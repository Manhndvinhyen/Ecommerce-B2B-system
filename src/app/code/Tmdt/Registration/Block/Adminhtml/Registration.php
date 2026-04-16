<?php

namespace Tmdt\Registration\Block\Adminhtml;

use Magento\Framework\App\ResourceConnection;
use Magento\Framework\View\Element\Template;

class Registration extends Template
{
    public function __construct(
        Template\Context $context,
        private readonly ResourceConnection $resourceConnection,
        array $data = []
    ) {
        parent::__construct($context, $data);
    }

    public function getRows(): array
    {
        $connection = $this->resourceConnection->getConnection();
        $select = $connection->select()
            ->from($this->resourceConnection->getTableName('tmdt_customer_registration'))
            ->order('registration_id DESC')
            ->limit(100);

        return $connection->fetchAll($select) ?: [];
    }
}