<?php
declare(strict_types=1);

namespace Tmdt\Promotion\Model;

use Magento\Framework\App\ResourceConnection;
use Tmdt\Promotion\Api\PromotionManagementInterface;

class PromotionManagement implements PromotionManagementInterface
{
    private const TABLE_NAME = 'tmdt_promotions';

    public function __construct(
        private readonly ResourceConnection $resourceConnection
    ) {}

    /**
     * @inheritDoc
     */
    public function getPromotions(): array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        try {
            $select = $connection->select()
                ->from($tableName)
                ->where('is_active = ?', 1)
                ->where('(start_at IS NULL OR start_at <= NOW())')
                ->where('(end_at IS NULL OR end_at >= NOW())')
                ->where('(type != ? OR usage_limit IS NULL OR used_count < usage_limit)', 'voucher')
                ->order('id ASC');

            $rows = $connection->fetchAll($select) ?: [];

            // Format return data structures properly
            $items = [];
            foreach ($rows as $row) {
                $items[] = [
                    'id' => (int)$row['id'],
                    'title' => (string)$row['title'],
                    'description' => (string)$row['description'],
                    'image' => (string)$row['image'],
                    'button_text' => (string)$row['button_text'],
                    'button_action' => (string)$row['button_action'],
                    'type' => (string)$row['type'],
                    'discount_code' => $row['discount_code'] ? (string)$row['discount_code'] : null,
                    'discount_type' => $row['discount_type'] ? (string)$row['discount_type'] : 'fixed',
                    'discount_value' => $row['discount_value'] !== null ? (float)$row['discount_value'] : null,
                    'min_order_amount' => $row['min_order_amount'] !== null ? (float)$row['min_order_amount'] : null,
                    'max_discount_amount' => $row['max_discount_amount'] !== null ? (float)$row['max_discount_amount'] : null,
                    'apply_scope' => $row['apply_scope'] ? (string)$row['apply_scope'] : null,
                    'category_ids' => $row['category_ids'] ? (string)$row['category_ids'] : null,
                    'product_skus' => $row['product_skus'] ? (string)$row['product_skus'] : null,
                    'usage_limit' => $row['usage_limit'] !== null ? (int)$row['usage_limit'] : null,
                    'used_count' => isset($row['used_count']) ? (int)$row['used_count'] : 0,
                    'start_at' => $row['start_at'] ? (string)$row['start_at'] : null,
                    'end_at' => $row['end_at'] ? (string)$row['end_at'] : null,
                ];
            }

            return [
                'success' => true,
                'items' => $items
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'message' => $e->getMessage(),
                'items' => []
            ];
        }
    }

    /**
     * @inheritDoc
     */
    public function getSuppliers(): array
    {
        $connection = $this->resourceConnection->getConnection();
        
        try {
            $regTable = $this->resourceConnection->getTableName('tmdt_customer_registration');
            $prodVarcharTable = $this->resourceConnection->getTableName('catalog_product_entity_varchar');
            $attrTable = $this->resourceConnection->getTableName('eav_attribute');
            $orderTable = $this->resourceConnection->getTableName('tmdt_orders');
            $orderItemsTable = $this->resourceConnection->getTableName('tmdt_order_items');

            // 1. Get tmdt_seller_id attribute ID
            $sellerAttrId = (int)$connection->fetchOne(
                $connection->select()
                    ->from($attrTable, ['attribute_id'])
                    ->where('attribute_code = ?', 'tmdt_seller_id')
                    ->where('entity_type_id = ?', 4)
                    ->limit(1)
            );

            // 2. Fetch all B2B sellers from database
            $select = $connection->select()
                ->from($regTable)
                ->where('role = ?', 'seller')
                ->where('status = ?', 'approved')
                ->order('registration_id ASC');
            
            $sellers = $connection->fetchAll($select) ?: [];
            $items = [];

            foreach ($sellers as $seller) {
                $id = (int)$seller['customer_id'];
                
                // Parse badges (comma-separated list in DB to array)
                $badgesStr = isset($seller['badges']) ? (string)$seller['badges'] : '';
                $badges = !empty($badgesStr) ? array_map('trim', explode(',', $badgesStr)) : [];

                // Retrieve logo & category
                $logo = isset($seller['logo']) ? (string)$seller['logo'] : '🧑‍🌾';
                $category = isset($seller['category']) ? (string)$seller['category'] : 'Nông sản sỉ B2B';

                // Fetch dynamic stats from database tables
                $productCount = 0;
                if ($sellerAttrId > 0) {
                    $productCount = (int)$connection->fetchOne(
                        "SELECT COUNT(DISTINCT entity_id) FROM {$prodVarcharTable}
                         WHERE attribute_id = ? AND value = ?",
                        [$sellerAttrId, (string)$id]
                    );
                }

                $orderCount = (int)$connection->fetchOne(
                    "SELECT COUNT(DISTINCT o.id) FROM {$orderTable} o
                     INNER JOIN {$orderItemsTable} oi ON o.id = oi.order_id
                     WHERE oi.seller_id = ?
                       AND o.status IN ('paid', 'processing')
                       AND COALESCE(o.parent_code, '') != 'parent'",
                    [$id]
                );

                $customerCount = (int)$connection->fetchOne(
                    "SELECT COUNT(DISTINCT o.customer_email) FROM {$orderTable} o
                     INNER JOIN {$orderItemsTable} oi ON o.id = oi.order_id
                     WHERE oi.seller_id = ?
                       AND o.status IN ('paid', 'processing')
                       AND COALESCE(o.parent_code, '') != 'parent'",
                    [$id]
                );

                // Read defaults from DB columns
                $defaultCustomers = isset($seller['default_customers']) ? (int)$seller['default_customers'] : 0;
                $defaultProducts = isset($seller['default_products']) ? (int)$seller['default_products'] : 0;
                $defaultBranches = isset($seller['default_branches']) ? (int)$seller['default_branches'] : 0;

                // Fallback to default stats if dynamic stats are 0
                $statsCustomers = $customerCount > 0 ? $customerCount : $defaultCustomers;
                $statsProducts = $productCount > 0 ? $productCount : $defaultProducts;
                $statsBranches = $orderCount > 0 ? $orderCount : $defaultBranches;

                $items[] = [
                    'id' => $id,
                    'name' => (string)$seller['business_name'],
                    'logo' => $logo,
                    'category' => $category,
                    'stats' => [
                        'customers' => $statsCustomers,
                        'products' => $statsProducts,
                        'branches' => $statsBranches
                    ],
                    'badges' => $badges,
                    'seller_province' => (string)$seller['province']
                ];
            }

            return [
                'success' => true,
                'items' => $items
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'message' => $e->getMessage(),
                'items' => []
            ];
        }
    }
}
