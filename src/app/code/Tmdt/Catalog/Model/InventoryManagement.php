<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Model;

use Magento\Authorization\Model\UserContextInterface;
use Magento\Catalog\Api\ProductRepositoryInterface;
use Magento\CatalogInventory\Api\StockRegistryInterface;
use Magento\Customer\Model\Session as CustomerSession;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Exception\LocalizedException;
use Tmdt\Catalog\Api\InventoryManagementInterface;

class InventoryManagement implements InventoryManagementInterface
{
    public function __construct(
        private readonly StockRegistryInterface $stockRegistry,
        private readonly CustomerSession $customerSession,
        private readonly ResourceConnection $resourceConnection,
        private readonly ProductRepositoryInterface $productRepository,
        private readonly UserContextInterface $userContext,
        private readonly RequestInterface $request
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
            throw new LocalizedException(__('SKU, So luong thay doi va loai nhap/xuat la bat buoc.'));
        }

        $sku = (string) $data['sku'];
        $qtyChange = (float) $data['qty_change'];
        $actionType = (string) $data['action_type'];
        $note = isset($data['note']) ? (string) $data['note'] : '';

        $this->verifyProductOwnership($sku, $sellerId);

        try {
            $stockItem = $this->stockRegistry->getStockItemBySku($sku);
            $qtyBefore = (float) $stockItem->getQty();
            $qtyAfter = $qtyBefore + $qtyChange;
            if ($qtyAfter < 0) {
                throw new LocalizedException(__('So luong xuat vuot qua ton kho kha dung hien tai.'));
            }

            $stockItem->setQty($qtyAfter);
            $stockItem->setIsInStock($qtyAfter > 0);
            $this->stockRegistry->updateStockItemBySku($sku, $stockItem);

            $connection = $this->resourceConnection->getConnection();
            $this->syncSourceItems($sku, $qtyAfter, $connection);
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
                'message' => 'Dieu chinh ton kho si thanh cong!',
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
            ->group('il.log_id')
            ->order('il.created_at DESC');

        return $connection->fetchAll($select);
    }

    /**
     * Synchronize stock across all B2B warehouses (default, bac-giang, binh-duong)
     */
    private function syncSourceItems(string $sku, float $qty, $connection): void
    {
        $sourceItemTable = $connection->getTableName('inventory_source_item');
        $sources = ['default', 'bac-giang', 'binh-duong'];
        foreach ($sources as $sourceCode) {
            $exists = $connection->fetchOne(
                "SELECT source_item_id FROM {$sourceItemTable} WHERE sku = ? AND source_code = ? LIMIT 1",
                [$sku, $sourceCode]
            );
            if ($exists) {
                $connection->update(
                    $sourceItemTable,
                    [
                        'quantity' => $qty,
                        'status'   => ($qty > 0) ? 1 : 0
                    ],
                    ['source_item_id = ?' => (int)$exists]
                );
            } else {
                $connection->insert(
                    $sourceItemTable,
                    [
                        'source_code' => $sourceCode,
                        'sku'         => $sku,
                        'quantity'    => $qty,
                        'status'      => ($qty > 0) ? 1 : 0
                    ]
                );
            }
        }
    }

    private function getCurrentCustomerId(): string
    {
        if ($this->customerSession->isLoggedIn()) {
            return (string) $this->customerSession->getCustomerId();
        }

        if ($this->userContext->getUserType() === UserContextInterface::USER_TYPE_CUSTOMER) {
            $userId = (int) $this->userContext->getUserId();
            if ($userId > 0) {
                return (string) $userId;
            }
        }

        $token = '';
        $authHeader = $this->request->getHeader('Authorization');
        if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = trim($matches[1]);
        }

        if ($token === '') {
            $token = trim((string) $this->request->getParam('token'));
        }

        if ($token !== '') {
            $connection = $this->resourceConnection->getConnection();
            $customerId = $connection->fetchOne(
                $connection->select()
                    ->from($connection->getTableName('oauth_token'), ['customer_id'])
                    ->where('token = ?', $token)
                    ->limit(1)
            );
            if ($customerId) {
                return (string) $customerId;
            }
        }

        throw new LocalizedException(__('Phien lam viec het han. Vui long dang nhap lai.'));
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

    private function verifyProductOwnership(string $sku, string $sellerId): void
    {
        try {
            $product = $this->productRepository->get($sku);
            $prodSellerId = $product->getCustomAttribute('tmdt_seller_id')
                ? (string) $product->getCustomAttribute('tmdt_seller_id')->getValue()
                : '';

            if ($prodSellerId !== $sellerId) {
                throw new LocalizedException(__('Ban khong co quyen quan ly kho cho san pham nay.'));
            }
        } catch (LocalizedException $e) {
            throw $e;
        } catch (\Exception) {
            throw new LocalizedException(__('Khong tim thay san pham.'));
        }
    }
}
