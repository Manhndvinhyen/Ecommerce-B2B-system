<?php

declare(strict_types=1);

use Magento\Framework\App\Bootstrap;
use Magento\Framework\App\Filesystem\DirectoryList;
use Magento\Framework\App\State;
use Magento\ImportExport\Model\Import;
use Magento\ImportExport\Model\Import\Adapter;
use Magento\ImportExport\Model\Import\ErrorProcessing\ProcessingErrorAggregatorInterface;

require __DIR__ . '/../../app/bootstrap.php';

$params = $_SERVER;
$bootstrap = Bootstrap::create(BP, $params);
$objectManager = $bootstrap->getObjectManager();

/** @var State $appState */
$appState = $objectManager->get(State::class);
try {
    $appState->setAreaCode('adminhtml');
} catch (\Exception $e) {
    // area code may already be set
}

$csvRelativePath = $argv[1] ?? 'pub/media/import/rau-cu-qua-products.csv';
$csvAbsolutePath = BP . '/' . ltrim($csvRelativePath, '/');

if (!is_file($csvAbsolutePath)) {
    fwrite(STDERR, "CSV not found: {$csvAbsolutePath}\n");
    exit(1);
}

/** @var Import $import */
$import = $objectManager->create(Import::class);
$import->setData([
    'entity' => 'catalog_product',
    'behavior' => Import::BEHAVIOR_APPEND,
    Import::FIELD_NAME_VALIDATION_STRATEGY => ProcessingErrorAggregatorInterface::VALIDATION_STRATEGY_SKIP_ERRORS,
    Import::FIELD_NAME_ALLOWED_ERROR_COUNT => 100,
    Import::FIELD_FIELD_SEPARATOR => ',',
    Import::FIELD_FIELD_MULTIPLE_VALUE_SEPARATOR => ',',
    Import::FIELD_NAME_IMG_FILE_DIR => BP . '/pub/media/import',
]);

$rootDir = $objectManager->get(\Magento\Framework\Filesystem::class)
    ->getDirectoryWrite(DirectoryList::ROOT);

$source = Adapter::findAdapterFor(
    $csvAbsolutePath,
    $rootDir,
    ','
);

$isValid = $import->validateSource($source);
if (!$isValid) {
    fwrite(STDERR, "Validation failed.\n");
    foreach ($import->getErrorAggregator()->getAllErrors() as $error) {
        fwrite(STDERR, '- ' . $error->getErrorMessage() . "\n");
    }
    exit(2);
}

$result = $import->importSource();
$import->invalidateIndex();

if (!$result) {
    fwrite(STDERR, "Import failed.\n");
    exit(3);
}

echo "Import success for file: {$csvRelativePath}\n";
echo 'Processed rows: ' . $import->getProcessedRowsCount() . "\n";
echo 'Processed entities: ' . $import->getProcessedEntitiesCount() . "\n";
