<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Setup\Patch\Data;

use Magento\Framework\Setup\ModuleDataSetupInterface;
use Magento\Framework\Setup\Patch\DataPatchInterface;

class MigrateOrderData implements DataPatchInterface
{
    public function __construct(
        private readonly ModuleDataSetupInterface $moduleDataSetup
    ) {}

    public function apply(): self
    {
        $this->moduleDataSetup->startSetup();
        $connection = $this->moduleDataSetup->getConnection();

        // 1. Prepare helper lookups
        $customerTable = $this->moduleDataSetup->getTable('customer_entity');
        $productTable = $this->moduleDataSetup->getTable('catalog_product_entity');
        $productVarcharTable = $this->moduleDataSetup->getTable('catalog_product_entity_varchar');
        $attributeTable = $this->moduleDataSetup->getTable('eav_attribute');

        // Get customer lookup by email
        $customerLookup = [];
        $customers = $connection->fetchAll("SELECT entity_id, email FROM {$customerTable}");
        foreach ($customers as $c) {
            $customerLookup[strtolower(trim($c['email']))] = (int)$c['entity_id'];
        }

        // Get product lookup by SKU
        $productLookup = [];
        $products = $connection->fetchAll("SELECT entity_id, sku FROM {$productTable}");
        foreach ($products as $p) {
            $productLookup[strtolower(trim($p['sku']))] = (int)$p['entity_id'];
        }

        // Get tmdt_seller_id attribute ID
        $sellerAttrId = (int)$connection->fetchOne(
            "SELECT attribute_id FROM {$attributeTable} WHERE attribute_code = 'tmdt_seller_id' AND entity_type_id = 4 LIMIT 1"
        );

        // Get seller ID lookup by product ID
        $sellerLookup = [];
        if ($sellerAttrId > 0) {
            $sellerValues = $connection->fetchAll(
                "SELECT entity_id, value FROM {$productVarcharTable} WHERE attribute_id = ?",
                [$sellerAttrId]
            );
            foreach ($sellerValues as $sv) {
                $val = trim($sv['value']);
                if (!empty($val) && $val !== 'NONE' && is_numeric($val)) {
                    $sellerLookup[(int)$sv['entity_id']] = (int)$val;
                }
            }
        }

        // 2. Migrate Orders & Order Items
        $orderTable = $this->moduleDataSetup->getTable('tmdt_orders');
        $orderItemsTable = $this->moduleDataSetup->getTable('tmdt_order_items');
        
        $orders = $connection->fetchAll("SELECT * FROM {$orderTable}");
        $orderIdMap = []; // order_code -> id

        foreach ($orders as $o) {
            $orderId = (int)$o['id'];
            $orderCode = $o['order_code'];
            $orderIdMap[$orderCode] = $orderId;

            // Link customer_id
            $email = strtolower(trim((string)($o['customer_email'] ?? '')));
            if (isset($customerLookup[$email])) {
                $connection->update(
                    $orderTable,
                    ['customer_id' => $customerLookup[$email]],
                    ['id = ?' => $orderId]
                );
            }

            // Populate order items
            $itemsJson = $o['items_json'] ?? '';
            $items = json_decode((string)$itemsJson, true);
            if (is_array($items)) {
                foreach ($items as $item) {
                    $sku = trim((string)($item['sku'] ?? ''));
                    $skuKey = strtolower($sku);
                    if (empty($sku)) {
                        continue;
                    }

                    // Resolve product_id
                    $productId = $productLookup[$skuKey] ?? 0;
                    if ($productId === 0) {
                        // Create a fallback product link or skip
                        continue;
                    }

                    // Resolve seller_id
                    $sellerId = $sellerLookup[$productId] ?? null;

                    // Row total
                    $qty = (float)($item['quantity'] ?? 0);
                    $price = (float)($item['unitPrice'] ?? 0);
                    $rowTotal = $qty * $price;

                    // Insert into tmdt_order_items if not already exists
                    $exists = $connection->fetchOne(
                        "SELECT id FROM {$orderItemsTable} WHERE order_id = ? AND sku = ?",
                        [$orderId, $sku]
                    );

                    if (!$exists) {
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
            }
        }

        // 3. Match parent_id for orders
        foreach ($orders as $o) {
            $parentCode = $o['parent_code'];
            if (!empty($parentCode) && isset($orderIdMap[$parentCode])) {
                $connection->update(
                    $orderTable,
                    ['parent_id' => $orderIdMap[$parentCode]],
                    ['id = ?' => $o['id']]
                );
            }
        }

        // 4. Update tmdt_order_status_history
        $historyTable = $this->moduleDataSetup->getTable('tmdt_order_status_history');
        $histories = $connection->fetchAll("SELECT id, order_code FROM {$historyTable} WHERE order_id IS NULL");
        foreach ($histories as $h) {
            $code = $h['order_code'];
            if (isset($orderIdMap[$code])) {
                $connection->update(
                    $historyTable,
                    ['order_id' => $orderIdMap[$code]],
                    ['id = ?' => $h['id']]
                );
            }
        }

        // 5. Update tmdt_seller_notifications
        $notifTable = $this->moduleDataSetup->getTable('tmdt_seller_notifications');
        $notifs = $connection->fetchAll("SELECT id, seller_id FROM {$notifTable} WHERE seller_customer_id IS NULL");
        foreach ($notifs as $n) {
            $sIdStr = trim($n['seller_id']);
            if (is_numeric($sIdStr)) {
                $connection->update(
                    $notifTable,
                    ['seller_customer_id' => (int)$sIdStr],
                    ['id = ?' => $n['id']]
                );
            }
        }

        // 6. Update tmdt_transactions
        $transTable = $this->moduleDataSetup->getTable('tmdt_transactions');
        $trans = $connection->fetchAll("SELECT id, order_code, seller_id FROM {$transTable} WHERE order_id IS NULL");
        foreach ($trans as $t) {
            $code = $t['order_code'];
            $updateData = [];

            if (isset($orderIdMap[$code])) {
                $updateData['order_id'] = $orderIdMap[$code];
            }

            $sIdStr = trim((string)$t['seller_id']);
            if (is_numeric($sIdStr)) {
                $updateData['seller_customer_id'] = (int)$sIdStr;
            }

            if (!empty($updateData)) {
                $connection->update(
                    $transTable,
                    $updateData,
                    ['id = ?' => $t['id']]
                );
            }
        }

        // 7. Update tmdt_inventory_log
        $invLogTable = $this->moduleDataSetup->getTable('tmdt_inventory_log');
        $invLogs = $connection->fetchAll("SELECT log_id, sku, note FROM {$invLogTable} WHERE product_id IS NULL");
        foreach ($invLogs as $il) {
            $skuKey = strtolower(trim($il['sku']));
            $updateData = [];

            if (isset($productLookup[$skuKey])) {
                $updateData['product_id'] = $productLookup[$skuKey];
            }

            // Parse note to extract order code reference (e.g. "đơn hàng DH1A2B3C")
            if (preg_match('/DH[A-Z0-9]{6,12}/i', (string)$il['note'], $matches)) {
                $orderCode = strtoupper($matches[0]);
                $updateData['reference_type'] = 'order';
                $updateData['reference_id'] = $orderCode;
            } else {
                $updateData['reference_type'] = 'manual';
            }

            if (!empty($updateData)) {
                $connection->update(
                    $invLogTable,
                    $updateData,
                    ['log_id = ?' => $il['log_id']]
                );
            }
        }

        // 8. Migrate Recurring Schedules & Recurring Items
        $recurTable = $this->moduleDataSetup->getTable('tmdt_recurring_schedules');
        $recurItemsTable = $this->moduleDataSetup->getTable('tmdt_recurring_items');
        
        $recurs = $connection->fetchAll("SELECT * FROM {$recurTable}");
        foreach ($recurs as $r) {
            $recurId = (int)$r['id'];

            // Link customer_id
            $email = strtolower(trim((string)($r['customer_email'] ?? '')));
            if (isset($customerLookup[$email])) {
                $connection->update(
                    $recurTable,
                    ['customer_id' => $customerLookup[$email]],
                    ['id = ?' => $recurId]
                );
            }

            // Populate recurring items
            $itemsJson = $r['items_json'] ?? '';
            $items = json_decode((string)$itemsJson, true);
            if (is_array($items)) {
                foreach ($items as $item) {
                    $sku = trim((string)($item['sku'] ?? ''));
                    $skuKey = strtolower($sku);
                    if (empty($sku)) {
                        continue;
                    }

                    // Resolve product_id
                    $productId = $productLookup[$skuKey] ?? 0;
                    if ($productId === 0) {
                        continue;
                    }

                    // Resolve seller_id
                    $sellerId = $sellerLookup[$productId] ?? null;

                    $qty = (float)($item['quantity'] ?? 0);
                    $price = (float)($item['unitPrice'] ?? 0);

                    // Insert if not exists
                    $exists = $connection->fetchOne(
                        "SELECT id FROM {$recurItemsTable} WHERE schedule_id = ? AND sku = ?",
                        [$recurId, $sku]
                    );

                    if (!$exists) {
                        $connection->insert($recurItemsTable, [
                            'schedule_id'     => $recurId,
                            'product_id'      => $productId,
                            'sku'             => $sku,
                            'name'            => $item['name'] ?? $sku,
                            'unit'            => $item['unit'] ?? 'kg',
                            'quantity'        => $qty,
                            'unit_price'      => $price,
                            'seller_id'       => $sellerId,
                            'supplier_name'   => $item['supplierName'] ?? null,
                            'supplier_region' => $item['supplierRegion'] ?? null,
                        ]);
                    }
                }
            }
        }

        // 9. Initialize seller balances from existing transactions
        $balanceTable = $this->moduleDataSetup->getTable('tmdt_seller_balance');
        $transSums = $connection->fetchAll(
            "SELECT seller_customer_id, SUM(amount) as total FROM {$transTable} WHERE seller_customer_id IS NOT NULL GROUP BY seller_customer_id"
        );
        foreach ($transSums as $ts) {
            $sellerId = (int)$ts['seller_customer_id'];
            $total = (float)$ts['total'];

            $exists = $connection->fetchOne(
                "SELECT id FROM {$balanceTable} WHERE seller_id = ?",
                [$sellerId]
            );

            if (!$exists) {
                $connection->insert($balanceTable, [
                    'seller_id'         => $sellerId,
                    'available_balance' => $total,
                    'pending_balance'   => 0.00
                ]);
            }
        }

        $this->moduleDataSetup->endSetup();
        return $this;
    }

    public static function getDependencies(): array
    {
        return [];
    }

    public function getAliases(): array
    {
        return [];
    }
}
