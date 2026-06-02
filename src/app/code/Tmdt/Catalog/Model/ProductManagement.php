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
        private readonly \Magento\Store\Model\StoreManagerInterface $storeManager
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
            if (!empty($data['category_ids']) && is_array($data['category_ids'])) {
                $product->setCategoryIds($data['category_ids']);
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
}
