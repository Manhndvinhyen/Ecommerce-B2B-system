<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Model;

use Tmdt\Catalog\Api\ProductManagementInterface;
use Magento\Catalog\Api\ProductRepositoryInterface;
use Magento\Catalog\Model\ProductFactory;
use Magento\Customer\Model\Session as CustomerSession;
use Magento\CatalogInventory\Api\StockRegistryInterface;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Authorization\Model\UserContextInterface;
use Magento\Framework\App\ObjectManager;

class ProductManagement implements ProductManagementInterface
{
    public function __construct(
        private readonly ProductRepositoryInterface $productRepository,
        private readonly ProductFactory $productFactory,
        private readonly CustomerSession $customerSession,
        private readonly StockRegistryInterface $stockRegistry,
        private readonly ResourceConnection $resourceConnection,
        private readonly RestRequest $request,
        private readonly \Magento\Store\Model\StoreManagerInterface $storeManager,
        private readonly \Magento\Framework\Indexer\IndexerRegistry $indexerRegistry,
        private readonly \Magento\Framework\App\Cache\TypeListInterface $cacheTypeList
    ) {
    }

    /**
     * Get UserContext via ObjectManager (lazy, avoids constructor changes requiring di:compile).
     */
    private function getUserContext(): UserContextInterface
    {
        return ObjectManager::getInstance()->get(UserContextInterface::class);
    }

    /**
     * @inheritDoc
     */
    public function createProduct(string $productData): string
    {
        $currentCustomerId = $this->getCurrentCustomerId();
        $this->assertCanManageProductCatalog($currentCustomerId);
        $sellerId = $this->resolveCompanySellerId($currentCustomerId);
        $data = json_decode($productData, true);
        if (!is_array($data)) {
            $data = [];
        }

        if (empty($data['name']) || empty($data['sku']) || empty($data['price'])) {
            throw new LocalizedException(__('TÃªn, SKU vÃ  giÃ¡ sá»‰ lÃ  báº¯t buá»™c.'));
        }

        try {
            $product = $this->productFactory->create();
            $product->setSku($data['sku']);
            $product->setName($data['name']);
            
            // Set unique URL key
            $product->setUrlKey($this->generateUniqueUrlKey($data['name'], $data['sku']));

            $product->setPrice((float) $data['price']);
            $product->setTypeId(\Magento\Catalog\Model\Product\Type::TYPE_SIMPLE);
            $product->setAttributeSetId(4); // Default Attribute Set
            $product->setStatus(\Magento\Catalog\Model\Product\Attribute\Source\Status::STATUS_ENABLED);
            $product->setVisibility(\Magento\Catalog\Model\Product\Visibility::VISIBILITY_BOTH);
            
            // Assign to current website (ensure fallback to website 1)
            $websiteId = (int)$this->storeManager->getStore()->getWebsiteId();
            if ($websiteId === 0) {
                $websiteId = 1;
            }
            $product->setWebsiteIds([$websiteId]);

            if (!empty($data['special_price'])) {
                $product->setSpecialPrice((float) $data['special_price']);
            }

            // Custom attributes for B2B Seller
            $product->setCustomAttribute('tmdt_seller_id', $sellerId);
            if (!empty($data['unit'])) {
                $product->setCustomAttribute('tmdt_unit', $data['unit']);
            }

            // Set note to short_description
            if (!empty($data['note'])) {
                $product->setShortDescription($data['note']);
            }

            // Set custom description details as HTML
            $descriptionHtml = '';
            if (!empty($data['description'])) {
                $desc = $data['description'];
                if (!empty($desc['features'])) {
                    $descriptionHtml .= '<p><strong>Äáº·c Ä‘iá»ƒm:</strong> ' . htmlspecialchars($desc['features']) . '</p>';
                }
                if (!empty($desc['benefits'])) {
                    $descriptionHtml .= '<p><strong>CÃ´ng dá»¥ng:</strong> ' . htmlspecialchars($desc['benefits']) . '</p>';
                }
                if (!empty($desc['storage'])) {
                    $descriptionHtml .= '<p><strong>CÃ¡ch báº£o quáº£n:</strong> ' . htmlspecialchars($desc['storage']) . '</p>';
                }
                if (!empty($desc['expiry'])) {
                    $descriptionHtml .= '<p><strong>Thá»i háº¡n sá»­ dá»¥ng:</strong> ' . htmlspecialchars($desc['expiry']) . '</p>';
                }
            }
            if ($descriptionHtml) {
                $product->setDescription($descriptionHtml);
            }

            // Category assignment
            $categoryIds = [];
            if (!empty($data['category_ids']) && is_array($data['category_ids'])) {
                $categoryIds = $data['category_ids'];
            } elseif (!empty($data['categoryLabel'])) {
                $resolvedId = $this->resolveCategoryIdByName($data['categoryLabel']);
                if ($resolvedId !== null) {
                    $categoryIds[] = $resolvedId;
                }
            }

            if (!empty($categoryIds)) {
                $product->setCategoryIds($categoryIds);
            }

            // Handle Base64 image upload if set
            if (!empty($data['image'])) {
                $this->processBase64Image($product, $data['image']);
            }

            // Save wholesale tiers
            if (isset($data['wholesale_tiers']) && is_array($data['wholesale_tiers'])) {
                $tierPrices = [];
                $tierPriceFactory = \Magento\Framework\App\ObjectManager::getInstance()->get(\Magento\Catalog\Api\Data\ProductTierPriceInterfaceFactory::class);
                foreach ($data['wholesale_tiers'] as $tier) {
                    $qty = isset($tier['qty']) ? (float)$tier['qty'] : 0;
                    $discountPercent = isset($tier['discount']) ? (float)$tier['discount'] : 0;
                    if ($qty > 0 && $discountPercent > 0 && $discountPercent <= 100) {
                        $tierPriceValue = (float)$product->getPrice() * (1 - ($discountPercent / 100));
                        $tierPrice = $tierPriceFactory->create();
                        $tierPrice->setCustomerGroupId(\Magento\Customer\Model\Group::CUST_GROUP_ALL);
                        $tierPrice->setQty($qty);
                        $tierPrice->setValue($tierPriceValue);
                        $tierPrices[] = $tierPrice;
                    }
                }
                $product->setTierPrices($tierPrices);
            }

            $this->productRepository->save($product);

            // Set Stock level natively
            $qty = isset($data['qty']) ? (float) $data['qty'] : 0.0;
            $stockItem = $this->stockRegistry->getStockItemBySku($product->getSku());
            $stockItem->setIsInStock($qty > 0);
            $stockItem->setQty($qty);
            $this->stockRegistry->updateStockItemBySku($product->getSku(), $stockItem);

            // Sync warehouse source items
            $connection = $this->resourceConnection->getConnection();
            $this->syncSourceItems($product->getSku(), $qty, $connection);

            // Reindex and clean cache
            $this->reindexAndCleanCache($product);

            return json_encode([
                'success' => true,
                'message' => 'ÄÄƒng sáº£n pháº©m sá»‰ thÃ nh cÃ´ng!',
                'sku' => $product->getSku()
            ]);
        } catch (\Exception $e) {
            throw new LocalizedException(__($e->getMessage()));
        }
    }

