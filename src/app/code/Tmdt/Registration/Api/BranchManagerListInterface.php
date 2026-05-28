<?php

declare(strict_types=1);

namespace Tmdt\Registration\Api;

interface BranchManagerListInterface
{
    /**
     * Return branch managers for the current restaurant owner.
     *
     * @return array
     */
    public function get(): array;
}
