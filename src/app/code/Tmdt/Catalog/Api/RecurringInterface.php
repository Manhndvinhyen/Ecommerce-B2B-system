<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Api;

interface RecurringInterface
{
    /**
     * Subscribe to recurring purchases.
     *
     * @param string $customerEmail
     * @param string $customerName
     * @param string $frequency
     * @param string|null $weekdays
     * @param int|null $monthDay
     * @param string $deliveryTime
     * @param string $itemsJson
     * @param string $shippingJson
     * @return mixed[]
     */
    public function subscribe(
        string $customerEmail,
        string $customerName,
        string $frequency,
        ?string $weekdays = null,
        ?int $monthDay = null,
        string $deliveryTime = '',
        string $itemsJson = '[]',
        string $shippingJson = '{}'
    ): array;

    /**
     * List active and cancelled subscriptions for a customer.
     *
     * @param string $customerEmail
     * @return mixed[]
     */
    public function listSubscriptions(string $customerEmail): array;

    /**
     * Cancel an active subscription.
     *
     * @param int $id
     * @return mixed[]
     */
    public function cancelSubscription(int $id): array;
}
