<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Model;

use Tmdt\Catalog\Api\InventoryManagementInterface;
use Magento\CatalogInventory\Api\StockRegistryInterface;
use Magento\Customer\Model\Session as CustomerSession;
use Magento\Framework\App\ResourceConnection;
use Magento\Catalog\Api\ProductRepositoryInterface;
use Magento\Framework\Exception\LocalizedException;

class InventoryManagement implements InventoryManagementInterface
{
    public function __construct(
        private readonly StockRegistryInterface $stockRegistry,
        private readonly CustomerSession $customerSession,
        private readonly ResourceConnection $resourceConnection,
        private readonly ProductRepositoryInterface $productRepository
    ) {
    }

    /**
     * @inheritDoc
     */
    public function adjustStock($adjustmentData): string
    {
        $sellerId = $this->getSellerIdFromSession();
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
        } catch (\Exception $e) {
            throw new LocalizedException(__($e->getMessage()));
        }
    }

    /**
     * @inheritDoc
     */
    public function getAdjustmentLogs()
    {
        $sellerId = $this->getSellerIdFromSession();
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
    private function getSellerIdFromSession(): string
    {
        if (!$this->customerSession->isLoggedIn()) {
            throw new LocalizedException(__('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.'));
        }
        return (string) $this->customerSession->getCustomerId();
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