    /**
     * @inheritDoc
     */
    public function updateProduct(string $sku, string $productData): string
    {
        try {
            $this->assertCanManageProductCatalog($this->getCurrentCustomerId());
            $this->verifyProductOwnership($sku);
            $data = json_decode($productData, true);
            if (!is_array($data)) {
                $data = [];
            }

            $product = $this->productRepository->get($sku);
            
            if (isset($data['name'])) {
                $product->setName($data['name']);
                $product->setUrlKey($this->generateUniqueUrlKey($data['name'], $sku));
            }
            if (isset($data['price'])) {
                $product->setPrice((float) $data['price']);
            }
            if (isset($data['special_price'])) {
                $product->setSpecialPrice((float) $data['special_price']);
            }
            if (isset($data['unit'])) {
                $product->setCustomAttribute('tmdt_unit', $data['unit']);
            }
            if (isset($data['note'])) {
                $product->setShortDescription($data['note']);
            }

            // Set custom description details as HTML
            if (isset($data['description'])) {
                $descriptionHtml = '';
                $desc = $data['description'];
                if (!empty($desc['features'])) {
                    $descriptionHtml .= '<p><strong>Äáº·c Ä‘iá»ƒm:</strong> ' . htmlspecialchars($desc['features']) . '</p>';
                }
                if (!empty($desc['benefits'])) {
                    $descriptionHtml .= '<p><strong>CÃ´ng dá»¥ng:</strong> ' . htmlspecialchars($desc['benefits']) . '</p>';
                }
                if (!empty($desc['storage'])) {
                    $descriptionHtml .= '<p><strong>CÃ¡ch báº£o quáº£n:</strong> ' . htmlspecialchars($desc['storage']) . '</p>';
                }
                if (!empty($desc['expiry'])) {
                    $descriptionHtml .= '<p><strong>Thá»i háº¡n sá»­ dá»¥ng:</strong> ' . htmlspecialchars($desc['expiry']) . '</p>';
                }
                if ($descriptionHtml) {
                    $product->setDescription($descriptionHtml);
                }
            }

            if (isset($data['category_ids']) && is_array($data['category_ids'])) {
                $product->setCategoryIds($data['category_ids']);
            } elseif (isset($data['categoryLabel'])) {
                $resolvedId = $this->resolveCategoryIdByName($data['categoryLabel']);
                if ($resolvedId !== null) {
                    $product->setCategoryIds([$resolvedId]);
                }
            }

            // Handle Base64 image upload if set
            if (!empty($data['image'])) {
                $this->processBase64Image($product, $data['image']);
            }

            // Save wholesale tiers
            if (isset($data['wholesale_tiers']) && is_array($data['wholesale_tiers'])) {
                $tierPrices = [];
                $tierPriceFactory = \Magento\Framework\App\ObjectManager::getInstance()->get(\Magento\Catalog\Api\Data\ProductTierPriceInterfaceFactory::class);
                foreach ($data['wholesale_tiers'] as $tier) {
                    $qty = isset($tier['qty']) ? (float)$tier['qty'] : 0;
                    $discountPercent = isset($tier['discount']) ? (float)$tier['discount'] : 0;
                    if ($qty > 0 && $discountPercent > 0 && $discountPercent <= 100) {
                        $tierPriceValue = (float)$product->getPrice() * (1 - ($discountPercent / 100));
                        $tierPrice = $tierPriceFactory->create();
                        $tierPrice->setCustomerGroupId(\Magento\Customer\Model\Group::CUST_GROUP_ALL);
                        $tierPrice->setQty($qty);
                        $tierPrice->setValue($tierPriceValue);
                        $tierPrices[] = $tierPrice;
                    }
                }
                $product->setTierPrices($tierPrices);
            }

            $this->productRepository->save($product);

            if (isset($data['qty'])) {
                $qty = (float) $data['qty'];
                $stockItem = $this->stockRegistry->getStockItemBySku($sku);
                $stockItem->setIsInStock($qty > 0);
                $stockItem->setQty($qty);
                $this->stockRegistry->updateStockItemBySku($sku, $stockItem);

                // Sync warehouse source items
                $connection = $this->resourceConnection->getConnection();
                $this->syncSourceItems($sku, $qty, $connection);
            }

            // Reindex and clean cache
            $this->reindexAndCleanCache($product);

            return json_encode([
                'success' => true,
                'message' => 'Cáº­p nháº­t sáº£n pháº©m sá»‰ thÃ nh cÃ´ng!',
                'sku' => $sku
            ]);
        } catch (\Exception $e) {
            \Magento\Framework\App\ObjectManager::getInstance()->get(\Psr\Log\LoggerInterface::class)->error(
                "TMDT UpdateProduct Error for SKU {$sku}: " . $e->getMessage() . "\n" . $e->getTraceAsString()
            );
            throw new LocalizedException(__($e->getMessage()));
        }
    }

    /**
     * @inheritDoc
     */
    public function deleteProduct(string $sku): string
    {
        $this->assertCanManageProductCatalog($this->getCurrentCustomerId());
        $this->verifyProductOwnership($sku);

        try {
            // Delete product
            $this->productRepository->deleteById($sku);

            // Clean cache types on deletion
            try {
                $cacheTypes = ['full_page', 'block_html', 'collections', 'graphql_query_resolver_result'];
                foreach ($cacheTypes as $type) {
                    $this->cacheTypeList->cleanType($type);
                }
            } catch (\Exception $e) {
                // Ignore
            }

            return json_encode([
                'success' => true,
                'message' => 'ÄÃ£ xÃ³a sáº£n pháº©m thÃ nh cÃ´ng khá»i catalog.'
            ]);
        } catch (\Exception $e) {
            throw new LocalizedException(__($e->getMessage()));
        }
    }

    /**
     * @inheritDoc
     */
    public function getSellerProducts()
    {
        $sellerId = $this->resolveCompanySellerId($this->getCurrentCustomerId());
        $connection = $this->resourceConnection->getConnection();
        $storeId = (int)$this->storeManager->getStore()->getId();
        
        $cpeTable = $connection->getTableName('catalog_product_entity');
        $cpevTable = $connection->getTableName('catalog_product_entity_varchar');
        $cpedTable = $connection->getTableName('catalog_product_entity_decimal');
        $stockTable = $connection->getTableName('cataloginventory_stock_item');
        
        // Fetch attribute IDs
        $nameAttrId = (int)$connection->fetchOne(
            "SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'name' AND entity_type_id = 4 LIMIT 1"
        );
        $priceAttrId = (int)$connection->fetchOne(
            "SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'price' AND entity_type_id = 4 LIMIT 1"
        );
        $specialPriceAttrId = (int)$connection->fetchOne(
            "SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'special_price' AND entity_type_id = 4 LIMIT 1"
        );
        $unitAttrId = (int)$connection->fetchOne(
            "SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'tmdt_unit' AND entity_type_id = 4 LIMIT 1"
        );
        $imageAttrId = (int)$connection->fetchOne(
            "SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'image' AND entity_type_id = 4 LIMIT 1"
        );
        $sellerAttrId = (int)$connection->fetchOne(
            "SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'tmdt_seller_id' AND entity_type_id = 4 LIMIT 1"
        );
        
        if ($sellerAttrId <= 0) {
            return [];
        }

        // We select product entity details using subqueries to support store overrides and defaults
        $nameSub = "COALESCE(
            (SELECT value FROM {$cpevTable} WHERE entity_id = cpe.entity_id AND attribute_id = {$nameAttrId} AND store_id = {$storeId} LIMIT 1),
            (SELECT value FROM {$cpevTable} WHERE entity_id = cpe.entity_id AND attribute_id = {$nameAttrId} AND store_id = 0 LIMIT 1)
        )";
        
