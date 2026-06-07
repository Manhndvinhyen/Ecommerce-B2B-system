<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Model;

use Magento\Customer\Api\CustomerRepositoryInterface;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Exception\AuthorizationException;
use Magento\Framework\Exception\InputException;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Serialize\Serializer\Json;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Integration\Model\Oauth\TokenFactory;
use Tmdt\Catalog\Api\RfqManagementInterface;

class RfqManagement implements RfqManagementInterface
{
    private const REQUEST_TABLE = 'tmdt_rfq_request';
    private const QUOTE_TABLE = 'tmdt_rfq_quote';
    private const REGISTRATION_TABLE = 'tmdt_customer_registration';
    private const AUTH_HEADER = 'Authorization';

    public function __construct(
        private readonly ResourceConnection $resourceConnection,
        private readonly RestRequest $request,
        private readonly TokenFactory $tokenFactory,
        private readonly CustomerRepositoryInterface $customerRepository,
        private readonly Json $serializer
    ) {
    }

    public function createRequest(): array
    {
        $buyerId = $this->getCustomerIdFromRequest();
        $payload = $this->getPayload();
        $productName = trim((string) ($payload['productName'] ?? ''));
        if ($productName === '') {
            throw new InputException(__('Ten san pham can bao gia la bat buoc.'));
        }

        $quantity = (float) ($payload['quantity'] ?? 1);
        if ($quantity <= 0) {
            throw new InputException(__('So luong can mua phai lon hon 0.'));
        }

        $buyer = $this->customerRepository->getById($buyerId);
        $buyerName = trim((string) $buyer->getFirstname() . ' ' . (string) $buyer->getLastname());
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::REQUEST_TABLE);
        $connection->insert($tableName, [
            'buyer_id' => $buyerId,
            'buyer_name' => $buyerName,
            'buyer_email' => (string) $buyer->getEmail(),
            'product_name' => $productName,
            'category' => trim((string) ($payload['category'] ?? '')),
            'quantity' => $quantity,
            'unit' => trim((string) ($payload['unit'] ?? '')),
            'delivery_region' => trim((string) ($payload['deliveryRegion'] ?? '')),
            'needed_by' => $this->normalizeDate($payload['neededBy'] ?? null),
            'target_price' => $this->nullableFloat($payload['targetPrice'] ?? null),
            'description' => trim((string) ($payload['description'] ?? '')),
            'image_url' => trim((string) ($payload['imageUrl'] ?? '')),
            'status' => 'open',
        ]);

