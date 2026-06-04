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
     * @inheritDoc
     */
    public function createProduct(string $productData): string
    {
        $sellerId = $this->getSellerIdFromSession();
        $data = json_decode($productData, true);
        if (!is_array($data)) {
            $data = [];
        }

        if (empty($data['name']) || empty($data['sku']) || empty($data['price'])) {
            throw new LocalizedException(__('Tên, SKU và giá sỉ là bắt buộc.'));
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
                    $descriptionHtml .= '<p><strong>Đặc điểm:</strong> ' . htmlspecialchars($desc['features']) . '</p>';
                }
                if (!empty($desc['benefits'])) {
                    $descriptionHtml .= '<p><strong>Công dụng:</strong> ' . htmlspecialchars($desc['benefits']) . '</p>';
                }
                if (!empty($desc['storage'])) {
                    $descriptionHtml .= '<p><strong>Cách bảo quản:</strong> ' . htmlspecialchars($desc['storage']) . '</p>';
                }
                if (!empty($desc['expiry'])) {
                    $descriptionHtml .= '<p><strong>Thời hạn sử dụng:</strong> ' . htmlspecialchars($desc['expiry']) . '</p>';
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

            // Save Product
            $this->productRepository->save($product);

            // Handle Base64 image upload if set
            if (!empty($data['image'])) {
                $this->processBase64Image($product, $data['image']);
                $this->productRepository->save($product);
            }

            // Set Stock level natively
            $qty = isset($data['qty']) ? (float) $data['qty'] : 0.0;
            $stockItem = $this->stockRegistry->getStockItemBySku($product->getSku());
            $stockItem->setIsInStock($qty > 0);
            $stockItem->setQty($qty);
            $this->stockRegistry->updateStockItemBySku($product->getSku(), $stockItem);

            // Reindex and clean cache
            $this->reindexAndCleanCache($product);

            return json_encode([
                'success' => true,
                'message' => 'Đăng sản phẩm sỉ thành công!',
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
                    $descriptionHtml .= '<p><strong>Đặc điểm:</strong> ' . htmlspecialchars($desc['features']) . '</p>';
                }
                if (!empty($desc['benefits'])) {
                    $descriptionHtml .= '<p><strong>Công dụng:</strong> ' . htmlspecialchars($desc['benefits']) . '</p>';
                }
                if (!empty($desc['storage'])) {
                    $descriptionHtml .= '<p><strong>Cách bảo quản:</strong> ' . htmlspecialchars($desc['storage']) . '</p>';
                }
                if (!empty($desc['expiry'])) {
                    $descriptionHtml .= '<p><strong>Thời hạn sử dụng:</strong> ' . htmlspecialchars($desc['expiry']) . '</p>';
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

            $this->productRepository->save($product);

            if (isset($data['qty'])) {
                $qty = (float) $data['qty'];
                $stockItem = $this->stockRegistry->getStockItemBySku($sku);
                $stockItem->setIsInStock($qty > 0);
                $stockItem->setQty($qty);
                $this->stockRegistry->updateStockItemBySku($sku, $stockItem);
            }

            // Reindex and clean cache
            $this->reindexAndCleanCache($product);

            return json_encode([
                'success' => true,
                'message' => 'Cập nhật sản phẩm sỉ thành công!',
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
                'message' => 'Đã xóa sản phẩm thành công khỏi catalog.'
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
        $sellerId = $this->getSellerIdFromSession();
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
        $products = [];
        
        foreach ($results as $row) {
            $products[] = [
                'id' => (int) $row['id'],
                'sku' => (string) $row['sku'],
                'name' => (string) $row['name'],
                'price' => $row['price'] !== null ? (float) $row['price'] : 0.0,
                'special_price' => $row['special_price'] !== null ? (float) $row['special_price'] : null,
                'qty' => $row['qty'] !== null ? (float) $row['qty'] : 0.0,
                'is_in_stock' => $row['is_in_stock'] !== null ? (bool) $row['is_in_stock'] : false,
                'unit' => (string) $row['unit'],
                'image' => $row['image'] ? '/media/catalog/product/' . ltrim((string) $row['image'], '/') : ''
            ];
        }
        
        return $products;
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
            throw new LocalizedException(__("Lỗi xử lý ảnh: %1", $e->getMessage()));
        }
    }

    /**
     * Get Seller ID from Customer Session.
     */
    private function getSellerIdFromSession(): string
    {
        if (!$this->customerSession->isLoggedIn()) {
            throw new LocalizedException(__('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.'));
        }
        return (string) $this->customerSession->getCustomerId();
    }

    /**
     * Verify that the requested product sku belongs to the logged-in seller.
     */
    private function verifyProductOwnership(string $sku): void
    {
        $sellerId = $this->getSellerIdFromSession();
        try {
            $product = $this->productRepository->get($sku);
            $prodSellerId = $product->getCustomAttribute('tmdt_seller_id') 
                ? (string) $product->getCustomAttribute('tmdt_seller_id')->getValue() 
                : '';

            if ($prodSellerId !== '' && $prodSellerId !== 'NONE' && $prodSellerId !== $sellerId) {
                throw new LocalizedException(__('Bạn không có quyền sửa sản phẩm này.'));
            }
        } catch (LocalizedException $e) {
            throw $e;
        } catch (\Exception $e) {
            throw new LocalizedException(__('Không tìm thấy sản phẩm.'));
        }
    }

    /**
     * Resolve category ID by name.
     */
    private function resolveCategoryIdByName(string $categoryName): ?int
    {
        $categoryMap = [
            'Rau củ quả' => 6,
            'Trái cây' => 10,
            'Thực phẩm tươi sống' => 13,
            'Thuỷ hải sản' => 17,
            'Thực phẩm đông lạnh' => 21,
            'Thực phẩm khô' => 25,
            'Tiện ích bếp' => 29
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
        $str = preg_replace("/(à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ)/", "a", $str);
        $str = preg_replace("/(è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ)/", "e", $str);
        $str = preg_replace("/(ì|í|ị|ỉ|ĩ)/", "i", $str);
        $str = preg_replace("/(ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ)/", "o", $str);
        $str = preg_replace("/(ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ)/", "u", $str);
        $str = preg_replace("/(ỳ|ý|ỵ|ỷ|ỹ)/", "y", $str);
        $str = preg_replace("/(đ)/", "d", $str);
        $str = preg_replace("/(À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ)/", "A", $str);
        $str = preg_replace("/(È|É|Ẹ|Ẻ|E|Ê|Ề|Ế|Ệ|Ể|Ễ)/", "E", $str);
        $str = preg_replace("/(Ì|Í|Ị|Ỉ|Ĩ)/", "I", $str);
        $str = preg_replace("/(Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ)/", "O", $str);
        $str = preg_replace("/(Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ)/", "U", $str);
        $str = preg_replace("/(Ý|Ý|Ý|Ý|Ý)/", "Y", $str);
        $str = preg_replace("/(Đ)/", "D", $str);
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
        $sellerId = $this->getSellerIdFromSession();
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
        $sellerId = $this->getSellerIdFromSession();
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
        $sellerId = $this->getSellerIdFromSession();
        $connection = $this->resourceConnection->getConnection();
        
        $storeId = 0;
        $cpevTable = $connection->getTableName('catalog_product_entity_varchar');
        $cpeTable = $connection->getTableName('catalog_product_entity');
        $cpedTable = $connection->getTableName('catalog_product_entity_decimal');
        $stockTable = $connection->getTableName('cataloginventory_stock_item');
        $oTable = $connection->getTableName('tmdt_orders');

        $nameAttrId = (int)$connection->fetchOne(
            "SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'name' AND entity_type_id = 4 LIMIT 1"
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
            return [
                'success' => true,
                'totalRevenue' => 0.0,
                'totalOrders' => 0,
                'chartData' => [],
                'categoryData' => [],
                'topProducts' => [],
                'operationalLog' => []
            ];
        }

        $nameSub = "COALESCE(
            (SELECT value FROM {$cpevTable} WHERE entity_id = cpe.entity_id AND attribute_id = {$nameAttrId} AND store_id = {$storeId} LIMIT 1),
            (SELECT value FROM {$cpevTable} WHERE entity_id = cpe.entity_id AND attribute_id = {$nameAttrId} AND store_id = 0 LIMIT 1)
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

        // Get seller's products with all details
        $productsQuery = "
            SELECT 
                cpe.entity_id AS id, 
                cpe.sku,
                {$nameSub} AS name,
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
        $productRows = $connection->fetchAll($productsQuery, ['seller_id' => $sellerId]);

        $sellerSkus = [];
        $productIds = [];
        $productsBySku = [];
        foreach ($productRows as $row) {
            $sku = strtolower(trim($row['sku']));
            $sellerSkus[$sku] = true;
            $productIds[] = (int)$row['id'];
            $productsBySku[$sku] = [
                'id' => (int)$row['id'],
                'sku' => $row['sku'],
                'name' => $row['name'],
                'unit' => $row['unit'],
                'image' => $row['image'],
                'qty' => (float)$row['qty'],
                'sales_volume' => 0.0,
                'revenue' => 0.0,
                'category' => 'Khác'
            ];
        }

        // Get categories for seller's products
        if (!empty($productIds)) {
            $categoryQuery = "
                SELECT ccp.product_id, ccev.value AS category_name
                FROM " . $connection->getTableName('catalog_category_product') . " ccp
                INNER JOIN " . $connection->getTableName('catalog_category_entity_varchar') . " ccev ON ccp.category_id = ccev.entity_id
                INNER JOIN " . $connection->getTableName('eav_attribute') . " ea ON ccev.attribute_id = ea.attribute_id
                WHERE ccp.product_id IN (" . implode(',', $productIds) . ")
                  AND ea.attribute_code = 'name' AND ea.entity_type_id = 3
            ";
            $catRows = $connection->fetchAll($categoryQuery);
            $productIdToSku = [];
            foreach ($productRows as $row) {
                $productIdToSku[(int)$row['id']] = strtolower(trim($row['sku']));
            }
            foreach ($catRows as $row) {
                $pId = (int)$row['product_id'];
                if (isset($productIdToSku[$pId])) {
                    $sku = $productIdToSku[$pId];
                    $productsBySku[$sku]['category'] = trim((string)$row['category_name']);
                }
            }
        }

        // Get all paid/processing/pending orders for log, paid/processing for revenue
        $query = "SELECT order_code, status, total_amount, items_json, customer_name, paid_at, created_at FROM {$oTable} ORDER BY created_at DESC";
        $records = $connection->fetchAll($query);

        $totalRevenue = 0.0;
        $orderCodes = [];
        $categoryTotals = [];
        $operationalLog = [];
        
        // Monthly chart aggregates (last 6 months)
        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $monthName = 'Tháng ' . date('n', strtotime("-{$i} month"));
            $months[$monthName] = [
                'name' => $monthName,
                'DoanhThu' => 0.0,
                'DonHang' => 0
            ];
        }
        
        $monthlyOrders = [];
        
        foreach ($records as $row) {
            $items = json_decode((string)($row['items_json'] ?? '[]'), true);
            if (!is_array($items)) {
                continue;
            }
            
            $hasSellerItem = false;
            $orderRevenue = 0.0;
            
            foreach ($items as $item) {
                $sku = strtolower(trim((string)($item['sku'] ?? '')));
                if (isset($sellerSkus[$sku])) {
                    $qty = (float)($item['quantity'] ?? 0);
                    $price = (float)($item['unitPrice'] ?? 0);
                    $rowTotal = $qty * $price;
                    $hasSellerItem = true;
                    
                    $orderStatus = strtolower($row['status']);
                    if ($orderStatus === 'paid' || $orderStatus === 'processing') {
                        $orderRevenue += $rowTotal;
                        $productsBySku[$sku]['sales_volume'] += $qty;
                        $productsBySku[$sku]['revenue'] += $rowTotal;

                        // Category distribution
                        $cat = $productsBySku[$sku]['category'];
                        if (!isset($categoryTotals[$cat])) {
                            $categoryTotals[$cat] = 0.0;
                        }
                        $categoryTotals[$cat] += $rowTotal;
                    }
                }
            }
            
            if ($hasSellerItem) {
                $orderStatus = strtolower($row['status']);
                if ($orderStatus === 'paid' || $orderStatus === 'processing') {
                    $totalRevenue += $orderRevenue;
                    $orderCodes[$row['order_code']] = true;
                    
                    // Monthly grouping
                    $createdAt = strtotime($row['created_at']);
                    $monthName = 'Tháng ' . date('n', $createdAt);
                    if (isset($months[$monthName])) {
                        $months[$monthName]['DoanhThu'] += $orderRevenue;
                        
                        $ref = $row['order_code'];
                        if (!isset($monthlyOrders[$monthName][$ref])) {
                            $monthlyOrders[$monthName][$ref] = true;
                            $months[$monthName]['DonHang'] += 1;
                        }
                    }
                }

                // Add to operational log
                $custName = $row['customer_name'] ?: 'Khách hàng B2B';
                $orderRef = $row['order_code'];
                
                // Event 1: Order created
                $operationalLog[] = [
                    'type' => 'order_created',
                    'title' => 'Đơn hàng mới nhận',
                    'message' => "Khách hàng <strong>{$custName}</strong> vừa tạo đơn sỉ <strong>#{$orderRef}</strong>.",
                    'time' => $row['created_at']
                ];
                
                // Event 2: Order paid (if status is paid/processing)
                if (($orderStatus === 'paid' || $orderStatus === 'processing')) {
                    $paidTime = !empty($row['paid_at']) ? $row['paid_at'] : $row['created_at'];
                    $operationalLog[] = [
                        'type' => 'order_paid',
                        'title' => 'Đồng bộ thanh toán thành công',
                        'message' => "Hệ thống tự động đối soát và xác nhận thanh toán đơn sỉ <strong>#{$orderRef}</strong>.",
                        'time' => $paidTime
                    ];
                }
            }
        }

        $categoryData = [];
        foreach ($categoryTotals as $name => $val) {
            $categoryData[] = [
                'name' => $name,
                'value' => $val
            ];
        }
        usort($categoryData, function($a, $b) {
            return $b['value'] <=> $a['value'];
        });
        
        $chartData = array_values($months);

        // Sort and slice top products
        $topProducts = array_values($productsBySku);
        usort($topProducts, function($a, $b) {
            if ($a['revenue'] == $b['revenue']) {
                return $b['sales_volume'] <=> $a['sales_volume'];
            }
            return $b['revenue'] <=> $a['revenue'];
        });
        $topProducts = array_slice($topProducts, 0, 4);

        // Sort and slice operational log
        usort($operationalLog, function($a, $b) {
            return strcmp($b['time'], $a['time']);
        });
        $operationalLog = array_slice($operationalLog, 0, 8);
        
        return [
            'success' => true,
            'totalRevenue' => $totalRevenue,
            'totalOrders' => count($orderCodes),
            'chartData' => $chartData,
            'categoryData' => $categoryData,
            'topProducts' => $topProducts,
            'operationalLog' => $operationalLog
        ];
    }

    /**
     * @inheritDoc
     */
    public function getSellerOrders(): array
    {
        $sellerId = $this->getSellerIdFromSession();
        $connection = $this->resourceConnection->getConnection();
        $limit = max(1, min(50, (int) ($this->request->getParam('limit') ?: 20)));
        $statusFilter = strtolower(trim((string) ($this->request->getParam('status') ?: 'all')));
        $query = strtolower(trim((string) ($this->request->getParam('q') ?: '')));

        $sellerAttrId = (int) $connection->fetchOne(
            "SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'tmdt_seller_id' AND entity_type_id = 4 LIMIT 1"
        );

        if ($sellerAttrId <= 0) {
            return [
                'success' => true,
                'summary' => [
                    'total_orders' => 0,
                    'total_revenue' => 0.0,
                    'paid_orders' => 0,
                    'pending_orders' => 0,
                    'processing_orders' => 0,
                    'cancelled_orders' => 0,
                    'expired_orders' => 0,
                ],
                'items' => [],
            ];
        }

        $cpeTable = $connection->getTableName('catalog_product_entity');
        $cpevTable = $connection->getTableName('catalog_product_entity_varchar');
        $oTable = $connection->getTableName('tmdt_orders');

        // Get seller's products
        $sellerProductsQuery = "
            SELECT cpe.sku, cpe.entity_id 
            FROM {$cpeTable} cpe
            INNER JOIN {$cpevTable} cpev ON cpe.entity_id = cpev.entity_id
            WHERE cpev.value = :seller_id
              AND cpev.attribute_id = :attr_id
        ";
        $productRows = $connection->fetchAll($sellerProductsQuery, ['seller_id' => $sellerId, 'attr_id' => $sellerAttrId]);
        $sellerSkus = [];
        $productIds = [];
        foreach ($productRows as $row) {
            $sku = strtolower(trim($row['sku']));
            $sellerSkus[$sku] = true;
            $productIds[] = (int)$row['entity_id'];
        }

        // Get category names
        $productCategories = [];
        if (!empty($productIds)) {
            $categoryQuery = "
                SELECT ccp.product_id, ccev.value AS category_name
                FROM " . $connection->getTableName('catalog_category_product') . " ccp
                INNER JOIN " . $connection->getTableName('catalog_category_entity_varchar') . " ccev ON ccp.category_id = ccev.entity_id
                INNER JOIN " . $connection->getTableName('eav_attribute') . " ea ON ccev.attribute_id = ea.attribute_id
                WHERE ccp.product_id IN (" . implode(',', $productIds) . ")
                  AND ea.attribute_code = 'name' AND ea.entity_type_id = 3
            ";
            $catRows = $connection->fetchAll($categoryQuery);
            $productIdToSku = [];
            foreach ($productRows as $row) {
                $productIdToSku[(int)$row['entity_id']] = strtolower(trim($row['sku']));
            }
            foreach ($catRows as $row) {
                $pId = (int)$row['product_id'];
                if (isset($productIdToSku[$pId])) {
                    $productCategories[$productIdToSku[$pId]] = trim((string)$row['category_name']);
                }
            }
        }

        // Fetch all orders
        $orderQuery = "SELECT order_code, status, total_amount, items_json, customer_email, customer_name, shipping_json, transaction_id, expires_at, paid_at, created_at FROM {$oTable} ORDER BY created_at DESC";
        $orderRows = $connection->fetchAll($orderQuery);

        $filteredOrders = [];
        foreach ($orderRows as $row) {
            $items = json_decode((string)($row['items_json'] ?? '[]'), true);
            if (!is_array($items)) {
                continue;
            }

            $sellerItems = [];
            $sellerSubtotal = 0.0;
            $hasSellerItem = false;
            $quantityTotal = 0.0;

            foreach ($items as $item) {
                $sku = strtolower(trim((string)($item['sku'] ?? '')));
                if (isset($sellerSkus[$sku])) {
                    $hasSellerItem = true;
                    $qty = (float)($item['quantity'] ?? 0);
                    $price = (float)($item['unitPrice'] ?? 0);
                    $rowTotal = $qty * $price;
                    $sellerSubtotal += $rowTotal;
                    $quantityTotal += $qty;

                    $sellerItems[] = [
                        'item_id' => count($sellerItems) + 1,
                        'sku' => $item['sku'] ?? '',
                        'name' => $item['name'] ?? '',
                        'category' => $productCategories[$sku] ?? 'Khác',
                        'unit' => $item['unit'] ?? 'kg',
                        'quantity' => $qty,
                        'unit_price' => $price,
                        'row_total' => $rowTotal,
                        'image' => $item['image'] ?? '',
                    ];
                }
            }

            if ($hasSellerItem) {
                $shippingInfo = $this->decodeJsonObject((string)($row['shipping_json'] ?? ''));
                $orderStatus = strtolower((string)$row['status']);

                $statusMatches =
                    $statusFilter === '' ||
                    $statusFilter === 'all' ||
                    $orderStatus === $statusFilter ||
                    ($statusFilter === 'cancelled' && $orderStatus === 'canceled') ||
                    ($statusFilter === 'canceled' && $orderStatus === 'cancelled');

                if (!$statusMatches) {
                    continue;
                }

                $orderData = [
                    'order_reference' => $row['order_code'],
                    'status' => $row['status'],
                    'status_label' => $this->getOrderStatusLabel((string) $row['status']),
                    'customer_name' => $row['customer_name'] ?? '',
                    'customer_email' => $row['customer_email'] ?? '',
                    'customer_region' => $shippingInfo['branch'] ?? '',
                    'supplier' => '',
                    'subtotal' => (float)$row['total_amount'],
                    'seller_subtotal' => $sellerSubtotal,
                    'total_amount' => (float)$row['total_amount'],
                    'delivery_date' => $shippingInfo['deliveryDate'] ?? '',
                    'delivery_time' => $shippingInfo['deliveryTime'] ?? '',
                    'shipping_address' => isset($shippingInfo['branch']) ? ($shippingInfo['branch'] . ' - ' . ($shippingInfo['address'] ?? '')) : '',
                    'shipping_info' => $shippingInfo,
                    'note' => $shippingInfo['note'] ?? '',
                    'created_at' => $row['created_at'],
                    'transaction_id' => $row['transaction_id'] ?? '',
                    'expires_at' => $row['expires_at'] ?? '',
                    'paid_at' => $row['paid_at'] ?? '',
                    'item_count' => count($sellerItems),
                    'quantity_total' => $quantityTotal,
                    'items' => $sellerItems,
                ];

                if ($query !== '' && !$this->matchesSellerOrderQuery($orderData, $query)) {
                    continue;
                }

                $filteredOrders[] = $orderData;
            }
        }

        $summary = [
            'total_orders' => 0,
            'total_revenue' => 0.0,
            'paid_orders' => 0,
            'pending_orders' => 0,
            'processing_orders' => 0,
            'cancelled_orders' => 0,
            'expired_orders' => 0,
        ];

        foreach ($filteredOrders as $order) {
            $summary['total_orders'] += 1;
            $summary['total_revenue'] += (float) ($order['seller_subtotal'] ?? 0);
            $status = strtolower((string) ($order['status'] ?? 'pending'));
            if ($status === 'paid') {
                $summary['paid_orders'] += 1;
            } elseif ($status === 'processing') {
                $summary['processing_orders'] += 1;
            } elseif (in_array($status, ['cancelled', 'canceled'], true)) {
                $summary['cancelled_orders'] += 1;
            } elseif ($status === 'expired') {
                $summary['expired_orders'] += 1;
            } else {
                $summary['pending_orders'] += 1;
            }
        }

        return [
            'success' => true,
            'summary' => [
                'total_orders' => $summary['total_orders'],
                'total_revenue' => round((float) $summary['total_revenue'], 2),
                'paid_orders' => $summary['paid_orders'],
                'pending_orders' => $summary['pending_orders'],
                'processing_orders' => $summary['processing_orders'],
                'cancelled_orders' => $summary['cancelled_orders'],
                'expired_orders' => $summary['expired_orders'],
            ],
            'items' => array_slice($filteredOrders, 0, $limit),
        ];
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
     * Normalize seller order status labels.
     */
    private function getOrderStatusLabel(string $status): string
    {
        return match (strtolower($status)) {
            'paid' => 'Đã thanh toán',
            'processing' => 'Đang xử lý',
            'cancelled', 'canceled' => 'Đã hủy',
            'expired' => 'Hết hạn',
            'pending' => 'Chờ thanh toán',
            default => $status !== '' ? ucfirst($status) : 'Chờ thanh toán',
        };
    }
}
