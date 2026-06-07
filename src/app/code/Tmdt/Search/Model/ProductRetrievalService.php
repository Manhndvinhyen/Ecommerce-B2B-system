<?php

declare(strict_types=1);

namespace Tmdt\Search\Model;

use Magento\Catalog\Api\CategoryRepositoryInterface;
use Magento\Catalog\Model\Product\Attribute\Source\Status;
use Magento\Catalog\Model\Product\Visibility;
use Magento\Catalog\Model\ResourceModel\Product\CollectionFactory as ProductCollectionFactory;
use Magento\Framework\Exception\NoSuchEntityException;
use Magento\Framework\UrlInterface;
use Magento\Store\Model\StoreManagerInterface;

class ProductRetrievalService
{
    private const SEARCH_ATTRIBUTE = 'tmdt_search_keywords';
    private const DEFAULT_CANDIDATE_LIMIT = 160;
    private const MAX_QUERY_TERMS = 36;
    private const MIN_SCORE = 35;

    private const STOPWORDS = [
        'toi', 'tui', 'minh', 'em', 'anh', 'chi', 'ban', 'khach',
        'muon', 'can', 'mua', 'tim', 'kiem', 'goi', 'y', 'tu', 'van',
        'san', 'pham', 'hang', 'mat', 'loai', 'cho', 'xin', 'hay', 'giup',
        'voi', 'nhe', 'nha', 'a', 'la', 'co', 'khong', 'duoc', 'nao', 'an',
    ];

    private const QUERY_GROUPS = [
        [
            'intent' => 'vegetable',
            'signals' => ['rau', 'rau xanh', 'rau cu', 'rau cu qua', 'vegetable', 'cu qua'],
            'terms' => [
                'rau', 'rau xanh', 'rau tuoi', 'rau cu', 'rau cu qua', 'vegetable',
                'cai', 'xa lach', 'lettuce', 'salad', 'su su', 'ca chua', 'tomato',
                'ca rot', 'carrot', 'khoai tay', 'potato', 'sup lo', 'cauliflower',
                'broccoli', 'dua leo', 'dua chuot', 'cucumber', 'nam', 'mushroom',
                'pepper', 'chilli',
            ],
        ],
        [
            'intent' => 'fruit',
            'signals' => ['trai cay', 'hoa qua', 'qua tuoi', 'fruit'],
            'terms' => ['trai cay', 'hoa qua', 'qua tuoi', 'fruit', 'chuoi', 'banana', 'cam', 'orange', 'tao', 'apple'],
        ],
        [
            'intent' => 'meat',
            'signals' => ['thit', 'thit heo', 'thit lon', 'pork', 'thit bo', 'beef', 'thit ga', 'chicken'],
            'terms' => ['thit', 'thit heo', 'thit lon', 'pork', 'thit bo', 'beef', 'thit ga', 'chicken'],
        ],
        [
            'intent' => 'seafood',
            'signals' => ['hai san', 'seafood', 'ca', 'fish', 'tom', 'shrimp', 'muc', 'squid'],
            'terms' => ['hai san', 'seafood', 'ca', 'fish', 'ca hoi', 'tom', 'shrimp', 'muc', 'squid'],
        ],
        [
            'intent' => 'rice',
            'signals' => ['gao', 'rice', 'com'],
            'terms' => ['gao', 'rice', 'gao thom', 'gao te', 'gao nep', 'st25'],
        ],
    ];

    private const INTENT_NEGATIVE_TERMS = [
        'vegetable' => [
            'thit', 'heo', 'lon', 'pork', 'bo', 'beef', 'ga', 'chicken', 'vit', 'duck',
            'trung', 'egg', 'ca hoi', 'fish', 'tom', 'shrimp', 'muc', 'squid', 'cua',
            'hai san', 'seafood', 'xuc xich', 'sausage',
        ],
        'fruit' => ['thit', 'pork', 'beef', 'chicken', 'fish', 'seafood', 'rau', 'vegetable'],
        'meat' => ['rau', 'vegetable', 'trai cay', 'fruit', 'gao', 'rice'],
        'seafood' => ['rau', 'vegetable', 'trai cay', 'fruit', 'gao', 'rice', 'thit heo', 'pork'],
        'rice' => ['rau', 'vegetable', 'thit', 'pork', 'beef', 'fish', 'seafood'],
    ];

