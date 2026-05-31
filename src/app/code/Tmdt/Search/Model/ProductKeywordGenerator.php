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
        $terms = $this->dictionary->expand($terms);

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
