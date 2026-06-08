<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Model;

use Magento\Framework\App\ResourceConnection;
use Tmdt\Catalog\Api\OrderManagementInterface;

class OrderManagement implements OrderManagementInterface
{
    private const TABLE = 'tmdt_orders';
    private const HOLD_MINUTES = 15;

    private readonly ResourceConnection $resourceConnection;
    private readonly \Tmdt\Catalog\Model\OrderProcessor $orderProcessor;
    private readonly \Magento\Customer\Model\Session $customerSession;
    private readonly \Magento\Framework\App\RequestInterface $request;

    public function __construct(
        ResourceConnection $resourceConnection,
        ?\Tmdt\Catalog\Model\OrderProcessor $orderProcessor = null,
        ?\Magento\Customer\Model\Session $customerSession = null,
        ?\Magento\Framework\App\RequestInterface $request = null
    ) {
        $objectManager = \Magento\Framework\App\ObjectManager::getInstance();
        $this->resourceConnection = $resourceConnection;
        $this->orderProcessor = $orderProcessor
            ?: $objectManager->get(\Tmdt\Catalog\Model\OrderProcessor::class);
        $this->customerSession = $customerSession
            ?: $objectManager->get(\Magento\Customer\Model\Session::class);
        $this->request = $request
            ?: $objectManager->get(\Magento\Framework\App\RequestInterface::class);
    }

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
     * Helper to save items to tmdt_order_items
     */
    private function saveOrderItems(int $orderId, array $items, $connection): void
    {
        $orderItemsTable = $connection->getTableName('tmdt_order_items');
        $productTable = $connection->getTableName('catalog_product_entity');
        $productVarcharTable = $connection->getTableName('catalog_product_entity_varchar');
        $attributeTable = $connection->getTableName('eav_attribute');

        $sellerAttrId = (int)$connection->fetchOne(
            "SELECT attribute_id FROM {$attributeTable} WHERE attribute_code = 'tmdt_seller_id' AND entity_type_id = 4 LIMIT 1"
        );

        foreach ($items as $item) {
            $sku = trim((string)($item['sku'] ?? ''));
            if (empty($sku)) {
                continue;
            }

            $productId = (int)$connection->fetchOne(
                "SELECT entity_id FROM {$productTable} WHERE sku = ?",
                [$sku]
            );

            if ($productId <= 0) {
                continue;
            }

            $sellerId = null;
            if ($sellerAttrId > 0) {
                $sellerVal = trim((string)$connection->fetchOne(
                    "SELECT value FROM {$productVarcharTable} WHERE entity_id = ? AND attribute_id = ? LIMIT 1",
                    [$productId, $sellerAttrId]
                ));
                if (!empty($sellerVal) && $sellerVal !== 'NONE' && is_numeric($sellerVal)) {
                    $sellerId = (int)$sellerVal;
                }
            }

            $qty = (float)($item['quantity'] ?? 0);
            $price = (float)($item['unitPrice'] ?? 0);
            $rowTotal = $qty * $price;

            $connection->insert($orderItemsTable, [
                'order_id'   => $orderId,
                'product_id' => $productId,
                'sku'        => $sku,
                'name'       => $item['name'] ?? $sku,
                'unit'       => $item['unit'] ?? 'kg',
                'quantity'   => $qty,
                'unit_price' => $price,
                'row_total'  => $rowTotal,
                'seller_id'  => $sellerId,
                'image'      => $item['image'] ?? null,
            ]);
        }
    }

