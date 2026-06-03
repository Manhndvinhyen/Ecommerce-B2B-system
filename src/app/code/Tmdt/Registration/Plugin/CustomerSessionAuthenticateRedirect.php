<?php
declare(strict_types=1);

namespace Tmdt\Registration\Plugin;

use Magento\Customer\Model\Session as CustomerSession;
use Magento\Framework\App\RequestInterface;

class CustomerSessionAuthenticateRedirect
{
    private const LOGIN_URL = '/?view=login';

    public function __construct(
        private readonly RequestInterface $request
    ) {
    }

    public function beforeAuthenticate(CustomerSession $subject, $loginUrl = null): array
    {
        if (
            !$subject->isLoggedIn()
            && $this->request->getFullActionName() === 'customer_account_index'
        ) {
            return [self::LOGIN_URL];
        }

        return [$loginUrl];
    }
}
