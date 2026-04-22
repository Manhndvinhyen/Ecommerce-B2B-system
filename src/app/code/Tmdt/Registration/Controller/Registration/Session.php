<?php

namespace Tmdt\Registration\Controller\Registration;

use Magento\Customer\Api\CustomerRepositoryInterface;
use Magento\Customer\Model\Session as CustomerSession;
use Magento\Framework\App\Action\Action;
use Magento\Framework\App\Action\Context;
use Magento\Framework\App\CsrfAwareActionInterface;
use Magento\Framework\App\Request\InvalidRequestException;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Framework\Exception\NoSuchEntityException;
use Magento\Framework\App\ResourceConnection;
use Magento\Integration\Model\Oauth\TokenFactory;

class Session extends Action implements CsrfAwareActionInterface
{
    private const TABLE_NAME = 'tmdt_customer_registration';

    public function __construct(
        Context $context,
        private readonly TokenFactory $tokenFactory,
        private readonly CustomerRepositoryInterface $customerRepository,
        private readonly CustomerSession $customerSession,
        private readonly ResourceConnection $resourceConnection,
        private readonly JsonFactory $jsonFactory
    ) {
        parent::__construct($context);
    }

    public function execute()
    {
        $result = $this->jsonFactory->create();
        $token = $this->extractToken();

        if ($token === '') {
            $this->getResponse()->setHttpResponseCode(400);
            return $result->setData([
                'success' => false,
                'message' => 'Thiếu token đăng nhập.',
            ]);
        }

        $tokenModel = $this->tokenFactory->create()->loadByToken($token);
        $customerId = (int) $tokenModel->getCustomerId();

        if ($customerId <= 0) {
            $this->getResponse()->setHttpResponseCode(401);
            return $result->setData([
                'success' => false,
                'message' => 'Token không hợp lệ hoặc đã hết hạn.',
            ]);
        }

        try {
            $customer = $this->customerRepository->getById($customerId);
        } catch (NoSuchEntityException) {
            $this->getResponse()->setHttpResponseCode(404);
            return $result->setData([
                'success' => false,
                'message' => 'Không tìm thấy tài khoản khách hàng.',
            ]);
        }

        $registrationRow = $this->getRegistrationByCustomerId($customerId);
        if ($registrationRow === null) {
            $this->getResponse()->setHttpResponseCode(403);
            return $result->setData([
                'success' => false,
                'message' => 'Tài khoản chưa đăng ký trong hệ thống doanh nghiệp.',
            ]);
        }

        $this->customerSession->setCustomerAsLoggedIn($customer);

        return $result->setData([
            'success' => true,
            'message' => 'Đăng nhập thành công.',
            'customer_id' => $customerId,
            'email' => (string) ($registrationRow['email'] ?? ''),
            'full_name' => (string) ($registrationRow['full_name'] ?? ''),
            'branch_name' => (string) ($registrationRow['unit_nickname'] ?? ''),
            'redirect_url' => $this->extractRedirectUrl() ?: '/react/index.html',
        ]);
    }

    public function createCsrfValidationException(RequestInterface $request): ?InvalidRequestException
    {
        return null;
    }

    public function validateForCsrf(RequestInterface $request): ?bool
    {
        return true;
    }

    private function extractToken(): string
    {
        $request = $this->getRequest();
        $token = trim((string) $request->getParam('token'));
        if ($token !== '') {
            return $token;
        }

        $payload = $this->getJsonPayload();
        return trim((string) ($payload['token'] ?? $payload['payload']['token'] ?? ''));
    }

    private function extractRedirectUrl(): string
    {
        $request = $this->getRequest();
        $redirectUrl = trim((string) $request->getParam('redirect_url'));
        if ($redirectUrl !== '') {
            return $redirectUrl;
        }

        $payload = $this->getJsonPayload();
        return trim((string) ($payload['redirect_url'] ?? $payload['payload']['redirect_url'] ?? ''));
    }

    private function getJsonPayload(): array
    {
        $content = (string) $this->getRequest()->getContent();
        if ($content === '') {
            return [];
        }

        $data = json_decode($content, true);
        return is_array($data) ? $data : [];
    }

    private function getRegistrationByCustomerId(int $customerId): ?array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $row = $connection->fetchRow(
            $connection->select()
                ->from($tableName, ['customer_id', 'email', 'full_name', 'unit_nickname'])
                ->where('customer_id = ?', $customerId)
                ->limit(1)
        );

        return is_array($row) ? $row : null;
    }
}
