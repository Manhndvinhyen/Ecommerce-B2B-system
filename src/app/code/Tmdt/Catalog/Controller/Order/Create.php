<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Controller\Order;

use Magento\Framework\App\Action\HttpPostActionInterface;
use Magento\Framework\App\CsrfAwareActionInterface;
use Magento\Framework\App\Request\InvalidRequestException;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Framework\App\ResourceConnection;
use Psr\Log\LoggerInterface;

/**
 * Create Order Controller – POST /tmdt/order/create
 * Reads raw JSON body: { customerEmail, customerName, totalAmount, itemsJson, shippingJson }
 */
class Create implements HttpPostActionInterface, CsrfAwareActionInterface
{
    private const TABLE = 'tmdt_orders';
    private const HOLD_MINUTES = 15;

    public function __construct(
        private readonly RequestInterface $request,
        private readonly JsonFactory $jsonFactory,
        private readonly ResourceConnection $resourceConnection,
        private readonly LoggerInterface $logger
    ) {}

    public function createCsrfValidationException(RequestInterface $request): ?InvalidRequestException
    {
        return null;
    }

    public function validateForCsrf(RequestInterface $request): ?bool
    {
        return true;
    }

    private function generateOrderCode(): string
    {
        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName(self::TABLE);
        do {
            $code = 'DH' . strtoupper(substr(md5(uniqid((string)mt_rand(), true)), 0, 6));
            $existing = $connection->fetchOne("SELECT id FROM {$table} WHERE order_code = ?", [$code]);
        } while ($existing);
        return $code;
    }

    public function execute()
    {
        $result = $this->jsonFactory->create();
        try {
            $rawBody = $this->request->getContent();
            if (empty($rawBody)) {
                return $result->setData(['success' => false, 'message' => 'Empty request body']);
            }
            $data = json_decode($rawBody, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return $result->setData(['success' => false, 'message' => 'Invalid JSON']);
            }

            $totalAmount = (float)($data['totalAmount'] ?? 0);
            if ($totalAmount <= 0) {
                return $result->setData(['success' => false, 'message' => 'Tổng tiền không hợp lệ.']);
            }

            $connection = $this->resourceConnection->getConnection();
            $table = $connection->getTableName(self::TABLE);
            $orderCode = $this->generateOrderCode();
            $expiresAt = date('Y-m-d H:i:s', time() + self::HOLD_MINUTES * 60);

            $connection->insert($table, [
                'order_code'     => $orderCode,
                'status'         => 'pending',
                'total_amount'   => $totalAmount,
                'items_json'     => $data['itemsJson'] ?? '[]',
                'customer_email' => $data['customerEmail'] ?? '',
                'customer_name'  => $data['customerName'] ?? '',
                'shipping_json'  => $data['shippingJson'] ?? '{}',
                'expires_at'     => $expiresAt,
                'created_at'     => date('Y-m-d H:i:s'),
            ]);

            $connection->insert(
                $connection->getTableName('tmdt_order_status_history'),
                [
                    'order_code' => $orderCode,
                    'status'     => 'pending',
                    'comment'    => 'Đơn hàng được tạo thành công. Chờ thanh toán.',
                    'created_at' => date('Y-m-d H:i:s'),
                ]
            );

            $this->logger->info('[Order] Created order', ['orderCode' => $orderCode, 'amount' => $totalAmount]);

            return $result->setData([
                'success'     => true,
                'orderCode'   => $orderCode,
                'totalAmount' => $totalAmount,
                'expiresAt'   => $expiresAt,
                'holdMinutes' => self::HOLD_MINUTES,
            ]);
        } catch (\Throwable $e) {
            $this->logger->error('[Order] Create error: ' . $e->getMessage());
            return $result->setData(['success' => false, 'message' => $e->getMessage()]);
        }
    }
}
