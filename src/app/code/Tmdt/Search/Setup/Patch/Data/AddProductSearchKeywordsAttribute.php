<?php

declare(strict_types=1);

namespace Tmdt\Search\Setup\Patch\Data;

use Magento\Catalog\Model\Product;
use Magento\Catalog\Setup\CategorySetupFactory;
use Magento\Eav\Model\Entity\Attribute\ScopedAttributeInterface;
use Magento\Framework\Setup\ModuleDataSetupInterface;
use Magento\Framework\Setup\Patch\DataPatchInterface;

class AddProductSearchKeywordsAttribute implements DataPatchInterface
{
    public const ATTRIBUTE_CODE = 'tmdt_search_keywords';

    public function __construct(
        private readonly ModuleDataSetupInterface $moduleDataSetup,
        private readonly CategorySetupFactory $categorySetupFactory
    ) {
    }

    public function apply(): void
    {
        $this->moduleDataSetup->getConnection()->startSetup();

        $categorySetup = $this->categorySetupFactory->create(['setup' => $this->moduleDataSetup]);
        $entityTypeId = $categorySetup->getEntityTypeId(Product::ENTITY);
        $attributeId = $categorySetup->getAttributeId($entityTypeId, self::ATTRIBUTE_CODE);

        if (!$attributeId) {
            $categorySetup->addAttribute(
                Product::ENTITY,
                self::ATTRIBUTE_CODE,
                [
                    'type' => 'text',
                    'label' => 'TMDT Search Keywords',
                    'input' => 'textarea',
                    'required' => false,
                    'sort_order' => 990,
                    'global' => ScopedAttributeInterface::SCOPE_STORE,
                    'visible' => true,
                    'visible_on_front' => false,
                    'user_defined' => true,
                    'group' => 'Search Engine Optimization',
                    'searchable' => true,
                    'visible_in_advanced_search' => true,
                    'filterable' => false,
                    'filterable_in_search' => false,
                    'comparable' => false,
                    'unique' => false,
                    'used_in_product_listing' => false,
                    'is_html_allowed_on_front' => false,
                    'note' => 'Generated automatically from product data and TMDT synonym dictionary.',
                ]
            );
        } else {
            $categorySetup->updateAttribute(Product::ENTITY, self::ATTRIBUTE_CODE, 'is_searchable', 1);
            $categorySetup->updateAttribute(Product::ENTITY, self::ATTRIBUTE_CODE, 'is_visible_in_advanced_search', 1);
        }

        $this->moduleDataSetup->getConnection()->endSetup();
    }

    public static function getDependencies(): array
    {
        return [];
    }

    public function getAliases(): array
    {
        return [];
    }
}
