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

        $expiresAt = date('Y-m-d H:i:s', time() + self::HOLD_MINUTES * 60);

        $items = json_decode($itemsJson, true) ?: [];
        $shippingData = json_decode($shippingJson, true) ?: [];

        $groups = [];
        foreach ($items as $item) {
            $sName = $item['supplierName'] ?? 'Tổng kho sỉ Thực phẩm B2B';
            $sRegion = $item['supplierRegion'] ?? 'Hà Nội';
            $supplierKey = $sName . ' · ' . $sRegion;
            $groups[$supplierKey][] = $item;
        }

        $childOrdersData = [];

        if (count($groups) > 1) {
            $parentCode = $this->generateOrderCode();
            $index = 0;
            $calculatedParentTotal = 0.0;

            foreach ($groups as $supplierKey => $groupItems) {
                $index++;
                $childCode = $parentCode . '-' . $index;
                $supplierShipping = $shippingData['suppliers'][$supplierKey] ?? [];

                $subtotal = 0.0;
                foreach ($groupItems as $item) {
                    $subtotal += (float)($item['quantity'] * $item['unitPrice']);
                }
                $shippingFee = (float)($supplierShipping['shippingFee'] ?? 0);
                $surcharge = (float)($supplierShipping['surcharge'] ?? 0);
                $childTotalAmount = $subtotal + $shippingFee + $surcharge;
                $calculatedParentTotal += $childTotalAmount;

                $connection->insert($table, [
                    'order_code'     => $childCode,
                    'parent_code'    => $parentCode,
                    'status'         => 'pending',
                    'total_amount'   => $childTotalAmount,
                    'items_json'     => json_encode($groupItems, JSON_UNESCAPED_UNICODE),
                    'customer_email' => $customerEmail,
                    'customer_name'  => $customerName,
                    'shipping_json'  => json_encode(array_merge($shippingData, ['supplier_info' => $supplierShipping]), JSON_UNESCAPED_UNICODE),
                    'expires_at'     => $expiresAt,
                    'created_at'     => date('Y-m-d H:i:s'),
                ]);

                $connection->insert(
                    $connection->getTableName('tmdt_order_status_history'),
                    [
                        'order_code' => $childCode,
                        'status'     => 'pending',
                        'comment'    => 'Đơn hàng con thuộc nhà cung cấp ' . $supplierKey . ' được tạo thành công. Chờ thanh toán.',
                        'created_at' => date('Y-m-d H:i:s'),
                    ]
                );

                $childOrdersData[] = [
                    'orderCode' => $childCode,
                    'supplier' => $supplierKey,
                    'subtotal' => $subtotal,
                    'totalAmount' => $childTotalAmount,
                    'items' => $groupItems
                ];
            }

            // Create parent order
            $connection->insert($table, [
                'order_code'     => $parentCode,
                'parent_code'    => 'parent',
                'status'         => 'pending',
                'total_amount'   => $calculatedParentTotal,
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
                    'order_code' => $parentCode,
                    'status'     => 'pending',
                    'comment'    => 'Đơn hàng tổng được tạo thành công. Chờ thanh toán qua SePay.',
                    'created_at' => date('Y-m-d H:i:s'),
                ]
            );

            return [
                'success'     => true,
                'orderCode'   => $parentCode,
                'totalAmount' => $calculatedParentTotal,
                'expiresAt'   => $expiresAt,
                'holdMinutes' => self::HOLD_MINUTES,
                'childOrders' => $childOrdersData
            ];
        } else {
            // Single supplier order
            $orderCode = $this->generateOrderCode();
            $connection->insert($table, [
                'order_code'     => $orderCode,
                'parent_code'    => null,
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

            $supplierKey = key($groups) ?: 'Tổng kho sỉ Thực phẩm B2B · Hà Nội';
            $subtotal = 0.0;
            foreach ($items as $item) {
                $subtotal += (float)($item['quantity'] * $item['unitPrice']);
            }

            $childOrdersData[] = [
                'orderCode' => $orderCode,
                'supplier' => $supplierKey,
                'subtotal' => $subtotal,
                'totalAmount' => $totalAmount,
                'items' => $items
            ];

            return [
                'success'     => true,
                'orderCode'   => $orderCode,
                'totalAmount' => $totalAmount,
                'expiresAt'   => $expiresAt,
                'holdMinutes' => self::HOLD_MINUTES,
                'childOrders' => $childOrdersData
            ];
        }
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
            // Also expire child orders if this is a parent order
            $connection->update($table, ['status' => 'expired'], ['parent_code = ?' => $orderCode]);
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

            // Also insert history logs for child orders
            $childOrders = $connection->fetchAll(
                "SELECT order_code FROM {$table} WHERE parent_code = ?",
                [$orderCode]
            );
            foreach ($childOrders as $childOrder) {
                $connection->insert(
                    $connection->getTableName('tmdt_order_status_history'),
                    [
                        'order_code' => $childOrder['order_code'],
                        'status'     => 'expired',
                        'comment'    => 'Đơn hàng con hết hạn thanh toán do đơn hàng tổng hết hạn.',
                        'created_at' => date('Y-m-d H:i:s'),
                    ]
                );
            }
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
     * Get list of warehouses (inventory sources) with coordinates from database.
     */
    public function getWarehouses(): array
    {
        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName('inventory_source');

        $rows = $connection->fetchAll(
            "SELECT name, latitude, longitude FROM {$table} WHERE enabled = 1 AND latitude IS NOT NULL AND longitude IS NOT NULL"
        );

        $warehouses = [];
        foreach ($rows as $row) {
            $warehouses[] = [
                'name' => $row['name'],
                'lat' => (float)$row['latitude'],
                'lon' => (float)$row['longitude'],
                'lng' => (float)$row['longitude']
            ];
        }

        return $warehouses;
    }
}

