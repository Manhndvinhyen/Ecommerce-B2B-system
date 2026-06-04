<?php

namespace Tmdt\Registration\Model;

use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Exception\AuthenticationException;
use Magento\Framework\Exception\InputException;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Integration\Api\CustomerTokenServiceInterface;
use Tmdt\Registration\Api\LoginInterface;

class LoginManagement implements LoginInterface
{
    private const TABLE_NAME = 'tmdt_customer_registration';

    public function __construct(
        private readonly ResourceConnection $resourceConnection,
        private readonly RestRequest $request,
        private readonly CustomerTokenServiceInterface $customerTokenService
    ) {
    }

    public function save(): array
    {
        $bodyParams = $this->request->getBodyParams();
        $payload = is_array($bodyParams) && isset($bodyParams['payload']) ? $bodyParams['payload'] : $bodyParams;

        if (!is_array($payload)) {
            throw new InputException(__('Du lieu dang nhap khong hop le.'));
        }

        $loginCode = trim((string) ($payload['restaurantCode'] ?? $payload['loginCode'] ?? ''));
        $identifier = trim((string) ($payload['identifier'] ?? ''));
        $password = (string) ($payload['password'] ?? '');

        if ($loginCode === '') {
            throw new InputException(__('Mã nhà hàng là bắt buộc.'));
        }

        if ($identifier === '') {
            throw new InputException(__('Email hoặc số điện thoại là bắt buộc.'));
        }

        if (trim($password) === '') {
            throw new InputException(__('Mật khẩu là bắt buộc.'));
        }

        $registrationRow = $this->getRegistrationByLoginCodeAndIdentifier($loginCode, $identifier);
        if ($registrationRow === null) {
            throw new AuthenticationException(__('Thông tin đăng nhập không hợp lệ.'));
        }

        $status = strtolower(trim((string) ($registrationRow['status'] ?? '')));
        $role = strtolower(trim((string) ($registrationRow['role'] ?? '')));
        if ($status === 'inactive') {
            throw new AuthenticationException(__('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị.'));
        }

        if ($role === 'seller' && $status !== 'approved') {
            throw new AuthenticationException(__('Tai khoan kinh doanh dang cho duyet hoac da bi tu choi.'));
        }

        try {
            $token = $this->customerTokenService->createCustomerAccessToken((string) $registrationRow['email'], $password);
        } catch (AuthenticationException | LocalizedException $exception) {
            throw new AuthenticationException(__('Thông tin đăng nhập không hợp lệ.'));
        }

        return [
            'success' => true,
            'message' => (string) __('Đăng nhập thành công.'),
            'token' => (string) $token,
            'customer_id' => (int) $registrationRow['customer_id'],
            'email' => (string) $registrationRow['email'],
            'full_name' => (string) ($registrationRow['full_name'] ?? ''),
            'branch_name' => (string) ($registrationRow['unit_nickname'] ?? ''),
            'role' => $role,
            'redirect_url' => '/react/index.html',
        ];
    }

    private function getRegistrationByLoginCodeAndIdentifier(string $loginCode, string $identifier): ?array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);
        $normalizedIdentifier = mb_strtolower(trim($identifier));
        $normalizedPhone = $this->normalizePhone($identifier);
        $isEmail = str_contains($normalizedIdentifier, '@');

        $select = $connection->select()
            ->from($tableName, ['customer_id', 'email', 'phone_number', 'full_name', 'unit_nickname', 'status', 'role'])
            ->where('login_code = ?', $loginCode)
            ->limit(1);

        if ($isEmail) {
            $select->where('LOWER(email) = ?', $normalizedIdentifier);
        } elseif ($normalizedPhone !== '') {
            $select->where('phone_number = ?', $normalizedPhone);
        } else {
            $select->where('LOWER(email) = ?', $normalizedIdentifier);
        }

        $row = $connection->fetchRow($select);

        return is_array($row) ? $row : null;
    }

    private function normalizePhone(string $value): string
    {
        return preg_replace('/\D+/', '', $value) ?? '';
    }
}
