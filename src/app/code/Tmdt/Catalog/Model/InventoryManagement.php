<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Model;

use Tmdt\Catalog\Api\InventoryManagementInterface;
use Magento\CatalogInventory\Api\StockRegistryInterface;
use Magento\Customer\Model\Session as CustomerSession;
use Magento\Framework\App\ResourceConnection;
use Magento\Catalog\Api\ProductRepositoryInterface;
use Magento\Framework\Exception\LocalizedException;
use Magento\Authorization\Model\UserContextInterface;

class InventoryManagement implements InventoryManagementInterface
{
    public function __construct(
        private readonly StockRegistryInterface $stockRegistry,
        private readonly CustomerSession $customerSession,
        private readonly ResourceConnection $resourceConnection,
        private readonly ProductRepositoryInterface $productRepository,
        private readonly UserContextInterface $userContext
    ) {
    }

    /**
     * @inheritDoc
     */
    public function adjustStock($adjustmentData): string
    {
        $sellerId = $this->resolveCompanySellerId($this->getCurrentCustomerId());
        $data = (array) $adjustmentData;

        if (empty($data['sku']) || !isset($data['qty_change']) || empty($data['action_type'])) {
            throw new LocalizedException(__('SKU, Số lượng thay đổi và loại nhập/xuất là bắt buộc.'));
        }

        $sku = (string) $data['sku'];
        $qtyChange = (float) $data['qty_change'];
        $actionType = (string) $data['action_type']; // inbound, outbound, system_adjust
        $note = isset($data['note']) ? (string) $data['note'] : '';

        // Verify product ownership
        $this->verifyProductOwnership($sku, $sellerId);

        try {
            $stockItem = $this->stockRegistry->getStockItemBySku($sku);
            $qtyBefore = (float) $stockItem->getQty();
            
            // Calculate new quantity
            $qtyAfter = $qtyBefore + $qtyChange;
            if ($qtyAfter < 0) {
                throw new LocalizedException(__('Số lượng xuất vượt quá tồn kho khả dụng hiện tại.'));
            }

            // Update Magento Core stock level
            $stockItem->setQty($qtyAfter);
            $stockItem->setIsInStock($qtyAfter > 0);
            $this->stockRegistry->updateStockItemBySku($sku, $stockItem);

            // Record log in tmdt_inventory_log
            $connection = $this->resourceConnection->getConnection();
            $connection->insert(
                $connection->getTableName('tmdt_inventory_log'),
                [
                    'sku' => $sku,
                    'action_type' => $actionType,
                    'qty_change' => $qtyChange,
                    'qty_after' => $qtyAfter,
                    'note' => $note,
                    'created_at' => date('Y-m-d H:i:s')
                ]
            );

            return json_encode([
                'success' => true,
                'message' => 'Điều chỉnh tồn kho sỉ thành công!',
                'sku' => $sku,
                'qty_after' => $qtyAfter
            ]);
        } catch (LocalizedException $e) {
            throw $e;
        } catch (\Exception $e) {
            throw new LocalizedException(__($e->getMessage()));
        }
    }

    /**
     * @inheritDoc
     */
    public function getAdjustmentLogs()
    {
        $sellerId = $this->resolveCompanySellerId($this->getCurrentCustomerId());
        $connection = $this->resourceConnection->getConnection();
        
        // Fetch logs only for products belonging to the logged-in seller
        $select = $connection->select()
            ->from(['il' => $connection->getTableName('tmdt_inventory_log')])
            ->joinInner(
                ['cpe' => $connection->getTableName('catalog_product_entity')],
                'il.sku = cpe.sku',
                []
            )
            ->joinInner(
                ['cpev' => $connection->getTableName('catalog_product_entity_varchar')],
                'cpe.entity_id = cpev.entity_id AND cpev.attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = \'tmdt_seller_id\' AND entity_type_id = 4 LIMIT 1)',
                []
            )
            ->where('cpev.value = ?', $sellerId)
            ->order('il.created_at DESC');

        return $connection->fetchAll($select);
    }

    /**
     * Get Seller ID from session
     */
    private function getCurrentCustomerId(): string
    {
        $userId = (int) $this->userContext->getUserId();
        if ($userId > 0) {
            return (string) $userId;
        }

        if (!$this->customerSession->isLoggedIn()) {
            throw new LocalizedException(__('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.'));
        }
        return (string) $this->customerSession->getCustomerId();
    }

    private function resolveCompanySellerId(string $customerId): string
    {
        $connection = $this->resourceConnection->getConnection();
        $registrationTable = $connection->getTableName('tmdt_customer_registration');
        $row = $connection->fetchRow(
            $connection->select()
                ->from($registrationTable, ['login_code'])
                ->where('customer_id = ?', (int) $customerId)
                ->limit(1)
        );

        $loginCode = is_array($row) ? trim((string) ($row['login_code'] ?? '')) : '';
        if ($loginCode === '') {
            return $customerId;
        }

        $ownerIds = $connection->fetchCol(
            $connection->select()
                ->from($registrationTable, ['customer_id'])
                ->where('login_code = ?', $loginCode)
                ->where('role = ?', 'seller')
        );

        foreach ($ownerIds as $ownerId) {
            if ($this->customerHasOwnerPrivilege((int) $ownerId)) {
                return (string) $ownerId;
            }
        }

        return $customerId;
    }

    private function customerHasOwnerPrivilege(int $customerId): bool
    {
        if ($customerId <= 0) {
            return false;
        }

        try {
            $connection = $this->resourceConnection->getConnection();
            $entityTypeId = (int) $connection->fetchOne(
                "SELECT entity_type_id FROM eav_entity_type WHERE entity_type_code = 'customer' LIMIT 1"
            );
            if ($entityTypeId <= 0) {
                return false;
            }

            $attrs = $connection->fetchPairs(
                $connection->select()
                    ->from($connection->getTableName('eav_attribute'), ['attribute_code', 'attribute_id'])
                    ->where('entity_type_id = ?', $entityTypeId)
                    ->where('attribute_code IN (?)', ['is_owner', 'is_super_admin'])
            );
            if (!$attrs) {
                return false;
            }

            $values = $connection->fetchPairs(
                $connection->select()
                    ->from($connection->getTableName('customer_entity_int'), ['attribute_id', 'value'])
                    ->where('entity_id = ?', $customerId)
                    ->where('attribute_id IN (?)', array_values($attrs))
            );

            foreach ($attrs as $attributeId) {
                if (!empty($values[(int) $attributeId])) {
                    return true;
                }
            }
        } catch (\Throwable) {
            return false;
        }

        return false;
    }

    /**
     * Verify that the requested product belongs to the seller
     */
    private function verifyProductOwnership(string $sku, string $sellerId): void
    {
        try {
            $product = $this->productRepository->get($sku);
            $prodSellerId = $product->getCustomAttribute('tmdt_seller_id') 
                ? (string) $product->getCustomAttribute('tmdt_seller_id')->getValue() 
                : '';

            if ($prodSellerId !== $sellerId) {
                throw new LocalizedException(__('Bạn không có quyền quản lý kho cho sản phẩm này.'));
            }
        } catch (\Exception $e) {
            throw new LocalizedException(__('Không tìm thấy sản phẩm.'));
        }
    }
}
