<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Api;

interface ProductManagementInterface
{
    /**
     * Create product for the authenticated B2B seller.
     *
     * @param mixed $productData
     * @return string
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function createProduct($productData): string;

    /**
     * Update product details by SKU for the authenticated B2B seller.
     *
     * @param string $sku
     * @param mixed $productData
     * @return string
     * @throws \Magento\Framework\Exception\LocalizedException
     */
    public function updateProduct(string $sku, $productData): string;

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
}
