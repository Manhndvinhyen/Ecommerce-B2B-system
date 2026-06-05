<?php

declare(strict_types=1);

namespace Tmdt\Search\Model;

use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Exception\AuthorizationException;
use Magento\Framework\Exception\InputException;
use Magento\Framework\Serialize\Serializer\Json;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Integration\Model\Oauth\TokenFactory;
use Tmdt\Search\Api\PurchaseHistoryInterface;

class PurchaseHistoryManagement implements PurchaseHistoryInterface
{
    private const HISTORY_TABLE = 'tmdt_purchase_history';
    private const ITEM_TABLE = 'tmdt_purchase_history_item';
    private const AUTH_HEADER = 'Authorization';

    public function __construct(
        private readonly ResourceConnection $resourceConnection,
        private readonly RestRequest $request,
        private readonly TokenFactory $tokenFactory,
        private readonly Json $serializer
    ) {
    }

    public function get(): array
    {
        $customerId = $this->getCustomerIdFromRequest();
        $connection = $this->resourceConnection->getConnection();
        $historyTable = $this->resourceConnection->getTableName(self::HISTORY_TABLE);
        $itemTable = $this->resourceConnection->getTableName(self::ITEM_TABLE);
        $orderTable = $this->resourceConnection->getTableName('tmdt_orders');
        $limit = max(1, min(50, (int) ($this->request->getParam('limit') ?: 20)));

        $orders = $connection->fetchAll(
            $connection->select()
                ->from($historyTable)
                ->where('customer_id = ?', $customerId)
                ->order('created_at DESC')
                ->limit($limit)
        );

        $historyIds = array_map(fn (array $row): int => (int) $row['history_id'], $orders);
        $orderReferences = array_values(array_filter(array_map(
            static fn (array $row): string => trim((string) ($row['order_reference'] ?? '')),
            $orders
        )));
        $itemsByHistory = [];
        if ($historyIds) {
            $items = $connection->fetchAll(
                $connection->select()
                    ->from($itemTable)
                    ->where('history_id IN (?)', $historyIds)
                    ->order('item_id ASC')
            );
            foreach ($items as $item) {
                $itemsByHistory[(int) $item['history_id']][] = $this->formatItem($item);
            }
        }

        $ordersByReference = [];
        if ($orderReferences) {
            $orderRows = $connection->fetchAll(
                $connection->select()
                    ->from($orderTable, ['order_code', 'status', 'transaction_id', 'expires_at', 'paid_at', 'customer_name', 'shipping_json', 'parent_code'])
                    ->where('order_code IN (?)', $orderReferences)
            );

            foreach ($orderRows as $orderRow) {
                $ordersByReference[trim((string) ($orderRow['order_code'] ?? ''))] = [
                    'status' => strtolower(trim((string) ($orderRow['status'] ?? 'pending'))),
                    'transaction_id' => trim((string) ($orderRow['transaction_id'] ?? '')),
                    'expires_at' => (string) ($orderRow['expires_at'] ?? ''),
                    'paid_at' => (string) ($orderRow['paid_at'] ?? ''),
                    'customer_name' => trim((string) ($orderRow['customer_name'] ?? '')),
                    'shipping_info' => $this->decodeJsonObject((string) ($orderRow['shipping_json'] ?? '')),
                    'parent_code' => trim((string) ($orderRow['parent_code'] ?? '')),
                ];
            }
        }

        return [
            'success' => true,
            'items' => array_map(function (array $order) use ($itemsByHistory, $ordersByReference): array {
                $historyId = (int) $order['history_id'];
                $orderReference = (string) $order['order_reference'];
                $orderMeta = $ordersByReference[$orderReference] ?? [
                    'status' => 'pending',
                    'transaction_id' => '',
                    'expires_at' => '',
                    'paid_at' => '',
                    'customer_name' => '',
                    'shipping_info' => [],
                    'parent_code' => '',
                ];
                return [
                    'history_id' => $historyId,
                    'order_reference' => $orderReference,
                    'parent_code' => $orderMeta['parent_code'],
                    'status' => $orderMeta['status'],
                    'status_label' => $this->getOrderStatusLabel((string) $orderMeta['status']),
                    'customer_region' => (string) ($order['customer_region'] ?? ''),
                    'supplier' => (string) ($order['supplier'] ?? ''),
                    'subtotal' => (float) $order['subtotal'],
                    'total_amount' => (float) $order['total_amount'],
                    'delivery_date' => (string) ($order['delivery_date'] ?? ''),
                    'delivery_time' => (string) ($order['delivery_time'] ?? ''),
                    'shipping_address' => (string) ($order['shipping_address'] ?? ''),
                    'note' => (string) ($order['note'] ?? ''),
                    'created_at' => (string) $order['created_at'],
                    'customer_name' => (string) $orderMeta['customer_name'],
                    'transaction_id' => (string) $orderMeta['transaction_id'],
                    'expires_at' => (string) $orderMeta['expires_at'],
                    'paid_at' => (string) $orderMeta['paid_at'],
                    'shipping_info' => $orderMeta['shipping_info'],
                    'items' => $itemsByHistory[$historyId] ?? [],
                ];
            }, $orders),
        ];
    }