    /**
     * POST /V1/tmdt-orders/create
     */
    public function createOrder(
        string $customerEmail,
        string $customerName,
        float $totalAmount,
        string $itemsJson,
        string $shippingJson,
        string $paymentMethod = 'bank_transfer'
    ): array {
        $paymentMethod = trim(strtolower($paymentMethod));
        if ($paymentMethod === 'cod') {
            $paymentMethod = 'direct_payment';
        }

        if ($totalAmount <= 0) {
            return ['success' => false, 'message' => 'Tổng tiền đơn hàng không hợp lệ.'];
        }

        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName(self::TABLE);

        // Fetch customer_id from email
        $customerTable = $connection->getTableName('customer_entity');
        $customerIdVal = $connection->fetchOne(
            "SELECT entity_id FROM {$customerTable} WHERE email = ? LIMIT 1",
            [$customerEmail]
        );
        $customerId = $customerIdVal ? (int)$customerIdVal : null;

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

            // Insert parent order first
            $connection->insert($table, [
                'order_code'     => $parentCode,
                'parent_code'    => 'parent',
                'parent_id'      => null,
                'status'         => 'pending',
                'total_amount'   => $totalAmount,
                'items_json'     => $itemsJson,
                'customer_email' => $customerEmail,
                'customer_name'  => $customerName,
                'customer_id'    => $customerId,
                'shipping_json'  => $shippingJson,
                'payment_method' => $paymentMethod,
                'expires_at'     => $expiresAt,
                'created_at'     => date('Y-m-d H:i:s'),
            ]);
            $parentId = (int)$connection->lastInsertId();

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
                    'parent_id'      => $parentId,
                    'status'         => 'pending',
                    'total_amount'   => $childTotalAmount,
                    'items_json'     => json_encode($groupItems, JSON_UNESCAPED_UNICODE),
                    'customer_email' => $customerEmail,
                    'customer_name'  => $customerName,
                    'customer_id'    => $customerId,
                    'shipping_json'  => json_encode(array_merge($shippingData, ['supplier_info' => $supplierShipping]), JSON_UNESCAPED_UNICODE),
                    'payment_method' => $paymentMethod,
                    'expires_at'     => $expiresAt,
                    'created_at'     => date('Y-m-d H:i:s'),
                ]);
                $childId = (int)$connection->lastInsertId();

                $connection->insert(
                    $connection->getTableName('tmdt_order_status_history'),
                    [
                        'order_code' => $childCode,
                        'order_id'   => $childId,
                        'status'     => 'pending',
                        'comment'    => 'Đơn hàng con thuộc nhà cung cấp ' . $supplierKey . ' được tạo thành công. Chờ thanh toán.',
                        'created_at' => date('Y-m-d H:i:s'),
                    ]
                );

                // Save normalized items
                $this->saveOrderItems($childId, $groupItems, $connection);

                $childOrdersData[] = [
                    'orderCode' => $childCode,
                    'supplier' => $supplierKey,
                    'subtotal' => $subtotal,
                    'totalAmount' => $childTotalAmount,
                    'items' => $groupItems
                ];
            }

            // Sync parent order total
            $connection->update(
                $table,
                ['total_amount' => $calculatedParentTotal],
                ['id = ?' => $parentId]
            );

            // Parent order history
            $connection->insert(
                $connection->getTableName('tmdt_order_status_history'),
                [
                    'order_code' => $parentCode,
                    'order_id'   => $parentId,
                    'status'     => 'pending',
                    'comment'    => 'Đơn hàng tổng được tạo thành công. Chờ thanh toán.',
                    'created_at' => date('Y-m-d H:i:s'),
                ]
            );

            // Save parent items
            $this->saveOrderItems($parentId, $items, $connection);

            if ($paymentMethod === 'direct_payment') {
                $this->orderProcessor->confirmOrder(
                    $parentCode,
                    'COD-' . $parentCode,
                    'processing',
                    'Đơn hàng thanh toán trực tiếp được xác nhận và đang xử lý.'
                );
            }

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
                'parent_id'      => null,
                'status'         => 'pending',
                'total_amount'   => $totalAmount,
                'items_json'     => $itemsJson,
                'customer_email' => $customerEmail,
                'customer_name'  => $customerName,
                'customer_id'    => $customerId,
                'shipping_json'  => $shippingJson,
                'payment_method' => $paymentMethod,
                'expires_at'     => $expiresAt,
                'created_at'     => date('Y-m-d H:i:s'),
            ]);
            $orderId = (int)$connection->lastInsertId();

            $connection->insert(
                $connection->getTableName('tmdt_order_status_history'),
                [
                    'order_code' => $orderCode,
                    'order_id'   => $orderId,
                    'status'     => 'pending',
                    'comment'    => 'Đơn hàng được tạo thành công. Chờ thanh toán.',
                    'created_at' => date('Y-m-d H:i:s'),
                ]
            );

            // Save items
            $this->saveOrderItems($orderId, $items, $connection);

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

            if ($paymentMethod === 'direct_payment') {
                $this->orderProcessor->confirmOrder(
                    $orderCode,
                    'COD-' . $orderCode,
                    'processing',
                    'Đơn hàng thanh toán trực tiếp được xác nhận và đang xử lý.'
                );
            }

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
            "SELECT id, order_code, status, total_amount, expires_at, paid_at FROM {$table} WHERE order_code = ?",
            [$orderCode]
        );

        if (!$row) {
            return ['success' => false, 'message' => 'Không tìm thấy đơn hàng.'];
        }

        $orderId = (int)$row['id'];

        // Auto-expire pending orders past their hold time
        if ($row['status'] === 'pending' && $row['expires_at'] && strtotime($row['expires_at']) < time()) {
            $connection->update($table, ['status' => 'expired'], ['id = ?' => $orderId]);
            $connection->update($table, ['status' => 'expired'], ['parent_id = ?' => $orderId]);
            $row['status'] = 'expired';

            $connection->insert(
                $connection->getTableName('tmdt_order_status_history'),
                [
                    'order_code' => $orderCode,
                    'order_id'   => $orderId,
                    'status'     => 'expired',
                    'comment'    => 'Đơn hàng hết hạn thanh toán (Quá thời gian giữ hàng 15 phút).',
                    'created_at' => date('Y-m-d H:i:s'),
                ]
            );

            // Also insert history logs for child orders
            $childOrders = $connection->fetchAll(
                "SELECT id, order_code FROM {$table} WHERE parent_id = ?",
                [$orderId]
            );
            foreach ($childOrders as $childOrder) {
                $connection->insert(
                    $connection->getTableName('tmdt_order_status_history'),
                    [
                        'order_code' => $childOrder['order_code'],
                        'order_id'   => (int)$childOrder['id'],
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

        // Ensure "Kho Bắc Giang" exists
        $bgExists = $connection->fetchOne("SELECT source_code FROM {$table} WHERE source_code = 'bac-giang'");
        if (!$bgExists) {
            $connection->insert($table, [
                'source_code' => 'bac-giang',
                'name' => 'Kho Bắc Giang',
                'enabled' => 1,
                'description' => 'Kho hàng tại Bắc Giang',
                'latitude' => 21.2730,
                'longitude' => 106.1946,
                'country_id' => 'VN',
                'postcode' => '230000',
                'use_default_carrier_config' => 1,
                'is_pickup_location_active' => 0
            ]);
        }

        // Ensure "Kho Bình Dương" exists
        $bdExists = $connection->fetchOne("SELECT source_code FROM {$table} WHERE source_code = 'binh-duong'");
        if (!$bdExists) {
            $connection->insert($table, [
                'source_code' => 'binh-duong',
                'name' => 'Kho Bình Dương',
                'enabled' => 1,
                'description' => 'Kho hàng tại Bình Dương',
                'latitude' => 10.9805,
                'longitude' => 106.6517,
                'country_id' => 'VN',
                'postcode' => '820000',
                'use_default_carrier_config' => 1,
                'is_pickup_location_active' => 0
            ]);
        }

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

    /**
     * @inheritDoc
     */
    public function confirmDirectPayment(string $orderCode): bool
    {
        $orderCode = trim($orderCode);
        if ($orderCode === '') {
            throw new \Magento\Framework\Exception\LocalizedException(__('Order code is required.'));
        }

        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName(self::TABLE);

        $order = $connection->fetchRow(
            "SELECT id, order_code, status, payment_method FROM {$table} WHERE order_code = ? LIMIT 1",
            [$orderCode]
        );

        if (!$order) {
            throw new \Magento\Framework\Exception\LocalizedException(__('Order not found.'));
        }

        if (($order['payment_method'] ?? '') !== 'direct_payment') {
            throw new \Magento\Framework\Exception\LocalizedException(__('This order is not a direct payment order.'));
        }

        $status = strtolower(trim((string)$order['status']));
        if (in_array($status, ['paid', 'delivered'], true)) {
            return true;
        }

        if (in_array($status, ['expired', 'cancelled', 'refunded'], true)) {
            throw new \Magento\Framework\Exception\LocalizedException(
                __('Order cannot be confirmed from status "%1".', $status)
            );
        }

        $sellerId = (int)$this->resolveCompanySellerId($this->getSellerIdFromSession());
        $itemCount = (int)$connection->fetchOne(
            "SELECT COUNT(*) FROM {$connection->getTableName('tmdt_order_items')} WHERE order_id = ? AND seller_id = ?",
            [(int)$order['id'], $sellerId]
        );

        if ($itemCount === 0) {
            throw new \Magento\Framework\Exception\LocalizedException(
                __('You do not have permission to confirm payment for this order.')
            );
        }

        $targetStatus = 'paid';
        if (in_array($status, ['preparing', 'shipping'], true)) {
            $targetStatus = 'delivered';
        }

        return $this->orderProcessor->confirmOrder(
            $orderCode,
            'COD-' . $orderCode,
            $targetStatus,
            'Direct payment has been collected by the seller.'
        );
    }

    /**
     * @inheritDoc
     */
    public function updateOrderFulfillment(string $orderCode, string $status): bool
    {
        $sellerId = (int)$this->resolveCompanySellerId($this->getSellerIdFromSession());
        $connection = $this->resourceConnection->getConnection();
        $oTable = $connection->getTableName(self::TABLE);
        $oiTable = $connection->getTableName('tmdt_order_items');

        // Validate target status
        $allowedStatuses = ['preparing', 'shipping', 'delivered'];
        if (!in_array($status, $allowedStatuses, true)) {
            throw new \Magento\Framework\Exception\LocalizedException(
                __('Trạng thái "%1" không hợp lệ. Chỉ chấp nhận: preparing, shipping, delivered.', $status)
            );
        }

        // Find the order
        $order = $connection->fetchRow(
            "SELECT id, status, order_code, parent_id FROM {$oTable} WHERE order_code = ? LIMIT 1",
            [$orderCode]
        );

        if (!$order) {
            throw new \Magento\Framework\Exception\LocalizedException(__('Không tìm thấy đơn hàng.'));
        }

        $orderId = (int)$order['id'];

        // Verify this seller owns at least one item in the order
        $itemCount = (int)$connection->fetchOne(
            "SELECT COUNT(*) FROM {$oiTable} WHERE order_id = ? AND seller_id = ?",
            [$orderId, $sellerId]
        );

        if ($itemCount === 0) {
            throw new \Magento\Framework\Exception\LocalizedException(
                __('Bạn không có quyền cập nhật trạng thái cho đơn hàng này.')
            );
        }

        // Validate status transition
        $currentStatus = strtolower(trim((string)$order['status']));
        $validTransitions = [
            'preparing' => ['paid', 'processing'],
            'shipping'  => ['preparing'],
            'delivered' => ['shipping'],
        ];

        if (!in_array($currentStatus, $validTransitions[$status] ?? [], true)) {
            $statusLabels = [
                'paid' => 'Đã thanh toán',
                'processing' => 'Đang xử lý',
                'preparing' => 'Đang chuẩn bị',
                'shipping' => 'Đang giao hàng',
                'delivered' => 'Đã giao hàng',
            ];
            throw new \Magento\Framework\Exception\LocalizedException(
                __('Không thể chuyển từ trạng thái "%1" sang "%2".', $statusLabels[$currentStatus] ?? $currentStatus, $statusLabels[$status] ?? $status)
            );
        }

        // Status label for log comments
        $commentMap = [
            'preparing' => 'Người bán đã xác nhận chuẩn bị đơn hàng.',
            'shipping'  => 'Đơn hàng đang được giao đến khách hàng.',
            'delivered' => 'Đơn hàng đã được giao thành công.',
        ];
        $comment = $commentMap[$status] ?? "Đơn hàng chuyển sang trạng thái {$status}";

        // Update order status
        $connection->update(
            $oTable,
            ['status' => $status],
            ['id = ?' => $orderId]
        );

        // Log status history
        $connection->insert(
            $connection->getTableName('tmdt_order_status_history'),
            [
                'order_code' => $orderCode,
                'order_id'   => $orderId,
                'status'     => $status,
                'comment'    => $comment,
                'created_at' => date('Y-m-d H:i:s'),
            ]
        );

        // Also update child orders if this is a parent order
        $childOrders = $connection->fetchAll(
            "SELECT id, order_code FROM {$oTable} WHERE parent_id = ?",
            [$orderId]
        );

        if ($childOrders) {
            $connection->update(
                $oTable,
                ['status' => $status],
                ['parent_id = ?' => $orderId]
            );

            foreach ($childOrders as $childOrder) {
                $connection->insert(
                    $connection->getTableName('tmdt_order_status_history'),
                    [
                        'order_code' => $childOrder['order_code'],
                        'order_id'   => (int)$childOrder['id'],
                        'status'     => $status,
                        'comment'    => "Đơn hàng con được cập nhật theo đơn hàng tổng {$orderCode}: {$comment}",
                        'created_at' => date('Y-m-d H:i:s'),
                    ]
                );
            }
        }

        return true;
    }

    /**
     * Resolve Seller ID from customer session or token
     */
    private function getSellerIdFromSession(): string
    {
        if ($this->customerSession->isLoggedIn()) {
            return (string)$this->customerSession->getCustomerId();
        }

        $token = '';
        $authHeader = $this->request->getHeader('Authorization');
        if ($authHeader) {
            if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                $token = trim($matches[1]);
            }
        }

        if ($token === '') {
            $token = trim((string)$this->request->getParam('token'));
        }

        if ($token !== '') {
            $connection = $this->resourceConnection->getConnection();
            $tableName = $connection->getTableName('oauth_token');
            $customerId = $connection->fetchOne(
                $connection->select()
                    ->from($tableName, ['customer_id'])
                    ->where('token = ?', $token)
                    ->limit(1)
            );
            if ($customerId) {
                return (string)$customerId;
            }
        }

        throw new \Magento\Framework\Exception\LocalizedException(__('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.'));
    }

    private function resolveCompanySellerId(string $customerId): string
    {
        $connection = $this->resourceConnection->getConnection();
        $registrationTable = $connection->getTableName('tmdt_customer_registration');
        $row = $connection->fetchRow(
            $connection->select()
                ->from($registrationTable, ['login_code'])
                ->where('customer_id = ?', (int)$customerId)
                ->limit(1)
        );

        $loginCode = is_array($row) ? trim((string)($row['login_code'] ?? '')) : '';
        if ($loginCode === '') {
            return $customerId;
        }

        $ownerIds = $connection->fetchCol(
            $connection->select()
                ->from($registrationTable, ['customer_id'])
                ->where('login_code = ?', $loginCode)
                ->where('role = ?', 'seller')
        );

        foreach ($ownerIds as $ownerId) {
            if ($this->customerHasOwnerPrivilege((int)$ownerId)) {
                return (string)$ownerId;
            }
        }

        return $customerId;
    }

    private function customerHasOwnerPrivilege(int $customerId): bool
    {
        if ($customerId <= 0) {
            return false;
        }

        try {
            $connection = $this->resourceConnection->getConnection();
            $entityTypeId = (int)$connection->fetchOne(
                "SELECT entity_type_id FROM {$connection->getTableName('eav_entity_type')} WHERE entity_type_code = 'customer' LIMIT 1"
            );
            if ($entityTypeId <= 0) {
                return false;
            }

            $attrs = $connection->fetchPairs(
                $connection->select()
                    ->from($connection->getTableName('eav_attribute'), ['attribute_code', 'attribute_id'])
                    ->where('entity_type_id = ?', $entityTypeId)
                    ->where('attribute_code IN (?)', ['is_owner', 'is_super_admin'])
            );
            if (!$attrs) {
                return false;
            }

            $values = $connection->fetchPairs(
                $connection->select()
                    ->from($connection->getTableName('customer_entity_int'), ['attribute_id', 'value'])
                    ->where('entity_id = ?', $customerId)
                    ->where('attribute_id IN (?)', array_values($attrs))
            );

            foreach ($attrs as $attributeId) {
                if (!empty($values[(int)$attributeId])) {
                    return true;
                }
            }
        } catch (\Throwable) {
            return false;
        }

        return false;
    }

    /**
     * @inheritDoc
     */
    public function confirmReceiptByCustomer(string $orderCode): bool
    {
        $orderCode = trim($orderCode);
        if ($orderCode === '') {
            throw new \Magento\Framework\Exception\LocalizedException(__('Mã đơn hàng không hợp lệ.'));
        }

        $customerId = (int)$this->getSellerIdFromSession();

        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName(self::TABLE);

        $order = $connection->fetchRow(
            "SELECT id, status, customer_id FROM {$table} WHERE order_code = ? LIMIT 1",
            [$orderCode]
        );

        if (!$order) {
            throw new \Magento\Framework\Exception\LocalizedException(__('Không tìm thấy đơn hàng.'));
        }

        // Verify that this order belongs to the logged in customer
        if ((int)$order['customer_id'] !== $customerId) {
            throw new \Magento\Framework\Exception\LocalizedException(
                __('Bạn không có quyền xác nhận đã nhận hàng cho đơn hàng này.')
            );
        }

        $currentStatus = strtolower(trim((string)$order['status']));
        if ($currentStatus === 'delivered') {
            return true;
        }

        // Only allow confirming receipt if the order is in 'shipping' status
        if ($currentStatus !== 'shipping') {
            throw new \Magento\Framework\Exception\LocalizedException(
                __('Đơn hàng phải ở trạng thái đang giao hàng mới có thể xác nhận đã nhận.')
            );
        }

        // Transition order status to 'delivered' using orderProcessor
        return $this->orderProcessor->confirmOrder(
            $orderCode,
            '',
            'delivered',
            'Khách hàng xác nhận đã nhận được hàng.'
        );
    }
}

