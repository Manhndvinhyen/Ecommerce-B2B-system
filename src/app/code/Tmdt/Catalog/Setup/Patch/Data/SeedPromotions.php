<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Setup\Patch\Data;

use Magento\Framework\Setup\ModuleDataSetupInterface;
use Magento\Framework\Setup\Patch\DataPatchInterface;

class SeedPromotions implements DataPatchInterface
{
    public function __construct(
        private readonly ModuleDataSetupInterface $moduleDataSetup
    ) {}

    public function apply(): self
    {
        $this->moduleDataSetup->startSetup();
        $connection = $this->moduleDataSetup->getConnection();
        $tableName = $this->moduleDataSetup->getTable('tmdt_promotions');

        // Check if there are already promotions to prevent duplicate inserts
        $count = (int)$connection->fetchOne("SELECT COUNT(*) FROM {$tableName}");
        if ($count > 0) {
            $this->moduleDataSetup->endSetup();
            return $this;
        }

        $promotions = [
            // 1. Banner 1 (Mùa vụ sầu riêng)
            [
                'title' => 'Mùa vụ sầu riêng Ri6 - Đắk Lắk',
                'description' => 'Sầu riêng Ri6 cơm vàng hạt lép, thơm lừng chín cây từ nhà vườn Đắk Lắk. Ưu đãi chiết khấu sỉ đến 25% cho đơn hàng từ 100kg.',
                'image' => 'https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&w=1200&q=80',
                'button_text' => 'Xem sản phẩm',
                'button_action' => 'category:rau-cu-qua',
                'type' => 'banner',
                'discount_code' => null,
                'discount_value' => null,
                'min_order_amount' => null,
                'is_active' => 1
            ],
            // 2. Banner 2 (Rau hữu cơ Đà Lạt)
            [
                'title' => 'Rau củ hữu cơ Đà Lạt tươi sạch',
                'description' => 'Nguồn rau sạch đạt chuẩn VietGAP & Organic từ hợp tác xã Đà Lạt. Hóa đơn VAT đầy đủ, giao nhanh xe lạnh bảo quản chuẩn.',
                'image' => 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=80',
                'button_text' => 'Mua ngay',
                'button_action' => 'category:rau-cu-qua',
                'type' => 'banner',
                'discount_code' => null,
                'discount_value' => null,
                'min_order_amount' => null,
                'is_active' => 1
            ],
            // 3. Banner 3 (Thủy sản biển Ninh Thuận)
            [
                'title' => 'Thủy hải sản tươi sống mỗi ngày',
                'description' => 'Tôm sú, mực ống, cá hồi tươi rói đánh bắt tự nhiên từ vùng biển Ninh Thuận. Ưu đãi giá sỉ cực tốt cho nhà hàng & đại lý.',
                'image' => 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1200&q=80',
                'button_text' => 'Xem sản phẩm',
                'button_action' => 'category:thuy-hai-san',
                'type' => 'banner',
                'discount_code' => null,
                'discount_value' => null,
                'min_order_amount' => null,
                'is_active' => 1
            ],
            // 4. Voucher 1 (Voucher Khách hàng mới)
            [
                'title' => 'Voucher Khách Hàng Mới',
                'description' => 'Giảm 50.000đ cho đơn hàng sỉ đầu tiên của khách hàng doanh nghiệp từ 1.000.000đ.',
                'image' => '',
                'button_text' => 'Nhận voucher',
                'button_action' => 'coupon:FRESO50',
                'type' => 'voucher',
                'discount_code' => 'FRESO50',
                'discount_value' => 50000.00,
                'min_order_amount' => 1000000.00,
                'is_active' => 1
            ],
            // 5. Voucher 2 (Voucher Freeship sỉ)
            [
                'title' => 'Miễn Phí Vận Chuyển Sỉ',
                'description' => 'Freeship tối đa 50.000đ cho đơn hàng sỉ có tổng giá trị từ 3.000.000đ.',
                'image' => '',
                'button_text' => 'Lưu mã',
                'button_action' => 'coupon:FREESHIP50',
                'type' => 'voucher',
                'discount_code' => 'FREESHIP50',
                'discount_value' => 50000.00,
                'min_order_amount' => 3000000.00,
                'is_active' => 1
            ],
            // 6. Seasonal card 1 (VAT Invoice)
            [
                'title' => 'VAT 0% - Hóa Đơn Đầy Đủ',
                'description' => 'Hỗ trợ xuất hóa đơn VAT điện tử nhanh chóng cho khách hàng doanh nghiệp và nhà hàng.',
                'image' => 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=700&q=80',
                'button_text' => 'Xem chi tiết',
                'button_action' => 'page:ve-chung-toi',
                'type' => 'seasonal',
                'discount_code' => null,
                'discount_value' => null,
                'min_order_amount' => null,
                'is_active' => 1
            ],
            // 7. Seasonal card 2 (Combo Rau Củ Quả)
            [
                'title' => 'Combo Rau Củ Quả Tiện Lợi',
                'description' => 'Combo rau quả tổng hợp đóng gói sẵn phục vụ cho các bếp ăn công nghiệp và nhà hàng lớn.',
                'image' => 'https://images.unsplash.com/photo-1543083505-590d22e4764d?auto=format&fit=crop&w=700&q=80',
                'button_text' => 'Xem khuyến mãi',
                'button_action' => 'category:rau-cu-qua',
                'type' => 'seasonal',
                'discount_code' => null,
                'discount_value' => null,
                'min_order_amount' => null,
                'is_active' => 1
            ]
        ];

        foreach ($promotions as $promo) {
            $connection->insert($tableName, $promo);
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
