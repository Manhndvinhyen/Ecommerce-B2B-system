<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Api;

interface PromotionManagementInterface
{
    /**
     * Get active promotions list including banners, vouchers, and seasonal blocks.
     *
     * @return mixed[]
     */
    public function getPromotions(): array;
}