        $priceSub = "COALESCE(
            (SELECT value FROM {$cpedTable} WHERE entity_id = cpe.entity_id AND attribute_id = {$priceAttrId} AND store_id = {$storeId} LIMIT 1),
            (SELECT value FROM {$cpedTable} WHERE entity_id = cpe.entity_id AND attribute_id = {$priceAttrId} AND store_id = 0 LIMIT 1)
        )";
        
        $specialPriceSub = "COALESCE(
            (SELECT value FROM {$cpedTable} WHERE entity_id = cpe.entity_id AND attribute_id = {$specialPriceAttrId} AND store_id = {$storeId} LIMIT 1),
            (SELECT value FROM {$cpedTable} WHERE entity_id = cpe.entity_id AND attribute_id = {$specialPriceAttrId} AND store_id = 0 LIMIT 1)
        )";
        
        $unitSub = "COALESCE(
            (SELECT value FROM {$cpevTable} WHERE entity_id = cpe.entity_id AND attribute_id = {$unitAttrId} AND store_id = {$storeId} LIMIT 1),
            (SELECT value FROM {$cpevTable} WHERE entity_id = cpe.entity_id AND attribute_id = {$unitAttrId} AND store_id = 0 LIMIT 1),
            'kg'
        )";

        $imageSub = "COALESCE(
            (SELECT value FROM {$cpevTable} WHERE entity_id = cpe.entity_id AND attribute_id = {$imageAttrId} AND store_id = {$storeId} LIMIT 1),
            (SELECT value FROM {$cpevTable} WHERE entity_id = cpe.entity_id AND attribute_id = {$imageAttrId} AND store_id = 0 LIMIT 1)
        )";

        $query = "
            SELECT 
                cpe.entity_id AS id, 
                cpe.sku,
                {$nameSub} AS name,
                {$priceSub} AS price,
                {$specialPriceSub} AS special_price,
                {$unitSub} AS unit,
                {$imageSub} AS image,
                si.qty,
                si.is_in_stock
            FROM {$cpeTable} cpe
            INNER JOIN {$cpevTable} cpev_seller ON cpe.entity_id = cpev_seller.entity_id
                AND cpev_seller.attribute_id = {$sellerAttrId}
            LEFT JOIN {$stockTable} si ON cpe.entity_id = si.product_id
            WHERE cpev_seller.value = :seller_id
        ";
        
        $results = $connection->fetchAll($query, ['seller_id' => $sellerId]);
        
        $productIds = [];
        foreach ($results as $row) {
            $productIds[] = (int) $row['id'];
        }

        // Fetch Tier Prices
        $tierPricesByProductId = [];
        if (!empty($productIds)) {
            $tierPriceTable = $connection->getTableName('catalog_product_entity_tier_price');
            $tierPricesQuery = "
                SELECT entity_id, qty, value 
                FROM {$tierPriceTable} 
                WHERE entity_id IN (" . implode(',', $productIds) . ")
            ";
            $tierRows = $connection->fetchAll($tierPricesQuery);
            foreach ($tierRows as $row) {
                $pId = (int)$row['entity_id'];
                if (!isset($tierPricesByProductId[$pId])) {
                    $tierPricesByProductId[$pId] = [];
                }
                $tierPricesByProductId[$pId][] = [
                    'qty' => (float)$row['qty'],
                    'value' => (float)$row['value']
                ];
            }
        }

        $categoryIdsByProductId = $this->getCategoryIdsByProductIds($connection, $productIds);
        $allCategoryIds = [];
        foreach ($categoryIdsByProductId as $categoryIds) {
            $allCategoryIds = array_merge($allCategoryIds, $categoryIds);
        }
        $categoryNamesById = $this->getCategoryNamesByIds($connection, array_values(array_unique($allCategoryIds)));
        $activeAutoPromotions = $this->getActiveAutoPromotions($connection);

        $products = [];
        
        foreach ($results as $row) {
            $productId = (int) $row['id'];
            $productCategoryIds = $categoryIdsByProductId[$productId] ?? [];
            $productCategoryNames = [];
            foreach ($productCategoryIds as $categoryId) {
                $categoryName = $categoryNamesById[(int)$categoryId] ?? '';
                if ($categoryName !== '') {
                    $productCategoryNames[] = $categoryName;
                }
            }
            $basePrice = $row['price'] !== null ? (float) $row['price'] : 0.0;
            $existingSpecialPrice = $row['special_price'] !== null ? (float) $row['special_price'] : null;
            $promotion = $this->resolveBestAutoPromotion(
                (string)$row['sku'],
                $categoryIdsByProductId[$productId] ?? [],
                $basePrice,
                $activeAutoPromotions
            );
            $promotionPrice = $promotion['price'] ?? null;
            $effectiveSpecialPrice = $existingSpecialPrice;
            if ($promotionPrice !== null && ($effectiveSpecialPrice === null || $promotionPrice < $effectiveSpecialPrice)) {
                $effectiveSpecialPrice = $promotionPrice;
            }
            
            $wholesaleTiers = [];
            if (isset($tierPricesByProductId[$productId]) && $basePrice > 0) {
                foreach ($tierPricesByProductId[$productId] as $t) {
                    $discount = round((1 - ($t['value'] / $basePrice)) * 100);
                    if ($discount > 0) {
                        $wholesaleTiers[] = [
                            'qty' => $t['qty'],
                            'discount' => $discount
                        ];
                    }
                }
                usort($wholesaleTiers, function($a, $b) {
                    return $a['qty'] <=> $b['qty'];
                });
            }

            $products[] = [
                'id' => $productId,
                'sku' => (string) $row['sku'],
                'name' => (string) $row['name'],
                'price' => $basePrice,
                'special_price' => $effectiveSpecialPrice,
                'promotion_price' => $promotionPrice,
                'promotion' => $promotion['promotion'] ?? null,
                'qty' => $row['qty'] !== null ? (float) $row['qty'] : 0.0,
                'is_in_stock' => $row['is_in_stock'] !== null ? (bool) $row['is_in_stock'] : false,
                'unit' => (string) $row['unit'],
                'image' => $row['image'] ? '/media/catalog/product/' . ltrim((string) $row['image'], '/') : '',
                'wholesale_tiers' => $wholesaleTiers,
                'category_ids' => array_values(array_map('intval', $productCategoryIds)),
                'category_names' => $productCategoryNames,
                'categoryLabel' => $productCategoryNames[0] ?? '',
                'subcategoryLabel' => $productCategoryNames[count($productCategoryNames) - 1] ?? ''
            ];
        }
        
        return $products;
    }

    private function getCategoryIdsByProductIds($connection, array $productIds): array
    {
        if (empty($productIds)) {
            return [];
        }

        $categoryProductTable = $connection->getTableName('catalog_category_product');
        $rows = $connection->fetchAll(
            "SELECT product_id, category_id FROM {$categoryProductTable} WHERE product_id IN (" . implode(',', array_map('intval', $productIds)) . ")"
        );

        $categoryIdsByProductId = [];
        foreach ($rows as $row) {
            $productId = (int)$row['product_id'];
            if (!isset($categoryIdsByProductId[$productId])) {
                $categoryIdsByProductId[$productId] = [];
            }
            $categoryIdsByProductId[$productId][] = (string)$row['category_id'];
        }

        return $categoryIdsByProductId;
    }

    private function getCategoryNamesByIds($connection, array $categoryIds): array
    {
        $categoryIds = array_values(array_filter(array_map('intval', $categoryIds)));
        if (empty($categoryIds)) {
            return [];
        }

        $categoryVarcharTable = $connection->getTableName('catalog_category_entity_varchar');
        $attributeId = (int)$connection->fetchOne(
            "SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'name' AND entity_type_id = 3 LIMIT 1"
        );
        if ($attributeId <= 0) {
            return [];
        }

        $rows = $connection->fetchAll(
            "SELECT entity_id, value FROM {$categoryVarcharTable} WHERE attribute_id = ? AND store_id = 0 AND entity_id IN (" . implode(',', $categoryIds) . ")",
            [$attributeId]
        );

        $namesById = [];
        foreach ($rows as $row) {
            $name = trim((string)($row['value'] ?? ''));
            if ($name === '' || in_array($name, ['Root Catalog', 'Default Category', 'Products'], true)) {
                continue;
            }
            $namesById[(int)$row['entity_id']] = $name;
        }

        return $namesById;
    }

    private function getActiveAutoPromotions($connection): array
    {
        $tableName = $this->resourceConnection->getTableName('tmdt_promotions');

        try {
            $select = $connection->select()
                ->from($tableName)
                ->where('type = ?', 'auto_discount')
                ->where('is_active = ?', 1)
                ->where('(start_at IS NULL OR start_at <= NOW())')
                ->where('(end_at IS NULL OR end_at >= NOW())')
                ->order('id ASC');

            return $connection->fetchAll($select) ?: [];
        } catch (\Throwable $e) {
            return [];
        }
    }

    private function resolveBestAutoPromotion(string $sku, array $categoryIds, float $basePrice, array $promotions): array
    {
        if ($basePrice <= 0 || empty($promotions)) {
            return [];
        }

        $best = null;
        $bestDiscount = 0.0;
        $normalizedSku = strtoupper(trim($sku));

        foreach ($promotions as $promotion) {
            if (!$this->promotionMatchesProduct($promotion, $normalizedSku, $categoryIds)) {
                continue;
            }

            $discount = $this->calculatePromotionDiscount($basePrice, $promotion);
            if ($discount > $bestDiscount) {
                $bestDiscount = $discount;
                $best = $promotion;
            }
        }

        if ($best === null || $bestDiscount <= 0) {
            return [];
        }

        $discountedPrice = max(0, $basePrice - $bestDiscount);

        return [
            'price' => round($discountedPrice, 2),
            'promotion' => [
                'id' => (int)$best['id'],
                'title' => (string)$best['title'],
                'discount_type' => (string)($best['discount_type'] ?? 'fixed'),
                'discount_value' => (float)($best['discount_value'] ?? 0),
                'discount_amount' => round($bestDiscount, 2),
                'start_at' => $best['start_at'] ?? null,
                'end_at' => $best['end_at'] ?? null,
            ]
        ];
    }

    private function promotionMatchesProduct(array $promotion, string $sku, array $categoryIds): bool
    {
        $scope = (string)($promotion['apply_scope'] ?? 'all');
        if ($scope === 'all' || $scope === '') {
            return true;
        }

        if ($scope === 'product') {
            $skus = array_map(static function ($item): string {
                return strtoupper(trim($item));
            }, explode(',', (string)($promotion['product_skus'] ?? '')));

            return in_array($sku, $skus, true);
        }

        if ($scope === 'category') {
            $promotionCategoryIds = array_filter(array_map('trim', explode(',', (string)($promotion['category_ids'] ?? ''))));
            return count(array_intersect($categoryIds, $promotionCategoryIds)) > 0;
        }

        return false;
    }

    private function calculatePromotionDiscount(float $basePrice, array $promotion): float
    {
        $discountValue = (float)($promotion['discount_value'] ?? 0);
        if ($discountValue <= 0) {
            return 0.0;
        }

        if (($promotion['discount_type'] ?? '') === 'percent') {
            return min($basePrice, $basePrice * min(100, $discountValue) / 100);
        }

        return min($basePrice, $discountValue);
    }

    /**
     * Process Base64 Image upload and set it to product.
     *
     * @param \Magento\Catalog\Model\Product $product
     * @param string|null $base64Image
     * @return void
     */
    private function processBase64Image($product, ?string $base64Image): void
    {
        if (empty($base64Image) || strpos($base64Image, 'data:image/') !== 0) {
            return;
        }

        try {
            $parts = explode(',', $base64Image);
            if (count($parts) < 2) {
                return;
            }

            $header = $parts[0];
            $base64Data = $parts[1];

            $ext = 'jpg';
            if (str_contains($header, 'image/png')) {
                $ext = 'png';
            } elseif (str_contains($header, 'image/gif')) {
                $ext = 'gif';
            } elseif (str_contains($header, 'image/webp')) {
                $ext = 'png'; // Map webp to png so Magento's gallery validator accepts the file extension
            }

            \Magento\Framework\App\ObjectManager::getInstance()->get(\Psr\Log\LoggerInterface::class)->info(
                "TMDT Image log: header={$header}, ext={$ext}"
            );

            $decoded = base64_decode($base64Data);
            if ($decoded === false) {
                return;
            }

            // Clear existing images to avoid clutter
            $existingImages = $product->getMediaGalleryImages();
            if ($existingImages) {
                $galleryProcessor = \Magento\Framework\App\ObjectManager::getInstance()->get(
                    \Magento\Catalog\Model\Product\Gallery\Processor::class
                );
                foreach ($existingImages as $img) {
                    $galleryProcessor->removeImage($product, $img->getFile());
                }
            }

            // Write temporary file inside Magento's pub/media directory to satisfy path validation
            $filesystem = \Magento\Framework\App\ObjectManager::getInstance()->get(\Magento\Framework\Filesystem::class);
            $mediaDir = $filesystem->getDirectoryRead(\Magento\Framework\App\Filesystem\DirectoryList::MEDIA)->getAbsolutePath();
            $tempFile = rtrim($mediaDir, '/') . '/tmdt_' . md5(uniqid('', true)) . '.' . $ext;
            file_put_contents($tempFile, $decoded);

            // Add image to product media gallery and set as primary roles
            $product->addImageToMediaGallery($tempFile, ['image', 'small_image', 'thumbnail'], true, false);

            // Clean up the temp file after copying
            if (file_exists($tempFile)) {
                @unlink($tempFile);
            }
        } catch (\Exception $e) {
            \Magento\Framework\App\ObjectManager::getInstance()->get(\Psr\Log\LoggerInterface::class)->error(
                "TMDT Image Error: " . $e->getMessage() . "\n" . $e->getTraceAsString()
            );
            throw new LocalizedException(__("Lá»—i xá»­ lÃ½ áº£nh: %1", $e->getMessage()));
        }
    }

    /**
     * Synchronize stock across all B2B warehouses (default, bac-giang, binh-duong)
     */
    private function syncSourceItems(string $sku, float $qty, $connection): void
    {
        $sourceItemTable = $connection->getTableName('inventory_source_item');
        $sources = ['default', 'bac-giang', 'binh-duong'];
        foreach ($sources as $sourceCode) {
            $exists = $connection->fetchOne(
                "SELECT source_item_id FROM {$sourceItemTable} WHERE sku = ? AND source_code = ? LIMIT 1",
                [$sku, $sourceCode]
            );
            if ($exists) {
                $connection->update(
                    $sourceItemTable,
                    [
                        'quantity' => $qty,
                        'status'   => ($qty > 0) ? 1 : 0
                    ],
                    ['source_item_id = ?' => (int)$exists]
                );
            } else {
                $connection->insert(
                    $sourceItemTable,
                    [
                        'source_code' => $sourceCode,
                        'sku'         => $sku,
                        'quantity'    => $qty,
                        'status'      => ($qty > 0) ? 1 : 0
                    ]
                );
            }
        }
    }

    /**
     * Get Seller ID from Customer Session.
     */
    private function getCurrentCustomerId(): string
    {
        // 1. Try PHP session first (browser-based access)
        if ($this->customerSession->isLoggedIn()) {
            return (string)$this->customerSession->getCustomerId();
        }

        // 2. Use Magento's REST UserContext (resolves Bearer token automatically)
        $userContext = $this->getUserContext();
        if ($userContext->getUserType() === UserContextInterface::USER_TYPE_CUSTOMER) {
            $uid = (int)$userContext->getUserId();
            if ($uid > 0) {
                return (string)$uid;
            }
        }

        // 3. Legacy fallback: manual Bearer â†’ oauth_token lookup
        $token = $this->extractBearerToken();

        if ($token === '') {
            $token = trim((string)$this->request->getParam('token'));
        }

        if ($token !== '') {
            $jwtCustomerId = $this->getCustomerIdFromJwtToken($token);
            if ($jwtCustomerId > 0) {
                return (string)$jwtCustomerId;
            }

            $connection = $this->resourceConnection->getConnection();
            $tableName = $connection->getTableName('oauth_token');
            $customerId = $connection->fetchOne(
                $connection->select()
                    ->from($tableName, ['customer_id'])
                    ->where('token = ?', $token)
                    ->limit(1)
            );
            if ($customerId) {
                return (string)$customerId;
            }
        }

        throw new LocalizedException(__('PhiÃªn lÃ m viá»‡c háº¿t háº¡n. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.'));
    }

    private function extractBearerToken(): string
    {
        $headers = [
            (string)$this->request->getHeader('Authorization'),
            (string)$this->request->getServerValue('HTTP_AUTHORIZATION'),
            (string)$this->request->getServerValue('REDIRECT_HTTP_AUTHORIZATION'),
        ];

        foreach ($headers as $authHeader) {
            if ($authHeader !== '' && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                return trim((string)($matches[1] ?? ''));
            }
        }

        return trim((string)$this->request->getQueryValue('token', ''));
    }

    private function getCustomerIdFromJwtToken(string $token): int
    {
        try {
            $reader = ObjectManager::getInstance()->get(\Magento\Integration\Api\UserTokenReaderInterface::class);
            $validator = ObjectManager::getInstance()->get(\Magento\Integration\Api\UserTokenValidatorInterface::class);
            $userToken = $reader->read($token);
            $validator->validate($userToken);
            $context = $userToken->getUserContext();
            if ($context->getUserType() === UserContextInterface::USER_TYPE_CUSTOMER) {
                return (int)$context->getUserId();
            }
        } catch (\Throwable) {
            return 0;
        }
    }

    private function resolveCompanySellerId(string $customerId): string
    {
        $connection = $this->resourceConnection->getConnection();
        $registrationTable = $connection->getTableName('tmdt_customer_registration');
        $row = $connection->fetchRow(
            $connection->select()
                ->from($registrationTable, ['login_code'])
                ->where('customer_id = ?', (int) $customerId)
                ->limit(1)
        );

        $loginCode = is_array($row) ? trim((string) ($row['login_code'] ?? '')) : '';
        if ($loginCode === '') {
            return $customerId;
        }

        $ownerIds = $connection->fetchCol(
            $connection->select()
                ->from($registrationTable, ['customer_id'])
                ->where('login_code = ?', $loginCode)
                ->where('role = ?', 'seller')
        );

        foreach ($ownerIds as $ownerId) {
            if ($this->customerHasOwnerPrivilege((int) $ownerId)) {
                return (string) $ownerId;
            }
        }

        return $customerId;
    }

    private function assertCanManageProductCatalog(string $customerId): void
    {
        if (!$this->customerHasOwnerPrivilege((int) $customerId)) {
            $this->logProductAccessDecision('deny_manage_product_catalog', (int)$customerId);
            throw new LocalizedException(__('Chi chu doanh nghiep moi co quyen quan ly san pham. Co so/chi nhanh chi duoc quan ly kho hang.'));
        }

        $this->logProductAccessDecision('allow_manage_product_catalog', (int)$customerId);
    }

    private function customerHasOwnerPrivilege(int $customerId): bool
    {
        if ($customerId <= 0) {
            return false;
        }

        try {
            $connection = $this->resourceConnection->getConnection();
            $registrationTable = $connection->getTableName('tmdt_customer_registration');
            $registrationRow = $connection->fetchRow(
                $connection->select()
                    ->from($registrationTable, ['role', 'status'])
                    ->where('customer_id = ?', $customerId)
                    ->limit(1)
            );
            $registrationRole = strtolower(trim((string)($registrationRow['role'] ?? '')));
            $registrationStatus = strtolower(trim((string)($registrationRow['status'] ?? '')));
            if ($registrationRole === 'seller' && in_array($registrationStatus, ['approved', 'active'], true)) {
                return true;
            }

            $entityTypeId = (int) $connection->fetchOne(
                "SELECT entity_type_id FROM eav_entity_type WHERE entity_type_code = 'customer' LIMIT 1"
            );
            if ($entityTypeId <= 0) {
                return false;
            }

            $attrs = $connection->fetchPairs(
                $connection->select()
                    ->from($connection->getTableName('eav_attribute'), ['attribute_code', 'attribute_id'])
                    ->where('entity_type_id = ?', $entityTypeId)
                    ->where('attribute_code IN (?)', ['is_owner', 'is_super_admin'])
            );
            if (!$attrs) {
                return false;
            }

            $values = $connection->fetchPairs(
                $connection->select()
                    ->from($connection->getTableName('customer_entity_int'), ['attribute_id', 'value'])
                    ->where('entity_id = ?', $customerId)
                    ->where('attribute_id IN (?)', array_values($attrs))
            );

            foreach ($attrs as $attributeId) {
                if (!empty($values[(int) $attributeId])) {
                    return true;
                }
            }
        } catch (\Throwable) {
            return false;
        }

        return false;
    }

    private function logProductAccessDecision(string $event, int $customerId): void
    {
        try {
            $connection = $this->resourceConnection->getConnection();
            $registrationTable = $connection->getTableName('tmdt_customer_registration');
            $registrationRow = $connection->fetchRow(
                $connection->select()
                    ->from($registrationTable, ['role', 'status', 'login_code', 'unit_nickname'])
                    ->where('customer_id = ?', $customerId)
                    ->limit(1)
            );

            ObjectManager::getInstance()
                ->get(\Psr\Log\LoggerInterface::class)
                ->info('[TMDT][ProductCatalogAccess] ' . $event, [
                    'customer_id' => $customerId,
                    'role' => is_array($registrationRow) ? (string)($registrationRow['role'] ?? '') : '',
                    'status' => is_array($registrationRow) ? (string)($registrationRow['status'] ?? '') : '',
                    'login_code' => is_array($registrationRow) ? (string)($registrationRow['login_code'] ?? '') : '',
                    'unit_nickname' => is_array($registrationRow) ? (string)($registrationRow['unit_nickname'] ?? '') : '',
                ]);
        } catch (\Throwable) {
            // Logging must never block product catalog actions.
        }
    }

    /**
     * Verify that the requested product sku belongs to the logged-in seller.
     */
    private function verifyProductOwnership(string $sku): void
    {
        $sellerId = $this->resolveCompanySellerId($this->getCurrentCustomerId());
        try {
            $product = $this->productRepository->get($sku);
            $prodSellerId = $product->getCustomAttribute('tmdt_seller_id') 
                ? (string) $product->getCustomAttribute('tmdt_seller_id')->getValue() 
                : '';

            if ($prodSellerId !== '' && $prodSellerId !== 'NONE' && $prodSellerId !== $sellerId) {
                throw new LocalizedException(__('Báº¡n khÃ´ng cÃ³ quyá»n sá»­a sáº£n pháº©m nÃ y.'));
            }
        } catch (LocalizedException $e) {
            throw $e;
        } catch (\Exception $e) {
            throw new LocalizedException(__('KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m.'));
        }
    }

    /**
     * Resolve category ID by name.
     */
    private function resolveCategoryIdByName(string $categoryName): ?int
    {
        $categoryMap = [
            'Rau cá»§ quáº£' => 6,
            'TrÃ¡i cÃ¢y' => 10,
            'Thá»±c pháº©m tÆ°Æ¡i sá»‘ng' => 13,
            'Thuá»· háº£i sáº£n' => 17,
            'Thá»±c pháº©m Ä‘Ã´ng láº¡nh' => 21,
            'Thá»±c pháº©m khÃ´' => 25,
            'Tiá»‡n Ã­ch báº¿p' => 29
        ];

        if (isset($categoryMap[$categoryName])) {
            return $categoryMap[$categoryName];
        }

        // Accentless normalization mapping
        $normalizedMap = [
            'rau cu qua' => 6,
            'trai cay' => 10,
            'thuc pham tuoi song' => 13,
            'thuy hai san' => 17,
            'thuc pham dong lanh' => 21,
            'thuc pham kho' => 25,
            'tien ich bep' => 29
        ];

        $normalizedName = strtolower($this->removeVietnameseAccents($categoryName));
        if (isset($normalizedMap[$normalizedName])) {
            return $normalizedMap[$normalizedName];
        }

        try {
            // Dynamic DB lookup in catalog_category_entity_varchar to support other environments
            $connection = $this->resourceConnection->getConnection();
            $select = $connection->select()
                ->from(['cce' => $connection->getTableName('catalog_category_entity')], ['entity_id'])
                ->join(
                    ['ccev' => $connection->getTableName('catalog_category_entity_varchar')],
                    'cce.entity_id = ccev.entity_id',
                    []
                )
                ->where('ccev.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = \'name\' AND entity_type_id = 3 LIMIT 1)')
                ->where('ccev.value = ? OR LOWER(ccev.value) = ?', [$categoryName, $normalizedName])
                ->limit(1);

            $result = $connection->fetchOne($select);
            if ($result) {
                return (int)$result;
            }
        } catch (\Exception $e) {
            // Ignore DB lookup error, fall back to default
        }

        return null;
    }

    /**
     * Helper to remove Vietnamese accents.
     */
    private function removeVietnameseAccents(string $str): string
    {
        $str = preg_replace("/(Ã |Ã¡|áº¡|áº£|Ã£|Ã¢|áº§|áº¥|áº­|áº©|áº«|Äƒ|áº±|áº¯|áº·|áº³|áºµ)/", "a", $str);
        $str = preg_replace("/(Ã¨|Ã©|áº¹|áº»|áº½|Ãª|á»|áº¿|á»‡|á»ƒ|á»…)/", "e", $str);
        $str = preg_replace("/(Ã¬|Ã­|á»‹|á»‰|Ä©)/", "i", $str);
        $str = preg_replace("/(Ã²|Ã³|á»|á»|Ãµ|Ã´|á»“|á»‘|á»™|á»•|á»—|Æ¡|á»|á»›|á»£|á»Ÿ|á»¡)/", "o", $str);
        $str = preg_replace("/(Ã¹|Ãº|á»¥|á»§|Å©|Æ°|á»«|á»©|á»±|á»­|á»¯)/", "u", $str);
        $str = preg_replace("/(á»³|Ã½|á»µ|á»·|á»¹)/", "y", $str);
        $str = preg_replace("/(Ä‘)/", "d", $str);
        $str = preg_replace("/(Ã€|Ã|áº |áº¢|Ãƒ|Ã‚|áº¦|áº¤|áº¬|áº¨|áºª|Ä‚|áº°|áº®|áº¶|áº²|áº´)/", "A", $str);
        $str = preg_replace("/(Ãˆ|Ã‰|áº¸|áºº|E|ÃŠ|á»€|áº¾|á»†|á»‚|á»„)/", "E", $str);
        $str = preg_replace("/(ÃŒ|Ã|á»Š|á»ˆ|Ä¨)/", "I", $str);
        $str = preg_replace("/(Ã’|Ã“|á»Œ|á»Ž|Ã•|Ã”|á»’|á»|á»˜|á»”|á»–|Æ |á»œ|á»š|á»¢|á»ž|á» )/", "O", $str);
        $str = preg_replace("/(Ã™|Ãš|á»¤|á»¦|Å¨|Æ¯|á»ª|á»¨|á»°|á»¬|á»®)/", "U", $str);
        $str = preg_replace("/(Ã|Ã|Ã|Ã|Ã)/", "Y", $str);
        $str = preg_replace("/(Ä)/", "D", $str);
        return $str;
    }

    /**
     * Reindex product and clear relevant caches.
     *
     * @param \Magento\Catalog\Model\Product $product
     * @return void
     */
    private function reindexAndCleanCache($product): void
    {
        try {
            $productId = (int)$product->getId();
            
            // Reindex specific product row for key indexers
            $indexers = [
                'catalog_category_product',
                'catalog_product_category',
                'catalog_product_price',
                'catalogsearch_fulltext'
            ];
            
            foreach ($indexers as $indexerId) {
                try {
                    $indexer = $this->indexerRegistry->get($indexerId);
                    $indexer->reindexRow($productId);
                } catch (\Exception $e) {
                    // Ignore indexer errors
                }
            }

            // Flush relevant cache types
            $cacheTypes = ['full_page', 'block_html', 'collections', 'graphql_query_resolver_result'];
            foreach ($cacheTypes as $type) {
                $this->cacheTypeList->cleanType($type);
            }
        } catch (\Exception $e) {
            // Silently ignore to avoid breaking the main request
        }
    }

    /**
     * Generate a unique URL key based on name and SKU.
     *
     * @param string $name
     * @param string $sku
     * @return string
     */
    private function generateUniqueUrlKey(string $name, string $sku): string
    {
        $normalized = $this->removeVietnameseAccents($name);
        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $normalized), '-'));
        $slug = preg_replace('/-+/', '-', $slug);
        
        $suffix = substr(md5($sku . '_' . time()), 0, 8);
        return $slug . '-' . $suffix;
    }

    /**
     * @inheritDoc
     */
    public function getSellerNotifications(): array
    {
        $sellerId = $this->resolveCompanySellerId($this->getCurrentCustomerId());
        $connection = $this->resourceConnection->getConnection();
        
        $select = $connection->select()
            ->from($connection->getTableName('tmdt_seller_notifications'))
            ->where('seller_id = ?', $sellerId)
            ->order('created_at DESC');
            
        return $connection->fetchAll($select);
    }

    /**
     * @inheritDoc
     */
    public function markNotificationsAsRead(): bool
    {
        $sellerId = $this->resolveCompanySellerId($this->getCurrentCustomerId());
        $connection = $this->resourceConnection->getConnection();
        
        $connection->update(
            $connection->getTableName('tmdt_seller_notifications'),
            ['is_read' => 1],
            ['seller_id = ?' => $sellerId]
        );
        
        return true;
    }

    /**
     * @inheritDoc
     */
    public function getSellerRevenueStats(): array
    {
        $sellerId = (int) $this->resolveCompanySellerId($this->getCurrentCustomerId());
        $connection = $this->resourceConnection->getConnection();
        
        $oTable = $connection->getTableName('tmdt_orders');
        $oiTable = $connection->getTableName('tmdt_order_items');

        // 1. Total revenue and total orders
        $totalStats = $connection->fetchRow("
            SELECT 
                COALESCE(SUM(oi.row_total), 0) AS total_revenue,
                COUNT(DISTINCT o.id) AS total_orders
            FROM {$oTable} o
            INNER JOIN {$oiTable} oi ON o.id = oi.order_id
            WHERE oi.seller_id = :seller_id
              AND o.status IN ('paid', 'processing', 'preparing', 'handed_over', 'shipping', 'delivered', 'pending')
              AND COALESCE(o.parent_code, '') != 'parent'
        ", ['seller_id' => $sellerId]);

        $totalRevenue = (float)$totalStats['total_revenue'];
        $totalOrders = (int)$totalStats['total_orders'];

        // 2. Chart data (last 6 months)
        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $monthNum = date('n', strtotime("-{$i} month"));
            $monthYear = date('Y-m', strtotime("-{$i} month"));
            $monthName = 'Tháng ' . $monthNum;
            $months[$monthYear] = [
                'name' => $monthName,
                'DoanhThu' => 0.0,
                'DonHang' => 0
            ];
        }

        $monthlyStats = $connection->fetchAll("
            SELECT 
                DATE_FORMAT(o.created_at, '%Y-%m') AS month_key,
                SUM(oi.row_total) AS monthly_revenue,
                COUNT(DISTINCT o.id) AS monthly_orders
            FROM {$oTable} o
            INNER JOIN {$oiTable} oi ON o.id = oi.order_id
            WHERE oi.seller_id = :seller_id
              AND o.status IN ('paid', 'processing', 'preparing', 'handed_over', 'shipping', 'delivered', 'pending')
              AND COALESCE(o.parent_code, '') != 'parent'
            GROUP BY month_key
        ", ['seller_id' => $sellerId]);

        foreach ($monthlyStats as $ms) {
            $key = $ms['month_key'];
            if (isset($months[$key])) {
                $months[$key]['DoanhThu'] = (float)$ms['monthly_revenue'];
                $months[$key]['DonHang'] = (int)$ms['monthly_orders'];
            }
        }

        $chartData = array_values($months);

        // 3. Category distribution
        $categoryDataQuery = "
            SELECT 
                COALESCE(ccev.value, 'Khác') AS name,
                SUM(oi.row_total) AS value
            FROM {$oTable} o
            INNER JOIN {$oiTable} oi ON o.id = oi.order_id
            LEFT JOIN " . $connection->getTableName('catalog_category_product') . " ccp ON oi.product_id = ccp.product_id
            LEFT JOIN " . $connection->getTableName('catalog_category_entity_varchar') . " ccev ON ccp.category_id = ccev.entity_id
                AND ccev.attribute_id = (SELECT attribute_id FROM " . $connection->getTableName('eav_attribute') . " WHERE attribute_code = 'name' AND entity_type_id = 3 LIMIT 1)
            WHERE oi.seller_id = :seller_id
              AND o.status IN ('paid', 'processing', 'preparing', 'handed_over', 'shipping', 'delivered', 'pending')
              AND COALESCE(o.parent_code, '') != 'parent'
            GROUP BY name
            ORDER BY value DESC
        ";
        $categoryData = $connection->fetchAll($categoryDataQuery, ['seller_id' => $sellerId]);
        foreach ($categoryData as &$cd) {
            $cd['value'] = (float)$cd['value'];
        }

        // 4. Top products
        $topProductsQuery = "
            SELECT 
                oi.product_id AS id,
                oi.sku,
                oi.name,
                oi.unit,
                oi.image,
                SUM(oi.quantity) AS sales_volume,
                SUM(oi.row_total) AS revenue
            FROM {$oTable} o
            INNER JOIN {$oiTable} oi ON o.id = oi.order_id
            WHERE oi.seller_id = :seller_id
              AND o.status IN ('paid', 'processing', 'preparing', 'handed_over', 'shipping', 'delivered', 'pending')
              AND COALESCE(o.parent_code, '') != 'parent'
            GROUP BY oi.product_id, oi.sku, oi.name, oi.unit, oi.image
            ORDER BY revenue DESC
            LIMIT 4
        ";
        $topProducts = $connection->fetchAll($topProductsQuery, ['seller_id' => $sellerId]);
        foreach ($topProducts as &$tp) {
            $tp['id'] = (int)$tp['id'];
            $tp['sales_volume'] = (float)$tp['sales_volume'];
            $tp['revenue'] = (float)$tp['revenue'];
            $tp['image'] = $tp['image'] ? '/media/catalog/product/' . ltrim((string)$tp['image'], '/') : '';
        }

        // 5. Operational log: recent orders for this seller + stock notifications
        $operationalLog = [];

        // 5a. Recent orders involving this seller
        $recentOrdersQuery = "
            SELECT DISTINCT
                o.order_code,
                o.status,
                o.customer_name,
                o.total_amount,
                o.created_at
            FROM {$oTable} o
            INNER JOIN {$oiTable} oi ON o.id = oi.order_id
            WHERE oi.seller_id = :seller_id
              AND COALESCE(o.parent_code, '') != 'parent'
            ORDER BY o.created_at DESC
            LIMIT 6
        ";
        $recentOrders = $connection->fetchAll($recentOrdersQuery, ['seller_id' => $sellerId]);
        foreach ($recentOrders as $ro) {
            $statusLabel = match(strtolower((string)$ro['status'])) {
                'paid'       => 'đã thanh toán',
                'processing' => 'đang xử lý (COD)',
                'cancelled','canceled' => 'đã hủy',
                'expired'    => 'hết hạn',
                default      => 'chờ thanh toán'
            };
            $operationalLog[] = [
                'type'    => 'order_created',
                'title'   => 'Đơn sỉ mới nhận',
                'message' => "Đơn <strong>{$ro['order_code']}</strong> từ <strong>{$ro['customer_name']}</strong> - " . number_format((float)$ro['total_amount'], 0, ',', '.') . "đ - {$statusLabel}",
                'time'    => $ro['created_at']
            ];
        }

        // 5b. Stock out-of-stock notifications
        $notifTable = $connection->getTableName('tmdt_seller_notifications');
        $tableExists = $connection->fetchOne(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '{$notifTable}'"
        );
        if ($tableExists) {
            $notifications = $connection->fetchAll("
                SELECT sku, message, created_at FROM {$notifTable}
                WHERE seller_customer_id = :seller_id
                ORDER BY created_at DESC
                LIMIT 4
            ", ['seller_id' => $sellerId]);
            foreach ($notifications as $n) {
                $operationalLog[] = [
                    'type'    => 'out_of_stock',
                    'title'   => 'Cảnh báo hết hàng',
                    'message' => $n['message'],
                    'time'    => $n['created_at']
                ];
            }
        }

        // Sort by time desc
        usort($operationalLog, fn($a, $b) => strcmp($b['time'], $a['time']));
        $operationalLog = array_slice($operationalLog, 0, 8);

        return [
            'success'        => true,
            'totalRevenue'   => $totalRevenue,
            'totalOrders'    => $totalOrders,
            'chartData'      => $chartData,
            'categoryData'   => $categoryData,
            'topProducts'    => $topProducts,
            'operationalLog' => $operationalLog
        ];
    }

    /**
     * @inheritDoc
     */
    public function getSellerOrders(): array
    {
        $logger = ObjectManager::getInstance()->get(\Psr\Log\LoggerInterface::class);
        $startedAt = microtime(true);

        try {
            $this->autoCompleteExpiredShippingOrders();
            $currentCustomerId = $this->getCurrentCustomerId();
            $sellerId = (int) $this->resolveCompanySellerId($currentCustomerId);
            $connection = $this->resourceConnection->getConnection();
            $limit = max(1, min(50, (int) ($this->request->getParam('limit') ?: 20)));
            $statusFilter = strtolower(trim((string) ($this->request->getParam('status') ?: 'all')));
            $searchQuery = strtolower(trim((string) ($this->request->getParam('q') ?: '')));

            $logger->info('[TMDT][SellerOrders] request started', [
                'customer_id' => $currentCustomerId,
                'seller_id' => $sellerId,
                'limit' => $limit,
                'status' => $statusFilter,
                'q' => $searchQuery,
                'has_authorization_header' => $this->extractBearerToken() !== '',
            ]);

            $oTable = $connection->getTableName('tmdt_orders');
            $oiTable = $connection->getTableName('tmdt_order_items');

        // Build base select
        $select = $connection->select()
            ->from(['o' => $oTable], [
                'order_reference' => 'order_code',
                'status',
                'customer_name',
                'customer_email',
                'shipping_json',
                'transaction_id',
                'expires_at',
                'paid_at',
                'created_at',
                'total_amount',
                'payment_method'
            ])
            ->join(['oi' => $oiTable], 'o.id = oi.order_id', [
                'seller_subtotal' => 'SUM(oi.row_total)',
                'quantity_total'  => 'SUM(oi.quantity)',
                'item_count'      => 'COUNT(oi.id)'
            ])
            ->where('(oi.seller_id = ? OR oi.seller_id IS NULL)', $sellerId)
            ->where('COALESCE(o.parent_code, \'\') != ?', 'parent')
            ->group('o.id')
            ->order('o.created_at DESC');

        // Apply status filter
        if ($statusFilter !== 'all' && $statusFilter !== '') {
            if ($statusFilter === 'cancelled') {
                $select->where('o.status IN (?)', ['cancelled', 'canceled']);
            } elseif ($statusFilter === 'shipping') {
                $select->where('o.status IN (?)', ['shipping', 'handed_over']);
            } else {
                $select->where('o.status = ?', $statusFilter);
            }
        }

        // Apply search query
        if ($searchQuery !== '') {
            $select->where(
                'o.order_code LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ? OR oi.sku LIKE ? OR oi.name LIKE ?',
                ['%' . $searchQuery . '%', '%' . $searchQuery . '%', '%' . $searchQuery . '%', '%' . $searchQuery . '%', '%' . $searchQuery . '%']
            );
        }

        $rows = $connection->fetchAll($select);

        $filteredOrders = [];
        $summary = [
            'total_orders' => 0,
            'total_revenue' => 0.0,
            'paid_orders' => 0,
            'pending_orders' => 0,
            'processing_orders' => 0,
            'cancelled_orders' => 0,
            'expired_orders' => 0,
        ];

        foreach ($rows as $row) {
            $orderRef = $row['order_reference'];
            $shippingInfo = $this->decodeJsonObject((string)($row['shipping_json'] ?? ''));

            // Fetch order items for this seller
            $itemsSelect = $connection->select()
                ->from($oiTable, ['item_id' => 'id', 'sku', 'name', 'unit', 'quantity', 'unit_price', 'row_total', 'image'])
                ->where('order_id = (SELECT id FROM ' . $oTable . ' WHERE order_code = ? LIMIT 1)', $orderRef)
                ->where('(seller_id = ? OR seller_id IS NULL)', $sellerId);
            $itemsRows = $connection->fetchAll($itemsSelect);

            foreach ($itemsRows as &$item) {
                $item['item_id'] = (int)$item['item_id'];
                $item['quantity'] = (float)$item['quantity'];
                $item['unit_price'] = (float)$item['unit_price'];
                $item['row_total'] = (float)$item['row_total'];
                $item['category'] = 'Máº·t hÃ ng sá»‰'; // fallback
                $item['image'] = $item['image'] ? '/media/catalog/product/' . ltrim((string)$item['image'], '/') : '';
            }

            $sellerSubtotal = (float)$row['seller_subtotal'];
            $orderStatus = strtolower((string)$row['status']);

            $orderData = [
                'order_reference' => $orderRef,
                'status'          => $row['status'],
                'status_label'    => $this->getOrderStatusLabel((string)$row['status']),
                'customer_name'   => $row['customer_name'] ?? '',
                'customer_email'  => $row['customer_email'] ?? '',
                'customer_region' => $shippingInfo['branch'] ?? '',
                'supplier'        => '',
                'subtotal'        => (float)$row['total_amount'],
                'seller_subtotal' => $sellerSubtotal,
                'total_amount'    => (float)$row['total_amount'],
                'delivery_date'   => $shippingInfo['deliveryDate'] ?? '',
                'delivery_time'   => $shippingInfo['deliveryTime'] ?? '',
                'shipping_address'=> isset($shippingInfo['branch']) ? ($shippingInfo['branch'] . ' - ' . ($shippingInfo['address'] ?? '')) : '',
                'shipping_info'   => $shippingInfo,
                'note'            => $shippingInfo['note'] ?? '',
                'created_at'      => $row['created_at'],
                'transaction_id'  => $row['transaction_id'] ?? '',
                'expires_at'      => $row['expires_at'] ?? '',
                'paid_at'         => $row['paid_at'] ?? '',
                'payment_method'  => $row['payment_method'] ?? 'bank_transfer',
                'item_count'      => (int)$row['item_count'],
                'quantity_total'  => (float)$row['quantity_total'],
                'items'           => $itemsRows,
            ];

            $filteredOrders[] = $orderData;

            // Summary calculations
            $summary['total_orders'] += 1;
            // Count revenue for all active statuses: paid, processing, preparing, handed_over, shipping, delivered, pending
            if (in_array($orderStatus, ['paid', 'processing', 'preparing', 'handed_over', 'shipping', 'delivered', 'pending'], true)) {
                $summary['total_revenue'] += $sellerSubtotal;
            }

            if ($orderStatus === 'paid') {
                $summary['paid_orders'] += 1;
            } elseif ($orderStatus === 'processing') {
                $summary['processing_orders'] += 1;
            } elseif (in_array($orderStatus, ['cancelled', 'canceled'], true)) {
                $summary['cancelled_orders'] += 1;
            } elseif ($orderStatus === 'expired') {
                $summary['expired_orders'] += 1;
            } else {
                $summary['pending_orders'] += 1;
            }
        }

            $items = array_slice($filteredOrders, 0, $limit);
            $logger->info('[TMDT][SellerOrders] request completed', [
                'seller_id' => $sellerId,
                'row_count' => count($rows),
                'returned_count' => count($items),
                'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            ]);

            return [
                'success' => true,
                'summary' => [
                    'total_orders'      => $summary['total_orders'],
                    'total_revenue'     => round((float)$summary['total_revenue'], 2),
                    'paid_orders'       => $summary['paid_orders'],
                    'pending_orders'    => $summary['pending_orders'],
                    'processing_orders' => $summary['processing_orders'],
                    'cancelled_orders'  => $summary['cancelled_orders'],
                    'expired_orders'    => $summary['expired_orders'],
                ],
                'items' => $items,
            ];
        } catch (\Throwable $e) {
            $logger->error('[TMDT][SellerOrders] request failed', [
                'message' => $e->getMessage(),
                'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            ]);
            throw $e;
        }
    }

    /**
     * Decode a JSON object safely.
     */
    private function decodeJsonObject(string $value): array
    {
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
    }

    /**
     * Normalize a purchase history item row.
     */
    private function formatItem(array $item): array
    {
        return [
            'item_id' => (int) ($item['item_id'] ?? 0),
            'sku' => (string) ($item['sku'] ?? ''),
            'name' => (string) ($item['product_name'] ?? $item['name'] ?? ''),
            'category' => (string) ($item['category'] ?? ''),
            'unit' => (string) ($item['unit'] ?? ''),
            'quantity' => (float) ($item['quantity'] ?? 0),
            'unit_price' => (float) ($item['unit_price'] ?? 0),
            'row_total' => (float) ($item['row_total'] ?? 0),
            'image' => (string) ($item['image'] ?? ''),
        ];
    }

    /**
     * Determine whether a seller order matches a search query.
     */
    private function matchesSellerOrderQuery(array $order, string $query): bool
    {
        $haystack = implode(' ', [
            (string) ($order['order_reference'] ?? ''),
            (string) ($order['customer_name'] ?? ''),
            (string) ($order['customer_email'] ?? ''),
            (string) ($order['customer_region'] ?? ''),
            (string) ($order['supplier'] ?? ''),
            (string) ($order['shipping_address'] ?? ''),
            (string) ($order['transaction_id'] ?? ''),
            (string) ($order['note'] ?? ''),
        ]);

        if (stripos($haystack, $query) !== false) {
            return true;
        }

        foreach (($order['items'] ?? []) as $item) {
            if (!is_array($item)) {
                continue;
            }

            $itemHaystack = implode(' ', [
                (string) ($item['sku'] ?? ''),
                (string) ($item['name'] ?? ''),
                (string) ($item['category'] ?? ''),
            ]);
            if (stripos($itemHaystack, $query) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * @inheritDoc
     * Get purchase history for the currently authenticated customer.
     * Uses Magento's UserContextInterface (resolves Bearer token automatically in REST context).
     */
    public function getPurchaseHistory(): array
    {
        $this->autoCompleteExpiredShippingOrders();
        $connection = $this->resourceConnection->getConnection();

        // â”€â”€ Resolve customer identity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        $customerId    = 0;
        $customerEmail = '';

        // 1. PHP session (browser-based)
        if ($this->customerSession->isLoggedIn()) {
            $customerId    = (int)$this->customerSession->getCustomerId();
            $customerEmail = (string)$this->customerSession->getCustomer()->getEmail();
        }

        // 2. Magento REST UserContext â€“ the framework resolves Bearer token automatically
        if ($customerId === 0) {
            $userCtx = $this->getUserContext();
            if ($userCtx->getUserType() === UserContextInterface::USER_TYPE_CUSTOMER) {
                $customerId = (int)$userCtx->getUserId();
            }
        }

        // 3. Legacy fallback: manual Bearer â†’ oauth_token lookup (handles long-lived tokens)
        if ($customerId === 0) {
            $token = '';
            $authHeader = $this->request->getHeader('Authorization');
            if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $m)) {
                $token = trim($m[1]);
            }
            if ($token === '') {
                $token = trim((string)$this->request->getParam('token'));
            }
            if ($token !== '') {
                $oauthTable = $connection->getTableName('oauth_token');
                $row = $connection->fetchRow(
                    $connection->select()
                        ->from($oauthTable, ['customer_id'])
                        ->where('token = ?', $token)
                        ->limit(1)
                );
                if ($row && (int)$row['customer_id'] > 0) {
                    $customerId = (int)$row['customer_id'];
                }
            }
        }

        // Resolve email from customer_entity
        if ($customerId > 0 && $customerEmail === '') {
            $ceTable = $connection->getTableName('customer_entity');
            $customerEmail = (string)$connection->fetchOne(
                $connection->select()
                    ->from($ceTable, ['email'])
                    ->where('entity_id = ?', $customerId)
                    ->limit(1)
            );
        }

        if ($customerEmail === '') {
            throw new LocalizedException(__('PhiÃªn lÃ m viá»‡c háº¿t háº¡n. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.'));
        }

        // â”€â”€ Query parameters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        $limit        = max(1, min(100, (int)($this->request->getParam('limit') ?: 30)));
        $statusFilter = strtolower(trim((string)($this->request->getParam('status') ?: 'all')));
        $searchQuery  = strtolower(trim((string)($this->request->getParam('q') ?: '')));

        $oTable  = $connection->getTableName('tmdt_orders');
        $oiTable = $connection->getTableName('tmdt_order_items');

        // â”€â”€ Build base SELECT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        $select = $connection->select()
            ->from(['o' => $oTable], [
                'history_id'       => 'o.id',
                'order_reference'  => 'o.order_code',
                'parent_code'      => 'o.parent_code',
                'status'           => 'o.status',
                'customer_name'    => 'o.customer_name',
                'customer_email'   => 'o.customer_email',
                'shipping_json'    => 'o.shipping_json',
                'transaction_id'   => 'o.transaction_id',
                'expires_at'       => 'o.expires_at',
                'paid_at'          => 'o.paid_at',
                'total_amount'     => 'o.total_amount',
                'payment_method'   => 'o.payment_method',
                'created_at'       => 'o.created_at',
            ])
            ->where('o.customer_email = ?', $customerEmail)
            ->order('o.created_at DESC')
            ->limit($limit);

        if ($statusFilter !== 'all' && $statusFilter !== '') {
            if ($statusFilter === 'paid') {
                $select->where('o.status IN (?)', ['paid', 'processing', 'preparing', 'handed_over', 'shipping', 'delivered']);
            } elseif ($statusFilter === 'cancelled') {
                $select->where('o.status IN (?)', ['cancelled', 'canceled']);
            } else {
                $select->where('o.status = ?', $statusFilter);
            }
        }

        if ($searchQuery !== '') {
            $select->where(
                'o.order_code LIKE ? OR o.customer_name LIKE ?',
                ['%' . $searchQuery . '%', '%' . $searchQuery . '%']
            );
        }

        $rows = $connection->fetchAll($select);
        $orders = [];

        foreach ($rows as $row) {
            $orderRef    = $row['order_reference'];
            $shippingInfo = $this->decodeJsonObject((string)($row['shipping_json'] ?? ''));

            // Fetch all items for this order (across all sellers)
            $itemsSelect = $connection->select()
                ->from(
                    $oiTable,
                    ['item_id' => 'id', 'seller_id', 'sku', 'name', 'unit', 'quantity', 'unit_price', 'row_total', 'image']
                )
                ->where('order_id = ?', (int)$row['history_id']);
            $itemRows = $connection->fetchAll($itemsSelect);

            // Resolve seller name for display (store name from tmdt_customer_registration)
            $sellerNames = [];
            $regTable = $connection->getTableName('tmdt_customer_registration');
            foreach ($itemRows as &$item) {
                $item['item_id']    = (int)$item['item_id'];
                $item['quantity']   = (float)$item['quantity'];
                $item['unit_price'] = (float)$item['unit_price'];
                $item['row_total']  = (float)$item['row_total'];
                $item['category']   = 'Máº·t hÃ ng sá»‰';
                $item['image']      = $item['image']
                    ? '/media/catalog/product/' . ltrim((string)$item['image'], '/')
                    : '';

                $sid = (int)$item['seller_id'];
                if ($sid > 0 && !isset($sellerNames[$sid])) {
                    $sellerName = $connection->fetchOne(
                        $connection->select()
                            ->from($regTable, ['unit_nickname'])
                            ->where('customer_id = ?', $sid)
                            ->limit(1)
                    );
                    $sellerNames[$sid] = $sellerName ?: ('Seller #' . $sid);
                }
                $item['seller_name'] = $sid > 0 ? ($sellerNames[$sid] ?? '') : '';
            }
            unset($item);

            // Determine primary supplier label
            $supplierLabel = '';
            if (!empty($sellerNames)) {
                $supplierLabel = implode(', ', array_unique(array_values($sellerNames)));
            }

            $orders[] = [
                'history_id'       => (int)$row['history_id'],
                'order_reference'  => $orderRef,
                'parent_code'      => $row['parent_code'] ?? null,
                'status'           => $row['status'] ?? 'pending',
                'status_label'     => $this->getOrderStatusLabel((string)($row['status'] ?? '')),
                'customer_name'    => $row['customer_name'] ?? '',
                'customer_region'  => $shippingInfo['branch'] ?? '',
                'supplier'         => $supplierLabel,
                'subtotal'         => (float)$row['total_amount'],
                'total_amount'     => (float)$row['total_amount'],
                'delivery_date'    => $shippingInfo['deliveryDate'] ?? '',
                'delivery_time'    => $shippingInfo['deliveryTime'] ?? '',
                'shipping_address' => isset($shippingInfo['branch'])
                    ? ($shippingInfo['branch'] . ' - ' . ($shippingInfo['address'] ?? ''))
                    : ($shippingInfo['address'] ?? ''),
                'shipping_info'    => $shippingInfo,
                'note'             => $shippingInfo['note'] ?? '',
                'transaction_id'   => $row['transaction_id'] ?? '',
                'expires_at'       => $row['expires_at'] ?? '',
                'paid_at'          => $row['paid_at'] ?? '',
                'payment_method'   => $row['payment_method'] ?? '',
                'created_at'       => $row['created_at'],
                'items'            => $itemRows,
            ];
        }

        return $orders;
    }

    /**
     * Normalize seller order status labels.
     */
    private function getOrderStatusLabel(string $status): string
    {
        return match (strtolower($status)) {
            'paid' => 'Đã thanh toán',
            'processing' => 'Đang xử lý',
            'preparing' => 'Đang chuẩn bị hàng',
            'handed_over' => 'Đang giao hàng',
            'shipping' => 'Đang giao hàng',
            'delivered' => 'Đã giao hàng',
            'cancelled', 'canceled' => 'Đã hủy',
            'expired' => 'Hết hạn',
            'pending' => 'Chờ thanh toán',
            default => $status !== '' ? ucfirst($status) : 'Chờ thanh toán',
        };
    }

    private function getOrderProcessor(): \Tmdt\Catalog\Model\OrderProcessor
    {
        return ObjectManager::getInstance()->get(\Tmdt\Catalog\Model\OrderProcessor::class);
    }

    /**
     * Automatically transition orders in 'shipping' status to 'delivered'
     * if they have been in 'shipping' for more than 3 days.
     */
    private function autoCompleteExpiredShippingOrders(): void
    {
        try {
            $connection = $this->resourceConnection->getConnection();
            $table = $connection->getTableName('tmdt_orders');
            $historyTable = $connection->getTableName('tmdt_order_status_history');

            // Find all orders currently in 'shipping' status
            $shippingOrders = $connection->fetchAll(
                "SELECT id, order_code FROM {$table} WHERE status = 'shipping'"
            );

            if (empty($shippingOrders)) {
                return;
            }

            $orderProcessor = $this->getOrderProcessor();
            $threeDaysAgo = time() - (3 * 24 * 60 * 60);

            foreach ($shippingOrders as $order) {
                $orderId = (int)$order['id'];
                $orderCode = (string)$order['order_code'];

                // Query the time it entered 'shipping' status
                $shippingTime = $connection->fetchOne(
                    "SELECT created_at FROM {$historyTable} WHERE order_id = ? AND status = 'shipping' ORDER BY id DESC LIMIT 1",
                    [$orderId]
                );

                if ($shippingTime) {
                    $shippingTimestamp = strtotime($shippingTime);
                    if ($shippingTimestamp < $threeDaysAgo) {
                        $orderProcessor->confirmOrder(
                            $orderCode,
                            '',
                            'delivered',
                            'Hệ thống tự động hoàn thành đơn hàng sau 3 ngày giao hàng.'
                        );
                    }
                }
            }
        } catch (\Throwable $e) {
            // Ignore
        }
    }
}
