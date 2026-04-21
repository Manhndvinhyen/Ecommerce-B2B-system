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

        $registrationRow = $this->getRegistrationByLoginCode($loginCode);
        if ($registrationRow === null || !$this->isMatchingIdentifier($identifier, (string) $registrationRow['email'], (string) $registrationRow['phone_number'])) {
            throw new AuthenticationException(__('Thông tin đăng nhập không hợp lệ.'));
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
            'redirect_url' => '/customer/account',
        ];
    }

    private function getRegistrationByLoginCode(string $loginCode): ?array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $row = $connection->fetchRow(
            $connection->select()
                ->from($tableName, ['customer_id', 'email', 'phone_number'])
                ->where('login_code = ?', $loginCode)
                ->limit(1)
        );

        return is_array($row) ? $row : null;
    }

    private function isMatchingIdentifier(string $identifier, string $email, string $phoneNumber): bool
    {
        $normalizedIdentifier = mb_strtolower(trim($identifier));
        $normalizedEmail = mb_strtolower(trim($email));

        if ($normalizedIdentifier === $normalizedEmail) {
            return true;
        }

        return $this->normalizePhone($identifier) !== ''
            && $this->normalizePhone($identifier) === $this->normalizePhone($phoneNumber);
    }

    private function normalizePhone(string $value): string
    {
        return preg_replace('/\D+/', '', $value) ?? '';
    }
}