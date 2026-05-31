<?php

declare(strict_types=1);

namespace Tmdt\Search\Observer;

use Magento\Catalog\Model\Product;
use Magento\Framework\Event\Observer;
use Magento\Framework\Event\ObserverInterface;
use Tmdt\Search\Model\ProductKeywordGenerator;
use Tmdt\Search\Setup\Patch\Data\AddProductSearchKeywordsAttribute;

class GenerateProductKeywordsObserver implements ObserverInterface
{
    public function __construct(
        private readonly ProductKeywordGenerator $keywordGenerator
    ) {
    }

    public function execute(Observer $observer): void
    {
        $product = $observer->getEvent()->getProduct();
        if (!$product instanceof Product) {
            return;
        }

        $keywords = $this->keywordGenerator->generate($product);
        if ($keywords === '') {
            return;
        }

        $current = trim((string) $product->getData(AddProductSearchKeywordsAttribute::ATTRIBUTE_CODE));
        if ($current !== $keywords) {
            $product->setData(AddProductSearchKeywordsAttribute::ATTRIBUTE_CODE, $keywords);
        }
    }
}
