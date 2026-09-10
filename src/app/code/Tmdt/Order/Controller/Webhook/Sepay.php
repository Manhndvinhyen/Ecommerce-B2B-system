<?php
declare(strict_types=1);

namespace Tmdt\Order\Controller\Webhook;

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
        private readonly \Tmdt\Order\Model\OrderProcessor $orderProcessor
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

            // Mark parent as paid and process inventory/etc via OrderProcessor
            $confirmed = $this->orderProcessor->confirmOrder(
                $orderCode,
                $transactionId,
                'paid',
                'Thanh toán thành công. Đơn hàng tổng chuyển sang trạng thái Đã thanh toán và Đang xử lý.'
            );

            if (!$confirmed) {
                return $result->setData(['success' => false, 'message' => 'Không thể xử lý xác nhận đơn hàng.']);
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
