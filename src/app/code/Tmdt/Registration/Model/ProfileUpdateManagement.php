<?php

declare(strict_types=1);

namespace Tmdt\Registration\Model;

use Magento\Customer\Api\CustomerRepositoryInterface;
use Magento\Customer\Api\Data\CustomerInterface;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Exception\AuthorizationException;
use Magento\Framework\Exception\InputException;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Integration\Model\Oauth\TokenFactory;
use Tmdt\Registration\Api\ProfileUpdateInterface;

class ProfileUpdateManagement implements ProfileUpdateInterface
{
    private const TABLE_NAME = 'tmdt_customer_registration';
    private const AUTH_HEADER = 'Authorization';

    private const MEDIA_SUBDIR = 'tmdt_registration/licenses';
    private const MAX_FILE_SIZE = 5242880;
    private const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'heif', 'heic'];

    public function __construct(
        private readonly ResourceConnection $resourceConnection,
        private readonly RestRequest $request,
        private readonly CustomerRepositoryInterface $customerRepository,
        private readonly TokenFactory $tokenFactory,
        private readonly \Magento\Framework\Filesystem $filesystem,
        private readonly \Magento\Framework\Serialize\Serializer\Json $serializer
    ) {
    }

    public function save(): array
    {
        $customerId = $this->getCustomerIdFromRequest();

        $bodyParams = $this->request->getBodyParams();
        $payload = is_array($bodyParams) && isset($bodyParams['payload']) ? $bodyParams['payload'] : $bodyParams;

        if (!is_array($payload)) {
            throw new InputException(__('Du lieu cap nhat khong hop le.'));
        }

        $hasUpdate = false;
        $tableUpdate = [];

        $customer = $this->customerRepository->getById($customerId);

        if (array_key_exists('email', $payload)) {
            $email = $this->normalizeEmail((string) $payload['email']);
            if ($email === '') {
                throw new InputException(__('Email khong hop le.'));
            }
            $customer->setEmail($email);
            $tableUpdate['email'] = $email;
            $hasUpdate = true;
        }

        if (array_key_exists('fullName', $payload)) {
            $fullName = trim((string) $payload['fullName']);
            if ($fullName !== '') {
                [$firstName, $lastName] = $this->splitName($fullName);
                $customer->setFirstname($firstName);
                $customer->setLastname($lastName);
                $tableUpdate['full_name'] = $fullName;
                $hasUpdate = true;
            }
        }

        if (array_key_exists('phoneNumber', $payload)) {
            $phoneNumber = $this->normalizePhone((string) $payload['phoneNumber']);
            if ($phoneNumber !== '') {
                $tableUpdate['phone_number'] = $phoneNumber;
                $hasUpdate = true;
            }
        }

        if (array_key_exists('taxCode', $payload)) {
            $taxCode = $this->normalize((string) $payload['taxCode']);
            if ($taxCode !== '') {
                $customer->setTaxvat($taxCode);
                $tableUpdate['tax_code'] = $taxCode;
                $hasUpdate = true;
            }
        }

        if (array_key_exists('businessName', $payload)) {
            $businessName = trim((string) $payload['businessName']);
            if ($businessName !== '') {
                $this->setCustomAttribute($customer, 'tmdt_business_name', $businessName);
                $tableUpdate['business_name'] = $businessName;
                $hasUpdate = true;
            }
        }

        if (array_key_exists('registrationType', $payload)) {
            $registrationType = trim((string) $payload['registrationType']);
            if ($registrationType !== '') {
                $this->setCustomAttribute($customer, 'tmdt_registration_type', $registrationType);
                $tableUpdate['registration_type'] = $registrationType;
                $hasUpdate = true;
            }
        }

        if (array_key_exists('unitNickname', $payload)) {
            $unitNickname = trim((string) $payload['unitNickname']);
            if ($unitNickname !== '') {
                $this->setCustomAttribute($customer, 'tmdt_unit_nickname', $unitNickname);
                $tableUpdate['unit_nickname'] = $unitNickname;
                $hasUpdate = true;
            }
        }

        if (array_key_exists('loginCode', $payload)) {
            $loginCode = trim((string) $payload['loginCode']);
            if ($loginCode !== '') {
                $this->setCustomAttribute($customer, 'tmdt_login_code', $loginCode);
                $tableUpdate['login_code'] = $loginCode;
                $hasUpdate = true;
            }
        }

        if (array_key_exists('province', $payload)) {
            $tableUpdate['province'] = trim((string) $payload['province']);
            $hasUpdate = true;
        }

        if (array_key_exists('district', $payload)) {
            $tableUpdate['district'] = trim((string) $payload['district']);
            $hasUpdate = true;
        }

        if (array_key_exists('ward', $payload)) {
            $tableUpdate['ward'] = trim((string) $payload['ward']);
            $hasUpdate = true;
        }

        if (array_key_exists('detailAddress', $payload)) {
            $tableUpdate['detail_address'] = trim((string) $payload['detailAddress']);
            $hasUpdate = true;
        }

        if (array_key_exists('role', $payload)) {
            $role = trim((string) $payload['role']);
            if ($role === 'seller') {
                $this->setCustomAttribute($customer, 'tmdt_role', 'seller');
                $tableUpdate['role'] = 'seller';
                $tableUpdate['status'] = 'approved';
                $hasUpdate = true;
            }
        }

        if (array_key_exists('files', $payload)) {
            $filesPayload = $payload['files'];
            if (is_array($filesPayload) && $filesPayload !== []) {
                $storedFiles = $this->storeUploadedFiles($customerId, $filesPayload);
                $tableUpdate['files_json'] = $this->serializer->serialize($storedFiles);
                $hasUpdate = true;
            }
        }

        if (!$hasUpdate) {
            throw new InputException(__('Khong co du lieu can cap nhat.'));
        }

        try {
            $this->customerRepository->save($customer);
        } catch (LocalizedException $exception) {
            throw $exception;
        } catch (\Exception $exception) {
            throw new LocalizedException(__('Khong the cap nhat thong tin khach hang.'));
        }

        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);
        $registrationId = $connection->fetchOne(
            $connection->select()
                ->from($tableName, ['registration_id'])
                ->where('customer_id = ?', $customerId)
                ->limit(1)
        );

        if (!$registrationId) {
            throw new LocalizedException(__('Khong tim thay du lieu dang ky cua khach hang.'));
        }

        if ($tableUpdate) {
            $connection->update($tableName, $tableUpdate, ['customer_id = ?' => $customerId]);
        }

        return [
            'success' => true,
            'message' => (string) __('Cap nhat thong tin thanh cong.'),
        ];
    }

    private function getCustomerIdFromRequest(): int
    {
        $token = $this->extractToken();
        if ($token === '') {
            throw new AuthorizationException(__('Ban can dang nhap de cap nhat thong tin.'));
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
        $token = trim((string) ($payload['token'] ?? ($payload['payload']['token'] ?? '')));
        return $token;
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

    private function normalize(string $value): string
    {
        return trim((string) preg_replace('/\s+/', ' ', $value));
    }

    private function normalizeEmail(string $value): string
    {
        return mb_strtolower($this->normalize($value));
    }

    private function normalizePhone(string $value): string
    {
        return preg_replace('/\D+/', '', $value) ?? '';
    }

    private function splitName(string $fullName): array
    {
        $parts = preg_split('/\s+/', trim($fullName)) ?: [];
        if (!$parts) {
            return ['', ''];
        }
        if (count($parts) === 1) {
            return [$parts[0], ''];
        }
        $lastName = array_pop($parts);
        return [implode(' ', $parts), (string) $lastName];
    }

    private function setCustomAttribute(CustomerInterface $customer, string $code, string $value): void
    {
        $customer->setCustomAttribute($code, $value);
    }

    private function storeUploadedFiles(int $customerId, mixed $files): array
    {
        if (!is_array($files) || $files === []) {
            return [];
        }

        $mediaDirectory = $this->filesystem->getDirectoryWrite(\Magento\Framework\App\Filesystem\DirectoryList::MEDIA);
        $result = [];

        foreach ($files as $file) {
            if (!is_array($file)) {
                continue;
            }

            $originalName = trim((string) ($file['name'] ?? ''));
            if ($originalName === '') {
                continue;
            }

            $safeName = basename($originalName);
            $ext = strtolower((string) pathinfo($safeName, PATHINFO_EXTENSION));
            if ($ext === '') {
                $type = strtolower(trim((string) ($file['type'] ?? '')));
                $ext = match ($type) {
                    'image/jpeg' => 'jpg',
                    'image/jpg' => 'jpg',
                    'image/png' => 'png',
                    'application/pdf' => 'pdf',
                    'image/heif' => 'heif',
                    'image/heic' => 'heic',
                    default => '',
                };
            }

            if ($ext === '' || !in_array($ext, self::ALLOWED_EXTENSIONS, true)) {
                throw new InputException(__('Định dạng file giấy phép kinh doanh không được hỗ trợ.'));
            }

            $content = trim((string) ($file['content'] ?? ($file['dataUrl'] ?? '')));
            if ($content === '') {
                throw new InputException(__('Vui lòng tải lên giấy phép kinh doanh.'));
            }

            $base64 = $content;
            if (str_starts_with($base64, 'data:')) {
                $commaPos = strpos($base64, ',');
                $base64 = $commaPos !== false ? substr($base64, $commaPos + 1) : '';
            }
            $base64 = preg_replace('/\s+/', '', (string) $base64) ?? '';

            $binary = base64_decode($base64, true);
            if ($binary === false) {
                throw new InputException(__('File giấy phép kinh doanh không hợp lệ.'));
            }

            if (strlen($binary) > self::MAX_FILE_SIZE) {
                throw new InputException(__('File giấy phép kinh doanh vượt quá dung lượng tối đa 5MB.'));
            }

            $baseName = (string) pathinfo($safeName, PATHINFO_FILENAME);
            $baseName = trim(preg_replace('/[^a-zA-Z0-9._-]+/', '_', $baseName) ?? $baseName, '_');
            if ($baseName === '') {
                $baseName = 'license';
            }

            try {
                $random = bin2hex(random_bytes(8));
            } catch (\Throwable) {
                $random = (string) mt_rand(100000, 999999);
            }

            $relativeDir = self::MEDIA_SUBDIR . '/' . $customerId;
            $relativePath = $relativeDir . '/' . time() . '_' . $random . '_' . $baseName . '.' . $ext;

            $mediaDirectory->create($relativeDir);
            $mediaDirectory->writeFile($relativePath, $binary);

            $result[] = [
                'name' => $safeName,
                'type' => (string) ($file['type'] ?? ''),
                'size' => (int) ($file['size'] ?? strlen($binary)),
                'path' => $relativePath,
            ];
        }

        if ($result === []) {
            throw new InputException(__('Vui lòng tải lên giấy phép kinh doanh.'));
        }

        return $result;
    }
}
