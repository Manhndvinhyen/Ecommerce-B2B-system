<?php
declare(strict_types=1);

namespace Tmdt\Order\Controller\Order;

use Magento\Framework\App\Action\HttpGetActionInterface;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Framework\App\ResourceConnection;

/**
 * Get Order Status – GET /tmdt/order/status?code=DH1A2B3C
 */
class Status implements HttpGetActionInterface
{
    private const TABLE = 'tmdt_orders';

    public function __construct(
        private readonly RequestInterface $request,
        private readonly JsonFactory $jsonFactory,
        private readonly ResourceConnection $resourceConnection
    ) {}

    public function execute()
    {
        $result = $this->jsonFactory->create();
        $orderCode = strtoupper(trim((string)$this->request->getParam('code', '')));

        if (!$orderCode) {
            return $result->setData(['success' => false, 'message' => 'Missing order code']);
        }

        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName(self::TABLE);

        $row = $connection->fetchRow(
            "SELECT id, order_code, status, total_amount, expires_at, paid_at FROM {$table} WHERE order_code = ?",
            [$orderCode]
        );

        if (!$row) {
            return $result->setData(['success' => false, 'message' => 'Không tìm thấy đơn hàng.']);
        }

        $orderId = (int)$row['id'];

        // Auto-expire
        if ($row['status'] === 'pending' && $row['expires_at'] && strtotime($row['expires_at']) < time()) {
            $connection->update($table, ['status' => 'expired'], ['id = ?' => $orderId]);
            $connection->update($table, ['status' => 'expired'], ['parent_id = ?' => $orderId]);
            $row['status'] = 'expired';

            $connection->insert(
                $connection->getTableName('tmdt_order_status_history'),
                [
                    'order_id'   => $orderId,
                    'order_code' => $orderCode,
                    'status'     => 'expired',
                    'comment'    => 'Đơn hàng hết hạn thanh toán (Quá thời gian giữ hàng 15 phút).',
                    'created_at' => date('Y-m-d H:i:s'),
                ]
            );

            // Also expire child orders status history
            $childOrders = $connection->fetchAll(
                "SELECT id, order_code FROM {$table} WHERE parent_id = ?",
                [$orderId]
            );
            foreach ($childOrders as $childOrder) {
                $connection->insert(
                    $connection->getTableName('tmdt_order_status_history'),
                    [
                        'order_id'   => (int)$childOrder['id'],
                        'order_code' => $childOrder['order_code'],
                        'status'     => 'expired',
                        'comment'    => 'Đơn hàng con hết hạn thanh toán do đơn hàng tổng hết hạn.',
                        'created_at' => date('Y-m-d H:i:s'),
                    ]
                );
            }
        }

        return $result->setData([
            'success'     => true,
            'orderCode'   => $row['order_code'],
            'status'      => $row['status'],
            'totalAmount' => (float)$row['total_amount'],
            'expiresAt'   => $row['expires_at'],
            'paidAt'      => $row['paid_at'],
        ]);
    }
}
