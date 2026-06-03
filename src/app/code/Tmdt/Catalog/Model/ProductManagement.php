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

class ProductManagement implements ProductManagementInterface
{
    public function __construct(
        private readonly ProductRepositoryInterface $productRepository,
        private readonly ProductFactory $productFactory,
        private readonly CustomerSession $customerSession,
        private readonly StockRegistryInterface $stockRegistry,
        private readonly ResourceConnection $resourceConnection,
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
            
            // Assign to current website
            $websiteId = $this->storeManager->getStore()->getWebsiteId();
            $product->setWebsiteIds([$websiteId]);

            if (!empty($data['special_price'])) {
                $product->setSpecialPrice((float) $data['special_price']);
            }

            // Custom attributes for B2B Seller
            $product->setCustomAttribute('tmdt_seller_id', $sellerId);
            if (!empty($data['unit'])) {
                $product->setCustomAttribute('tmdt_unit', $data['unit']);
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
        $this->verifyProductOwnership($sku);
        $data = json_decode($productData, true);
        if (!is_array($data)) {
            $data = [];
        }

        try {
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
        
        // Raw DB query to fetch seller's products based on custom seller ID attribute
        // This is safe and highly efficient.
        $select = $connection->select()
            ->from(['cpe' => $connection->getTableName('catalog_product_entity')], ['entity_id', 'sku'])
            ->joinLeft(
                ['cpev' => $connection->getTableName('catalog_product_entity_varchar')],
                'cpe.entity_id = cpev.entity_id AND cpev.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = \'tmdt_seller_id\' AND entity_type_id = 4 LIMIT 1)',
                ['seller_id' => 'value']
            )
            ->where('cpev.value = ?', $sellerId);

        $results = $connection->fetchAll($select);
        $products = [];

        foreach ($results as $row) {
            try {
                $prod = $this->productRepository->get($row['sku']);
                $stock = $this->stockRegistry->getStockItemBySku($row['sku']);
                
                $products[] = [
                    'id' => $prod->getId(),
                    'sku' => $prod->getSku(),
                    'name' => $prod->getName(),
                    'price' => $prod->getPrice(),
                    'special_price' => $prod->getSpecialPrice(),
                    'qty' => $stock->getQty(),
                    'is_in_stock' => $stock->getIsInStock(),
                    'unit' => $prod->getCustomAttribute('tmdt_unit') ? $prod->getCustomAttribute('tmdt_unit')->getValue() : 'kg'
                ];
            } catch (\Exception $e) {
                // Skip broken product references
            }
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
                $ext = 'webp';
            }

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

            $tempFile = sys_get_temp_dir() . '/' . uniqid('tmdt_', true) . '.' . $ext;
            file_put_contents($tempFile, $decoded);

            // Add image to product media gallery and set as primary roles
            $product->addImageToMediaGallery($tempFile, ['image', 'small_image', 'thumbnail'], true, false);
        } catch (\Exception $e) {
            // Silently log or ignore to not block product saving
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
        
        $cpevTable = $connection->getTableName('catalog_product_entity_varchar');
        $cpeTable = $connection->getTableName('catalog_product_entity');
        $phiTable = $connection->getTableName('tmdt_purchase_history_item');
        $phTable = $connection->getTableName('tmdt_purchase_history');
        $oTable = $connection->getTableName('tmdt_orders');
        
        // Fetch all paid/processing item records for this seller's products
        $query = "
            SELECT phi.sku, phi.product_name, phi.category, phi.quantity, phi.unit_price, phi.row_total, ph.created_at, ph.order_reference
            FROM {$phiTable} phi
            INNER JOIN {$phTable} ph ON phi.history_id = ph.history_id
            INNER JOIN {$oTable} o ON ph.order_reference = o.order_code
            INNER JOIN {$cpeTable} cpe ON phi.sku = cpe.sku
            INNER JOIN {$cpevTable} cpev ON cpe.entity_id = cpev.entity_id
            WHERE cpev.value = :seller_id
              AND cpev.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'tmdt_seller_id' AND entity_type_id = 4 LIMIT 1)
              AND o.status IN ('paid', 'processing')
        ";
        
        $records = $connection->fetchAll($query, ['seller_id' => $sellerId]);
        
        $totalRevenue = 0.0;
        $orderCodes = [];
        $categoryTotals = [];
        
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
            $rowTotal = (float)$row['row_total'];
            $totalRevenue += $rowTotal;
            $orderCodes[$row['order_reference']] = true;
            
            // Category distribution
            $cat = $row['category'] ?: 'Khác';
            if (!isset($categoryTotals[$cat])) {
                $categoryTotals[$cat] = 0.0;
            }
            $categoryTotals[$cat] += $rowTotal;
            
            // Monthly grouping
            $createdAt = strtotime($row['created_at']);
            $monthName = 'Tháng ' . date('n', $createdAt);
            if (isset($months[$monthName])) {
                $months[$monthName]['DoanhThu'] += $rowTotal;
                
                $ref = $row['order_reference'];
                if (!isset($monthlyOrders[$monthName][$ref])) {
                    $monthlyOrders[$monthName][$ref] = true;
                    $months[$monthName]['DonHang'] += 1;
                }
            }
        }
        
        // Format category chart data
        $categoryData = [];
        foreach ($categoryTotals as $name => $val) {
            $categoryData[] = [
                'name' => $name,
                'value' => $val
            ];
        }
        // Sort by value desc
        usort($categoryData, function($a, $b) {
            return $b['value'] <=> $a['value'];
        });
        
        // Format monthly data array
        $chartData = array_values($months);
        
        return [
            'success' => true,
            'totalRevenue' => $totalRevenue,
            'totalOrders' => count($orderCodes),
            'chartData' => $chartData,
            'categoryData' => $categoryData
        ];
    }
}
