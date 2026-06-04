<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Controller\Webhook;

use Magento\Framework\App\Action\Action;
use Magento\Framework\App\Action\Context;
use Magento\Framework\App\Action\HttpPostActionInterface;
use Magento\Framework\App\CsrfAwareActionInterface;
use Magento\Framework\App\Request\InvalidRequestException;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Framework\App\ResourceConnection;
use Psr\Log\LoggerInterface;
use Magento\CatalogInventory\Api\StockRegistryInterface;
use Magento\Catalog\Api\ProductRepositoryInterface;
use Magento\Framework\Indexer\IndexerRegistry;
use Magento\Framework\App\Cache\TypeListInterface;

/**
 * SePay Webhook Controller
 * URL: /api/webhook/sepay
 */
class Sepay extends Action implements HttpPostActionInterface, CsrfAwareActionInterface
{
    private const TABLE = 'tmdt_orders';

    public function __construct(
        Context $context,
        private readonly JsonFactory $jsonFactory,
        private readonly ResourceConnection $resourceConnection,
        private readonly LoggerInterface $logger,
        private readonly StockRegistryInterface $stockRegistry,
        private readonly ProductRepositoryInterface $productRepository,
        private readonly IndexerRegistry $indexerRegistry,
        private readonly TypeListInterface $cacheTypeList
    ) {
        parent::__construct($context);
    }

    public function createCsrfValidationException(RequestInterface $request): ?InvalidRequestException
    {
        return null; // Disable CSRF for webhook
    }

    public function validateForCsrf(RequestInterface $request): ?bool
    {
        return true; // Allow all POST requests (SePay does not send CSRF token)
    }

