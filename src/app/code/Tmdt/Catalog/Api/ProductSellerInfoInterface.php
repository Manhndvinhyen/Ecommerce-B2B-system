<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Api;

interface ProductSellerInfoInterface
{
    /**
     * Resolve registered seller display information for product SKUs.
     *
     * @param string $skus Comma-separated SKU list.
     * @return mixed[]
     */
    public function getBySkus(string $skus = ''): array;
}