    public function __construct(
        private readonly ProductCollectionFactory $productCollectionFactory,
        private readonly CategoryRepositoryInterface $categoryRepository,
        private readonly StoreManagerInterface $storeManager,
        private readonly SearchDictionary $searchDictionary
    ) {
    }

    public function retrieve(string $query, int $limit = 20, int $candidateLimit = self::DEFAULT_CANDIDATE_LIMIT): array
    {
        $query = trim($query);
        $limit = max(1, min(100, $limit));
        $candidateLimit = max($limit, min(300, $candidateLimit));

        if ($query === '') {
            return [];
        }

        $terms = $this->buildQueryTerms($query);
        if (!$terms) {
            return [];
        }

        $collection = $this->createCollection($terms, $candidateLimit);
        $intent = $this->detectIntent($terms);
        $scored = [];

        foreach ($collection as $product) {
            $categoryText = $this->getCategoryText($product);
            if (!$this->matchesIntent($product, $categoryText, $intent)) {
                continue;
            }

            $score = $this->scoreProduct($product, $categoryText, $terms, $intent);
            if ($score < self::MIN_SCORE) {
                continue;
            }

            $scored[] = [
                'score' => $score,
                'product' => $product,
                'categoryText' => $categoryText,
            ];
        }

        usort($scored, static fn (array $a, array $b): int => $b['score'] <=> $a['score']);

        $items = [];
        foreach (array_slice($scored, 0, $limit) as $item) {
            $items[] = $this->formatProduct($item['product'], $item['categoryText'], $item['score']);
        }

        return $items;
    }

    public function buildQueryTerms(string $query): array
    {
        $normalized = $this->searchDictionary->normalize($query);
        $terms = [$query, $normalized];

        foreach (preg_split('/\s+/', $normalized) ?: [] as $part) {
            $part = trim((string) $part);
            if ($this->isUsefulTerm($part)) {
                $terms[] = $part;
            }
        }

        foreach (self::QUERY_GROUPS as $group) {
            foreach ($group['signals'] as $signal) {
                if ($this->containsTerm($normalized, $signal)) {
                    array_push($terms, ...$group['terms']);
                    break;
                }
            }
        }

        return array_slice($this->searchDictionary->dedupe($terms), 0, self::MAX_QUERY_TERMS);
    }

    public function detectIntent(array $terms): string
    {
        $haystack = $this->searchDictionary->normalize(implode(' ', $terms));
        foreach (self::QUERY_GROUPS as $group) {
            foreach ($group['signals'] as $signal) {
                if ($this->containsTerm($haystack, $signal)) {
                    return $group['intent'];
                }
            }
        }

        return '';
    }

    private function createCollection(array $terms, int $candidateLimit): \Magento\Catalog\Model\ResourceModel\Product\Collection
    {
        $filters = [];
        foreach ($terms as $term) {
            $term = trim((string) $term);
            if ($term === '') {
                continue;
            }
            $filters[] = ['attribute' => 'name', 'like' => '%' . $term . '%'];
            $filters[] = ['attribute' => 'sku', 'like' => '%' . $term . '%'];
            $filters[] = ['attribute' => self::SEARCH_ATTRIBUTE, 'like' => '%' . $term . '%'];
        }

        $collection = $this->productCollectionFactory->create();
        $collection->addAttributeToSelect([
            'name',
            'sku',
            'price',
            'url_key',
            'thumbnail',
            'small_image',
            'short_description',
            self::SEARCH_ATTRIBUTE,
        ]);
        $collection->addAttributeToFilter('status', Status::STATUS_ENABLED);
        $collection->addAttributeToFilter('visibility', ['in' => [
            Visibility::VISIBILITY_IN_CATALOG,
            Visibility::VISIBILITY_IN_SEARCH,
            Visibility::VISIBILITY_BOTH,
        ]]);
        $collection->addAttributeToFilter($filters);
        $collection->addCategoryIds();
        $collection->setPageSize($candidateLimit);

        return $collection;
    }

