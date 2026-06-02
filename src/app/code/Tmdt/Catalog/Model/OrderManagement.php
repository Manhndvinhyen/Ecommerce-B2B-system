<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Model;

use Magento\Framework\App\ResourceConnection;
use Tmdt\Catalog\Api\OrderManagementInterface;

class OrderManagement implements OrderManagementInterface
{
    private const TABLE = 'tmdt_orders';
    private const HOLD_MINUTES = 15;

    public function __construct(
        private readonly ResourceConnection $resourceConnection
    ) {}

    /**
     * Generate unique order code: DH-XXXXXX (6 digit random suffix).
     */
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

    /**
     * POST /V1/tmdt-orders/create
     * Body: { items, totalAmount, customerEmail, customerName, shippingInfo, deliveryDate, deliveryTime }
     */
    public function createOrder(array $orderData): array
    {
        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName(self::TABLE);

        $totalAmount = (float)($orderData['totalAmount'] ?? 0);
        if ($totalAmount <= 0) {
            return ['success' => false, 'message' => 'Tổng tiền đơn hàng không hợp lệ.'];
        }

        $orderCode = $this->generateOrderCode();
        $expiresAt = date('Y-m-d H:i:s', time() + self::HOLD_MINUTES * 60);

        $connection->insert($table, [
            'order_code'     => $orderCode,
            'status'         => 'pending',
            'total_amount'   => $totalAmount,
            'items_json'     => json_encode($orderData['items'] ?? [], JSON_UNESCAPED_UNICODE),
            'customer_email' => $orderData['customerEmail'] ?? '',
            'customer_name'  => $orderData['customerName'] ?? '',
            'shipping_json'  => json_encode($orderData['shippingInfo'] ?? [], JSON_UNESCAPED_UNICODE),
            'expires_at'     => $expiresAt,
            'created_at'     => date('Y-m-d H:i:s'),
        ]);

        return [
            'success'     => true,
            'orderCode'   => $orderCode,
            'totalAmount' => $totalAmount,
            'expiresAt'   => $expiresAt,
            'holdMinutes' => self::HOLD_MINUTES,
        ];
    }

    /**
     * GET /V1/tmdt-orders/status/:orderCode
     */
    public function getOrderStatus(string $orderCode): array
    {
        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName(self::TABLE);

        $row = $connection->fetchRow(
            "SELECT order_code, status, total_amount, expires_at, paid_at FROM {$table} WHERE order_code = ?",
            [$orderCode]
        );

        if (!$row) {
            return ['success' => false, 'message' => 'Không tìm thấy đơn hàng.'];
        }

        // Auto-expire pending orders whose hold time has elapsed
        if ($row['status'] === 'pending' && $row['expires_at'] && strtotime($row['expires_at']) < time()) {
            $connection->update(
                $table,
                ['status' => 'expired'],
                ['order_code = ?' => $orderCode]
            );
            $row['status'] = 'expired';
        }

        return [
            'success'     => true,
            'orderCode'   => $row['order_code'],
            'status'      => $row['status'],
            'totalAmount' => (float)$row['total_amount'],
            'expiresAt'   => $row['expires_at'],
            'paidAt'      => $row['paid_at'],
        ];
    }

    /**
     * POST /V1/tmdt-orders/webhook (SePay format)
     * SePay payload fields: id, gateway, transactionDate, accountNumber,
     *   code, content, transferType, transferAmount, accumulated, referenceCode,
     *   description, subAccount, referenceNumber
     */
    public function handleWebhook(array $payload): array
    {
        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName(self::TABLE);

        // Extract order code from transfer content (e.g. "THANHTOAN DH1A2B3C")
        $content = $payload['content'] ?? $payload['description'] ?? '';
        $transactionId = (string)($payload['referenceNumber'] ?? $payload['id'] ?? '');
        $transferAmount = (float)($payload['transferAmount'] ?? 0);

        if (!preg_match('/\bDH[A-Z0-9]{6}\b/i', $content, $matches)) {
            return ['success' => false, 'message' => 'Không tìm thấy mã đơn hàng trong nội dung chuyển khoản.'];
        }

        $orderCode = strtoupper($matches[0]);

        $row = $connection->fetchRow(
            "SELECT id, status, total_amount FROM {$table} WHERE order_code = ?",
            [$orderCode]
        );

        if (!$row) {
            return ['success' => false, 'message' => "Không tìm thấy đơn hàng {$orderCode}."];
        }

        if ($row['status'] === 'paid') {
            return ['success' => true, 'message' => 'Đơn hàng đã được xác nhận trước đó.', 'orderCode' => $orderCode];
        }

        if ($row['status'] === 'expired' || $row['status'] === 'cancelled') {
            return ['success' => false, 'message' => "Đơn hàng {$orderCode} đã hết hạn hoặc bị hủy."];
        }

        // Verify amount (allow ±1000đ tolerance for bank fees)
        $expectedAmount = (float)$row['total_amount'];
        if (abs($transferAmount - $expectedAmount) > 1000) {
            return [
                'success' => false,
                'message' => "Số tiền không khớp. Mong đợi: {$expectedAmount}, Nhận: {$transferAmount}.",
            ];
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

        return [
            'success'       => true,
            'message'       => 'Thanh toán xác nhận thành công.',
            'orderCode'     => $orderCode,
            'transactionId' => $transactionId,
        ];
    }
}
