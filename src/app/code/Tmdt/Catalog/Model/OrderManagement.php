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
     * Generate unique order code: DHxxxxxx (6 hex chars)
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
     */
    public function createOrder(
        string $customerEmail,
        string $customerName,
        float $totalAmount,
        string $itemsJson,
        string $shippingJson
    ): array {
        if ($totalAmount <= 0) {
            return ['success' => false, 'message' => 'Tổng tiền đơn hàng không hợp lệ.'];
        }

        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName(self::TABLE);

        $orderCode = $this->generateOrderCode();
        $expiresAt = date('Y-m-d H:i:s', time() + self::HOLD_MINUTES * 60);

        $connection->insert($table, [
            'order_code'     => $orderCode,
            'status'         => 'pending',
            'total_amount'   => $totalAmount,
            'items_json'     => $itemsJson,
            'customer_email' => $customerEmail,
            'customer_name'  => $customerName,
            'shipping_json'  => $shippingJson,
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

        // Auto-expire pending orders past their hold time
        if ($row['status'] === 'pending' && $row['expires_at'] && strtotime($row['expires_at']) < time()) {
            $connection->update($table, ['status' => 'expired'], ['order_code = ?' => $orderCode]);
            $row['status'] = 'expired';
            $connection->insert(
                $connection->getTableName('tmdt_order_status_history'),
                [
                    'order_code' => $orderCode,
                    'status'     => 'expired',
                    'comment'    => 'Đơn hàng hết hạn thanh toán (Quá thời gian giữ hàng 15 phút).',
                    'created_at' => date('Y-m-d H:i:s'),
                ]
            );
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
}
