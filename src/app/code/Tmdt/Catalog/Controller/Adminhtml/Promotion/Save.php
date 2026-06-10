<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Controller\Adminhtml\Promotion;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\App\ResourceConnection;

class Save extends Action
{
    public const ADMIN_RESOURCE = 'Tmdt_Catalog::promotion';
    private const MANAGED_TYPES = ['auto_discount', 'voucher', 'banner', 'seasonal'];

    public function __construct(
        Context $context,
        private readonly ResourceConnection $resourceConnection
    ) {
        parent::__construct($context);
    }

    public function execute()
    {
        $resultRedirect = $this->resultRedirectFactory->create();
        $data = $this->getRequest()->getPostValue();

        if (empty($data)) {
            $this->messageManager->addErrorMessage(__('Du lieu khong hop le.'));
            return $resultRedirect->setPath('*/*/index');
        }

        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName('tmdt_promotions');

        try {
            $id = isset($data['id']) && trim((string)$data['id']) !== '' ? (int)$data['id'] : null;
            $type = trim((string)($data['type'] ?? 'auto_discount'));
            if (!in_array($type, self::MANAGED_TYPES, true)) {
                throw new \InvalidArgumentException('Loai chuong trinh khong hop le.');
            }

            $title = trim((string)($data['title'] ?? ''));
            if ($title === '') {
                throw new \InvalidArgumentException('Thieu ten chuong trinh.');
            }

            $discountType = trim((string)($data['discount_type'] ?? 'fixed'));
            $discountValue = isset($data['discount_value']) && trim((string)$data['discount_value']) !== ''
                ? (float)$data['discount_value']
                : null;
            $startAt = $this->normalizeDateTime($data['start_at'] ?? null);
            $endAt = $this->normalizeDateTime($data['end_at'] ?? null);

            if (in_array($type, ['auto_discount', 'voucher'], true)) {
                $this->validateDiscount($discountType, $discountValue, $startAt, $endAt);
            }

            $discountCode = isset($data['discount_code']) && trim((string)$data['discount_code']) !== ''
                ? strtoupper(trim((string)$data['discount_code']))
                : null;
            if ($type === 'voucher') {
                $this->validateUniqueVoucherCode($connection, $tableName, $discountCode, $id);
            }

            $applyScope = trim((string)($data['apply_scope'] ?? 'all'));
            if (!in_array($applyScope, ['all', 'category', 'product'], true)) {
                $applyScope = 'all';
            }
            $categoryIds = $this->normalizeList($data['category_ids'] ?? '');
            $productSkus = strtoupper($this->normalizeList($data['product_skus'] ?? ''));

            if ($type === 'auto_discount') {
                if ($applyScope === 'category' && $categoryIds === '') {
                    throw new \InvalidArgumentException('Vui long chon danh muc ap dung.');
                }
                if ($applyScope === 'product' && $productSkus === '') {
                    throw new \InvalidArgumentException('Vui long nhap SKU san pham ap dung.');
                }
            }

            $promoData = [
                'title' => $title,
                'description' => trim((string)($data['description'] ?? '')),
                'image' => trim((string)($data['image'] ?? '')),
                'button_text' => trim((string)($data['button_text'] ?? '')),
                'button_action' => trim((string)($data['button_action'] ?? '')),
                'type' => $type,
                'discount_code' => $discountCode,
                'discount_type' => $discountType,
                'discount_value' => $discountValue,
                'min_order_amount' => isset($data['min_order_amount']) && trim((string)$data['min_order_amount']) !== '' ? (float)$data['min_order_amount'] : null,
                'max_discount_amount' => isset($data['max_discount_amount']) && trim((string)$data['max_discount_amount']) !== '' ? (float)$data['max_discount_amount'] : null,
                'apply_scope' => $applyScope,
                'category_ids' => $categoryIds !== '' ? $categoryIds : null,
                'product_skus' => $productSkus !== '' ? $productSkus : null,
                'usage_limit' => isset($data['usage_limit']) && trim((string)$data['usage_limit']) !== '' ? max(0, (int)$data['usage_limit']) : null,
                'start_at' => $startAt,
                'end_at' => $endAt,
                'is_active' => (int)($data['is_active'] ?? 1)
            ];

            if ($id) {
                $connection->update($tableName, $promoData, ['id = ?' => $id]);
                $this->messageManager->addSuccessMessage(__('Cap nhat chuong trinh thanh cong.'));
            } else {
                $connection->insert($tableName, $promoData);
                $message = $type === 'voucher'
                    ? 'Tạo voucher thành công'
                    : 'Tạo chương trình khuyến mãi thành công';
                $this->messageManager->addSuccessMessage(__($message));
            }
        } catch (\Throwable $e) {
            if ($e->getMessage() === 'Mã voucher đã tồn tại.') {
                $this->messageManager->addErrorMessage(__('Mã voucher đã tồn tại.'));
            } else {
                $this->messageManager->addErrorMessage(__('Loi khi luu: %1', $e->getMessage()));
            }
        }

        return $resultRedirect->setPath('*/*/index');
    }

    private function validateDiscount(string $discountType, ?float $discountValue, ?string $startAt, ?string $endAt): void
    {
        if (!in_array($discountType, ['percent', 'fixed'], true)) {
            throw new \InvalidArgumentException('Loai giam gia khong hop le.');
        }
        if ($discountValue === null || $discountValue <= 0) {
            throw new \InvalidArgumentException('Gia tri giam gia phai lon hon 0.');
        }
        if ($discountType === 'percent' && $discountValue > 100) {
            throw new \InvalidArgumentException('Giam theo phan tram khong duoc vuot qua 100%.');
        }
        if ($startAt === null || $endAt === null) {
            throw new \InvalidArgumentException('Thieu thoi gian bat dau hoac ket thuc.');
        }
        if (strtotime($endAt) <= strtotime($startAt)) {
            throw new \InvalidArgumentException('Thoi gian ket thuc phai sau thoi gian bat dau.');
        }
    }

    private function validateUniqueVoucherCode($connection, string $tableName, ?string $discountCode, ?int $id): void
    {
        if ($discountCode === null) {
            throw new \InvalidArgumentException('Thieu ma voucher.');
        }

        $duplicateSelect = $connection->select()
            ->from($tableName, ['id'])
            ->where('discount_code = ?', $discountCode)
            ->where('type = ?', 'voucher')
            ->limit(1);
        if ($id) {
            $duplicateSelect->where('id != ?', $id);
        }

        if ((int)$connection->fetchOne($duplicateSelect) > 0) {
            throw new \InvalidArgumentException('Mã voucher đã tồn tại.');
        }
    }

    private function normalizeDateTime($value): ?string
    {
        $value = trim((string)($value ?? ''));
        if ($value === '') {
            return null;
        }

        $timestamp = strtotime($value);
        return $timestamp === false ? null : date('Y-m-d H:i:s', $timestamp);
    }

    private function normalizeList($value): string
    {
        if (is_array($value)) {
            $items = $value;
        } else {
            $items = preg_split('/[\r\n,]+/', (string)$value) ?: [];
        }

        $items = array_filter(array_map(static function ($item): string {
            return trim((string)$item);
        }, $items), static function (string $item): bool {
            return $item !== '';
        });

        return implode(',', array_values(array_unique($items)));
    }
}
