<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Model;

use Magento\Framework\App\ResourceConnection;
use Tmdt\Catalog\Api\RecurringInterface;

class Recurring implements RecurringInterface
{
    private const TABLE = 'tmdt_recurring_schedules';

    public function __construct(
        private readonly ResourceConnection $resourceConnection
    ) {}

    /**
     * @inheritDoc
     */
    public function subscribe(
        string $customerEmail,
        string $customerName,
        string $frequency,
        ?string $weekdays,
        ?int $monthDay,
        string $deliveryTime,
        string $itemsJson,
        string $shippingJson
    ): array {
        if (empty($customerEmail)) {
            return ['success' => false, 'message' => 'Email khách hàng không được để trống.'];
        }
        if ($frequency !== 'weekly' && $frequency !== 'monthly') {
            return ['success' => false, 'message' => 'Tần suất không hợp lệ.'];
        }
        if (empty($deliveryTime)) {
            return ['success' => false, 'message' => 'Khung giờ giao hàng không được để trống.'];
        }
        if (empty($itemsJson) || json_decode($itemsJson) === null) {
            return ['success' => false, 'message' => 'Danh sách sản phẩm không hợp lệ.'];
        }
        if (empty($shippingJson) || json_decode($shippingJson) === null) {
            return ['success' => false, 'message' => 'Thông tin giao hàng không hợp lệ.'];
        }

        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName(self::TABLE);

        // Calculate next run date starting from tomorrow
        $todayStr = date('Y-m-d');
        $nextRunDate = $this->calculateNextRunDate($frequency, $weekdays, $monthDay, $todayStr);

        try {
            $connection->insert($table, [
                'customer_email' => $customerEmail,
                'customer_name'  => $customerName,
                'frequency'      => $frequency,
                'weekdays'       => $weekdays,
                'month_day'      => $monthDay,
                'delivery_time'  => $deliveryTime,
                'items_json'     => $itemsJson,
                'shipping_json'  => $shippingJson,
                'status'         => 'active',
                'last_run_date'  => null,
                'next_run_date'  => $nextRunDate,
                'created_at'     => date('Y-m-d H:i:s')
            ]);

            return [
                'success' => true,
                'message' => 'Đăng ký lịch mua hàng định kỳ thành công. Ngày bắt đầu tiếp theo: ' . date('d/m/Y', strtotime($nextRunDate))
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Có lỗi xảy ra khi đăng ký lịch: ' . $e->getMessage()
            ];
        }
    }

    /**
     * @inheritDoc
     */
    public function listSubscriptions(string $customerEmail): array
    {
        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName(self::TABLE);

        try {
            $select = $connection->select()
                ->from($table)
                ->where('customer_email = ?', $customerEmail)
                ->order('id DESC');

            return $connection->fetchAll($select);
        } catch (\Exception $e) {
            return [];
        }
    }

    /**
     * @inheritDoc
     */
    public function cancelSubscription(int $id): array
    {
        $connection = $this->resourceConnection->getConnection();
        $table = $connection->getTableName(self::TABLE);

        try {
            $connection->update(
                $table,
                ['status' => 'cancelled'],
                ['id = ?' => $id]
            );

            return ['success' => true, 'message' => 'Đã hủy lịch đăng ký mua hàng định kỳ thành công.'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => 'Không thể hủy lịch đăng ký: ' . $e->getMessage()];
        }
    }

    /**
     * Helper to calculate the next run date based on frequency, starting from $startDate (exclusive)
     */
    public function calculateNextRunDate(string $frequency, ?string $weekdays, ?int $monthDay, string $startDate): string
    {
        $startTs = strtotime($startDate);
        if ($frequency === 'weekly') {
            if (empty($weekdays)) {
                return date('Y-m-d', $startTs + 86400);
            }
            $days = array_map('intval', explode(',', $weekdays));
            sort($days);

            // Find the next matching weekday in the range +1 to +7 days
            for ($i = 1; $i <= 7; $i++) {
                $checkTs = $startTs + $i * 86400;
                $checkW = (int)date('w', $checkTs); // 0 (Sunday) to 6 (Saturday)
                if (in_array($checkW, $days, true)) {
                    return date('Y-m-d', $checkTs);
                }
            }
        } elseif ($frequency === 'monthly') {
            $day = $monthDay ?: 1;
            $currentMonth = (int)date('m', $startTs);
            $currentYear = (int)date('Y', $startTs);

            // Target date in current month
            $targetDateThisMonth = sprintf('%04d-%02d-%02d', $currentYear, $currentMonth, $day);
            $targetTsThisMonth = strtotime($targetDateThisMonth);

            if ($targetTsThisMonth && $targetTsThisMonth > $startTs) {
                return $targetDateThisMonth;
            } else {
                // Next month
                $nextMonth = $currentMonth + 1;
                $nextYear = $currentYear;
                if ($nextMonth > 12) {
                    $nextMonth = 1;
                    $nextYear++;
                }
                $daysInNextMonth = (int)date('t', strtotime(sprintf('%04d-%02d-01', $nextYear, $nextMonth)));
                $finalDay = min($day, $daysInNextMonth);
                return sprintf('%04d-%02d-%02d', $nextYear, $nextMonth, $finalDay);
            }
        }

        return date('Y-m-d', $startTs + 86400);
    }
}
