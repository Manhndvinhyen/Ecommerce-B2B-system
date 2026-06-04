<?php

declare(strict_types=1);

namespace Tmdt\Search\Api;

interface ProductSearchInterface
{
    /**
     * Search catalog products without relying on Magento fulltext GraphQL search.
     *
     * @param string $query
     * @param int $limit
     * @return array
     */
    public function search(string $query = '', int $limit = 100): array;
}
