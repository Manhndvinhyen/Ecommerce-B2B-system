<?php
declare(strict_types=1);

namespace Tmdt\Promotion\Block\Adminhtml;

use Magento\Backend\Block\Template;
use Magento\Framework\App\ResourceConnection;

class Promotion extends Template
{
    public function __construct(
        Template\Context $context,
        private readonly ResourceConnection $resourceConnection,
        array $data = []
    ) {
        parent::__construct($context, $data);
    }

    public function getRows(?string $type = null): array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName('tmdt_promotions');

        try {
            $select = $connection->select()
                ->from($tableName)
                ->order('id DESC');
            if ($type !== null) {
                $select->where('type = ?', $type);
            }

            return $connection->fetchAll($select) ?: [];
        } catch (\Throwable $e) {
            return [];
        }
    }

    public function getCategoryOptions(): array
    {
        $connection = $this->resourceConnection->getConnection();
        $categoryEntity = $this->resourceConnection->getTableName('catalog_category_entity');
        $categoryVarchar = $this->resourceConnection->getTableName('catalog_category_entity_varchar');
        $attribute = $this->resourceConnection->getTableName('eav_attribute');

        try {
            $nameAttrId = (int)$connection->fetchOne(
                $connection->select()
                    ->from($attribute, ['attribute_id'])
                    ->where('attribute_code = ?', 'name')
                    ->where('entity_type_id = ?', 3)
                    ->limit(1)
            );
            if ($nameAttrId <= 0) {
                return [];
            }

            $select = $connection->select()
                ->from(['c' => $categoryEntity], ['id' => 'entity_id', 'level'])
                ->joinLeft(
                    ['v' => $categoryVarchar],
                    'v.entity_id = c.entity_id AND v.attribute_id = ' . $nameAttrId . ' AND v.store_id = 0',
                    ['name' => 'value']
                )
                ->where('c.entity_id > ?', 2)
                ->order(['c.level ASC', 'v.value ASC']);

            return $connection->fetchAll($select) ?: [];
        } catch (\Throwable $e) {
            return [];
        }
    }

    public function getProductOptions(): array
    {
        $connection = $this->resourceConnection->getConnection();
        $productEntity = $this->resourceConnection->getTableName('catalog_product_entity');
        $productVarchar = $this->resourceConnection->getTableName('catalog_product_entity_varchar');
        $attribute = $this->resourceConnection->getTableName('eav_attribute');

        try {
            $nameAttrId = (int)$connection->fetchOne(
                $connection->select()
                    ->from($attribute, ['attribute_id'])
                    ->where('attribute_code = ?', 'name')
                    ->where('entity_type_id = ?', 4)
                    ->limit(1)
            );
            if ($nameAttrId <= 0) {
                return [];
            }

            $select = $connection->select()
                ->from(['p' => $productEntity], ['sku'])
                ->joinLeft(
                    ['v' => $productVarchar],
                    'v.entity_id = p.entity_id AND v.attribute_id = ' . $nameAttrId . ' AND v.store_id = 0',
                    ['name' => 'value']
                )
                ->order('v.value ASC')
                ->limit(300);

            return $connection->fetchAll($select) ?: [];
        } catch (\Throwable $e) {
            return [];
        }
    }

    public function getSaveUrl(): string
    {
        return $this->getUrl('tmdt_catalog/promotion/save');
    }

    public function getDeleteUrl(int $id): string
    {
        return $this->getUrl('tmdt_catalog/promotion/delete', ['id' => $id]);
    }

    public function formatDateTimeInput($value): string
    {
        if (!$value) {
            return '';
        }
        $timestamp = strtotime((string)$value);
        return $timestamp === false ? '' : date('Y-m-d\TH:i', $timestamp);
    }

    public function isSelectedListValue($storedList, string $value): bool
    {
        $items = array_map('trim', explode(',', (string)$storedList));
        return in_array($value, $items, true);
    }
}
