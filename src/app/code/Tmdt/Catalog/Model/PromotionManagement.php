<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Model;

use Magento\Framework\App\ResourceConnection;
use Tmdt\Catalog\Api\PromotionManagementInterface;

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
                    'discount_value' => $row['discount_value'] !== null ? (float)$row['discount_value'] : null,
                    'min_order_amount' => $row['min_order_amount'] !== null ? (float)$row['min_order_amount'] : null,
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
