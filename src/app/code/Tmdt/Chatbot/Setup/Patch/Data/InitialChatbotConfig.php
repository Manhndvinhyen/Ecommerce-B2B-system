<?php

declare(strict_types=1);

namespace Tmdt\Chatbot\Setup\Patch\Data;

use Magento\Framework\App\Config\Storage\WriterInterface;
use Magento\Framework\Setup\ModuleDataSetupInterface;
use Magento\Framework\Setup\Patch\DataPatchInterface;

/**
 * Seed cấu hình mặc định cho Chatbot.
 * Chạy 1 lần duy nhất qua: bin/magento setup:upgrade
 * GEMINI_API_KEY không được seed ở đây — đặt trong env/custom.env
 */
class InitialChatbotConfig implements DataPatchInterface
{
    public function __construct(
        private readonly ModuleDataSetupInterface $moduleDataSetup,
        private readonly WriterInterface $configWriter
    ) {}

    public function apply(): self
    {
        $this->moduleDataSetup->startSetup();

        // Cấu hình mặc định chatbot
        $configs = [
            'tmdt_chatbot/general/enabled'          => '1',
            'tmdt_chatbot/general/widget_position'  => 'bottom-right',
            'tmdt_chatbot/general/welcome_message'  => 'Xin chào! Tôi có thể giúp gì cho bạn?',
            'tmdt_chatbot/general/language'         => 'vi',
        ];

        foreach ($configs as $path => $value) {
            $this->configWriter->save($path, $value);
        }

        $this->moduleDataSetup->endSetup();

        return $this;
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
