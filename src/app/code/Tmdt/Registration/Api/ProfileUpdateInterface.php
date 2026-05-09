<?php

declare(strict_types=1);

namespace Tmdt\Registration\Api;

interface ProfileUpdateInterface
{
    /**
     * Update customer profile data based on registration fields.
     *
     * @return array
     */
    public function save(): array;
}
