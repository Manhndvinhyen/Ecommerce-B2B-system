<?php

namespace Tmdt\Registration\Model;

use Magento\Framework\App\Area;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Exception\AuthenticationException;
use Magento\Framework\Exception\InputException;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Mail\Template\TransportBuilder;
use Magento\Framework\Encryption\EncryptorInterface;
use Magento\Framework\Translate\Inline\StateInterface;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Store\Model\StoreManagerInterface;
use Psr\Log\LoggerInterface;
use Tmdt\Registration\Api\ForgotPasswordRequestOtpInterface;

class ForgotPasswordRequestOtpManagement implements ForgotPasswordRequestOtpInterface
{
    private const TABLE_NAME = 'tmdt_customer_registration';
    private const OTP_EXPIRES_MINUTES = 10;

    public function __construct(
        private readonly ResourceConnection $resourceConnection,
        private readonly RestRequest $request,
        private readonly EncryptorInterface $encryptor,
        private readonly TransportBuilder $transportBuilder,
        private readonly StateInterface $inlineTranslation,
        private readonly StoreManagerInterface $storeManager,
        private readonly LoggerInterface $logger
    ) {
    }

    public function save(): array
    {
        $payload = $this->getPayload();

        $restaurantCode = trim((string) ($payload['restaurantCode'] ?? $payload['loginCode'] ?? ''));
        $email = mb_strtolower(trim((string) ($payload['email'] ?? '')));

        if ($restaurantCode === '') {
            throw new InputException(__('Mã nhà hàng là bắt buộc.'));
        }

        if ($email === '') {
            throw new InputException(__('Email là bắt buộc.'));
        }

        $registrationRow = $this->getRegistrationByLoginCode($restaurantCode);
        if ($registrationRow === null) {
            throw new AuthenticationException(__('Thông tin khôi phục mật khẩu không hợp lệ.'));
        }

        $registrationEmail = mb_strtolower(trim((string) ($registrationRow['email'] ?? '')));
        if ($registrationEmail !== $email) {
            throw new AuthenticationException(__('Thông tin khôi phục mật khẩu không hợp lệ.'));
        }

        $otpCode = (string) random_int(100000, 999999);
        $otpHash = $this->encryptor->getHash($otpCode, true);
        $expiresAt = gmdate('Y-m-d H:i:s', time() + (self::OTP_EXPIRES_MINUTES * 60));

        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $connection->update(
            $tableName,
            [
                'password_reset_otp_hash' => $otpHash,
                'password_reset_otp_expires_at' => $expiresAt,
                'password_reset_otp_attempts' => 0,
            ],
            ['registration_id = ?' => (int) $registrationRow['registration_id']]
        );

        try {
            $this->sendOtpEmail($email, $otpCode, $restaurantCode);
        } catch (LocalizedException $exception) {
            $this->clearOtp((int) $registrationRow['registration_id']);
            throw $exception;
        }

        $response = [
            'success' => true,
            'message' => (string) __('Mã OTP đã được gửi tới email của bạn.'),
            'expires_in_minutes' => self::OTP_EXPIRES_MINUTES,
        ];

        if ($this->shouldExposeOtpForDebug()) {
            $response['debug_otp'] = $otpCode;
            $this->logger->info('Forgot-password OTP generated in debug mode.', [
                'login_code' => $restaurantCode,
                'email' => $email,
            ]);
        }

        return $response;
    }

    private function getPayload(): array
    {
        $bodyParams = $this->request->getBodyParams();
        $payload = is_array($bodyParams) && isset($bodyParams['payload']) ? $bodyParams['payload'] : $bodyParams;

        if (!is_array($payload)) {
            throw new InputException(__('Dữ liệu yêu cầu OTP không hợp lệ.'));
        }

        return $payload;
    }

    private function getRegistrationByLoginCode(string $loginCode): ?array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $row = $connection->fetchRow(
            $connection->select()
                ->from($tableName, ['registration_id', 'email'])
                ->where('login_code = ?', $loginCode)
                ->limit(1)
        );

