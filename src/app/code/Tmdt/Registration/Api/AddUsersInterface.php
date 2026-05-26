<?php

declare(strict_types=1);

namespace Tmdt\Registration\Api;

interface AddUsersInterface
{
    /**
     * Create a branch manager account for the current restaurant owner.
     *
     * @return array
     */
    public function save(): array;
}
