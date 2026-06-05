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
            $expiresAt = date('Y-m-d H:i:s', time() + self::HOLD_MINUTES * 60);

            $itemsJson = $data['itemsJson'] ?? '[]';
            $shippingJson = $data['shippingJson'] ?? '{}';
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
                        'customer_email' => $data['customerEmail'] ?? '',
                        'customer_name'  => $data['customerName'] ?? '',
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
                    'customer_email' => $data['customerEmail'] ?? '',
                    'customer_name'  => $data['customerName'] ?? '',
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

                $this->logger->info('[Order] Created split parent order', ['parentCode' => $parentCode, 'amount' => $calculatedParentTotal]);

                return $result->setData([
                    'success'     => true,
                    'orderCode'   => $parentCode,
                    'totalAmount' => $calculatedParentTotal,
                    'expiresAt'   => $expiresAt,
                    'holdMinutes' => self::HOLD_MINUTES,
                    'childOrders' => $childOrdersData
                ]);
            } else {
                // Single supplier order
                $orderCode = $this->generateOrderCode();
                $connection->insert($table, [
                    'order_code'     => $orderCode,
                    'parent_code'    => null,
                    'status'         => 'pending',
                    'total_amount'   => $totalAmount,
                    'items_json'     => $itemsJson,
                    'customer_email' => $data['customerEmail'] ?? '',
                    'customer_name'  => $data['customerName'] ?? '',
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

                $this->logger->info('[Order] Created single supplier order', ['orderCode' => $orderCode, 'amount' => $totalAmount]);

                return $result->setData([
                    'success'     => true,
                    'orderCode'   => $orderCode,
                    'totalAmount' => $totalAmount,
                    'expiresAt'   => $expiresAt,
                    'holdMinutes' => self::HOLD_MINUTES,
                    'childOrders' => $childOrdersData
                ]);
            }
        } catch (\Throwable $e) {
            $this->logger->error('[Order] Create error: ' . $e->getMessage());
            return $result->setData(['success' => false, 'message' => $e->getMessage()]);
        }
    }
}
