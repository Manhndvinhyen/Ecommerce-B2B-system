<?php

declare(strict_types=1);

namespace Tmdt\Registration\Api;

interface BranchManagerUpdateInterface
{
    /**
     * Update a branch manager's contact details.
     *
     * @param int $managerId
     * @return array
     */
    public function update(int $managerId): array;
}
