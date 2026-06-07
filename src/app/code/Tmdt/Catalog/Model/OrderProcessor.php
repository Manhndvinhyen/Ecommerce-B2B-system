<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Model;

use Magento\Framework\App\ResourceConnection;
use Psr\Log\LoggerInterface;
use Magento\CatalogInventory\Api\StockRegistryInterface;
use Magento\Catalog\Api\ProductRepositoryInterface;
use Magento\Framework\Indexer\IndexerRegistry;
use Magento\Framework\App\Cache\TypeListInterface;

class OrderProcessor
{
    private const TABLE = 'tmdt_orders';

    public function __construct(
        private readonly ResourceConnection $resourceConnection,
        private readonly LoggerInterface $logger,
        private readonly StockRegistryInterface $stockRegistry,
        private readonly ProductRepositoryInterface $productRepository,
        private readonly IndexerRegistry $indexerRegistry,
        private readonly TypeListInterface $cacheTypeList
    ) {}

    /**
     * Confirm payment/order status and process stock reduction, alerts, and transaction records.
     *
     * @param string $orderCode
     * @param string $transactionId
     * @param string $status
     * @param string $comment
     * @return bool
     */
    public function confirmOrder(string $orderCode, string $transactionId, string $status = 'paid', string $comment = ''): bool
    {
        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName(self::TABLE);

        $row = $connection->fetchRow(
            "SELECT id, status, total_amount FROM {$table} WHERE order_code = ?",
            [$orderCode]
        );

        if (!$row) {
            $this->logger->warning('[OrderProcessor] Order not found', ['orderCode' => $orderCode]);
            return false;
        }

        if ($row['status'] === $status || $row['status'] === 'paid') {
            return true; // Already processed
        }

        $orderId = (int)$row['id'];

        // Update parent order status
        $connection->update(
            $table,
            [
                'status'         => $status,
                'transaction_id' => $transactionId,
                'paid_at'        => date('Y-m-d H:i:s'),
            ],
            ['id = ?' => $orderId]
        );

        // Log status history transition for parent
        $connection->insert(
            $connection->getTableName('tmdt_order_status_history'),
            [
                'order_code' => $orderCode,
                'order_id'   => $orderId,
                'status'     => $status,
                'comment'    => $comment ?: "Đơn hàng chuyển sang trạng thái " . $status,
                'created_at' => date('Y-m-d H:i:s'),
            ]
        );

        // Fetch any child orders
        $childOrders = $connection->fetchAll(
            "SELECT id, order_code FROM {$table} WHERE parent_id = ?",
            [$orderId]
        );

        if ($childOrders) {
            // Mark all child orders as same status
            $connection->update(
                $table,
                [
                    'status'         => $status,
                    'transaction_id' => $transactionId,
                    'paid_at'        => date('Y-m-d H:i:s'),
                ],
                ['parent_id = ?' => $orderId]
            );

            // Add status history for each child order
            foreach ($childOrders as $childOrder) {
                $connection->insert(
                    $connection->getTableName('tmdt_order_status_history'),
                    [
                        'order_code' => $childOrder['order_code'],
                        'order_id'   => (int)$childOrder['id'],
                        'status'     => $status,
                        'comment'    => "Đơn hàng con được cập nhật theo đơn hàng tổng " . $orderCode,
                        'created_at' => date('Y-m-d H:i:s'),
                    ]
                );
            }
        }

        // Identify which orders to process for inventory and seller revenue
        $ordersToProcess = [];
        if ($childOrders) {
            foreach ($childOrders as $childOrder) {
                $ordersToProcess[] = [
                    'id'         => (int)$childOrder['id'],
                    'order_code' => $childOrder['order_code']
                ];
            }
        } else {
            $ordersToProcess[] = [
                'id'         => $orderId,
                'order_code' => $orderCode
            ];
        }

        $orderItemsTable = $connection->getTableName('tmdt_order_items');

        foreach ($ordersToProcess as $orderInfo) {
            $currentOrderId = $orderInfo['id'];
            $currentOrderCode = $orderInfo['order_code'];
            
            // Read items from normalized relational table
            $items = $connection->fetchAll(
                "SELECT product_id, sku, name, unit, quantity, unit_price, row_total, seller_id FROM {$orderItemsTable} WHERE order_id = ?",
                [$currentOrderId]
            );

            $sellerRevenues = [];
            $sellerItems = [];
            $oldStatus = $row['status'];

            if (is_array($items)) {
                foreach ($items as $item) {
                    $sku = isset($item['sku']) ? (string)$item['sku'] : '';
                    $productId = (int)$item['product_id'];
                    $sellerId = $item['seller_id'] !== null ? (int)$item['seller_id'] : null;
                    $qtySold = (float)$item['quantity'];
                    $rowTotal = (float)$item['row_total'];

                    if ($productId <= 0 || $qtySold <= 0) {
                        continue;
                    }

                    if ($sellerId !== null) {
                        $sellerRevenues[$sellerId] = ($sellerRevenues[$sellerId] ?? 0.0) + $rowTotal;
                        $sellerItems[$sellerId][] = ($item['name'] ?: $sku) . ' (x' . $qtySold . ')';
                    }

                    // Only decrement stock if transitioning from 'pending' status
                    if ($oldStatus === 'pending') {
                        try {
                            // Get current stock
                            $stockItem = $this->stockRegistry->getStockItem($productId);
                            $qtyBefore = (float)$stockItem->getQty();
                            $qtyAfter = max(0.0, $qtyBefore - $qtySold);

                            // Update stock level
                            $stockItem->setQty($qtyAfter);
                            $stockItem->setIsInStock($qtyAfter > 0);
                            $this->stockRegistry->updateStockItemBySku($sku, $stockItem);

                            // Record log in tmdt_inventory_log using relation IDs
                            $connection->insert(
                                $connection->getTableName('tmdt_inventory_log'),
                                [
                                    'product_id'     => $productId,
                                    'sku'            => $sku,
                                    'action_type'    => 'outbound',
                                    'qty_change'     => -$qtySold,
                                    'qty_after'      => $qtyAfter,
                                    'reference_type' => 'order',
                                    'reference_id'   => $currentOrderCode,
                                    'note'           => 'Hệ thống tự động trừ kho cho đơn hàng ' . $currentOrderCode,
                                    'created_at'     => date('Y-m-d H:i:s')
                                ]
                            );

                            // Reindex and flush cache for product
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
                                $this->logger->warning('[OrderProcessor] Failed to reindex/flush cache for SKU: ' . $sku);
                            }

                            // Check if out of stock, send alert to seller
                            if ($qtyAfter <= 0) {
                                if ($sellerId !== null) {
                                    try {
                                        $connection->insert(
                                            $connection->getTableName('tmdt_seller_notifications'),
                                            [
                                                'seller_id'          => (string)$sellerId,
                                                'seller_customer_id' => $sellerId,
                                                'sku'                => $sku,
                                                'message'            => 'Sản phẩm "' . $item['name'] . '" (SKU: ' . $sku . ') đã hết hàng.',
                                                'is_read'            => 0,
                                                'created_at'         => date('Y-m-d H:i:s')
                                            ]
                                        );
                                    } catch (\Exception $e) {
                                        $this->logger->error('[OrderProcessor] Failed to create out of stock warning: ' . $e->getMessage());
                                    }
                                }
                            }

                        } catch (\Exception $e) {
                            $this->logger->error('[OrderProcessor] Failed to adjust stock for SKU: ' . $sku . ' error: ' . $e->getMessage());
                        }
                    }
                }
            }

            // Only notify seller if transitioning from 'pending' status
            if ($oldStatus === 'pending') {
                foreach ($sellerRevenues as $sellerId => $amount) {
                    try {
                        $itemsList = implode(', ', $sellerItems[$sellerId]);
                        $formattedAmount = number_format($amount, 0, ',', '.') . 'đ';
                        
                        // Insert order notification
                        $connection->insert(
                            $connection->getTableName('tmdt_seller_notifications'),
                            [
                                'seller_id'          => (string)$sellerId,
                                'seller_customer_id' => $sellerId,
                                'sku'                => $currentOrderCode,
                                'message'            => "Bạn có đơn hàng mới {$currentOrderCode}. Sản phẩm: {$itemsList}. Tổng doanh thu: {$formattedAmount}.",
                                'is_read'            => 0,
                                'created_at'         => date('Y-m-d H:i:s')
                            ]
                        );
                    } catch (\Exception $e) {
                        $this->logger->error('[OrderProcessor] Failed to create seller order notification: ' . $e->getMessage());
                    }
                }
            }

            // Only record transactions and credit available balances if the status transitions to 'paid'
            if ($status === 'paid') {
                foreach ($sellerRevenues as $sellerId => $amount) {
                    try {
                        // Insert revenue transaction
                        $connection->insert(
                            $connection->getTableName('tmdt_transactions'),
                            [
                                'order_code'         => $currentOrderCode,
                                'order_id'           => $currentOrderId,
                                'transaction_id'     => $transactionId,
                                'amount'             => $amount,
                                'seller_id'          => (string)$sellerId,
                                'seller_customer_id' => $sellerId,
                                'status'             => 'success',
                                'created_at'         => date('Y-m-d H:i:s')
                            ]
                        );

                        // Update seller balance table
                        $balanceTable = $connection->getTableName('tmdt_seller_balance');
                        $exists = $connection->fetchRow(
                            "SELECT id, available_balance FROM {$balanceTable} WHERE seller_id = ?",
                            [$sellerId]
                        );
                        
                        if ($exists) {
                            $connection->update(
                                $balanceTable,
                                ['available_balance' => (float)$exists['available_balance'] + $amount],
                                ['seller_id = ?' => $sellerId]
                            );
                        } else {
                            $connection->insert(
                                $balanceTable,
                                [
                                    'seller_id'         => $sellerId,
                                    'available_balance' => $amount,
                                    'pending_balance'   => 0.00
                                ]
                            );
                        }
                    } catch (\Exception $e) {
                        $this->logger->error('[OrderProcessor] Failed to create transaction / balance: ' . $e->getMessage());
                    }
                }
            }
        }

        return true;
    }
}
