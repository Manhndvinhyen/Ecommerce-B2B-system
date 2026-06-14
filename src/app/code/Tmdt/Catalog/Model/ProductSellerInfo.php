<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Model;

use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Psr\Log\LoggerInterface;
use Tmdt\Catalog\Api\ProductSellerInfoInterface;

class ProductSellerInfo implements ProductSellerInfoInterface
{
    public function __construct(
        private readonly ResourceConnection $resourceConnection,
        private readonly RestRequest $request,
        private readonly LoggerInterface $logger
    ) {
    }

    /**
     * @inheritDoc
     */
    public function getBySkus(string $skus = ''): array
    {
        $rawSkus = trim($skus ?: (string)$this->request->getParam('skus'));
        $skuList = $this->normalizeSkuList($rawSkus);

        if (!$skuList) {
            $this->logger->info('[TMDT][ProductSellerInfo] Empty SKU request');
            return [];
        }

        try {
            $connection = $this->resourceConnection->getConnection();
            $productTable = $this->resourceConnection->getTableName('catalog_product_entity');
            $varcharTable = $this->resourceConnection->getTableName('catalog_product_entity_varchar');
            $attributeTable = $this->resourceConnection->getTableName('eav_attribute');
            $registrationTable = $this->resourceConnection->getTableName('tmdt_customer_registration');

            $sellerAttrId = (int)$connection->fetchOne(
                $connection->select()
                    ->from($attributeTable, ['attribute_id'])
                    ->where('attribute_code = ?', 'tmdt_seller_id')
                    ->where('entity_type_id = ?', 4)
                    ->limit(1)
            );

            if ($sellerAttrId <= 0) {
                $this->logger->warning('[TMDT][ProductSellerInfo] tmdt_seller_id attribute not found', [
                    'sku_count' => count($skuList),
                ]);
                return [];
            }

            $select = $connection->select()
                ->from(['cpe' => $productTable], ['sku'])
                ->joinLeft(
                    ['seller_attr' => $varcharTable],
                    'seller_attr.entity_id = cpe.entity_id'
                    . ' AND seller_attr.attribute_id = ' . $sellerAttrId
                    . ' AND seller_attr.store_id = 0',
                    ['seller_id' => 'value']
                )
                ->joinLeft(
                    ['reg' => $registrationTable],
                    'reg.customer_id = CAST(seller_attr.value AS UNSIGNED)',
                    [
                        'business_name',
                        'unit_nickname',
                        'province',
                    ]
                )
                ->where('cpe.sku IN (?)', $skuList);

            $rows = $connection->fetchAll($select) ?: [];
            $items = [];

            foreach ($rows as $row) {
                $unitNickname = trim((string)($row['unit_nickname'] ?? ''));
                $businessName = trim((string)($row['business_name'] ?? ''));
                $province = trim((string)($row['province'] ?? ''));
                $sellerId = trim((string)($row['seller_id'] ?? ''));

                if ($sellerId === '' || ($unitNickname === '' && $businessName === '')) {
                    continue;
                }

                $items[] = [
                    'sku' => (string)$row['sku'],
                    'seller_id' => $sellerId,
                    'store_name' => $unitNickname !== '' ? $unitNickname : $businessName,
                    'business_name' => $businessName,
                    'unit_nickname' => $unitNickname,
                    'province' => $province,
                ];
            }

            $this->logger->info('[TMDT][ProductSellerInfo] Seller info resolved', [
                'sku_count' => count($skuList),
                'matched_count' => count($items),
            ]);

            return $items;
        } catch (\Throwable $e) {
            $this->logger->error('[TMDT][ProductSellerInfo] Failed to resolve seller info', [
                'message' => $e->getMessage(),
                'sku_count' => count($skuList),
            ]);
            return [];
        }
    }

    private function normalizeSkuList(string $rawSkus): array
    {
        $parts = preg_split('/[,\\s]+/', $rawSkus) ?: [];
        $skus = [];

        foreach ($parts as $sku) {
            $sku = trim((string)$sku);
            if ($sku === '') {
                continue;
            }
            $skus[] = mb_substr($sku, 0, 96);
        }

        return array_slice(array_values(array_unique($skus)), 0, 100);
    }
}
