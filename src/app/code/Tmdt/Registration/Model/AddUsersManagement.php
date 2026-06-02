<?php

declare(strict_types=1);

namespace Tmdt\Registration\Model;

use Magento\Customer\Api\AccountManagementInterface;
use Magento\Customer\Api\CustomerRepositoryInterface;
use Magento\Customer\Api\Data\CustomerInterfaceFactory;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Exception\AuthorizationException;
use Magento\Framework\Exception\AlreadyExistsException;
use Magento\Framework\Exception\InputException;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Serialize\Serializer\Json;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Integration\Model\Oauth\TokenFactory;
use Magento\Store\Model\StoreManagerInterface;
use Tmdt\Registration\Api\AddUsersInterface;

class AddUsersManagement implements AddUsersInterface
{
    private const TABLE_NAME = 'tmdt_customer_registration';
    private const AUTH_HEADER = 'Authorization';

    public function __construct(
        private readonly CustomerInterfaceFactory $customerFactory,
        private readonly AccountManagementInterface $accountManagement,
        private readonly CustomerRepositoryInterface $customerRepository,
        private readonly StoreManagerInterface $storeManager,
        private readonly ResourceConnection $resourceConnection,
        private readonly TokenFactory $tokenFactory,
        private readonly RestRequest $request,
        private readonly Json $serializer
    ) {
    }

    public function save(): array
    {
        $ownerId = $this->getCustomerIdFromRequest();
        $owner = $this->customerRepository->getById($ownerId);
        if (!$this->isOwnerCustomer($owner)) {
            throw new AuthorizationException(__('Ban khong co quyen tao co so.'));
        }

        $bodyParams = $this->request->getBodyParams();
        $payload = is_array($bodyParams) && isset($bodyParams['payload']) ? $bodyParams['payload'] : $bodyParams;

        if (!is_array($payload)) {
            throw new InputException(__('Du lieu tao tai khoan khong hop le.'));
        }

        $branchName = trim((string) ($payload['branchName'] ?? ''));
        $phoneNumber = $this->normalizePhone((string) ($payload['phoneNumber'] ?? ''));
        $email = $this->normalizeEmail((string) ($payload['email'] ?? ''));
        $password = (string) ($payload['password'] ?? '');

        if ($branchName === '') {
            throw new InputException(__('Chi nhanh la bat buoc.'));
        }
        if ($phoneNumber === '') {
            throw new InputException(__('So dien thoai la bat buoc.'));
        }
        if ($email === '') {
            throw new InputException(__('Email la bat buoc.'));
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InputException(__('Email khong hop le.'));
        }
        if (trim($password) === '') {
            throw new InputException(__('Mat khau la bat buoc.'));
        }

        $ownerRegistration = $this->getRegistrationByCustomerId($ownerId);
        if (!$ownerRegistration) {
            throw new InputException(__('Khong tim thay thong tin nha hang.'));
        }

        $loginCode = trim((string) ($ownerRegistration['login_code'] ?? ''));
        if ($loginCode === '') {
            throw new InputException(__('Khong tim thay ma nha hang.'));
        }

        if ($this->getRegistrationByLoginCodeAndPhone($loginCode, $phoneNumber)) {
            throw new InputException(__('So dien thoai da ton tai cho nha hang nay.'));
        }

        $fullName = $branchName !== '' ? $branchName : 'Quan ly chi nhanh';
        [$firstName, $lastName] = $this->splitName($fullName);

        $customer = $this->customerFactory->create();
        $customer->setWebsiteId((int) $this->storeManager->getStore()->getWebsiteId());
        $customer->setEmail($email);
        $customer->setFirstname($firstName);
        $customer->setLastname($lastName);
        $customer->setTaxvat((string) ($ownerRegistration['tax_code'] ?? ''));
        $customer->setCustomAttribute('tmdt_business_name', (string) ($ownerRegistration['business_name'] ?? ''));
        $customer->setCustomAttribute('tmdt_login_code', $loginCode);
        $customer->setCustomAttribute('tmdt_registration_type', (string) ($ownerRegistration['registration_type'] ?? ''));
        $customer->setCustomAttribute('tmdt_unit_nickname', $branchName);
        $customer->setCustomAttribute('is_owner', 0);
        $customer->setCustomAttribute('is_super_admin', 0);
        $customer->setCustomAttribute('tmdt_role', 'branch');

        try {
            $createdCustomer = $this->accountManagement->createAccount($customer, $password);
        } catch (AlreadyExistsException) {
            throw new InputException(__('Email da ton tai.'));
        } catch (LocalizedException $exception) {
            $message = trim((string) $exception->getMessage());
            throw new InputException(__($message !== '' ? $message : 'Khong the tao tai khoan co so.'));
        } catch (\Throwable) {
            throw new InputException(__('Khong the tao tai khoan co so.'));
        }

        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);
        $connection->insert($tableName, [
            'customer_id' => (int) $createdCustomer->getId(),
            'email' => $email,
            'tax_code' => (string) ($ownerRegistration['tax_code'] ?? ''),
            'business_name' => (string) ($ownerRegistration['business_name'] ?? ''),
            'registration_type' => (string) ($ownerRegistration['registration_type'] ?? ''),
            'province' => (string) ($ownerRegistration['province'] ?? ''),
            'district' => (string) ($ownerRegistration['district'] ?? ''),
            'ward' => (string) ($ownerRegistration['ward'] ?? ''),
            'detail_address' => (string) ($ownerRegistration['detail_address'] ?? ''),
            'unit_nickname' => $branchName,
            'login_code' => $loginCode,
            'full_name' => $fullName,
            'phone_number' => $phoneNumber,
            'agree_to_terms' => 1,
            'files_json' => null,
            'sanitized_payload_json' => $this->serializer->serialize([
                'loginCode' => $loginCode,
                'branchName' => $branchName,
                'phoneNumber' => $phoneNumber,
                'email' => $email,
            ]),
            'status' => 'approved',
            'role' => 'branch',
            'notes' => null,
        ]);

