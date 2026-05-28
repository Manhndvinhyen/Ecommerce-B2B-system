<?php

namespace Tmdt\Registration\Model;

use Magento\Customer\Api\AccountManagementInterface;
use Magento\Customer\Api\Data\CustomerInterfaceFactory;
use Magento\Customer\Model\ResourceModel\Customer\CollectionFactory as CustomerCollectionFactory;
use Magento\Framework\App\Filesystem\DirectoryList;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\DB\Adapter\DuplicateException;
use Magento\Framework\Exception\InputException;
use Magento\Framework\Filesystem;
use Magento\Framework\Serialize\Serializer\Json;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Store\Model\StoreManagerInterface;
use Tmdt\Registration\Api\RegisterInterface;

class RegisterManagement implements RegisterInterface
{
    private const TABLE_NAME = 'tmdt_customer_registration';
    private const MEDIA_SUBDIR = 'tmdt_registration/licenses';
    private const MAX_FILE_SIZE = 5242880;
    private const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'heif', 'heic'];

    public function __construct(
        private readonly CustomerInterfaceFactory $customerFactory,
        private readonly AccountManagementInterface $accountManagement,
        private readonly StoreManagerInterface $storeManager,
        private readonly ResourceConnection $resourceConnection,
        private readonly CustomerCollectionFactory $customerCollectionFactory,
        private readonly Json $serializer,
        private readonly RestRequest $request,
        private readonly Filesystem $filesystem
    ) {
    }

    public function save(): array
    {
        $bodyParams = $this->request->getBodyParams();
        $payload = is_array($bodyParams) && isset($bodyParams['payload']) ? $bodyParams['payload'] : $bodyParams;

        if (!is_array($payload)) {
            throw new InputException(__('Du lieu dang ky khong hop le.'));
        }

        $this->validatePayload($payload);

        $email = $this->normalize((string) $payload['email']);
        $password = (string) $payload['password'];
        $fullName = trim((string) $payload['fullName']);
        $loginCode = trim((string) $payload['loginCode']);
        $taxCode = $this->normalize((string) $payload['taxCode']);
        $businessName = trim((string) $payload['businessName']);
        $registrationType = trim((string) $payload['registrationType']);
        $unitNickname = trim((string) $payload['unitNickname']);
        $phoneNumber = $this->normalize((string) $payload['phoneNumber']);
        $agreeToTerms = filter_var($payload['agreeToTerms'] ?? false, FILTER_VALIDATE_BOOLEAN);
        [$firstName, $lastName] = $this->splitName($fullName);

        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $existingRegistrationId = $connection->fetchOne(
            $connection->select()
                ->from($tableName, ['registration_id'])
                ->where('login_code = ?', $loginCode)
                ->limit(1)
        );

        if ($existingRegistrationId) {
            throw new InputException(__('Mã đăng nhập đã tồn tại. Vui lòng chọn mã khác.'));
        }

        $customer = $this->customerFactory->create();
        $customer->setWebsiteId((int) $this->storeManager->getStore()->getWebsiteId());
        $customer->setEmail($email);
        $customer->setFirstname($firstName);
        $customer->setLastname($lastName);
        $customer->setTaxvat($taxCode);
        $customer->setCustomAttribute('tmdt_business_name', $businessName);
        $customer->setCustomAttribute('tmdt_login_code', $loginCode);
        $customer->setCustomAttribute('tmdt_registration_type', $registrationType);
        $customer->setCustomAttribute('tmdt_unit_nickname', $unitNickname);
        $customer->setCustomAttribute('is_owner', $this->shouldAssignOwnerFlag() ? 1 : 0);

        $createdCustomer = $this->accountManagement->createAccount($customer, $password);

        try {
            $storedFiles = $this->storeUploadedFiles((int) $createdCustomer->getId(), $payload['files'] ?? []);

            $connection->insert($tableName, [
                'customer_id' => (int) $createdCustomer->getId(),
                'email' => $email,
                'tax_code' => $taxCode,
                'business_name' => $businessName,
                'registration_type' => $registrationType,
                'province' => trim((string) $payload['province']),
                'district' => trim((string) ($payload['district'] ?? '')),
                'ward' => trim((string) $payload['ward']),
                'detail_address' => trim((string) ($payload['detailAddress'] ?? '')),
                'unit_nickname' => $unitNickname,
                'login_code' => $loginCode,
                'full_name' => $fullName,
                'phone_number' => $phoneNumber,
                'agree_to_terms' => (int) $agreeToTerms,
                'files_json' => $this->serializer->serialize($storedFiles),
                'sanitized_payload_json' => $this->buildSanitizedPayloadJson($payload),
                'status' => 'pending',
                'notes' => null,
            ]);
        } catch (DuplicateException $exception) {
            $this->deleteCreatedCustomer((int) $createdCustomer->getId());
            throw new InputException(__('Mã đăng nhập đã tồn tại. Vui lòng chọn mã khác.'));
        } catch (\Throwable $exception) {
            $this->deleteCreatedCustomer((int) $createdCustomer->getId());
            throw $exception;
        }

        return [
            'success' => true,
            'message' => (string) __('Đăng ký đã được lưu vào Magento.'),
            'customer_id' => (int) $createdCustomer->getId(),
        ];
    }

    private function deleteCreatedCustomer(int $customerId): void
    {
        if ($customerId <= 0) {
            return;
        }

        try {
            \Magento\Framework\App\ObjectManager::getInstance()
                ->get(\Magento\Customer\Api\CustomerRepositoryInterface::class)
                ->deleteById($customerId);
        } catch (\Throwable) {
        }
    }

    private function shouldAssignOwnerFlag(): bool
    {
        try {
            $collection = $this->customerCollectionFactory->create();
            $collection->addAttributeToSelect('entity_id');
            $collection->addAttributeToFilter('is_owner', 1);
            $collection->setPageSize(1);
            return $collection->getSize() === 0;
        } catch (\Throwable $exception) {
            return false;
        }
    }

    private function validatePayload(array $payload): void
    {
        $requiredFields = [
            'taxCode' => 'Mã số thuế',
            'businessName' => 'Tên doanh nghiệp',
            'registrationType' => 'Đối tượng đăng ký',
            'province' => 'Tỉnh/Thành',
            'ward' => 'Phường/Xã',
            'unitNickname' => 'Tên gợi nhớ đơn vị',
            'loginCode' => 'Mã đăng nhập',
            'fullName' => 'Họ và tên',
            'phoneNumber' => 'Số điện thoại',
            'email' => 'Email',
            'password' => 'Mật khẩu',
            'confirmPassword' => 'Xác nhận mật khẩu',
        ];

        foreach ($requiredFields as $field => $label) {
            if (!isset($payload[$field]) || trim((string) $payload[$field]) === '') {
                throw new InputException(__('%1 là bắt buộc.', $label));
            }
        }

        if ((string) $payload['password'] !== (string) $payload['confirmPassword']) {
            throw new InputException(__('Mật khẩu xác nhận không khớp.'));
        }

        $agreeToTerms = filter_var($payload['agreeToTerms'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if (!$agreeToTerms) {
            throw new InputException(__('Bạn cần đồng ý với điều khoản sử dụng.'));
        }

        if (mb_strlen(trim((string) $payload['password'])) < 8) {
            throw new InputException(__('Mật khẩu phải có ít nhất 8 ký tự.'));
        }

        $files = $payload['files'] ?? null;
        if (!is_array($files) || count($files) === 0) {
            throw new InputException(__('Vui lòng tải lên giấy phép kinh doanh.'));
        }

        $firstFile = $files[0] ?? null;
        if (!is_array($firstFile)) {
            throw new InputException(__('Vui lòng tải lên giấy phép kinh doanh.'));
        }

        if (trim((string) ($firstFile['name'] ?? '')) === '') {
            throw new InputException(__('Vui lòng tải lên giấy phép kinh doanh.'));
        }

        $content = (string) ($firstFile['content'] ?? ($firstFile['dataUrl'] ?? ''));
        if (trim($content) === '') {
            throw new InputException(__('Vui lòng tải lên giấy phép kinh doanh.'));
        }

        $this->validateLicenseFilePayload($firstFile);
    }

    private function validateLicenseFilePayload(array $file): void
    {
        $originalName = trim((string) ($file['name'] ?? ''));
        $safeName = $originalName !== '' ? basename($originalName) : '';
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

        $declaredSize = (int) ($file['size'] ?? 0);
        if ($declaredSize > self::MAX_FILE_SIZE) {
            throw new InputException(__('File giấy phép kinh doanh vượt quá dung lượng tối đa 5MB.'));
        }

    }

    private function storeUploadedFiles(int $customerId, mixed $files): array
    {
        if (!is_array($files) || $files === []) {
            return [];
        }

        $mediaDirectory = $this->filesystem->getDirectoryWrite(DirectoryList::MEDIA);
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

    private function splitName(string $fullName): array
    {
        $parts = preg_split('/\s+/', trim($fullName)) ?: [];

        if ($parts === []) {
            return ['Người', 'đại diện'];
        }

        if (count($parts) === 1) {
            return [$parts[0], 'Đại diện'];
        }

        $lastName = array_pop($parts);

        return [implode(' ', $parts), $lastName];
    }

    private function normalize(string $value): string
    {
        return trim(preg_replace('/\s+/', ' ', $value) ?? $value);
    }

    private function buildSanitizedPayloadJson(array $payload): string
    {
        unset($payload['password'], $payload['confirmPassword']);

        return $this->serializer->serialize($payload);
    }
}
