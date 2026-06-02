<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Api;

interface OrderManagementInterface
{
    /**
     * Create a new pending order and return order code + expiry.
     *
     * @param mixed[] $orderData
     * @return mixed[]
     */
    public function createOrder(array $orderData): array;

    /**
     * Get order status by order code.
     *
     * @param string $orderCode
     * @return mixed[]
     */
    public function getOrderStatus(string $orderCode): array;

    /**
     * Handle SePay webhook for payment confirmation.
     *
     * @param mixed[] $payload
     * @return mixed[]
     */
    public function handleWebhook(array $payload): array;
}
