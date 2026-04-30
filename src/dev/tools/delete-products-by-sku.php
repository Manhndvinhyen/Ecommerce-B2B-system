<?php
declare(strict_types=1);

use Magento\Framework\App\Bootstrap;

// Simple deletion helper for dev environments.
// Usage inside container:
//   php dev/tools/delete-products-by-sku.php -- <sku1> <sku2> ...
// or:
//   php dev/tools/delete-products-by-sku.php --file var/tmp/skus.txt

require __DIR__ . '/../../app/bootstrap.php';

$params = $_SERVER['argv'] ?? [];
array_shift($params);

$filePath = null;
$skus = [];

while ($params) {
    $arg = array_shift($params);
    if ($arg === '--file') {
        $filePath = (string) array_shift($params);
        continue;
    }
    if ($arg === '--') {
        $skus = array_values(array_filter($params, fn($v) => (string)$v !== ''));
        break;
    }
}

if ($filePath) {
    if (!is_file($filePath)) {
        fwrite(STDERR, "File not found: {$filePath}\n");
        exit(1);
    }
    $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    $skus = array_values(array_filter(array_map('trim', $lines), fn($v) => $v !== ''));
}

$skus = array_values(array_unique($skus));

if (!$skus) {
    fwrite(STDERR, "No SKUs provided.\n");
    exit(1);
}

$bootstrap = Bootstrap::create(BP, $_SERVER);
$objectManager = $bootstrap->getObjectManager();

/** @var \Magento\Framework\App\State $state */
$state = $objectManager->get(\Magento\Framework\App\State::class);
try {
    $state->setAreaCode('adminhtml');
} catch (\Magento\Framework\Exception\LocalizedException $e) {
    // area code already set
}

/** @var \Magento\Framework\Registry $registry */
$registry = $objectManager->get(\Magento\Framework\Registry::class);
if (!$registry->registry('isSecureArea')) {
    $registry->register('isSecureArea', true);
}

/** @var \Magento\Catalog\Api\ProductRepositoryInterface $productRepository */
$productRepository = $objectManager->get(\Magento\Catalog\Api\ProductRepositoryInterface::class);

$deleted = 0;
$notFound = 0;
$failed = 0;

foreach ($skus as $sku) {
    $sku = trim((string) $sku);
    if ($sku === '') continue;

    try {
        $product = $productRepository->get($sku, false, null, true);
    } catch (\Magento\Framework\Exception\NoSuchEntityException $e) {
        $notFound++;
        fwrite(STDOUT, "- NOT FOUND: {$sku}\n");
        continue;
    } catch (\Throwable $e) {
        $failed++;
        fwrite(STDERR, "- ERROR loading {$sku}: {$e->getMessage()}\n");
        continue;
    }

    try {
        $productRepository->delete($product);
        $deleted++;
        fwrite(STDOUT, "- DELETED: {$sku}\n");
    } catch (\Throwable $e) {
        $failed++;
        fwrite(STDERR, "- ERROR deleting {$sku}: {$e->getMessage()}\n");
    }
}

fwrite(STDOUT, "Done. deleted={$deleted} not_found={$notFound} failed={$failed}\n");

if ($failed > 0) {
    exit(2);
}
