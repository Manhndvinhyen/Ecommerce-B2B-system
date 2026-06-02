<?php

namespace Tmdt\Registration\Controller\Registration;

use Magento\Customer\Model\Session as CustomerSession;
use Magento\Framework\App\Action\Action;
use Magento\Framework\App\Action\Context;
use Magento\Framework\App\CsrfAwareActionInterface;
use Magento\Framework\App\Request\InvalidRequestException;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Integration\Model\Oauth\TokenFactory;

class Logout extends Action implements CsrfAwareActionInterface
{
    public function __construct(
        Context $context,
        private readonly TokenFactory $tokenFactory,
        private readonly CustomerSession $customerSession,
        private readonly JsonFactory $jsonFactory
    ) {
        parent::__construct($context);
    }

    public function execute()
    {
        $result = $this->jsonFactory->create();
        $token = $this->extractToken();

        if ($token !== '') {
            $tokenModel = $this->tokenFactory->create()->load($token, 'token');
            if ($tokenModel->getId()) {
                $tokenModel->delete();
            }
        }

        $this->customerSession->logout();

        return $result->setData([
            'success' => true,
            'message' => 'Dang xuat thiet bi hien tai thanh cong.',
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

        $content = (string) $request->getContent();
        if ($content === '') {
            return '';
        }

        $payload = json_decode($content, true);
        if (!is_array($payload)) {
            return '';
        }

        return trim((string) ($payload['token'] ?? $payload['payload']['token'] ?? ''));
    }
}
