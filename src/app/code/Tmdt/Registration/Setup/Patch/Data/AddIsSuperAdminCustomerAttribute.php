<?php

declare(strict_types=1);

namespace Tmdt\Registration\Setup\Patch\Data;

use Magento\Customer\Model\Customer;
use Magento\Customer\Setup\CustomerSetupFactory;
use Magento\Eav\Setup\EavSetupFactory;
use Magento\Framework\Setup\ModuleDataSetupInterface;
use Magento\Framework\Setup\Patch\DataPatchInterface;

class AddIsSuperAdminCustomerAttribute implements DataPatchInterface
{
    public function __construct(
        private readonly ModuleDataSetupInterface $moduleDataSetup,
        private readonly CustomerSetupFactory $customerSetupFactory,
        private readonly EavSetupFactory $eavSetupFactory
    ) {
    }

    public function apply(): void
    {
        $this->moduleDataSetup->getConnection()->startSetup();

        $customerSetup = $this->customerSetupFactory->create(['setup' => $this->moduleDataSetup]);
        $eavSetup = $this->eavSetupFactory->create(['setup' => $this->moduleDataSetup]);

        $attributeCode = 'is_super_admin';
        $entityTypeId = $customerSetup->getEntityTypeId(Customer::ENTITY);
        $attributeSetId = $customerSetup->getDefaultAttributeSetId(Customer::ENTITY);
        $attributeGroupId = $customerSetup->getDefaultAttributeGroupId(Customer::ENTITY, $attributeSetId);

        $attributeId = $eavSetup->getAttributeId($entityTypeId, $attributeCode);
        if (!$attributeId) {
            $customerSetup->addAttribute(
                Customer::ENTITY,
                $attributeCode,
                [
                    'type' => 'int',
                    'label' => 'Is Super Admin',
                    'input' => 'boolean',
                    'source' => 'Magento\\Eav\\Model\\Entity\\Attribute\\Source\\Boolean',
                    'required' => false,
                    'default' => 0,
                    'visible' => true,
                    'user_defined' => true,
                    'system' => 0,
                    'position' => 998,
                ]
            );
            $attributeId = (int) $eavSetup->getAttributeId($entityTypeId, $attributeCode);
        }

        if ($attributeId) {
            $eavSetup->addAttributeToGroup(
                $entityTypeId,
                $attributeSetId,
                $attributeGroupId,
                $attributeCode,
                998
            );

            $attribute = $customerSetup->getEavConfig()->getAttribute(Customer::ENTITY, $attributeCode);
            $attribute->setData('used_in_forms', ['adminhtml_customer']);
            $attribute->save();
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