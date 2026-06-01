<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Api;

interface InventoryManagementInterface
{
    /**
     * Adjust stock level of a product (inbound/outbound) for B2B sellers.
     *
     * @param mixed $adjustmentData
     * @return string
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function adjustStock($adjustmentData): string;

    /**
     * Get stock adjustment logs history for the authenticated B2B seller.
     *
     * @return mixed
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function getAdjustmentLogs();
}
