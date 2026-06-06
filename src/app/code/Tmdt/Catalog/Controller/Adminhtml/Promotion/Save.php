<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Controller\Adminhtml\Promotion;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\App\ResourceConnection;

class Save extends Action
{
    public const ADMIN_RESOURCE = 'Tmdt_Catalog::promotion';

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
            $this->messageManager->addErrorMessage(__('Dữ liệu không hợp lệ.'));
            return $resultRedirect->setPath('*/*/index');
        }

        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName('tmdt_promotions');

        try {
            $id = isset($data['id']) && trim((string)$data['id']) !== '' ? (int)$data['id'] : null;

            $promoData = [
                'title' => trim((string)($data['title'] ?? '')),
                'description' => trim((string)($data['description'] ?? '')),
                'image' => trim((string)($data['image'] ?? '')),
                'button_text' => trim((string)($data['button_text'] ?? '')),
                'button_action' => trim((string)($data['button_action'] ?? '')),
                'type' => trim((string)($data['type'] ?? 'banner')),
                'discount_code' => isset($data['discount_code']) && trim((string)$data['discount_code']) !== '' ? trim((string)$data['discount_code']) : null,
                'discount_value' => isset($data['discount_value']) && trim((string)$data['discount_value']) !== '' ? (float)$data['discount_value'] : null,
                'min_order_amount' => isset($data['min_order_amount']) && trim((string)$data['min_order_amount']) !== '' ? (float)$data['min_order_amount'] : null,
                'is_active' => (int)($data['is_active'] ?? 1)
            ];

            if ($id) {
                $connection->update($tableName, $promoData, ['id = ?' => $id]);
                $this->messageManager->addSuccessMessage(__('Cập nhật khuyến mãi thành công.'));
            } else {
                $connection->insert($tableName, $promoData);
                $this->messageManager->addSuccessMessage(__('Tạo khuyến mãi mới thành công.'));
            }
        } catch (\Throwable $e) {
            $this->messageManager->addErrorMessage(__('Lỗi khi lưu khuyến mãi: %1', $e->getMessage()));
        }

        return $resultRedirect->setPath('*/*/index');
    }
}
