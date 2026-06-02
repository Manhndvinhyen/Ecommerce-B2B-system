<?php

declare(strict_types=1);

namespace Tmdt\Registration\Api;

interface BranchPerformanceInterface
{
    /**
     * Return order/revenue performance grouped by branch accounts.
     *
     * @return array
     */
    public function get(): array;
}