    private function scoreProduct(object $product, string $categoryText, array $terms, string $intent): int
    {
        $name = $this->searchDictionary->normalize((string) $product->getName());
        $sku = $this->searchDictionary->normalize((string) $product->getSku());
        $keywords = $this->searchDictionary->normalize((string) $product->getData(self::SEARCH_ATTRIBUTE));
        $category = $this->searchDictionary->normalize($categoryText);
        $score = 0;

        foreach ($terms as $term) {
            $needle = $this->searchDictionary->normalize((string) $term);
            if (!$this->isUsefulTerm($needle)) {
                continue;
            }

            if ($name === $needle) {
                $score += 120;
            } elseif ($this->containsTerm($name, $needle)) {
                $score += 70;
            }
            if ($sku === $needle || $this->containsTerm($sku, $needle)) {
                $score += 35;
            }
            if ($category !== '' && $this->containsTerm($category, $needle)) {
                $score += 85;
            }
            if ($this->containsTerm($keywords, $needle)) {
                $score += 25;
            }
        }

        if ($intent !== '' && $this->intentPositiveMatch($name . ' ' . $sku . ' ' . $category, $intent)) {
            $score += 150;
        } elseif ($intent !== '' && $this->intentPositiveMatch($keywords, $intent)) {
            $score += 60;
        }

        return $score;
    }

    private function matchesIntent(object $product, string $categoryText, string $intent): bool
    {
        if ($intent === '') {
            return true;
        }

        $identity = $this->searchDictionary->normalize(
            (string) $product->getName() . ' ' . (string) $product->getSku() . ' ' . $categoryText
        );

        foreach (self::INTENT_NEGATIVE_TERMS[$intent] ?? [] as $negativeTerm) {
            if ($this->containsTerm($identity, $negativeTerm)) {
                return false;
            }
        }

        $keywords = $this->searchDictionary->normalize((string) $product->getData(self::SEARCH_ATTRIBUTE));

        return $this->intentPositiveMatch($identity, $intent)
            || $this->intentPositiveMatch($keywords, $intent);
    }

    private function intentPositiveMatch(string $value, string $intent): bool
    {
        $haystack = $this->searchDictionary->normalize($value);
        foreach (self::QUERY_GROUPS as $group) {
            if ($group['intent'] !== $intent) {
                continue;
            }
            foreach ($group['terms'] as $term) {
                if ($this->containsTerm($haystack, $term)) {
                    return true;
                }
            }
        }

        return false;
    }

    private function getCategoryText(object $product): string
    {
        $categoryIds = method_exists($product, 'getCategoryIds') ? (array) $product->getCategoryIds() : [];
        $names = [];

        foreach ($categoryIds as $categoryId) {
            try {
                $category = $this->categoryRepository->get((int) $categoryId);
            } catch (NoSuchEntityException) {
                continue;
            }

            $name = trim((string) $category->getName());
            if ($name !== '' && !in_array($name, ['Root Catalog', 'Default Category', 'Products'], true)) {
                $names[] = $name;
            }
        }

        return implode(' ', $this->searchDictionary->dedupe($names));
    }

    private function formatProduct(object $product, string $categoryText, int $score): array
    {
        $baseUrl = $this->storeManager->getStore()->getBaseUrl(UrlInterface::URL_TYPE_WEB);
        $mediaBaseUrl = $this->storeManager->getStore()->getBaseUrl(UrlInterface::URL_TYPE_MEDIA);
        $imagePath = (string) ($product->getData('small_image') ?: $product->getData('thumbnail') ?: '');
        $query = http_build_query([
            'view' => 'product',
            'id' => (int) $product->getId(),
            'sku' => (string) $product->getSku(),
        ]);

        return [
            'id' => (int) $product->getId(),
            'sku' => (string) $product->getSku(),
            'name' => (string) $product->getName(),
            'priceValue' => (float) $product->getPrice(),
            'price' => number_format((float) $product->getPrice(), 0, ',', '.') . ' VND',
            'url' => rtrim($baseUrl, '/') . '/react/index.html?' . $query,
            'image' => ($imagePath !== '' && $imagePath !== 'no_selection')
                ? rtrim($mediaBaseUrl, '/') . '/catalog/product' . $imagePath
                : '',
            'categoryLabel' => $categoryText,
            'relevanceScore' => $score,
        ];
    }

    private function isUsefulTerm(string $term): bool
    {
        return $term !== ''
            && mb_strlen($term, 'UTF-8') >= 2
            && !in_array($term, self::STOPWORDS, true);
    }

    private function containsTerm(string $haystack, string $needle): bool
    {
        $needle = $this->searchDictionary->normalize($needle);
        if ($needle === '') {
            return false;
        }

        $normalizedHaystack = $this->searchDictionary->normalize($haystack);
        if (str_contains(' ' . $normalizedHaystack . ' ', ' ' . $needle . ' ')) {
            return true;
        }

        return mb_strlen($needle, 'UTF-8') >= 4 && str_contains($normalizedHaystack, $needle);
    }
}
