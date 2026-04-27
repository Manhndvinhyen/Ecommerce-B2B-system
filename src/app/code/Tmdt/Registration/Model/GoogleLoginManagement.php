<?php

namespace Tmdt\Registration\Model;

use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Exception\AuthenticationException;
use Magento\Framework\Exception\InputException;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\HTTP\Client\Curl;
use Magento\Framework\Serialize\Serializer\Json;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Integration\Model\Oauth\TokenFactory;
use Tmdt\Registration\Api\GoogleLoginInterface;

class GoogleLoginManagement implements GoogleLoginInterface
{
    private const TABLE_NAME = 'tmdt_customer_registration';
    private const GOOGLE_ISSUER = 'https://accounts.google.com';
    private const GOOGLE_ISSUER_SHORT = 'accounts.google.com';

    public function __construct(
        private readonly ResourceConnection $resourceConnection,
        private readonly RestRequest $request,
        private readonly Curl $curl,
        private readonly Json $serializer,
        private readonly TokenFactory $tokenFactory
    ) {
    }

    public function save(): array
    {
        $bodyParams = $this->request->getBodyParams();
        $payload = is_array($bodyParams) && isset($bodyParams['payload']) ? $bodyParams['payload'] : $bodyParams;

        if (!is_array($payload)) {
            throw new InputException(__('Du lieu dang nhap Google khong hop le.'));
        }

        $loginCode = trim((string) ($payload['restaurantCode'] ?? $payload['loginCode'] ?? ''));
        $idToken = trim((string) ($payload['googleIdToken'] ?? $payload['idToken'] ?? ''));

        if ($loginCode === '') {
            throw new InputException(__('Mã nhà hàng là bắt buộc.'));
        }

        if ($idToken === '') {
            throw new InputException(__('Thiếu token Google đăng nhập.'));
        }

        $googleClientId = trim((string) getenv('GOOGLE_OAUTH_CLIENT_ID'));
        if ($googleClientId === '') {
            throw new LocalizedException(__('Thiếu cấu hình GOOGLE_OAUTH_CLIENT_ID trên server.'));
        }

        $googleClaims = $this->verifyGoogleIdToken($idToken, $googleClientId);

        $email = mb_strtolower(trim((string) ($googleClaims['email'] ?? '')));
        $emailVerifiedClaim = $googleClaims['email_verified'] ?? false;
        $emailVerified = $emailVerifiedClaim === true || (string) $emailVerifiedClaim === 'true';

        if ($email === '' || !$emailVerified) {
            throw new AuthenticationException(__('Tài khoản Google chưa xác thực email.'));
        }

        $registrationRow = $this->getRegistrationByLoginCode($loginCode);
        if ($registrationRow === null) {
            throw new AuthenticationException(__('Thông tin đăng nhập không hợp lệ.'));
        }

        $registrationEmail = mb_strtolower(trim((string) ($registrationRow['email'] ?? '')));
        if ($registrationEmail !== $email) {
            throw new AuthenticationException(__('Email Google không khớp với tài khoản doanh nghiệp.'));
        }

        try {
            $token = $this->tokenFactory->create()->createCustomerToken((int) $registrationRow['customer_id'])->getToken();
        } catch (\Exception $exception) {
            throw new LocalizedException(__('Không thể tạo phiên đăng nhập. Vui lòng thử lại.'));
        }

        return [
            'success' => true,
            'message' => (string) __('Đăng nhập thành công.'),
            'token' => (string) $token,
            'customer_id' => (int) $registrationRow['customer_id'],
            'email' => $registrationEmail,
            'full_name' => (string) ($registrationRow['full_name'] ?? ''),
            'branch_name' => (string) ($registrationRow['unit_nickname'] ?? ''),
            'redirect_url' => '/react/index.html',
        ];
    }

    private function verifyGoogleIdToken(string $idToken, string $googleClientId): array
    {
        $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken);

        try {
            $this->curl->get($url);
        } catch (\Exception $exception) {
            throw new LocalizedException(__('Không thể kết nối đến Google để xác thực đăng nhập.'));
        }

        if ($this->curl->getStatus() !== 200) {
            throw new AuthenticationException(__('Google token không hợp lệ hoặc đã hết hạn.'));
        }

        $rawBody = trim((string) $this->curl->getBody());
        if ($rawBody === '') {
            throw new AuthenticationException(__('Google token không hợp lệ hoặc đã hết hạn.'));
        }

        try {
            $decoded = $this->serializer->unserialize($rawBody);
        } catch (\InvalidArgumentException $exception) {
            throw new AuthenticationException(__('Google token không hợp lệ hoặc đã hết hạn.'));
        }

        if (!is_array($decoded)) {
            throw new AuthenticationException(__('Google token không hợp lệ hoặc đã hết hạn.'));
        }

        $audience = trim((string) ($decoded['aud'] ?? ''));
        $issuer = trim((string) ($decoded['iss'] ?? ''));
        $expiresAt = (int) ($decoded['exp'] ?? 0);

        if ($audience === '' || $audience !== $googleClientId) {
            throw new AuthenticationException(__('Google token không hợp lệ cho ứng dụng hiện tại.'));
        }

        if ($issuer !== self::GOOGLE_ISSUER && $issuer !== self::GOOGLE_ISSUER_SHORT) {
            throw new AuthenticationException(__('Nguồn Google token không hợp lệ.'));
        }

        if ($expiresAt <= time()) {
            throw new AuthenticationException(__('Google token đã hết hạn.'));
        }

        return $decoded;
    }

    private function getRegistrationByLoginCode(string $loginCode): ?array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $row = $connection->fetchRow(
            $connection->select()
                ->from($tableName, ['customer_id', 'email', 'full_name', 'unit_nickname'])
                ->where('login_code = ?', $loginCode)
                ->limit(1)
        );

        return is_array($row) ? $row : null;
    }
}
