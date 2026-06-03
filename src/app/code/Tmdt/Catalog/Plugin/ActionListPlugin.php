<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Plugin;

use Magento\Framework\App\Router\ActionList;

class ActionListPlugin
{
    /**
     * Normalize action name by removing hyphens before looking up the action class.
     * This allows URLs like /api/sale/sepay-webhook to map to Sepaywebhook controller.
     *
     * @param ActionList $subject
     * @param string $module
     * @param string $area
     * @param string $namespace
     * @param string $action
     * @return array
     */
    public function beforeGet(
        ActionList $subject,
        $module,
        $area,
        $namespace,
        $action
    ) {
        if ($action && strpos($action, '-') !== false) {
            $action = str_replace('-', '', $action);
        }
        return [$module, $area, $namespace, $action];
    }
}
