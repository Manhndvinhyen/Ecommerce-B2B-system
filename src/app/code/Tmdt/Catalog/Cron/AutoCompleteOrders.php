<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Cron;

use Magento\Framework\App\ResourceConnection;
use Tmdt\Catalog\Model\OrderProcessor;

class AutoCompleteOrders
{
    public function __construct(
        private readonly ResourceConnection $resourceConnection,
        private readonly OrderProcessor $orderProcessor
    ) {}

    /**
     * Auto complete orders in shipping status for > 3 days
     *
     * @return void
     */
    public function execute(): void
    {
        try {
            $connection = $this->resourceConnection->getConnection();
            $table = $connection->getTableName('tmdt_orders');
            $historyTable = $connection->getTableName('tmdt_order_status_history');

            $shippingOrders = $connection->fetchAll(
                "SELECT id, order_code FROM {$table} WHERE status = 'shipping'"
            );

            if (empty($shippingOrders)) {
                return;
            }

            $threeDaysAgo = time() - (3 * 24 * 60 * 60);

            foreach ($shippingOrders as $order) {
                $orderId = (int)$order['id'];
                $orderCode = (string)$order['order_code'];

                $shippingTime = $connection->fetchOne(
                    "SELECT created_at FROM {$historyTable} WHERE order_id = ? AND status = 'shipping' ORDER BY id DESC LIMIT 1",
                    [$orderId]
                );

                if ($shippingTime) {
                    $shippingTimestamp = strtotime($shippingTime);
                    if ($shippingTimestamp < $threeDaysAgo) {
                        $this->orderProcessor->confirmOrder(
                            $orderCode,
                            '',
                            'delivered',
                            'Hệ thống tự động hoàn thành đơn hàng sau 3 ngày giao hàng (Cron).'
                        );
                    }
                }
            }
        } catch (\Throwable) {
            // Ignore
        }
    }
}
