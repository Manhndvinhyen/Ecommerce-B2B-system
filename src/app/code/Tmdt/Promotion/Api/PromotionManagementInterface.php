<?php
declare(strict_types=1);

namespace Tmdt\Promotion\Api;

interface PromotionManagementInterface
{
    /**
     * Get active promotions list including banners, vouchers, and seasonal blocks.
     *
     * @return mixed[]
     */
    public function getPromotions(): array;

    /**
     * Get list of B2B suppliers from database with real statistics.
     *
     * @return mixed[]
     */
    public function getSuppliers(): array;
}
