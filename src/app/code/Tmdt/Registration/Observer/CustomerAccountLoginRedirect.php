<?php
declare(strict_types=1);

namespace Tmdt\Registration\Observer;

use Magento\Customer\Model\Session as CustomerSession;
use Magento\Framework\App\ActionInterface;
use Magento\Framework\App\ActionFlag;
use Magento\Framework\App\ResponseInterface;
use Magento\Framework\Event\Observer;
use Magento\Framework\Event\ObserverInterface;

class CustomerAccountLoginRedirect implements ObserverInterface
{
    private const LOGIN_URL = '/?view=login';

    public function __construct(
        private readonly CustomerSession $customerSession,
        private readonly ActionFlag $actionFlag,
        private readonly ResponseInterface $response
    ) {
    }

    public function execute(Observer $observer): void
    {
        if ($this->customerSession->isLoggedIn()) {
            return;
        }

        $this->response->setRedirect(self::LOGIN_URL);
        $this->actionFlag->set('', ActionInterface::FLAG_NO_DISPATCH, true);
    }
}
