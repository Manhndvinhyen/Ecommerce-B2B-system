<?php

declare(strict_types=1);

namespace Tmdt\Search\Api;

interface PurchaseHistoryInterface
{
    /**
     * Get purchase history for the current customer.
     *
     * @return array
     */
    public function get(): array;

    /**
     * Save purchase history for the current customer.
     *
     * @return array
     */
    public function save(): array;
}
