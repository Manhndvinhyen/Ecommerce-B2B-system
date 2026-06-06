<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Controller\Order;

use Magento\Framework\App\Action\HttpPostActionInterface;
use Magento\Framework\App\CsrfAwareActionInterface;
use Magento\Framework\App\Request\InvalidRequestException;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\Controller\Result\JsonFactory;
use Tmdt\Catalog\Api\OrderManagementInterface;
use Psr\Log\LoggerInterface;

/**
 * Legacy Create Order Controller – POST /tmdt/order/create
 * Delegates execution to OrderManagement service contract.
 */
class Create implements HttpPostActionInterface, CsrfAwareActionInterface
{
    public function __construct(
        private readonly RequestInterface $request,
        private readonly JsonFactory $jsonFactory,
        private readonly OrderManagementInterface $orderManagement,
        private readonly LoggerInterface $logger
    ) {}

    public function createCsrfValidationException(RequestInterface $request): ?InvalidRequestException
    {
        return null;
    }

    public function validateForCsrf(RequestInterface $request): ?bool
    {
        return true;
    }

    public function execute()
    {
        $result = $this->jsonFactory->create();
        try {
            $rawBody = $this->request->getContent();
            if (empty($rawBody)) {
                return $result->setData(['success' => false, 'message' => 'Empty request body']);
            }
            $data = json_decode($rawBody, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return $result->setData(['success' => false, 'message' => 'Invalid JSON']);
            }

            $customerEmail = (string)($data['customerEmail'] ?? '');
            $customerName = (string)($data['customerName'] ?? '');
            $totalAmount = (float)($data['totalAmount'] ?? 0);
            $itemsJson = (string)($data['itemsJson'] ?? '[]');
            $shippingJson = (string)($data['shippingJson'] ?? '{}');
            $paymentMethod = (string)($data['paymentMethod'] ?? 'bank_transfer');

            $orderResult = $this->orderManagement->createOrder(
                $customerEmail,
                $customerName,
                $totalAmount,
                $itemsJson,
                $shippingJson,
                $paymentMethod
            );

            return $result->setData($orderResult);
        } catch (\Throwable $e) {
            $this->logger->error('[Order Controller] Create error: ' . $e->getMessage());
            return $result->setData(['success' => false, 'message' => $e->getMessage()]);
        }
    }
}