    public function save(): array
    {
        $customerId = $this->getCustomerIdFromRequest();
        $payload = $this->getJsonPayload();
        $items = $payload['items'] ?? null;
        if (!is_array($items) || $items === []) {
            throw new InputException(__('Danh sach san pham da mua khong hop le.'));
        }

        $connection = $this->resourceConnection->getConnection();
        $historyTable = $this->resourceConnection->getTableName(self::HISTORY_TABLE);
        $itemTable = $this->resourceConnection->getTableName(self::ITEM_TABLE);
        $orderReference = trim((string) ($payload['orderReference'] ?? ''));
        if ($orderReference === '') {
            $orderReference = 'TMDT-' . date('Ymd-His') . '-' . $customerId;
        }

        $connection->beginTransaction();
        try {
            $connection->insert($historyTable, [
                'customer_id' => $customerId,
                'customer_email' => trim((string) ($payload['customerEmail'] ?? '')),
                'customer_region' => trim((string) ($payload['customerRegion'] ?? '')),
                'order_reference' => $orderReference,
                'supplier' => trim((string) ($payload['supplier'] ?? '')),
                'subtotal' => (float) ($payload['subtotal'] ?? 0),
                'total_amount' => (float) ($payload['totalAmount'] ?? ($payload['subtotal'] ?? 0)),
                'delivery_date' => $this->normalizeDate($payload['deliveryDate'] ?? null),
                'delivery_time' => trim((string) ($payload['deliveryTime'] ?? '')),
                'shipping_address' => trim((string) ($payload['shippingAddress'] ?? '')),
                'note' => trim((string) ($payload['note'] ?? '')),
                'invoice_json' => $this->serializer->serialize($payload['invoiceInfo'] ?? []),
            ]);
            $historyId = (int) $connection->lastInsertId($historyTable);

            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $quantity = max(1.0, (float) ($item['quantity'] ?? 1));
                $unitPrice = max(0.0, (float) ($item['unitPrice'] ?? 0));
                $connection->insert($itemTable, [
                    'history_id' => $historyId,
                    'sku' => trim((string) ($item['sku'] ?? '')),
                    'product_name' => trim((string) ($item['name'] ?? '')),
                    'category' => trim((string) ($item['category'] ?? '')),
                    'unit' => trim((string) ($item['unit'] ?? '')),
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'row_total' => $quantity * $unitPrice,
                    'image' => trim((string) ($item['image'] ?? '')),
                ]);
            }

            $connection->commit();
        } catch (\Throwable $exception) {
            $connection->rollBack();
            throw $exception;
        }

        return [
            'success' => true,
            'history_id' => $historyId,
            'order_reference' => $orderReference,
        ];
    }

    private function getCustomerIdFromRequest(): int
    {
        $token = $this->extractToken();
        if ($token === '') {
            throw new AuthorizationException(__('Ban can dang nhap de xem lich su mua hang.'));
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

        return trim((string) $this->request->getParam('token'));
    }

    private function getJsonPayload(): array
    {
        $content = (string) $this->request->getContent();
        if ($content === '') {
            return [];
        }

        $data = json_decode($content, true);
        return is_array($data) ? $data : [];
    }

    private function normalizeDate(mixed $value): ?string
    {
        $value = trim((string) $value);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : null;
    }

    private function formatItem(array $item): array
    {
        return [
            'item_id' => (int) $item['item_id'],
            'sku' => (string) $item['sku'],
            'name' => (string) $item['product_name'],
            'category' => (string) ($item['category'] ?? ''),
            'unit' => (string) ($item['unit'] ?? ''),
            'quantity' => (float) $item['quantity'],
            'unit_price' => (float) $item['unit_price'],
            'row_total' => (float) $item['row_total'],
            'image' => (string) ($item['image'] ?? ''),
        ];
    }

    private function decodeJsonObject(string $value): array
    {
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function getOrderStatusLabel(string $status): string
    {
        return match (strtolower($status)) {
            'paid' => 'Đã thanh toán',
            'processing' => 'Đang xử lý',
            'cancelled', 'canceled' => 'Đã hủy',
            'expired' => 'Hết hạn',
            'pending' => 'Chờ thanh toán',
            default => $status !== '' ? ucfirst($status) : 'Chờ thanh toán',
        };
    }
}
