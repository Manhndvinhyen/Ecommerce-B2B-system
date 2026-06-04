<?php

declare(strict_types=1);

namespace Tmdt\Search\Model;

use Magento\Catalog\Model\Product\Attribute\Source\Status;
use Magento\Catalog\Model\Product\Visibility;
use Magento\Catalog\Model\ResourceModel\Product\CollectionFactory as ProductCollectionFactory;
use Magento\Framework\UrlInterface;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Store\Model\StoreManagerInterface;
use Tmdt\Search\Api\ProductSearchInterface;

class ProductSearchManagement implements ProductSearchInterface
{
    private const SEARCH_ATTRIBUTE = 'tmdt_search_keywords';
    private const KEYWORD_LIMIT = 16;

    public function __construct(
        private readonly ProductCollectionFactory $productCollectionFactory,
        private readonly StoreManagerInterface $storeManager,
        private readonly RestRequest $request,
        private readonly SearchDictionary $searchDictionary
    ) {
    }

    public function search(string $query = '', int $limit = 100): array
    {
        $query = trim($query ?: (string) $this->request->getParam('query'));
        $limit = max(1, min(100, (int) ($limit ?: $this->request->getParam('limit') ?: 100)));

        if ($query === '') {
            return [];
        }

        $keywords = $this->buildKeywords($query);
        if (!$keywords) {
            return [];
        }

        $collection = $this->createCollection($keywords, $limit);
        $scored = [];

        foreach ($collection as $product) {
            $score = $this->scoreProduct($product, $keywords);
            if ($score <= 0) {
                continue;
            }
            $scored[] = [
                'score' => $score,
                'product' => $product,
            ];
        }

        usort($scored, static fn (array $a, array $b): int => $b['score'] <=> $a['score']);

        $items = [];
        foreach (array_slice($scored, 0, $limit) as $item) {
            $items[] = $this->formatProduct($item['product']);
        }

        return $items;
    }

    private function createCollection(array $keywords, int $limit): \Magento\Catalog\Model\ResourceModel\Product\Collection
    {
        $filters = [];
        foreach ($keywords as $keyword) {
            $filters[] = ['attribute' => 'name', 'like' => '%' . $keyword . '%'];
            $filters[] = ['attribute' => 'sku', 'like' => '%' . $keyword . '%'];
            $filters[] = ['attribute' => self::SEARCH_ATTRIBUTE, 'like' => '%' . $keyword . '%'];
        }

        $collection = $this->productCollectionFactory->create();
        $collection->addAttributeToSelect([
            'name',
            'sku',
            'price',
            'thumbnail',
            'small_image',
            self::SEARCH_ATTRIBUTE,
        ]);
        $collection->addAttributeToFilter('status', Status::STATUS_ENABLED);
        $collection->addAttributeToFilter('visibility', ['in' => [
            Visibility::VISIBILITY_IN_CATALOG,
            Visibility::VISIBILITY_IN_SEARCH,
            Visibility::VISIBILITY_BOTH,
        ]]);
        $collection->addAttributeToFilter($filters);
        $collection->setPageSize(max($limit, 30));

        return $collection;
    }

    private function buildKeywords(string $query): array
    {
        $terms = [$query, $this->searchDictionary->normalize($query)];
        foreach (preg_split('/\s+/', $this->searchDictionary->normalize($query)) ?: [] as $part) {
            $part = trim((string) $part);
            if (mb_strlen($part) >= 2) {
                $terms[] = $part;
            }
        }

        return array_slice($this->searchDictionary->expand($terms), 0, self::KEYWORD_LIMIT);
    }

    private function scoreProduct(object $product, array $keywords): int
    {
        $name = $this->searchDictionary->normalize((string) $product->getName());
        $sku = $this->searchDictionary->normalize((string) $product->getSku());
        $searchKeywords = $this->searchDictionary->normalize((string) $product->getData(self::SEARCH_ATTRIBUTE));
        $score = 0;

        foreach ($keywords as $keyword) {
            $needle = $this->searchDictionary->normalize((string) $keyword);
            if ($needle === '') {
                continue;
            }
            if ($name === $needle) {
                $score += 80;
            } elseif (str_contains($name, $needle)) {
                $score += 45;
            }
            if ($sku === $needle || str_contains($sku, $needle)) {
                $score += 30;
            }
            if (str_contains($searchKeywords, $needle)) {
                $score += 25;
            }
        }

        return $score;
    }

    private function formatProduct(object $product): array
    {
        $mediaBaseUrl = $this->storeManager->getStore()->getBaseUrl(UrlInterface::URL_TYPE_MEDIA);
        $imagePath = (string) ($product->getData('small_image') ?: $product->getData('thumbnail') ?: '');
        $image = ($imagePath !== '' && $imagePath !== 'no_selection')
            ? rtrim($mediaBaseUrl, '/') . '/catalog/product' . $imagePath
            : '';

        return [
            'id' => (int) $product->getId(),
            'sku' => (string) $product->getSku(),
            'name' => (string) $product->getName(),
            'priceValue' => (float) $product->getPrice(),
            'image' => $image,
        ];
    }
}
