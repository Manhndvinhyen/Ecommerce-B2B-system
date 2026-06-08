<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Model;

use Tmdt\Catalog\Api\RfqManagementInterface;
use Magento\Framework\App\ResourceConnection;
use Magento\Customer\Model\Session as CustomerSession;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\Exception\LocalizedException;

class RfqManagement implements RfqManagementInterface
{
    private const TABLE_RFQ = 'tmdt_rfq';
    private const TABLE_QUOTE = 'tmdt_rfq_quote';
    private const TABLE_MESSAGE = 'tmdt_rfq_message';

    public function __construct(
        private readonly ResourceConnection $resourceConnection,
        private readonly CustomerSession $customerSession,
        private readonly RequestInterface $request
    ) {}

    /**
     * Helper to resolve the current customer ID from session or Authorization header
     */
    private function getCurrentCustomerId(): int
    {
        if ($this->customerSession->isLoggedIn()) {
            return (int)$this->customerSession->getCustomerId();
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
                return (int)$customerId;
            }
        }

        throw new LocalizedException(__('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.'));
    }

    /**
     * Helper to check if a customer is an approved seller
     */
    private function verifyApprovedSeller(int $customerId): array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $connection->getTableName('tmdt_customer_registration');
        $seller = $connection->fetchRow(
            $connection->select()
                ->from($tableName)
                ->where('customer_id = ?', $customerId)
                ->limit(1)
        );

        if (!$seller || $seller['role'] !== 'seller' || $seller['status'] !== 'approved') {
            throw new LocalizedException(__('Tài khoản của bạn chưa được phê duyệt làm nhà cung cấp sỉ (Seller).'));
        }

        return $seller;
    }

    /**
     * @inheritDoc
     */
    public function createRfq(
        string $productName,
        float $quantity,
        string $unit,
        float $desiredPrice,
        string $shippingAddress,
        string $deliveryDate,
        string $expiryDate
    ): array {
        $customerId = $this->getCurrentCustomerId();
        $connection = $this->resourceConnection->getConnection();
        $tableName = $connection->getTableName(self::TABLE_RFQ);

        try {
            $connection->insert($tableName, [
                'customer_id' => $customerId,
                'product_name' => $productName,
                'quantity' => $quantity,
                'unit' => $unit,
                'desired_price' => $desiredPrice,
                'shipping_address' => $shippingAddress,
                'delivery_date' => $deliveryDate,
                'expiry_date' => $expiryDate,
                'status' => 'open',
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ]);
            
            return [
                'success' => true,
                'message' => 'Yêu cầu báo giá (RFQ) đã được tạo thành công!'
            ];
        } catch (\Exception $e) {
            throw new LocalizedException(__($e->getMessage()));
        }
    }

    /**
     * @inheritDoc
     */
    public function getBuyerRfqs(): array
    {
        $customerId = $this->getCurrentCustomerId();
        $connection = $this->resourceConnection->getConnection();
        $rfqTable = $connection->getTableName(self::TABLE_RFQ);
        $quoteTable = $connection->getTableName(self::TABLE_QUOTE);

        $select = $connection->select()
            ->from(['r' => $rfqTable])
            ->joinLeft(
                ['q' => $quoteTable],
                'r.id = q.rfq_id',
                ['quote_count' => 'COUNT(q.id)']
            )
            ->where('r.customer_id = ?', $customerId)
            ->group('r.id')
            ->order('r.created_at DESC');

        return $connection->fetchAll($select);
    }

    /**
     * @inheritDoc
     */
    public function getOpenRfqs(): array
    {
        $customerId = $this->getCurrentCustomerId();
        $this->verifyApprovedSeller($customerId);

        $connection = $this->resourceConnection->getConnection();
        $rfqTable = $connection->getTableName(self::TABLE_RFQ);
        $quoteTable = $connection->getTableName(self::TABLE_QUOTE);
        $customerTable = $connection->getTableName('customer_entity');

        // Fetch all open RFQs
        $select = $connection->select()
            ->from(['r' => $rfqTable])
            ->joinLeft(
                ['c' => $customerTable],
                'r.customer_id = c.entity_id',
                ['buyer_email' => 'c.email', 'buyer_name' => "CONCAT(c.firstname, ' ', c.lastname)"]
            )
            ->joinLeft(
                ['q' => $quoteTable],
                'r.id = q.rfq_id',
                ['quote_count' => 'COUNT(q.id)']
            )
            ->where('r.status = ?', 'open')
            ->group(['r.id', 'c.email', 'c.firstname', 'c.lastname'])
            ->order('r.created_at DESC');

        $rfqs = $connection->fetchAll($select);

        // For each RFQ, check if current seller has already quoted
        foreach ($rfqs as &$rfq) {
            $hasQuoted = $connection->fetchOne(
                $connection->select()
                    ->from($quoteTable, ['id'])
                    ->where('rfq_id = ?', (int)$rfq['id'])
                    ->where('seller_id = ?', $customerId)
                    ->limit(1)
            );
            $rfq['seller_quoted'] = $hasQuoted ? true : false;
        }

        return $rfqs;
    }

    /**
     * @inheritDoc
     */
    public function submitQuote(
        int $rfqId,
        float $price,
        float $quantity,
        string $deliveryDate,
        ?string $note = null
    ): array {
        $customerId = $this->getCurrentCustomerId();
        $seller = $this->verifyApprovedSeller($customerId);

        $connection = $this->resourceConnection->getConnection();
        $rfqTable = $connection->getTableName(self::TABLE_RFQ);
        $quoteTable = $connection->getTableName(self::TABLE_QUOTE);
        $messageTable = $connection->getTableName(self::TABLE_MESSAGE);

        // Verify RFQ is open
        $rfq = $connection->fetchRow(
            $connection->select()->from($rfqTable)->where('id = ?', $rfqId)->limit(1)
        );

        if (!$rfq) {
            throw new LocalizedException(__('Yêu cầu báo giá không tồn tại.'));
        }

        if ($rfq['status'] !== 'open') {
            throw new LocalizedException(__('Yêu cầu báo giá này đã đóng hoặc đã tạo đơn hàng.'));
        }

        $connection->beginTransaction();
        try {
            // Save Quote
            $connection->insert($quoteTable, [
                'rfq_id' => $rfqId,
                'seller_id' => $customerId,
                'price' => $price,
                'quantity' => $quantity,
                'delivery_date' => $deliveryDate,
                'note' => $note,
                'status' => 'pending',
                'created_at' => date('Y-m-d H:i:s')
            ]);
            $quoteId = (int)$connection->lastInsertId();

            // Auto-insert a negotiation chat message logs
            $formattedPrice = number_format($price, 0, ',', '.') . 'đ';
            $systemMessage = sprintf(
                "Nhà cung cấp %s gửi báo giá: %s / %s cho %s %s. (Giao hàng dự kiến: %s)",
                $seller['business_name'] ?: 'đối tác',
                $formattedPrice,
                $rfq['product_name'],
                $quantity,
                $rfq['unit'],
                date('d/m/Y', strtotime($deliveryDate))
            );

            if (!empty($note)) {
                $systemMessage .= "\nGhi chú: " . $note;
            }

            $connection->insert($messageTable, [
                'rfq_id' => $rfqId,
                'quote_id' => $quoteId,
                'sender_id' => $customerId,
                'sender_role' => 'seller',
                'message' => $systemMessage,
                'created_at' => date('Y-m-d H:i:s')
            ]);

            $connection->commit();
            return [
                'success' => true,
                'message' => 'Nộp báo giá thành công!'
            ];
        } catch (\Exception $e) {
            $connection->rollBack();
            throw new LocalizedException(__($e->getMessage()));
        }
    }

    /**
     * @inheritDoc
     */
    public function getQuotesForRfq(int $rfqId): array
    {
        $customerId = $this->getCurrentCustomerId();
        $connection = $this->resourceConnection->getConnection();
        $rfqTable = $connection->getTableName(self::TABLE_RFQ);
        $quoteTable = $connection->getTableName(self::TABLE_QUOTE);
        $regTable = $connection->getTableName('tmdt_customer_registration');

        // Check ownership of RFQ
        $rfq = $connection->fetchRow(
            $connection->select()->from($rfqTable)->where('id = ?', $rfqId)->limit(1)
        );

        if (!$rfq) {
            throw new LocalizedException(__('Yêu cầu báo giá không tồn tại.'));
        }

        if ((int)$rfq['customer_id'] !== $customerId) {
            throw new LocalizedException(__('Bạn không có quyền xem các báo giá của yêu cầu này.'));
        }

        $select = $connection->select()
            ->from(['q' => $quoteTable])
            ->joinLeft(
                ['reg' => $regTable],
                'q.seller_id = reg.customer_id',
                ['seller_name' => 'reg.business_name', 'seller_nickname' => 'reg.unit_nickname', 'seller_province' => 'reg.province']
            )
            ->where('q.rfq_id = ?', $rfqId)
            ->order('q.price ASC');

        return $connection->fetchAll($select);
    }

    /**
     * @inheritDoc
     */
    public function getSellerQuotes(): array
    {
        $customerId = $this->getCurrentCustomerId();
        $this->verifyApprovedSeller($customerId);

        $connection = $this->resourceConnection->getConnection();
        $rfqTable = $connection->getTableName(self::TABLE_RFQ);
        $quoteTable = $connection->getTableName(self::TABLE_QUOTE);

        $select = $connection->select()
            ->from(['q' => $quoteTable])
            ->joinInner(
                ['r' => $rfqTable],
                'q.rfq_id = r.id',
                ['product_name' => 'r.product_name', 'rfq_quantity' => 'r.quantity', 'rfq_unit' => 'r.unit', 'rfq_desired_price' => 'r.desired_price', 'rfq_status' => 'r.status']
            )
            ->where('q.seller_id = ?', $customerId)
            ->order('q.created_at DESC');

        return $connection->fetchAll($select);
    }

    /**
     * Helper to generate unique order code: DHxxxxxx (6 hex chars)
     */
    private function generateOrderCode(): string
    {
        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName('tmdt_orders');

        do {
            $code = 'DH' . strtoupper(substr(md5(uniqid((string)mt_rand(), true)), 0, 6));
            $existing = $connection->fetchOne("SELECT id FROM {$table} WHERE order_code = ?", [$code]);
        } while ($existing);

        return $code;
    }

    /**
     * @inheritDoc
     */
    public function acceptQuote(int $quoteId): array
    {
        $buyerId = $this->getCurrentCustomerId();
        $connection = $this->resourceConnection->getConnection();
        $rfqTable = $connection->getTableName(self::TABLE_RFQ);
        $quoteTable = $connection->getTableName(self::TABLE_QUOTE);
        $orderTable = $connection->getTableName('tmdt_orders');
        $orderItemsTable = $connection->getTableName('tmdt_order_items');
        $customerTable = $connection->getTableName('customer_entity');
        $regTable = $connection->getTableName('tmdt_customer_registration');

        // Fetch quote details
        $quote = $connection->fetchRow(
            $connection->select()->from($quoteTable)->where('id = ?', $quoteId)->limit(1)
        );

        if (!$quote) {
            throw new LocalizedException(__('Báo giá không tồn tại.'));
        }

        if ($quote['status'] !== 'pending') {
            throw new LocalizedException(__('Báo giá này đã được xử lý (Chấp nhận hoặc Từ chối).'));
        }

        $rfqId = (int)$quote['rfq_id'];

        // Fetch RFQ details
        $rfq = $connection->fetchRow(
            $connection->select()->from($rfqTable)->where('id = ?', $rfqId)->limit(1)
        );

        if (!$rfq) {
            throw new LocalizedException(__('Yêu cầu báo giá liên quan không tồn tại.'));
        }

        if ((int)$rfq['customer_id'] !== $buyerId) {
            throw new LocalizedException(__('Bạn không có quyền chấp nhận báo giá này.'));
        }

        if ($rfq['status'] !== 'open') {
            throw new LocalizedException(__('Yêu cầu báo giá này đã đóng hoặc đã được đặt hàng trước đó.'));
        }

        // Fetch Buyer details
        $buyer = $connection->fetchRow(
            $connection->select()
                ->from($customerTable, ['email', 'firstname', 'lastname'])
                ->where('entity_id = ?', $buyerId)
                ->limit(1)
        );
        $buyerEmail = $buyer ? $buyer['email'] : 'buyer_' . $buyerId . '@example.com';
        $buyerName = $buyer ? trim($buyer['firstname'] . ' ' . $buyer['lastname']) : 'Khách hàng RFQ';

        // Fetch Seller details
        $sellerId = (int)$quote['seller_id'];
        $seller = $connection->fetchRow(
            $connection->select()->from($regTable)->where('customer_id = ?', $sellerId)->limit(1)
        );
        $sellerName = $seller ? ($seller['business_name'] ?: $seller['unit_nickname']) : 'Nhà cung cấp B2B';
        $sellerRegion = $seller ? $seller['province'] : 'Hà Nội';

        // Fetch Buyer phone (if any)
        $buyerReg = $connection->fetchRow(
            $connection->select()->from($regTable)->where('customer_id = ?', $buyerId)->limit(1)
        );
        $buyerPhone = $buyerReg ? $buyerReg['phone_number'] : '';

        // Transactional update & order placement
        $connection->beginTransaction();
        try {
            // 1. Update accepted quote status
            $connection->update(
                $quoteTable,
                ['status' => 'accepted'],
                ['id = ?' => $quoteId]
            );

            // 2. Reject other quotes for this RFQ
            $connection->update(
                $quoteTable,
                ['status' => 'rejected'],
                ['rfq_id = ?' => $rfqId, 'status = ?' => 'pending']
            );

            // 3. Mark RFQ as ordered
            $connection->update(
                $rfqTable,
                ['status' => 'ordered', 'updated_at' => date('Y-m-d H:i:s')],
                ['id = ?' => $rfqId]
            );

            // 4. Resolve fallback product ID to satisfy tmdt_order_items foreign key constraints
            // Find a product where name matches RFQ product name (or matches partly)
            $productTable = $connection->getTableName('catalog_product_entity');
            $productVarcharTable = $connection->getTableName('catalog_product_entity_varchar');
            $attrTable = $connection->getTableName('eav_attribute');

            $nameAttrId = (int)$connection->fetchOne(
                $connection->select()
                    ->from($attrTable, ['attribute_id'])
                    ->where('attribute_code = ?', 'name')
                    ->where('entity_type_id = ?', 4)
                    ->limit(1)
            );

            $productId = null;
            if ($nameAttrId > 0) {
                // Find matching product id
                $productId = $connection->fetchOne(
                    $connection->select()
                        ->from(['cpev' => $productVarcharTable], ['entity_id'])
                        ->where('cpev.attribute_id = ?', $nameAttrId)
                        ->where('cpev.value LIKE ?', '%' . $rfq['product_name'] . '%')
                        ->limit(1)
                );
            }

            if (!$productId) {
                // Let's get any product id from product table to satisfy FK constraint
                $productId = $connection->fetchOne(
                    $connection->select()->from($productTable, ['entity_id'])->limit(1)
                );
            }

            if (!$productId) {
                throw new LocalizedException(__('Không tìm thấy bất kỳ sản phẩm nào trong Catalog của hệ thống để liên kết làm Foreign Key. Vui lòng tạo ít nhất 1 sản phẩm trước.'));
            }

            $productId = (int)$productId;

            // Fetch SKU for selected product
            $sku = (string)$connection->fetchOne(
                $connection->select()->from($productTable, ['sku'])->where('entity_id = ?', $productId)->limit(1)
            );

            // 5. Generate Order and Order Items
            $orderCode = $this->generateOrderCode();
            $totalAmount = (float)$quote['price'] * (float)$quote['quantity'];

            // Prepare items JSON for tmdt_orders
            $itemsJsonArray = [
                [
                    'sku' => $sku,
                    'name' => $rfq['product_name'],
                    'quantity' => (float)$quote['quantity'],
                    'unitPrice' => (float)$quote['price'],
                    'unit' => $rfq['unit'],
                    'supplierName' => $sellerName,
                    'supplierRegion' => $sellerRegion
                ]
            ];

            // Prepare shipping JSON
            $shippingJsonArray = [
                'address' => $rfq['shipping_address'],
                'receiver' => $buyerName,
                'phone' => $buyerPhone,
                'note' => 'Đơn hàng tự động tạo từ RFQ #' . $rfqId,
                'deliveryDate' => date('Y-m-d', strtotime((string)$quote['delivery_date'])),
                'deliveryTime' => 'Trong giờ hành chính',
                'suppliers' => [
                    $sellerName . ' · ' . $sellerRegion => [
                        'shippingFee' => 0,
                        'surcharge' => 0
                    ]
                ]
            ];

            // Insert Order
            $connection->insert($orderTable, [
                'order_code' => $orderCode,
                'parent_code' => null,
                'parent_id' => null,
                'customer_id' => $buyerId,
                'status' => 'pending',
                'total_amount' => $totalAmount,
                'items_json' => json_encode($itemsJsonArray, JSON_UNESCAPED_UNICODE),
                'customer_email' => $buyerEmail,
                'customer_name' => $buyerName,
                'shipping_json' => json_encode($shippingJsonArray, JSON_UNESCAPED_UNICODE),
                'payment_method' => 'bank_transfer',
                'expires_at' => date('Y-m-d H:i:s', time() + 24 * 3600), // B2B order hold 24h
                'created_at' => date('Y-m-d H:i:s')
            ]);
            $orderId = (int)$connection->lastInsertId();

            // Insert Order Item
            $connection->insert($orderItemsTable, [
                'order_id' => $orderId,
                'product_id' => $productId,
                'sku' => $sku,
                'name' => $rfq['product_name'],
                'unit' => $rfq['unit'],
                'quantity' => (float)$quote['quantity'],
                'unit_price' => (float)$quote['price'],
                'row_total' => $totalAmount,
                'seller_id' => $sellerId,
                'image' => null
            ]);

            // Insert Order Status History
            $connection->insert(
                $connection->getTableName('tmdt_order_status_history'),
                [
                    'order_code' => $orderCode,
                    'order_id' => $orderId,
                    'status' => 'pending',
                    'comment' => 'Đơn hàng được tạo tự động từ RFQ #' . $rfqId . ' do chấp nhận báo giá của ' . $sellerName . '.',
                    'created_at' => date('Y-m-d H:i:s')
                ]
            );

            // Add auto-message in the chat log
            $systemMessage = sprintf(
                "Người mua đã CHẤP NHẬN báo giá số #%d của nhà cung cấp %s. Đơn hàng %s đã được tạo tự động.",
                $quoteId,
                $sellerName,
                $orderCode
            );
            $connection->insert($connection->getTableName(self::TABLE_MESSAGE), [
                'rfq_id' => $rfqId,
                'quote_id' => $quoteId,
                'sender_id' => $buyerId,
                'sender_role' => 'buyer',
                'message' => $systemMessage,
                'created_at' => date('Y-m-d H:i:s')
            ]);

            $connection->commit();
            return [
                'success' => true,
                'message' => 'Chấp nhận báo giá thành công! Đơn hàng ' . $orderCode . ' đã được tạo.',
                'order_code' => $orderCode
            ];
        } catch (\Exception $e) {
            $connection->rollBack();
            throw new LocalizedException(__($e->getMessage()));
        }
    }

    /**
     * @inheritDoc
     */
    public function addRfqMessage(int $rfqId, string $message, ?int $quoteId = null): array
    {
        $customerId = $this->getCurrentCustomerId();
        $connection = $this->resourceConnection->getConnection();
        $rfqTable = $connection->getTableName(self::TABLE_RFQ);
        $quoteTable = $connection->getTableName(self::TABLE_QUOTE);
        $messageTable = $connection->getTableName(self::TABLE_MESSAGE);

        // Fetch RFQ
        $rfq = $connection->fetchRow(
            $connection->select()->from($rfqTable)->where('id = ?', $rfqId)->limit(1)
        );

        if (!$rfq) {
            throw new LocalizedException(__('Yêu cầu báo giá không tồn tại.'));
        }

        // Determine Sender Role
        $senderRole = null;
        if ((int)$rfq['customer_id'] === $customerId) {
            $senderRole = 'buyer';
        } else {
            // Check if user is an approved seller
            try {
                $this->verifyApprovedSeller($customerId);
                $senderRole = 'seller';
            } catch (\Exception $ex) {
                throw new LocalizedException(__('Bạn không có quyền gửi tin nhắn trong yêu cầu báo giá này.'));
            }
        }

        // If sender is a seller and quoteId is provided, verify they own the quote
        if ($senderRole === 'seller' && $quoteId) {
            $quote = $connection->fetchRow(
                $connection->select()->from($quoteTable)->where('id = ?', $quoteId)->limit(1)
            );
            if (!$quote || (int)$quote['seller_id'] !== $customerId) {
                throw new LocalizedException(__('Báo giá không tồn tại hoặc bạn không có quyền trên báo giá này.'));
            }
        }

        try {
            $connection->insert($messageTable, [
                'rfq_id' => $rfqId,
                'quote_id' => $quoteId,
                'sender_id' => $customerId,
                'sender_role' => $senderRole,
                'message' => $message,
                'created_at' => date('Y-m-d H:i:s')
            ]);

            return [
                'success' => true,
                'message' => 'Gửi tin nhắn thành công!'
            ];
        } catch (\Exception $e) {
            throw new LocalizedException(__($e->getMessage()));
        }
    }

    /**
     * @inheritDoc
     */
    public function getRfqMessages(int $rfqId, ?int $quoteId = null): array
    {
        $customerId = $this->getCurrentCustomerId();
        $connection = $this->resourceConnection->getConnection();
        $rfqTable = $connection->getTableName(self::TABLE_RFQ);
        $quoteTable = $connection->getTableName(self::TABLE_QUOTE);
        $messageTable = $connection->getTableName(self::TABLE_MESSAGE);
        $customerTable = $connection->getTableName('customer_entity');
        $regTable = $connection->getTableName('tmdt_customer_registration');

        // Fetch RFQ
        $rfq = $connection->fetchRow(
            $connection->select()->from($rfqTable)->where('id = ?', $rfqId)->limit(1)
        );

        if (!$rfq) {
            throw new LocalizedException(__('Yêu cầu báo giá không tồn tại.'));
        }

        // Check Access: Buyer of the RFQ can view any message in the RFQ.
        // A seller can only view messages where they are the sender, OR messages belonging to their specific quote thread.
        $isBuyer = ((int)$rfq['customer_id'] === $customerId);
        $isSeller = false;

        try {
            $this->verifyApprovedSeller($customerId);
            $isSeller = true;
        } catch (\Exception $e) {
            // Not a seller
        }

        if (!$isBuyer && !$isSeller) {
            throw new LocalizedException(__('Bạn không có quyền truy cập hội thoại này.'));
        }

        $select = $connection->select()
            ->from(['m' => $messageTable])
            ->joinLeft(
                ['c' => $customerTable],
                'm.sender_id = c.entity_id',
                ['sender_name' => "CONCAT(c.firstname, ' ', c.lastname)"]
            )
            ->joinLeft(
                ['reg' => $regTable],
                'm.sender_id = reg.customer_id',
                ['seller_name' => 'reg.business_name', 'seller_nickname' => 'reg.unit_nickname']
            )
            ->where('m.rfq_id = ?', $rfqId);

        // Security filtering for sellers
        if (!$isBuyer && $isSeller) {
            // Seller can see:
            // 1. Messages in their quote threads:
            // Let's find quotes submitted by this seller for this RFQ
            $sellerQuotes = $connection->fetchCol(
                $connection->select()
                    ->from($quoteTable, ['id'])
                    ->where('rfq_id = ?', $rfqId)
                    ->where('seller_id = ?', $customerId)
            );

            if (empty($sellerQuotes)) {
                // Seller hasn't submitted any quotes, can only see messages without quoteId (general messages)
                $select->where('m.quote_id IS NULL AND m.sender_id = ?', $customerId);
            } else {
                $quoteIdsStr = implode(',', array_map('intval', $sellerQuotes));
                $select->where("(m.quote_id IN ({$quoteIdsStr}) OR m.quote_id IS NULL)");
            }
        } else {
            // Buyer can filter by quoteId if they only want chat history for a specific supplier
            if ($quoteId) {
                $select->where('m.quote_id = ? OR m.quote_id IS NULL', $quoteId);
            }
        }

        $select->order('m.created_at ASC');
        return $connection->fetchAll($select);
    }
}
