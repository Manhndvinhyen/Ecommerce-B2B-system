<?php
declare(strict_types=1);

use Magento\CatalogImportExport\Model\Import\Product;
use Magento\Framework\App\Bootstrap;
use Magento\Framework\App\Filesystem\DirectoryList;
use Magento\ImportExport\Model\Import;
use Magento\ImportExport\Model\Import\Adapter as ImportAdapter;

require __DIR__ . '/../../app/bootstrap.php';

$csvPath = $argv[1] ?? 'pub/media/import/category-products-seed.csv';
$behavior = $argv[2] ?? Import::BEHAVIOR_ADD_UPDATE;

$allowedBehaviors = [
    Import::BEHAVIOR_ADD_UPDATE,
    Import::BEHAVIOR_APPEND,
    Import::BEHAVIOR_REPLACE,
    Import::BEHAVIOR_DELETE,
];

if (!in_array($behavior, $allowedBehaviors, true)) {
    fwrite(
        STDERR,
        "❌ Invalid behavior '{$behavior}'. Allowed: add_update, append, replace, delete" . PHP_EOL
    );
    exit(1);
}

$absoluteCsvPath = str_starts_with($csvPath, '/') ? $csvPath : BP . '/' . ltrim($csvPath, '/');

if (!is_file($absoluteCsvPath)) {
    fwrite(STDERR, "❌ CSV file not found: {$absoluteCsvPath}" . PHP_EOL);
    exit(1);
}

try {
    $bootstrap = Bootstrap::create(BP, $_SERVER);
    $objectManager = $bootstrap->getObjectManager();

    /** @var \Magento\Framework\App\State $appState */
    $appState = $objectManager->get(\Magento\Framework\App\State::class);
    try {
        $appState->setAreaCode('adminhtml');
    } catch (\Magento\Framework\Exception\LocalizedException $e) {
        // Area code may already be set.
    }

    /** @var \Magento\Framework\Filesystem $filesystem */
    $filesystem = $objectManager->get(\Magento\Framework\Filesystem::class);
    $directoryWrite = $filesystem->getDirectoryWrite(DirectoryList::ROOT);
    $source = ImportAdapter::findAdapterFor($absoluteCsvPath, $directoryWrite);

    /** @var Product $importModel */
    $importModel = $objectManager->create(Product::class);
    $importModel->setParameters([
        'behavior' => $behavior,
        'entity' => 'catalog_product',
    ]);
    $importModel->setSource($source);

    $errors = $importModel->validateData();

    if ($errors->getErrorsCount() > 0 || !empty($errors->getAllErrors())) {
        fwrite(
            STDERR,
            "❌ Product CSV validation failed. Total errors: " . $errors->getErrorsCount() . PHP_EOL
        );
        foreach ($errors->getAllErrors() as $error) {
            fwrite(STDERR, ' - ' . $error->getErrorMessage() . PHP_EOL);
        }
        exit(1);
    }

    if (!$importModel->importData()) {
        fwrite(STDERR, "❌ Import failed while writing data." . PHP_EOL);
        exit(1);
    }

    echo "✅ Imported products from {$absoluteCsvPath} with behavior '{$behavior}'." . PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, "❌ Import crashed: " . $e->getMessage() . PHP_EOL);
    exit(1);
}
