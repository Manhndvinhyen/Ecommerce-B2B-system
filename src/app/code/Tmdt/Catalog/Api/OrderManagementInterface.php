<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Api;

interface OrderManagementInterface
{
    /**
     * Create a new pending order.
     *
     * @param string $customerEmail
     * @param string $customerName
     * @param float  $totalAmount
     * @param string $itemsJson    JSON-encoded array of cart items
     * @param string $shippingJson JSON-encoded shipping info
     * @return mixed[]
     */
    public function createOrder(
        string $customerEmail,
        string $customerName,
        float $totalAmount,
        string $itemsJson,
        string $shippingJson
    ): array;

    /**
     * Get order status by order code.
     *
     * @param string $orderCode
     * @return mixed[]
     */
    public function getOrderStatus(string $orderCode): array;

    /**
     * Get list of warehouses (inventory sources) with coordinates from database.
     *
     * @return mixed[]
     */
    public function getWarehouses(): array;
}

