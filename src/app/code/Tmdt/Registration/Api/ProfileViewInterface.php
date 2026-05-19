<?php

declare(strict_types=1);

namespace Tmdt\Registration\Api;

interface ProfileViewInterface
{
    /**
     * Retrieve registration profile data for the current customer.
     *
     * @return array
     */
    public function get(): array;
}
