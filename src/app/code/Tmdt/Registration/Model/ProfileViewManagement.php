<?php

declare(strict_types=1);

namespace Tmdt\Registration\Model;

use Magento\Customer\Api\CustomerRepositoryInterface;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Exception\AuthorizationException;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Serialize\Serializer\Json;
use Magento\Framework\UrlInterface;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Integration\Model\Oauth\TokenFactory;
use Magento\Store\Model\StoreManagerInterface;
use Tmdt\Registration\Api\ProfileViewInterface;

class ProfileViewManagement implements ProfileViewInterface
{
    private const TABLE_NAME = 'tmdt_customer_registration';
    private const AUTH_HEADER = 'Authorization';

    public function __construct(
        private readonly ResourceConnection $resourceConnection,
        private readonly RestRequest $request,
        private readonly TokenFactory $tokenFactory,
        private readonly Json $serializer,
        private readonly StoreManagerInterface $storeManager,
        private readonly CustomerRepositoryInterface $customerRepository
    ) {
    }

    public function get(): array
    {
        $customerId = $this->getCustomerIdFromRequest();
        $isOwner = false;
        $isSuperAdmin = false;

        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);
        $registrationRow = $connection->fetchRow(
            $connection->select()
                ->from($tableName)
                ->where('customer_id = ?', $customerId)
                ->limit(1)
        );

        if (!$registrationRow) {
            throw new LocalizedException(__('Khong tim thay du lieu dang ky.'));
        }

        try {
            $customer = $this->customerRepository->getById($customerId);
            $isOwnerAttr = $customer->getCustomAttribute('is_owner');
            $isSuperAttr = $customer->getCustomAttribute('is_super_admin');
            $isOwner = $isOwnerAttr ? $this->normalizeBool($isOwnerAttr->getValue()) : false;
            $isSuperAdmin = $isSuperAttr ? $this->normalizeBool($isSuperAttr->getValue()) : false;

            if (!$isOwner && !$isSuperAdmin) {
                $loginCode = trim((string) ($registrationRow['login_code'] ?? ''));
                if ($loginCode !== '') {
                    $ownerRegistration = $this->getOwnerRegistrationByLoginCode($loginCode);
                    if ($ownerRegistration) {
                        $registrationRow = $ownerRegistration;
                    }
                }
            }
        } catch (\Throwable) {
        }

        $files = $this->parseFilesJson($registrationRow['files_json'] ?? null);
        $files = $this->hydrateFilesWithUrls($files);
        $licenseName = $this->extractLicenseName($files);
        $addressText = $this->buildAddressText([
            $registrationRow['detail_address'] ?? '',
            $registrationRow['ward'] ?? '',
            $registrationRow['district'] ?? '',
            $registrationRow['province'] ?? '',
        ]);

        return [
            'success' => true,
            'data' => [
                'customer_id' => $customerId,
                'email' => (string) ($registrationRow['email'] ?? ''),
                'full_name' => (string) ($registrationRow['full_name'] ?? ''),
                'phone_number' => (string) ($registrationRow['phone_number'] ?? ''),
                'login_code' => (string) ($registrationRow['login_code'] ?? ''),
                'tax_code' => (string) ($registrationRow['tax_code'] ?? ''),
                'business_name' => (string) ($registrationRow['business_name'] ?? ''),
                'registration_type' => (string) ($registrationRow['registration_type'] ?? ''),
                'unit_nickname' => (string) ($registrationRow['unit_nickname'] ?? ''),
                'province' => (string) ($registrationRow['province'] ?? ''),
                'district' => (string) ($registrationRow['district'] ?? ''),
                'ward' => (string) ($registrationRow['ward'] ?? ''),
                'detail_address' => (string) ($registrationRow['detail_address'] ?? ''),
                'address_text' => $addressText,
                'status' => (string) ($registrationRow['status'] ?? ''),
                'notes' => (string) ($registrationRow['notes'] ?? ''),
                'files' => $files,
                'license_name' => $licenseName,
                'is_owner' => $isOwner ? 1 : 0,
                'is_super_admin' => $isSuperAdmin ? 1 : 0,
            ],
        ];
    }

    private function hydrateFilesWithUrls(array $files): array
    {
        if (!$files) {
            return [];
        }

        $baseMediaUrl = rtrim(
            (string) $this->storeManager->getStore()->getBaseUrl(UrlInterface::URL_TYPE_MEDIA),
            '/'
        );

        $result = [];
        foreach ($files as $file) {
            if (!is_array($file)) {
                $result[] = $file;
                continue;
            }

            $path = trim((string) ($file['path'] ?? ''));
            if ($path !== '' && empty($file['url'])) {
                $file['url'] = $baseMediaUrl . '/' . ltrim($path, '/');
            }

            $result[] = $file;
        }

        return $result;
    }

    private function getCustomerIdFromRequest(): int
    {
        $token = $this->extractToken();
        if ($token === '') {
            throw new AuthorizationException(__('Ban can dang nhap de xem thong tin.'));
        }

        $tokenModel = $this->tokenFactory->create()->loadByToken($token);
        $customerId = (int) $tokenModel->getCustomerId();
        if ($customerId <= 0) {
            throw new AuthorizationException(__('Token khong hop le hoac da het han.'));
        }

        return $customerId;
    }

    private function extractToken(): string
    {
        $header = trim((string) ($this->request->getHeader(self::AUTH_HEADER) ?? ''));
        if ($header !== '' && preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
            return trim((string) ($matches[1] ?? ''));
        }

        $token = trim((string) $this->request->getParam('token'));
        if ($token !== '') {
            return $token;
        }

        $payload = $this->getJsonPayload();
        return trim((string) ($payload['token'] ?? ($payload['payload']['token'] ?? '')));
    }

    private function getJsonPayload(): array
    {
        $content = (string) $this->request->getContent();
        if ($content === '') {
            return [];
        }

        $data = json_decode($content, true);
        return is_array($data) ? $data : [];
    }

    private function getOwnerRegistrationByLoginCode(string $loginCode): ?array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $row = $connection->fetchRow(
            $connection->select()
                ->from($tableName)
                ->where('login_code = ?', $loginCode)
                ->order('registration_id ASC')
                ->limit(1)
        );

        return is_array($row) ? $row : null;
    }

    private function parseFilesJson(?string $filesJson): array
    {
        if (!$filesJson) {
            return [];
        }

        try {
            $decoded = $this->serializer->unserialize($filesJson);
        } catch (\Throwable) {
            return [];
        }

        return is_array($decoded) ? $decoded : [];
    }

    private function extractLicenseName(array $files): string
    {
        if (!$files) {
            return '';
        }

        $first = $files[0] ?? null;
        if (is_array($first)) {
            if (!empty($first['name'])) {
                return (string) $first['name'];
            }
            if (!empty($first['filename'])) {
                return (string) $first['filename'];
            }
        }

        return is_string($first) ? $first : '';
    }

    private function normalizeBool(mixed $value): bool
    {
        $normalized = strtolower(trim((string) $value));
        return $normalized === '1' || $normalized === 'true' || $normalized === 'yes';
    }

    private function buildAddressText(array $parts): string
    {
        $cleaned = array_values(array_filter(array_map('trim', $parts)));
        return implode(', ', $cleaned);
    }
}
