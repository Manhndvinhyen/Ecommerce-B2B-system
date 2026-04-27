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
        $registrationRows = $connection->fetchAll(
            $connection->select()
                ->from($this->resourceConnection->getTableName('tmdt_customer_registration'))
                ->order('registration_id DESC')
        ) ?: [];

        $customerRows = $connection->fetchAll(
            $connection->select()
                ->from(
                    $this->resourceConnection->getTableName('customer_entity'),
                    ['entity_id', 'email', 'firstname', 'lastname', 'created_at']
                )
                ->order('entity_id DESC')
        ) ?: [];

        $registrationsByCustomerId = [];
        foreach ($registrationRows as $row) {
            $registrationsByCustomerId[(int) $row['customer_id']] = $row;
        }

        $result = [];
        foreach ($customerRows as $customerRow) {
            $customerId = (int) $customerRow['entity_id'];
            $registrationRow = $registrationsByCustomerId[$customerId] ?? null;
            $fullName = trim(((string) ($customerRow['firstname'] ?? '')) . ' ' . ((string) ($customerRow['lastname'] ?? '')));

            $result[] = [
                'registration_id' => $registrationRow['registration_id'] ?? null,
                'customer_id' => $customerId,
                'business_name' => $registrationRow['business_name'] ?? '',
                'full_name' => $registrationRow['full_name'] ?? $fullName,
                'email' => (string) ($customerRow['email'] ?? ($registrationRow['email'] ?? '')),
                'phone_number' => $registrationRow['phone_number'] ?? '',
                'tax_code' => $registrationRow['tax_code'] ?? '',
                'registration_type' => $registrationRow['registration_type'] ?? '',
                'province' => $registrationRow['province'] ?? '',
                'district' => $registrationRow['district'] ?? '',
                'ward' => $registrationRow['ward'] ?? '',
                'detail_address' => $registrationRow['detail_address'] ?? '',
                'unit_nickname' => $registrationRow['unit_nickname'] ?? '',
                'login_code' => $registrationRow['login_code'] ?? '',
                'status' => $registrationRow['status'] ?? 'customer_only',
                'created_at' => $registrationRow['created_at'] ?? ($customerRow['created_at'] ?? ''),
                'data_source' => $registrationRow ? 'tmdt_registration' : 'customer_entity',
            ];
        }

        return $result;
    }
}