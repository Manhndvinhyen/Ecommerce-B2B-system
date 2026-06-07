<?php

namespace Tmdt\Registration\Controller\Adminhtml\Registration;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Customer\Api\CustomerRepositoryInterface;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Controller\Result\Redirect;
use Magento\Framework\App\ObjectManager;

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
        $row = $connection->fetchRow(
            $connection->select()
                ->from($tableName, ['customer_id', 'role'])
                ->where('registration_id = ?', $registrationId)
                ->limit(1)
        );

        if (!is_array($row)) {
            $this->messageManager->addErrorMessage(__('Khong tim thay dang ky can duyet.'));
            return $this->resultRedirectFactory->create()->setPath('*/*/index');
        }

        $role = strtolower(trim((string) ($row['role'] ?? '')));
        if ($role === '') {
            $role = 'seller';
        }

        $updated = $connection->update(
            $tableName,
            ['status' => 'approved', 'role' => $role, 'notes' => null],
            ['registration_id = ?' => $registrationId]
        );

        $this->approveCustomer((int) ($row['customer_id'] ?? 0), $role);

        if ($updated > 0) {
            $this->messageManager->addSuccessMessage(__('Da duyet tai khoan kinh doanh.'));
        } else {
            $this->messageManager->addNoticeMessage(__('Dang ky khong thay doi hoac khong ton tai.'));
        }

        return $this->resultRedirectFactory->create()->setPath('*/*/index');
    }

    private function approveCustomer(int $customerId, string $role): void
    {
        if ($customerId <= 0 || $role !== 'seller') {
            return;
        }

        try {
            $customerRepository = ObjectManager::getInstance()->get(CustomerRepositoryInterface::class);
            $customer = $customerRepository->getById($customerId);
            $customer->setCustomAttribute('tmdt_role', 'seller');
            $customer->setCustomAttribute('is_owner', '1');
            $customer->setCustomAttribute('is_super_admin', '0');
            $customerRepository->save($customer);
        } catch (\Throwable) {
        }
    }
}
