<?php

declare(strict_types=1);

namespace Tmdt\Search\Model;

use Magento\Catalog\Api\CategoryRepositoryInterface;
use Magento\Catalog\Api\Data\ProductInterface;
use Magento\Framework\Exception\NoSuchEntityException;

class ProductKeywordGenerator
{
    private const MAX_KEYWORDS = 120;
    private const MAX_LENGTH = 4000;

    public function __construct(
        private readonly SearchDictionary $dictionary,
        private readonly CategoryRepositoryInterface $categoryRepository
    ) {
    }

    public function generate(ProductInterface $product): string
    {
        $terms = [];
        $terms[] = (string) $product->getName();
        $terms[] = (string) $product->getSku();
        $terms[] = $this->stripHtml((string) ($product->getCustomAttribute('short_description')?->getValue() ?? ''));
        $terms[] = $this->stripHtml((string) ($product->getCustomAttribute('description')?->getValue() ?? ''));
        $terms[] = (string) ($product->getCustomAttribute('country_of_manufacture')?->getValue() ?? '');

        foreach ($this->getCategoryNames($product) as $categoryName) {
            $terms[] = $categoryName;
        }

        $terms = $this->dictionary->dedupe($terms);
        $terms = array_merge($terms, $this->buildNamePhrases((string) $product->getName()));
        $terms = array_merge($terms, $this->buildControlledSynonyms($terms));

        foreach ($terms as $term) {
            $normalized = $this->dictionary->normalize($term);
            if ($normalized !== $term) {
                $terms[] = $normalized;
            }
        }

        $terms = array_slice($this->dictionary->dedupe($terms), 0, self::MAX_KEYWORDS);
        $keywords = implode(', ', $terms);

        return mb_substr($keywords, 0, self::MAX_LENGTH, 'UTF-8');
    }

    private function buildNamePhrases(string $name): array
    {
        $normalized = $this->dictionary->normalize($name);
        $tokens = array_values(array_filter(explode(' ', $normalized), fn (string $token): bool => mb_strlen($token) >= 2));
        $phrases = [];

        for ($size = 1; $size <= 3; $size++) {
            for ($index = 0; $index <= count($tokens) - $size; $index++) {
                $phrases[] = implode(' ', array_slice($tokens, $index, $size));
            }
        }

        return $phrases;
    }

    private function buildControlledSynonyms(array $terms): array
    {
        $haystack = ' ' . $this->dictionary->normalize(implode(' ', $terms)) . ' ';
        $synonyms = [];

        $groups = [
            ['signals' => [' rau ', ' vegetable ', ' cai ', ' lettuce ', ' salad '], 'terms' => ['rau', 'rau xanh', 'rau tuoi', 'vegetable']],
            ['signals' => [' ca chua ', ' tomato '], 'terms' => ['ca chua', 'tomato', 'rau cu', 'cu qua']],
            ['signals' => [' ca rot ', ' carrot '], 'terms' => ['ca rot', 'carrot', 'rau cu', 'cu qua']],
            ['signals' => [' khoai tay ', ' potato '], 'terms' => ['khoai tay', 'potato', 'rau cu', 'cu qua']],
            ['signals' => [' su su ', ' chayote '], 'terms' => ['su su', 'chayote', 'rau cu', 'cu qua']],
            ['signals' => [' sup lo ', ' cauliflower ', ' broccoli '], 'terms' => ['sup lo', 'cauliflower', 'broccoli', 'rau cu', 'cu qua']],
            ['signals' => [' dua leo ', ' dua chuot ', ' cucumber '], 'terms' => ['dua leo', 'dua chuot', 'cucumber', 'rau cu']],
            ['signals' => [' nam ', ' mushroom '], 'terms' => ['nam', 'mushroom', 'rau cu']],
            ['signals' => [' trai cay ', ' hoa qua ', ' fruit '], 'terms' => ['trai cay', 'hoa qua', 'qua tuoi', 'fruit']],
            ['signals' => [' thit heo ', ' thit lon ', ' pork ', ' ba chi ', ' suon heo '], 'terms' => ['thit heo', 'thit lon', 'pork']],
            ['signals' => [' thit bo ', ' beef '], 'terms' => ['thit bo', 'beef']],
            ['signals' => [' thit ga ', ' chicken '], 'terms' => ['thit ga', 'chicken']],
            ['signals' => [' trung ', ' egg '], 'terms' => ['trung', 'egg']],
            ['signals' => [' hai san ', ' seafood ', ' ca hoi ', ' fish ', ' tom ', ' shrimp ', ' muc ', ' squid '], 'terms' => ['hai san', 'seafood']],
            ['signals' => [' gao ', ' rice '], 'terms' => ['gao', 'rice']],
        ];

        foreach ($groups as $group) {
            foreach ($group['signals'] as $signal) {
                if (str_contains($haystack, $signal)) {
                    array_push($synonyms, ...$group['terms']);
                    break;
                }
            }
        }

        return $this->dictionary->dedupe($synonyms);
    }

    private function getCategoryNames(ProductInterface $product): array
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

        return $names;
    }

    private function stripHtml(string $value): string
    {
        $value = strip_tags($value);
        $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $value = preg_replace('/\s+/', ' ', $value) ?? $value;

        return trim($value);
    }
}
