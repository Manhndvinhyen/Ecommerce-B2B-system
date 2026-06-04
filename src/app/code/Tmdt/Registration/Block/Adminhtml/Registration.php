<?php

namespace Tmdt\Registration\Block\Adminhtml;

use Magento\Backend\Block\Template;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Serialize\Serializer\Json;
use Magento\Framework\UrlInterface;
use Magento\Store\Model\StoreManagerInterface;

class Registration extends Template
{
    public function __construct(
        Template\Context $context,
        private readonly ResourceConnection $resourceConnection,
        private readonly Json $serializer,
        private readonly StoreManagerInterface $storeManager,
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
                ->order(new \Zend_Db_Expr("CASE WHEN status = 'pending' THEN 0 ELSE 1 END"))
                ->order('registration_id DESC')
        ) ?: [];

        $customerIds = array_values(array_unique(array_map(
            static fn (array $row): int => (int) ($row['customer_id'] ?? 0),
            $registrationRows
        )));
        $customerIds = array_filter($customerIds);

        $customerRows = [];
        if (!empty($customerIds)) {
            $customerRows = $connection->fetchAll(
                $connection->select()
                    ->from(
                        $this->resourceConnection->getTableName('customer_entity'),
                        ['entity_id', 'email', 'firstname', 'lastname', 'created_at']
                    )
                    ->where('entity_id IN (?)', $customerIds)
            ) ?: [];
        }

        $customersById = [];
        foreach ($customerRows as $row) {
            $customersById[(int) $row['entity_id']] = $row;
        }

        $result = [];
        foreach ($registrationRows as $registrationRow) {
            $customerId = (int) ($registrationRow['customer_id'] ?? 0);
            $customerRow = $customersById[$customerId] ?? [];
            $fullName = trim(((string) ($customerRow['firstname'] ?? '')) . ' ' . ((string) ($customerRow['lastname'] ?? '')));

            $result[] = [
                'registration_id' => $registrationRow['registration_id'],
                'customer_id' => $customerId,
                'business_name' => $registrationRow['business_name'],
                'full_name' => $registrationRow['full_name'] ?: $fullName,
                'email' => (string) ($customerRow['email'] ?? ($registrationRow['email'] ?? '')),
                'phone_number' => $registrationRow['phone_number'],
                'tax_code' => $registrationRow['tax_code'],
                'registration_type' => $registrationRow['registration_type'],
                'province' => $registrationRow['province'],
                'district' => $registrationRow['district'],
                'ward' => $registrationRow['ward'],
                'detail_address' => $registrationRow['detail_address'],
                'unit_nickname' => $registrationRow['unit_nickname'],
                'login_code' => $registrationRow['login_code'],
                'status' => $registrationRow['status'],
                'role' => $registrationRow['role'] ?? '',
                'license_files' => $this->hydrateLicenseFiles($registrationRow['files_json'] ?? null),
                'created_at' => $registrationRow['created_at'],
                'updated_at' => $registrationRow['updated_at'] ?? '',
                'data_source' => 'tmdt_registration',
            ];
        }

        return $result;
    }

    public function getApproveUrl(int $registrationId): string
    {
        return $this->getUrl('tmdt_registration/registration/approve', ['registration_id' => $registrationId]);
    }

    public function getRejectUrl(int $registrationId): string
    {
        return $this->getUrl('tmdt_registration/registration/reject', ['registration_id' => $registrationId]);
    }

    private function hydrateLicenseFiles(mixed $filesJson): array
    {
        if (!is_string($filesJson) || trim($filesJson) === '') {
            return [];
        }

        try {
            $files = $this->serializer->unserialize($filesJson);
        } catch (\InvalidArgumentException) {
            return [];
        }

        if (!is_array($files)) {
            return [];
        }

        $mediaBaseUrl = $this->storeManager->getStore()->getBaseUrl(UrlInterface::URL_TYPE_MEDIA);
        $result = [];
        foreach ($files as $file) {
            if (!is_array($file)) {
                continue;
            }
            $path = trim((string) ($file['path'] ?? ''));
            $name = trim((string) ($file['name'] ?? ($path !== '' ? basename($path) : '')));
            if ($name === '' && $path === '') {
                continue;
            }
            $result[] = [
                'name' => $name !== '' ? $name : basename($path),
                'url' => $path !== '' ? $mediaBaseUrl . ltrim($path, '/') : '',
            ];
        }

        return $result;
    }
}
