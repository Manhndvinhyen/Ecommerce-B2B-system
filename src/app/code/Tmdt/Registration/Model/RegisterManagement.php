<?php

namespace Tmdt\Registration\Model;

use Magento\Customer\Api\AccountManagementInterface;
use Magento\Customer\Api\Data\CustomerInterfaceFactory;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\DB\Adapter\DuplicateException;
use Magento\Framework\Exception\InputException;
use Magento\Framework\Serialize\Serializer\Json;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Store\Model\StoreManagerInterface;
use Tmdt\Registration\Api\RegisterInterface;

class RegisterManagement implements RegisterInterface
{
    private const TABLE_NAME = 'tmdt_customer_registration';

    public function __construct(
        private readonly CustomerInterfaceFactory $customerFactory,
        private readonly AccountManagementInterface $accountManagement,
        private readonly StoreManagerInterface $storeManager,
        private readonly ResourceConnection $resourceConnection,
        private readonly Json $serializer,
        private readonly RestRequest $request
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

        $createdCustomer = $this->accountManagement->createAccount($customer, $password);

        try {
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
                'files_json' => $this->serializer->serialize($payload['files'] ?? []),
                'sanitized_payload_json' => $this->buildSanitizedPayloadJson($payload),
                'status' => 'pending',
                'notes' => null,
            ]);
        } catch (DuplicateException $exception) {
            throw new InputException(__('Mã đăng nhập đã tồn tại. Vui lòng chọn mã khác.'));
        }

        return [
            'success' => true,
            'message' => (string) __('Đăng ký đã được lưu vào Magento.'),
            'customer_id' => (int) $createdCustomer->getId(),
        ];
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