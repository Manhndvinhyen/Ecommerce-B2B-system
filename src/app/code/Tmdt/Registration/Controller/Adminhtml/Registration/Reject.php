<?php

namespace Tmdt\Registration\Controller\Adminhtml\Registration;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Controller\Result\Redirect;

class Reject extends Action
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
            $this->messageManager->addErrorMessage(__('Khong tim thay dang ky can tu choi.'));
            return $this->resultRedirectFactory->create()->setPath('*/*/index');
        }

        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName('tmdt_customer_registration');
        $updated = $connection->update(
            $tableName,
            ['status' => 'rejected', 'notes' => 'Rejected by admin'],
            ['registration_id = ?' => $registrationId]
        );

        if ($updated > 0) {
            $this->messageManager->addSuccessMessage(__('Da tu choi tai khoan kinh doanh.'));
        } else {
            $this->messageManager->addNoticeMessage(__('Dang ky khong thay doi hoac khong ton tai.'));
        }

        return $this->resultRedirectFactory->create()->setPath('*/*/index');
    }
}
