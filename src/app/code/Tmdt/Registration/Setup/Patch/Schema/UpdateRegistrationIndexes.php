<?php

declare(strict_types=1);

namespace Tmdt\Registration\Setup\Patch\Schema;

use Magento\Framework\DB\Adapter\AdapterInterface;
use Magento\Framework\Setup\ModuleDataSetupInterface;
use Magento\Framework\Setup\Patch\SchemaPatchInterface;

class UpdateRegistrationIndexes implements SchemaPatchInterface
{
    public function __construct(
        private readonly ModuleDataSetupInterface $moduleDataSetup
    ) {
    }

    public function apply(): void
    {
        $connection = $this->moduleDataSetup->getConnection();
        $tableName = $this->moduleDataSetup->getTable('tmdt_customer_registration');

        $this->moduleDataSetup->getConnection()->startSetup();

        if ($connection->isTableExists($tableName)) {
            $indexes = $connection->getIndexList($tableName);

            $legacyIndex = 'TMDT_CUSTOMER_REGISTRATION_LOGIN_CODE';
            if (isset($indexes[$legacyIndex])) {
                $connection->dropIndex($tableName, $legacyIndex);
            }

            $compositeIndex = 'TMDT_CUSTOMER_REGISTRATION_LOGIN_CODE_PHONE_UNIQUE';
            if (!isset($indexes[$compositeIndex])) {
                $connection->addIndex(
                    $tableName,
                    $compositeIndex,
                    ['login_code', 'phone_number'],
                    AdapterInterface::INDEX_TYPE_UNIQUE
                );
            }
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