        return is_array($row) ? $row : null;
    }

    private function sendOtpEmail(string $email, string $otpCode, string $restaurantCode): void
    {
        $smtpConfig = $this->getSmtpConfig();

        if ($smtpConfig !== null) {
            $this->sendOtpEmailViaSmtp($email, $otpCode, $restaurantCode, $smtpConfig);
            return;
        }

        $storeId = (int) $this->storeManager->getStore()->getId();

        try {
            $this->inlineTranslation->suspend();

            $transport = $this->transportBuilder
                ->setTemplateIdentifier('tmdt_registration_password_reset_otp')
                ->setTemplateOptions([
                    'area' => Area::AREA_FRONTEND,
                    'store' => $storeId,
                ])
                ->setTemplateVars([
                    'otp_code' => $otpCode,
                    'restaurant_code' => $restaurantCode,
                    'expires_minutes' => self::OTP_EXPIRES_MINUTES,
                ])
                ->setFromByScope('general', $storeId)
                ->addTo($email)
                ->getTransport();

            $transport->sendMessage();
            $this->inlineTranslation->resume();
        } catch (\Throwable $exception) {
            $this->inlineTranslation->resume();
            $this->logger->error('Failed to send forgot-password OTP email.', [
                'email' => $email,
                'exception' => $exception->getMessage(),
            ]);
            throw new LocalizedException(__('Không thể gửi mã OTP lúc này. Vui lòng thử lại sau.'));
        }
    }

    /**
     * @param array<string, string|int> $smtpConfig
     */
    private function sendOtpEmailViaSmtp(string $email, string $otpCode, string $restaurantCode, array $smtpConfig): void
    {
        $subject = 'Ma OTP dat lai mat khau';
        $body = "Xin chao,\n"
            . "Ban da yeu cau dat lai mat khau cho ma nha hang: {$restaurantCode}\n"
            . "Ma OTP cua ban la: {$otpCode}\n"
            . 'Ma OTP co hieu luc trong ' . self::OTP_EXPIRES_MINUTES . " phut.\n"
            . 'Neu ban khong thuc hien yeu cau nay, vui long bo qua email.';

        $fromEmail = (string) $smtpConfig['from_email'];
        $fromName = (string) $smtpConfig['from_name'];
        $username = (string) $smtpConfig['username'];
        $password = (string) $smtpConfig['password'];
        $host = (string) $smtpConfig['host'];
        $port = (int) $smtpConfig['port'];
        $encryption = (string) $smtpConfig['encryption'];

        $scheme = $encryption === 'ssl' ? 'ssl://' : '';
        $socketAddress = $scheme . $host . ':' . $port;

        $headers = [
            'From: ' . $fromName . ' <' . $fromEmail . '>',
            'To: <' . $email . '>',
            'Subject: ' . $subject,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];

        $messageData = implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n";

        try {
            $socket = @stream_socket_client($socketAddress, $errno, $errstr, 15);
            if (!is_resource($socket)) {
                throw new LocalizedException(__('Khong the ket noi SMTP server: %1', $errstr ?: 'unknown'));
            }

            stream_set_timeout($socket, 15);

            $this->smtpRead($socket, [220]);
            $this->smtpWrite($socket, 'EHLO localhost', [250]);

            if ($encryption === 'tls') {
                $this->smtpWrite($socket, 'STARTTLS', [220]);
                $tlsEnabled = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                if ($tlsEnabled !== true) {
                    throw new LocalizedException(__('Khong the bat ket noi TLS voi SMTP server.'));
                }
                $this->smtpWrite($socket, 'EHLO localhost', [250]);
            }

            $this->smtpWrite($socket, 'AUTH LOGIN', [334]);
            $this->smtpWrite($socket, base64_encode($username), [334]);
            $this->smtpWrite($socket, base64_encode($password), [235]);
            $this->smtpWrite($socket, 'MAIL FROM:<' . $fromEmail . '>', [250]);
            $this->smtpWrite($socket, 'RCPT TO:<' . $email . '>', [250, 251]);
            $this->smtpWrite($socket, 'DATA', [354]);
            $this->smtpWriteRaw($socket, $messageData . ".\r\n");
            $this->smtpRead($socket, [250]);
            $this->smtpWrite($socket, 'QUIT', [221]);
            fclose($socket);
        } catch (\Throwable $exception) {
            $this->logger->error('Failed to send forgot-password OTP email via SMTP.', [
                'email' => $email,
                'host' => $smtpConfig['host'],
                'exception' => $exception->getMessage(),
            ]);
            throw new LocalizedException(__('Không thể gửi mã OTP qua SMTP. Vui lòng kiểm tra cấu hình email.'));
        }
    }

    /**
     * @param resource $socket
     * @param array<int> $expectedCodes
     */
    private function smtpWrite($socket, string $command, array $expectedCodes): void
    {
        $this->smtpWriteRaw($socket, $command . "\r\n");
        $this->smtpRead($socket, $expectedCodes);
    }

    /**
     * @param resource $socket
     */
    private function smtpWriteRaw($socket, string $data): void
    {
        $result = fwrite($socket, $data);
        if ($result === false) {
            throw new LocalizedException(__('Khong the gui lenh SMTP.'));
        }
    }

    /**
     * @param resource $socket
     * @param array<int> $expectedCodes
     */
    private function smtpRead($socket, array $expectedCodes): void
    {
        $lastLine = '';

        while (($line = fgets($socket, 515)) !== false) {
            $lastLine = trim($line);
            if (strlen($line) < 4 || $line[3] !== '-') {
                break;
            }
        }

        if ($lastLine === '') {
            throw new LocalizedException(__('Khong nhan duoc phan hoi tu SMTP server.'));
        }

        $code = (int) substr($lastLine, 0, 3);
        if (!in_array($code, $expectedCodes, true)) {
            throw new LocalizedException(__('SMTP phan hoi khong hop le: %1', $lastLine));
        }
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

    private function shouldExposeOtpForDebug(): bool
    {
        $flag = mb_strtolower(trim((string) getenv('TMDT_EXPOSE_OTP')));

        return in_array($flag, ['1', 'true', 'yes', 'on'], true);
    }

    /**
     * @return array<string, string|int>|null
     */
    private function getSmtpConfig(): ?array
    {
        $host = trim((string) getenv('TMDT_SMTP_HOST'));
        $username = trim((string) getenv('TMDT_SMTP_USERNAME'));
        $password = str_replace(' ', '', trim((string) getenv('TMDT_SMTP_PASSWORD')));

        if ($host === '' || $username === '' || $password === '') {
            return null;
        }

        $port = (int) getenv('TMDT_SMTP_PORT');
        if ($port <= 0) {
            $port = 587;
        }

        $encryption = mb_strtolower(trim((string) getenv('TMDT_SMTP_ENCRYPTION')));
        if (!in_array($encryption, ['tls', 'ssl', ''], true)) {
            $encryption = 'tls';
        }

        $fromEmail = trim((string) getenv('TMDT_SMTP_FROM_EMAIL'));
        $fromEmail = trim($fromEmail, "<> ");
        if ($fromEmail === '') {
            $fromEmail = $username;
        }

        if (filter_var($fromEmail, FILTER_VALIDATE_EMAIL) === false) {
            $fromEmail = $username;
        }

        $fromName = trim((string) getenv('TMDT_SMTP_FROM_NAME'));
        if ($fromName === '') {
            $fromName = 'TMDT Shop';
        }

        return [
            'host' => $host,
            'port' => $port,
            'username' => $username,
            'password' => $password,
            'encryption' => $encryption,
            'from_email' => $fromEmail,
            'from_name' => $fromName,
        ];
    }
}
