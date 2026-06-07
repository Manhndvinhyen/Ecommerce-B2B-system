<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Controller\Adminhtml\Promotion;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\App\ResourceConnection;

class Delete extends Action
{
    public const ADMIN_RESOURCE = 'Tmdt_Catalog::promotion';

    public function __construct(
        Context $context,
        private readonly ResourceConnection $resourceConnection
    ) {
        parent::__construct($context);
    }

    public function execute()
    {
        $resultRedirect = $this->resultRedirectFactory->create();
        $id = (int)$this->getRequest()->getParam('id');

        if ($id <= 0) {
            $this->messageManager->addErrorMessage(__('ID khuyến mãi không hợp lệ.'));
            return $resultRedirect->setPath('*/*/index');
        }

        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName('tmdt_promotions');

        try {
            $connection->delete($tableName, ['id = ?' => $id]);
            $this->messageManager->addSuccessMessage(__('Xóa khuyến mãi thành công.'));
        } catch (\Throwable $e) {
            $this->messageManager->addErrorMessage(__('Lỗi khi xóa khuyến mãi: %1', $e->getMessage()));
        }

        return $resultRedirect->setPath('*/*/index');
    }
}
