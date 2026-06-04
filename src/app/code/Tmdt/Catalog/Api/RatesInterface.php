<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Api;

interface RatesInterface
{
    /**
     * Get Vietcombank exchange rates.
     *
     * @return string
     */
    public function getRates(): string;
}