        return [
            'success' => true,
            'message' => (string) __('Da gui yeu cau bao gia.'),
            'request_id' => (int) $connection->lastInsertId($tableName),
        ];
    }

    public function getSellerRequests(): array
    {
        $sellerId = $this->getCustomerIdFromRequest();
        $this->assertSeller($sellerId);
        $connection = $this->resourceConnection->getConnection();
        $requestTable = $this->resourceConnection->getTableName(self::REQUEST_TABLE);
        $quoteTable = $this->resourceConnection->getTableName(self::QUOTE_TABLE);
        $query = trim((string) $this->request->getParam('query'));
        $status = trim((string) $this->request->getParam('status'));

        $select = $connection->select()
            ->from(['r' => $requestTable])
            ->joinLeft(
                ['q' => $quoteTable],
                'q.request_id = r.request_id AND q.seller_id = ' . (int) $sellerId,
                [
                    'my_quote_id' => 'quote_id',
                    'my_unit_price' => 'unit_price',
                    'my_available_quantity' => 'available_quantity',
                    'my_delivery_time' => 'delivery_time',
                    'my_quality_grade' => 'quality_grade',
                    'my_quote_status' => 'status',
                ]
            )
            ->order('r.created_at DESC');

        if ($status !== '' && $status !== 'all') {
            $select->where('r.status = ?', $status);
        }
        if ($query !== '') {
            $like = '%' . $query . '%';
            $quotedLike = $connection->quote($like);
            $select->where(
                '(r.product_name LIKE ' . $quotedLike .
                ' OR r.category LIKE ' . $quotedLike .
                ' OR r.delivery_region LIKE ' . $quotedLike . ')'
            );
        }

        return [
            'success' => true,
            'items' => array_map([$this, 'mapRequestRow'], $connection->fetchAll($select)),
        ];
    }

    public function getBuyerRequests(): array
    {
        $buyerId = $this->getCustomerIdFromRequest();
        $connection = $this->resourceConnection->getConnection();
        $requestTable = $this->resourceConnection->getTableName(self::REQUEST_TABLE);
        $quoteTable = $this->resourceConnection->getTableName(self::QUOTE_TABLE);

        $rows = $connection->fetchAll(
            $connection->select()
                ->from(['r' => $requestTable])
                ->where('r.buyer_id = ?', $buyerId)
                ->order('r.created_at DESC')
        );

        $items = [];
        foreach ($rows as $row) {
            $request = $this->mapRequestRow($row);
            $quotes = $connection->fetchAll(
                $connection->select()
                    ->from($quoteTable)
                    ->where('request_id = ?', (int) ($row['request_id'] ?? 0))
                    ->order('unit_price ASC')
            );
            $request['quotes'] = array_map([$this, 'mapQuoteRow'], $quotes);
            $items[] = $request;
        }

        return [
            'success' => true,
            'items' => $items,
        ];
    }

    public function submitQuote(): array
    {
        $sellerId = $this->getCustomerIdFromRequest();
        $this->assertSeller($sellerId);
        $payload = $this->getPayload();
        $requestId = (int) ($payload['requestId'] ?? 0);
        if ($requestId <= 0) {
            throw new InputException(__('Yeu cau bao gia khong hop le.'));
        }

        $unitPrice = (float) ($payload['unitPrice'] ?? 0);
        if ($unitPrice <= 0) {
            throw new InputException(__('Gia bao la bat buoc.'));
        }

        $connection = $this->resourceConnection->getConnection();
        $requestTable = $this->resourceConnection->getTableName(self::REQUEST_TABLE);
        $quoteTable = $this->resourceConnection->getTableName(self::QUOTE_TABLE);
        $exists = (int) $connection->fetchOne(
            $connection->select()->from($requestTable, ['request_id'])->where('request_id = ?', $requestId)->limit(1)
        );
        if ($exists <= 0) {
            throw new InputException(__('Khong tim thay yeu cau bao gia.'));
        }

        $seller = $this->customerRepository->getById($sellerId);
        $sellerName = trim((string) $seller->getFirstname() . ' ' . (string) $seller->getLastname());
        $existingQuoteId = (int) $connection->fetchOne(
            $connection->select()
                ->from($quoteTable, ['quote_id'])
                ->where('request_id = ?', $requestId)
                ->where('seller_id = ?', $sellerId)
                ->limit(1)
        );

        $quoteData = [
            'request_id' => $requestId,
            'seller_id' => $sellerId,
            'seller_name' => $sellerName,
            'unit_price' => $unitPrice,
            'available_quantity' => $this->nullableFloat($payload['availableQuantity'] ?? null),
            'delivery_time' => trim((string) ($payload['deliveryTime'] ?? '')),
            'quality_grade' => trim((string) ($payload['qualityGrade'] ?? '')),
            'description' => trim((string) ($payload['description'] ?? '')),
            'image_url' => trim((string) ($payload['imageUrl'] ?? '')),
            'status' => 'submitted',
        ];

        if ($existingQuoteId > 0) {
            $connection->update($quoteTable, $quoteData, ['quote_id = ?' => $existingQuoteId]);
            $quoteId = $existingQuoteId;
        } else {
            $connection->insert($quoteTable, $quoteData);
            $quoteId = (int) $connection->lastInsertId($quoteTable);
        }

        $connection->update($requestTable, ['status' => 'quoted'], ['request_id = ?' => $requestId]);

        return [
            'success' => true,
            'message' => (string) __('Da gui bao gia.'),
            'quote_id' => $quoteId,
        ];
    }

    private function assertSeller(int $customerId): void
    {
        $row = $this->getRegistrationByCustomerId($customerId);
        $role = strtolower(trim((string) ($row['role'] ?? '')));
        $status = strtolower(trim((string) ($row['status'] ?? '')));
        if (!in_array($role, ['seller', 'branch'], true) || $status !== 'approved') {
            throw new AuthorizationException(__('Chi tai khoan ban hang da duyet moi co quyen bao gia.'));
        }
    }

    private function getRegistrationByCustomerId(int $customerId): ?array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::REGISTRATION_TABLE);
        $row = $connection->fetchRow(
            $connection->select()->from($tableName)->where('customer_id = ?', $customerId)->limit(1)
        );
        return is_array($row) ? $row : null;
    }

    private function getCustomerIdFromRequest(): int
    {
        $token = $this->extractToken();
        if ($token === '') {
            throw new AuthorizationException(__('Ban can dang nhap.'));
        }

        $tokenModel = $this->tokenFactory->create()->loadByToken($token);
        $customerId = (int) $tokenModel->getCustomerId();
        if ($customerId <= 0) {
            throw new AuthorizationException(__('Token khong hop le hoac da het han.'));
        }

        return $customerId;
    }

    private function extractToken(): string
    {
        $header = trim((string) ($this->request->getHeader(self::AUTH_HEADER) ?? ''));
        if ($header !== '' && preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
            return trim((string) ($matches[1] ?? ''));
        }

        $payload = $this->getPayload();
        return trim((string) ($payload['token'] ?? ''));
    }

    private function getPayload(): array
    {
        $bodyParams = $this->request->getBodyParams();
        if (is_array($bodyParams) && isset($bodyParams['payload']) && is_array($bodyParams['payload'])) {
            return $bodyParams['payload'];
        }
        if (is_array($bodyParams)) {
            return $bodyParams;
        }

        $content = (string) $this->request->getContent();
        if ($content === '') {
            return [];
        }
        try {
            $decoded = $this->serializer->unserialize($content);
        } catch (\Throwable) {
            return [];
        }
        return is_array($decoded) ? $decoded : [];
    }

    private function mapRequestRow(array $row): array
    {
        return [
            'request_id' => (int) ($row['request_id'] ?? 0),
            'buyer_id' => (int) ($row['buyer_id'] ?? 0),
            'buyer_name' => (string) ($row['buyer_name'] ?? ''),
            'buyer_email' => (string) ($row['buyer_email'] ?? ''),
            'product_name' => (string) ($row['product_name'] ?? ''),
            'category' => (string) ($row['category'] ?? ''),
            'quantity' => (float) ($row['quantity'] ?? 0),
            'unit' => (string) ($row['unit'] ?? ''),
            'delivery_region' => (string) ($row['delivery_region'] ?? ''),
            'needed_by' => (string) ($row['needed_by'] ?? ''),
            'target_price' => isset($row['target_price']) ? (float) $row['target_price'] : null,
            'description' => (string) ($row['description'] ?? ''),
            'image_url' => (string) ($row['image_url'] ?? ''),
            'status' => (string) ($row['status'] ?? ''),
            'created_at' => (string) ($row['created_at'] ?? ''),
            'my_quote_id' => isset($row['my_quote_id']) ? (int) $row['my_quote_id'] : null,
            'my_unit_price' => isset($row['my_unit_price']) ? (float) $row['my_unit_price'] : null,
            'my_available_quantity' => isset($row['my_available_quantity']) ? (float) $row['my_available_quantity'] : null,
            'my_delivery_time' => (string) ($row['my_delivery_time'] ?? ''),
            'my_quality_grade' => (string) ($row['my_quality_grade'] ?? ''),
            'my_quote_status' => (string) ($row['my_quote_status'] ?? ''),
        ];
    }

    private function mapQuoteRow(array $row): array
    {
        return [
            'quote_id' => (int) ($row['quote_id'] ?? 0),
            'request_id' => (int) ($row['request_id'] ?? 0),
            'seller_id' => (int) ($row['seller_id'] ?? 0),
            'seller_name' => (string) ($row['seller_name'] ?? ''),
            'unit_price' => (float) ($row['unit_price'] ?? 0),
            'available_quantity' => isset($row['available_quantity']) ? (float) $row['available_quantity'] : null,
            'delivery_time' => (string) ($row['delivery_time'] ?? ''),
            'quality_grade' => (string) ($row['quality_grade'] ?? ''),
            'description' => (string) ($row['description'] ?? ''),
            'image_url' => (string) ($row['image_url'] ?? ''),
            'status' => (string) ($row['status'] ?? ''),
            'created_at' => (string) ($row['created_at'] ?? ''),
        ];
    }

    private function normalizeDate(mixed $value): ?string
    {
        $date = trim((string) $value);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) ? $date : null;
    }

    private function nullableFloat(mixed $value): ?float
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }
        return (float) $value;
    }
}