    public function execute()
    {
        $result = $this->jsonFactory->create();

        try {
            // Restrict endpoint to only /api/webhook/sepay
            $pathInfo = rtrim($this->getRequest()->getPathInfo(), '/');
            if ($pathInfo !== '/api/webhook/sepay') {
                $this->logger->warning('[SePay Webhook] Access attempt on invalid route', ['path' => $pathInfo]);
                return $result->setData(['success' => false, 'message' => 'Endpoint not allowed']);
            }

            // Read raw POST body
            $rawBody = $this->getRequest()->getContent();
            if (empty($rawBody)) {
                return $result->setData(['success' => false, 'message' => 'Empty request body']);
            }

            $payload = json_decode($rawBody, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return $result->setData(['success' => false, 'message' => 'Invalid JSON payload']);
            }

            // SePay field mapping
            $content         = $payload['content'] ?? $payload['description'] ?? '';
            $transferAmount  = (float)($payload['transferAmount'] ?? 0);
            $transactionId   = (string)($payload['referenceCode'] ?? $payload['id'] ?? '');
            $transferType    = $payload['transferType'] ?? 'in';

            $this->logger->info('[SePay Webhook] Received', [
                'content'        => $content,
                'transferAmount' => $transferAmount,
                'transactionId'  => $transactionId,
                'transferType'   => $transferType,
            ]);

            // Only process incoming transfers
            if (strtolower($transferType) !== 'in') {
                return $result->setData(['success' => true, 'message' => 'Ignored: outbound transfer']);
            }

            // Extract order code from content (e.g. "THANHTOAN DH1A2B3C" or "THANHTOANDH1A2B3C")
            if (!preg_match('/DH[A-Z0-9]{6}\b/i', $content, $matches)) {
                $this->logger->warning('[SePay Webhook] No order code found in content', ['content' => $content]);
                return $result->setData(['success' => false, 'message' => 'Không tìm thấy mã đơn hàng trong nội dung chuyển khoản.']);
            }

            $orderCode = strtoupper($matches[0]);

            $connection = $this->resourceConnection->getConnection();
            $table = $connection->getTableName(self::TABLE);

            $row = $connection->fetchRow(
                "SELECT id, status, total_amount, items_json FROM {$table} WHERE order_code = ?",
                [$orderCode]
            );

            if (!$row) {
                $this->logger->warning('[SePay Webhook] Order not found', ['orderCode' => $orderCode]);
                return $result->setData(['success' => false, 'message' => "Không tìm thấy đơn hàng {$orderCode}."]);
            }

            if ($row['status'] === 'paid') {
                return $result->setData(['success' => true, 'message' => 'Đơn hàng đã được xác nhận trước đó.', 'orderCode' => $orderCode]);
            }

            if (in_array($row['status'], ['expired', 'cancelled'], true)) {
                return $result->setData(['success' => false, 'message' => "Đơn hàng {$orderCode} đã hết hạn hoặc bị hủy."]);
            }

            // Verify amount (allow ±2000đ tolerance)
            $expectedAmount = (float)$row['total_amount'];
            if ($transferAmount > 0 && abs($transferAmount - $expectedAmount) > 2000) {
                $this->logger->warning('[SePay Webhook] Amount mismatch', [
                    'orderCode'     => $orderCode,
                    'expected'      => $expectedAmount,
                    'received'      => $transferAmount,
                ]);
                return $result->setData([
                    'success' => false,
                    'message' => "Số tiền không khớp. Mong đợi: {$expectedAmount}đ, Nhận: {$transferAmount}đ.",
                ]);
            }

            // Mark as paid
            $connection->update(
                $table,
                [
                    'status'         => 'paid',
                    'transaction_id' => $transactionId,
                    'paid_at'        => date('Y-m-d H:i:s'),
                ],
                ['order_code = ?' => $orderCode]
            );

            // Log status history transition
            $connection->insert(
                $connection->getTableName('tmdt_order_status_history'),
                [
                    'order_code' => $orderCode,
                    'status'     => 'paid',
                    'comment'    => 'Thanh toán thành công. Đơn hàng chuyển sang trạng thái Đã thanh toán và Đang xử lý.',
                    'created_at' => date('Y-m-d H:i:s'),
                ]
            );

            // Process inventory updates
            $items = json_decode((string)($row['items_json'] ?? '[]'), true);
            $sellerRevenues = [];
            $sellerItems = [];

            if (is_array($items)) {
                foreach ($items as $item) {
                    $sku = isset($item['sku']) ? (string)$item['sku'] : '';
                    $qtySold = isset($item['quantity']) ? (float)$item['quantity'] : 0.0;
                    if (empty($sku) || $qtySold <= 0) {
                        continue;
                    }

                    try {
                        // 1. Get product info
                        $product = $this->productRepository->get($sku);
                        $productId = (int)$product->getId();
                        $sellerIdAttr = $product->getCustomAttribute('tmdt_seller_id');
                        $sellerId = $sellerIdAttr ? (string)$sellerIdAttr->getValue() : '';

                        if (!empty($sellerId) && $sellerId !== 'NONE') {
                            $unitPrice = isset($item['unitPrice']) ? (float)$item['unitPrice'] : (float)$product->getPrice();
                            $rowTotal = $qtySold * $unitPrice;
                            $sellerRevenues[$sellerId] = ($sellerRevenues[$sellerId] ?? 0.0) + $rowTotal;
                            $sellerItems[$sellerId][] = ($product->getName() ?: $sku) . ' (x' . $qtySold . ')';
                        }

                        // 2. Get current stock
                        $stockItem = $this->stockRegistry->getStockItemBySku($sku);
                        $qtyBefore = (float)$stockItem->getQty();
                        $qtyAfter = max(0.0, $qtyBefore - $qtySold);

                        // 3. Update stock level
                        $stockItem->setQty($qtyAfter);
                        $stockItem->setIsInStock($qtyAfter > 0);
                        $this->stockRegistry->updateStockItemBySku($sku, $stockItem);

                        // 4. Record log in tmdt_inventory_log
                        $connection->insert(
                            $connection->getTableName('tmdt_inventory_log'),
                            [
                                'sku' => $sku,
                                'action_type' => 'outbound',
                                'qty_change' => -$qtySold,
                                'qty_after' => $qtyAfter,
                                'note' => 'Hệ thống tự động trừ kho cho đơn hàng ' . $orderCode,
                                'created_at' => date('Y-m-d H:i:s')
                            ]
                        );

                        // 5. Reindex and flush cache for product
                        try {
                            $indexers = [
                                'catalog_category_product',
                                'catalog_product_category',
                                'catalog_product_price',
                                'catalogsearch_fulltext'
                            ];
                            foreach ($indexers as $indexerId) {
                                try {
                                    $indexer = $this->indexerRegistry->get($indexerId);
                                    $indexer->reindexRow($productId);
                                } catch (\Exception $e) {
                                    // Ignore indexer errors
                                }
                            }
                            
                            $cacheTypes = ['full_page', 'block_html', 'collections', 'graphql_query_resolver_result'];
                            foreach ($cacheTypes as $type) {
                                $this->cacheTypeList->cleanType($type);
                            }
                        } catch (\Exception $e) {
                            $this->logger->warning('[SePay Webhook] Failed to reindex/flush cache for SKU: ' . $sku);
                        }

                        // 6. Check if out of stock, send alert to seller
                        if ($qtyAfter <= 0) {
                            if (!empty($sellerId) && $sellerId !== 'NONE') {
                                try {
                                    $connection->insert(
                                        $connection->getTableName('tmdt_seller_notifications'),
                                        [
                                            'seller_id' => $sellerId,
                                            'sku' => $sku,
                                            'message' => 'Sản phẩm "' . $product->getName() . '" (SKU: ' . $sku . ') đã hết hàng.',
                                            'is_read' => 0,
                                            'created_at' => date('Y-m-d H:i:s')
                                        ]
                                    );
                                    $this->logger->info('[SePay Webhook] Out of stock warning created for seller: ' . $sellerId . ' SKU: ' . $sku);
                                } catch (\Exception $e) {
                                    $this->logger->error('[SePay Webhook] Failed to create out of stock warning: ' . $e->getMessage());
                                }
                            }
                        }

                    } catch (\Exception $e) {
                        $this->logger->error('[SePay Webhook] Failed to adjust stock for SKU: ' . $sku . ' error: ' . $e->getMessage());
                    }
                }
            }

            // Create seller notifications and write revenue transactions
            foreach ($sellerRevenues as $sellerId => $amount) {
                try {
                    $itemsList = implode(', ', $sellerItems[$sellerId]);
                    $formattedAmount = number_format($amount, 0, ',', '.') . 'đ';
                    
                    // Insert order notification
                    $connection->insert(
                        $connection->getTableName('tmdt_seller_notifications'),
                        [
                            'seller_id' => $sellerId,
                            'sku'       => $orderCode,
                            'message'   => "Bạn có đơn hàng mới {$orderCode}. Sản phẩm: {$itemsList}. Tổng doanh thu: {$formattedAmount}.",
                            'is_read'   => 0,
                            'created_at'=> date('Y-m-d H:i:s')
                        ]
                    );

                    // Insert revenue transaction
                    $connection->insert(
                        $connection->getTableName('tmdt_transactions'),
                        [
                            'order_code'     => $orderCode,
                            'transaction_id' => $transactionId,
                            'amount'         => $amount,
                            'seller_id'      => $sellerId,
                            'created_at'     => date('Y-m-d H:i:s')
                        ]
                    );

                    $this->logger->info("[SePay Webhook] Logged new order notification and revenue transaction for seller: {$sellerId}, amount: {$amount}");
                } catch (\Exception $e) {
                    $this->logger->error('[SePay Webhook] Failed to create seller order notification / transaction: ' . $e->getMessage());
                }
            }

            $this->logger->info('[SePay Webhook] Order marked as PAID', [
                'orderCode'     => $orderCode,
                'transactionId' => $transactionId,
                'amount'        => $transferAmount,
            ]);

            return $result->setData([
                'success'       => true,
                'message'       => 'Thanh toán xác nhận thành công.',
                'orderCode'     => $orderCode,
                'transactionId' => $transactionId,
            ]);

        } catch (\Throwable $e) {
            $this->logger->error('[SePay Webhook] Error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return $result->setData(['success' => false, 'message' => 'Internal server error: ' . $e->getMessage()]);
        }
    }
}