        return [
            'success' => true,
            'message' => (string) __('Tao tai khoan co so thanh cong.'),
            'customer_id' => (int) $createdCustomer->getId(),
        ];
    }

    private function getRegistrationByCustomerId(int $customerId): ?array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $row = $connection->fetchRow(
            $connection->select()
                ->from($tableName)
                ->where('customer_id = ?', $customerId)
                ->order('registration_id ASC')
                ->limit(1)
        );

        return is_array($row) ? $row : null;
    }

    private function getRegistrationByLoginCodeAndPhone(string $loginCode, string $phoneNumber): ?array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $row = $connection->fetchRow(
            $connection->select()
                ->from($tableName, ['customer_id'])
                ->where('login_code = ?', $loginCode)
                ->where('phone_number = ?', $phoneNumber)
                ->limit(1)
        );

        return is_array($row) ? $row : null;
    }

    private function getCustomerIdFromRequest(): int
    {
        $token = $this->extractToken();
        if ($token === '') {
            throw new AuthorizationException(__('Ban can dang nhap de tao tai khoan.'));
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

    private function normalizePhone(string $value): string
    {
        return preg_replace('/\D+/', '', $value) ?? '';
    }

    private function normalizeEmail(string $value): string
    {
        return strtolower(trim($value));
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

    private function isOwnerCustomer(\Magento\Customer\Api\Data\CustomerInterface $customer): bool
    {
        $isOwnerAttr = $customer->getCustomAttribute('is_owner');
        $isSuperAttr = $customer->getCustomAttribute('is_super_admin');
        $roleAttr = $customer->getCustomAttribute('tmdt_role');
        $isOwner = $isOwnerAttr ? $this->normalizeBool($isOwnerAttr->getValue()) : false;
        $isSuper = $isSuperAttr ? $this->normalizeBool($isSuperAttr->getValue()) : false;
        $role = $roleAttr ? strtolower(trim((string) $roleAttr->getValue())) : '';
        return $role !== 'branch' && ($isOwner || $isSuper || $role === '' || $role === 'manager' || $role === 'seller');
    }

    private function normalizeBool(mixed $value): bool
    {
        $normalized = strtolower(trim((string) $value));
        return $normalized === '1' || $normalized === 'true' || $normalized === 'yes';
    }

}
