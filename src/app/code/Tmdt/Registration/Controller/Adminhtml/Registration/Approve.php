<?php

namespace Tmdt\Registration\Controller\Adminhtml\Registration;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Controller\Result\Redirect;

class Approve extends Action
{
    public const ADMIN_RESOURCE = 'Tmdt_Registration::registration';

    public function __construct(
        Context $context,
        private readonly ResourceConnection $resourceConnection
    ) {
        parent::__construct($context);
    }

    public function execute(): Redirect
    {
        $registrationId = (int) $this->getRequest()->getParam('registration_id');
        if ($registrationId <= 0) {
            $this->messageManager->addErrorMessage(__('Khong tim thay dang ky can duyet.'));
            return $this->resultRedirectFactory->create()->setPath('*/*/index');
        }

        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName('tmdt_customer_registration');
        $roleExpression = new \Zend_Db_Expr("CASE WHEN role IS NULL OR role = '' THEN 'seller' ELSE role END");
        $updated = $connection->update(
            $tableName,
            ['status' => 'approved', 'role' => $roleExpression, 'notes' => null],
            ['registration_id = ?' => $registrationId]
        );

        if ($updated > 0) {
            $this->messageManager->addSuccessMessage(__('Da duyet tai khoan kinh doanh.'));
        } else {
            $this->messageManager->addNoticeMessage(__('Dang ky khong thay doi hoac khong ton tai.'));
        }

        return $this->resultRedirectFactory->create()->setPath('*/*/index');
    }
}
