<?php

namespace Tmdt\Registration\Model;

use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Exception\AuthenticationException;
use Magento\Framework\Exception\InputException;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Framework\Encryption\EncryptorInterface;
use Tmdt\Registration\Api\ForgotPasswordResetInterface;

class ForgotPasswordResetManagement implements ForgotPasswordResetInterface
{
    private const TABLE_NAME = 'tmdt_customer_registration';
    private const OTP_MAX_ATTEMPTS = 5;

    public function __construct(
        private readonly ResourceConnection $resourceConnection,
        private readonly RestRequest $request,
        private readonly EncryptorInterface $encryptor
    ) {
    }

    public function save(): array
    {
        $payload = $this->getPayload();

        $restaurantCode = trim((string) ($payload['restaurantCode'] ?? $payload['loginCode'] ?? ''));
        $email = mb_strtolower(trim((string) ($payload['email'] ?? '')));
        $otpCode = trim((string) ($payload['otpCode'] ?? $payload['otp'] ?? ''));
        $newPassword = (string) ($payload['newPassword'] ?? '');
        $confirmPassword = (string) ($payload['confirmPassword'] ?? '');

        if ($restaurantCode === '') {
            throw new InputException(__('Mã nhà hàng là bắt buộc.'));
        }

        if ($email === '') {
            throw new InputException(__('Email là bắt buộc.'));
        }

        if ($otpCode === '') {
            throw new InputException(__('Mã OTP là bắt buộc.'));
        }

        if ($newPassword === '' || $confirmPassword === '') {
            throw new InputException(__('Mật khẩu mới và xác nhận mật khẩu là bắt buộc.'));
        }

        if ($newPassword !== $confirmPassword) {
            throw new InputException(__('Mật khẩu xác nhận không khớp.'));
        }

        if (mb_strlen(trim($newPassword)) < 8) {
            throw new InputException(__('Mật khẩu phải có ít nhất 8 ký tự.'));
        }

        $registrationRow = $this->getRegistrationByLoginCode($restaurantCode);
        if ($registrationRow === null) {
            throw new AuthenticationException(__('Thông tin khôi phục mật khẩu không hợp lệ.'));
        }

        $registrationEmail = mb_strtolower(trim((string) ($registrationRow['email'] ?? '')));
        if ($registrationEmail !== $email) {
            throw new AuthenticationException(__('Thông tin khôi phục mật khẩu không hợp lệ.'));
        }

        if ((int) ($registrationRow['password_reset_otp_attempts'] ?? 0) >= self::OTP_MAX_ATTEMPTS) {
            throw new InputException(__('Mã OTP đã hết lượt thử. Vui lòng yêu cầu mã OTP mới.'));
        }

        $otpHash = (string) ($registrationRow['password_reset_otp_hash'] ?? '');
        $otpExpiresAt = (string) ($registrationRow['password_reset_otp_expires_at'] ?? '');

        if ($otpHash === '' || $otpExpiresAt === '') {
            throw new InputException(__('Mã OTP không hợp lệ hoặc đã hết hạn.'));
        }

        if (strtotime($otpExpiresAt) < time()) {
            $this->clearOtp((int) $registrationRow['registration_id']);
            throw new InputException(__('Mã OTP không hợp lệ hoặc đã hết hạn.'));
        }

        if (!$this->encryptor->validateHash($otpCode, $otpHash)) {
            $this->increaseOtpAttempts((int) $registrationRow['registration_id'], (int) ($registrationRow['password_reset_otp_attempts'] ?? 0));
            throw new InputException(__('Mã OTP không chính xác.'));
        }

        $this->updateCustomerPassword((int) $registrationRow['customer_id'], $newPassword);
        $this->clearOtp((int) $registrationRow['registration_id']);

        return [
            'success' => true,
            'message' => (string) __('Đặt lại mật khẩu thành công.'),
        ];
    }

    private function getPayload(): array
    {
        $bodyParams = $this->request->getBodyParams();
        $payload = is_array($bodyParams) && isset($bodyParams['payload']) ? $bodyParams['payload'] : $bodyParams;

        if (!is_array($payload)) {
            throw new InputException(__('Dữ liệu đặt lại mật khẩu không hợp lệ.'));
        }

        return $payload;
    }

    private function getRegistrationByLoginCode(string $loginCode): ?array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $row = $connection->fetchRow(
            $connection->select()
                ->from($tableName)
                ->where('login_code = ?', $loginCode)
                ->limit(1)
        );

        return is_array($row) ? $row : null;
    }

    private function increaseOtpAttempts(int $registrationId, int $currentAttempts): void
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $nextAttempts = $currentAttempts + 1;

        $updateData = [
            'password_reset_otp_attempts' => $nextAttempts,
        ];

        if ($nextAttempts >= self::OTP_MAX_ATTEMPTS) {
            $updateData['password_reset_otp_hash'] = null;
            $updateData['password_reset_otp_expires_at'] = null;
        }

        $connection->update(
            $tableName,
            $updateData,
            ['registration_id = ?' => $registrationId]
        );
    }

    private function clearOtp(int $registrationId): void
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $connection->update(
            $tableName,
            [
                'password_reset_otp_hash' => null,
                'password_reset_otp_expires_at' => null,
                'password_reset_otp_attempts' => 0,
            ],
            ['registration_id = ?' => $registrationId]
        );
    }

    private function updateCustomerPassword(int $customerId, string $newPassword): void
    {
        if ($customerId <= 0) {
            throw new AuthenticationException(__('Tài khoản không hợp lệ.'));
        }

        $connection = $this->resourceConnection->getConnection();
        $customerTable = $this->resourceConnection->getTableName('customer_entity');

        $passwordHash = $this->encryptor->getHash($newPassword, true);

        $updated = $connection->update(
            $customerTable,
            ['password_hash' => $passwordHash],
            ['entity_id = ?' => $customerId]
        );

        if ($updated <= 0) {
            throw new AuthenticationException(__('Không thể cập nhật mật khẩu.'));
        }
    }
}
