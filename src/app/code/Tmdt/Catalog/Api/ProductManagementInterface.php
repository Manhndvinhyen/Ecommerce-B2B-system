<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Api;

interface ProductManagementInterface
{
    /**
     * Create product for the authenticated B2B seller.
     *
     * @param string $productData
     * @return string
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function createProduct(string $productData): string;

    /**
     * Update product details by SKU for the authenticated B2B seller.
     *
     * @param string $sku
     * @param string $productData
     * @return string
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function updateProduct(string $sku, string $productData): string;

    /**
     * Delete product by SKU for the authenticated B2B seller.
     *
     * @param string $sku
     * @return string
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function deleteProduct(string $sku): string;

    /**
     * Get products belonging to the authenticated B2B seller.
     *
     * @return mixed
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function getSellerProducts();

    /**
     * Get stock notifications for the authenticated B2B seller.
     *
     * @return mixed[]
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function getSellerNotifications(): array;

    /**
     * Mark all stock notifications as read for the authenticated B2B seller.
     *
     * @return bool
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function markNotificationsAsRead(): bool;

    /**
     * Get revenue and analytics stats for the authenticated B2B seller.
     *
     * @return mixed[]
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function getSellerRevenueStats(): array;

    /**
     * Get order list for the authenticated B2B seller.
     *
     * @return mixed[]
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function getSellerOrders(): array;
}
