<?php

declare(strict_types=1);

namespace Tmdt\Registration\Api;

interface BranchManagerDeleteInterface
{
    /**
     * Soft delete a branch manager.
     *
     * @param int $managerId
     * @return array
     */
    public function delete(int $managerId): array;
}
