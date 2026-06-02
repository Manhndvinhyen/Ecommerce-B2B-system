<?php
use Magento\Framework\App\Bootstrap;
require __DIR__ . '/app/bootstrap.php';

$bootstrap = Bootstrap::create(BP, $_SERVER);
$objectManager = $bootstrap->getObjectManager();

$state = $objectManager->get(\Magento\Framework\App\State::class);
$state->setAreaCode(\Magento\Framework\App\Area::AREA_GLOBAL);

$connection = $objectManager->get(\Magento\Framework\App\ResourceConnection::class)->getConnection();

echo "Querying catalog_product_entity directly...\n";
$select = $connection->select()->from($connection->getTableName('catalog_product_entity'), ['entity_id', 'sku']);
$results = $connection->fetchAll($select);

echo "Total products in entity table: " . count($results) . "\n";
foreach ($results as $row) {
    echo "- ID: {$row['entity_id']} | SKU: {$row['sku']}\n";
}
