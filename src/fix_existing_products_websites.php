<?php
use Magento\Framework\App\Bootstrap;
require __DIR__ . '/app/bootstrap.php';

$bootstrap = Bootstrap::create(BP, $_SERVER);
$objectManager = $bootstrap->getObjectManager();

$state = $objectManager->get(\Magento\Framework\App\State::class);
$state->setAreaCode(\Magento\Framework\App\Area::AREA_GLOBAL);

$productCollectionFactory = $objectManager->get(\Magento\Catalog\Model\ResourceModel\Product\CollectionFactory::class);
$productRepository = $objectManager->get(\Magento\Catalog\Api\ProductRepositoryInterface::class);

echo "Loading all products in catalog...\n";

$collection = $productCollectionFactory->create();
$collection->addAttributeToSelect('*');

$count = 0;
foreach ($collection as $prod) {
    $sku = $prod->getSku();
    try {
        $product = $productRepository->get($sku);
        $sellerIdAttr = $product->getCustomAttribute('tmdt_seller_id');
        $sellerId = $sellerIdAttr ? $sellerIdAttr->getValue() : null;
        
        // Only process products created by sellers (have seller_id set and not NONE)
        if ($sellerId && $sellerId !== 'NONE') {
            $websiteIds = $product->getWebsiteIds();
            echo "B2B Product found: {$product->getName()} ($sku) | Seller ID: $sellerId | Websites: " . implode(', ', $websiteIds) . "\n";
            
            if (empty($websiteIds)) {
                echo " -> Missing website assignment. Assigning to Website 1...\n";
                $product->setWebsiteIds([1]);
                $productRepository->save($product);
                $count++;
                echo " -> Saved successfully!\n";
            }
        }
    } catch (\Exception $e) {
        echo " -> Error processing product $sku: " . $e->getMessage() . "\n";
    }
}

echo "Done! Fixed $count B2B product(s).\n";
