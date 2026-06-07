<?php

namespace Tmdt\Registration\Controller\Adminhtml\Registration;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Customer\Api\CustomerRepositoryInterface;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Controller\Result\Redirect;
use Magento\Framework\App\ObjectManager;

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
        $row = $connection->fetchRow(
            $connection->select()
                ->from($tableName, ['customer_id'])
                ->where('registration_id = ?', $registrationId)
                ->limit(1)
        );
        $updated = $connection->update(
            $tableName,
            ['status' => 'rejected', 'notes' => 'Rejected by admin'],
            ['registration_id = ?' => $registrationId]
        );

        if (is_array($row)) {
            $this->rejectCustomer((int) ($row['customer_id'] ?? 0));
        }

        if ($updated > 0) {
            $this->messageManager->addSuccessMessage(__('Da tu choi tai khoan kinh doanh.'));
        } else {
            $this->messageManager->addNoticeMessage(__('Dang ky khong thay doi hoac khong ton tai.'));
        }

        return $this->resultRedirectFactory->create()->setPath('*/*/index');
    }

    private function rejectCustomer(int $customerId): void
    {
        if ($customerId <= 0) {
            return;
        }

        try {
            $customerRepository = ObjectManager::getInstance()->get(CustomerRepositoryInterface::class);
            $customer = $customerRepository->getById($customerId);
            $customer->setCustomAttribute('tmdt_role', 'customer');
            $customer->setCustomAttribute('is_owner', '0');
            $customer->setCustomAttribute('is_super_admin', '0');
            $customerRepository->save($customer);
        } catch (\Throwable) {
        }
    }
}
