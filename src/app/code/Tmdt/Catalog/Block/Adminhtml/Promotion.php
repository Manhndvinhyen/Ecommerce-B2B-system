<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Block\Adminhtml;

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

    /**
     * Get all promotions from database.
     *
     * @return array
     */
    public function getRows(): array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName('tmdt_promotions');

        try {
            $select = $connection->select()
                ->from($tableName)
                ->order('id DESC');

            return $connection->fetchAll($select) ?: [];
        } catch (\Throwable $e) {
            return [];
        }
    }

    /**
     * Get URL for saving promotion.
     *
     * @return string
     */
    public function getSaveUrl(): string
    {
        return $this->getUrl('tmdt_catalog/promotion/save');
    }

    /**
     * Get URL for deleting promotion.
     *
     * @param int $id
     * @return string
     */
    public function getDeleteUrl(int $id): string
    {
        return $this->getUrl('tmdt_catalog/promotion/delete', ['id' => $id]);
    }
}
