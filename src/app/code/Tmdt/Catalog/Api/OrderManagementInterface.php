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
     * @param string $paymentMethod
     * @return mixed[]
     */
    public function createOrder(
        string $customerEmail,
        string $customerName,
        float $totalAmount,
        string $itemsJson,
        string $shippingJson,
        string $paymentMethod = 'bank_transfer'
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

    /**
     * Confirm that a direct payment (COD) order has been paid.
     *
     * @param string $orderCode
     * @return bool
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function confirmDirectPayment(string $orderCode): bool;

    /**
     * Update order fulfillment status (preparing / shipping / delivered).
     * Only the seller who owns items in the order can update fulfillment.
     *
     * @param string $orderCode
     * @param string $status  One of: preparing, shipping, delivered
     * @return bool
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function updateOrderFulfillment(string $orderCode, string $status): bool;

    /**
     * Confirm receipt of goods by the customer.
     *
     * @param string $orderCode
     * @return bool
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function confirmReceiptByCustomer(string $orderCode): bool;
}

