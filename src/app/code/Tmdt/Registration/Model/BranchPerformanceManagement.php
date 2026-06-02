<?php

declare(strict_types=1);

namespace Tmdt\Registration\Model;

use Magento\Customer\Api\CustomerRepositoryInterface;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Exception\AuthorizationException;
use Magento\Framework\Exception\InputException;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Integration\Model\Oauth\TokenFactory;
use Tmdt\Registration\Api\BranchPerformanceInterface;

class BranchPerformanceManagement implements BranchPerformanceInterface
{
    private const REGISTRATION_TABLE = 'tmdt_customer_registration';
    private const ORDER_TABLE = 'sales_order';
    private const AUTH_HEADER = 'Authorization';

    public function __construct(
        private readonly CustomerRepositoryInterface $customerRepository,
        private readonly ResourceConnection $resourceConnection,
        private readonly TokenFactory $tokenFactory,
        private readonly RestRequest $request
    ) {
    }

    public function get(): array
    {
        $ownerId = $this->getCustomerIdFromRequest();
        $owner = $this->customerRepository->getById($ownerId);
        if (!$this->isOwnerCustomer($owner)) {
            throw new AuthorizationException(__('Ban khong co quyen xem bao cao co so.'));
        }

        $ownerRegistration = $this->getRegistrationByCustomerId($ownerId);
        if (!$ownerRegistration) {
            throw new InputException(__('Khong tim thay thong tin nha hang.'));
        }

        $loginCode = trim((string) ($ownerRegistration['login_code'] ?? ''));
        if ($loginCode === '') {
            throw new InputException(__('Khong tim thay ma nha hang.'));
        }

        $branches = $this->getBranchesByLoginCode($loginCode, $ownerId);
        $branchIds = array_values(array_filter(array_map(
            static fn (array $branch): int => (int) ($branch['customer_id'] ?? 0),
            $branches
        )));
        $performanceByCustomerId = $branchIds ? $this->getOrderPerformanceByCustomerIds($branchIds) : [];

        $totalRevenue = 0.0;
        $totalOrders = 0;
        $totalCanceled = 0;

        $items = array_map(
            static function (array $branch) use ($performanceByCustomerId, &$totalRevenue, &$totalOrders, &$totalCanceled): array {
                $customerId = (int) ($branch['customer_id'] ?? 0);
                $performance = $performanceByCustomerId[$customerId] ?? [
                    'order_count' => 0,
                    'revenue' => 0.0,
                    'canceled_count' => 0,
                    'status_counts' => [],
                ];

                $orderCount = (int) ($performance['order_count'] ?? 0);
                $revenue = (float) ($performance['revenue'] ?? 0.0);
                $canceledCount = (int) ($performance['canceled_count'] ?? 0);
                $averageOrderValue = $orderCount > 0 ? $revenue / $orderCount : 0.0;

                $totalRevenue += $revenue;
                $totalOrders += $orderCount;
                $totalCanceled += $canceledCount;

                return [
                    'customer_id' => $customerId,
                    'branch_name' => (string) ($branch['branch_name'] ?? ''),
                    'email' => (string) ($branch['email'] ?? ''),
                    'account_status' => (string) ($branch['status'] ?? ''),
                    'order_count' => $orderCount,
                    'revenue' => round($revenue, 2),
                    'average_order_value' => round($averageOrderValue, 2),
                    'canceled_order_count' => $canceledCount,
                    'status_counts' => $performance['status_counts'] ?? [],
                ];
            },
            $branches
        );

        return [
            'success' => true,
            'summary' => [
                'branch_count' => count($branches),
                'order_count' => $totalOrders,
                'revenue' => round($totalRevenue, 2),
                'average_order_value' => $totalOrders > 0 ? round($totalRevenue / $totalOrders, 2) : 0.0,
                'canceled_order_count' => $totalCanceled,
            ],
            'items' => $items,
        ];
    }

    private function getOrderPerformanceByCustomerIds(array $customerIds): array
    {
        $connection = $this->resourceConnection->getConnection();
        $orderTable = $this->resourceConnection->getTableName(self::ORDER_TABLE);

        $rows = $connection->fetchAll(
            $connection->select()
                ->from($orderTable, [
                    'customer_id',
                    'status',
                    'order_count' => new \Zend_Db_Expr('COUNT(entity_id)'),
                    'revenue' => new \Zend_Db_Expr('COALESCE(SUM(base_grand_total), 0)'),
                ])
                ->where('customer_id IN (?)', $customerIds)
                ->group(['customer_id', 'status'])
        );

        $result = [];
        foreach ($rows as $row) {
            $customerId = (int) ($row['customer_id'] ?? 0);
            if ($customerId <= 0) {
                continue;
            }

            $status = (string) ($row['status'] ?? '');
            $orderCount = (int) ($row['order_count'] ?? 0);
            $revenue = (float) ($row['revenue'] ?? 0);

            if (!isset($result[$customerId])) {
                $result[$customerId] = [
                    'order_count' => 0,
                    'revenue' => 0.0,
                    'canceled_count' => 0,
                    'status_counts' => [],
                ];
            }

            $result[$customerId]['order_count'] += $orderCount;
            $result[$customerId]['revenue'] += $revenue;
            $result[$customerId]['status_counts'][$status] = $orderCount;
            if (in_array(strtolower($status), ['canceled', 'closed'], true)) {
                $result[$customerId]['canceled_count'] += $orderCount;
            }
        }

        return $result;
    }

    private function getBranchesByLoginCode(string $loginCode, int $ownerId): array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::REGISTRATION_TABLE);

        $rows = $connection->fetchAll(
            $connection->select()
                ->from($tableName, [
                    'customer_id',
                    'email',
                    'full_name',
                    'unit_nickname',
                    'status',
                ])
                ->where('login_code = ?', $loginCode)
                ->where('customer_id <> ?', $ownerId)
                ->order('registration_id ASC')
        );

        if (!is_array($rows)) {
            return [];
        }

        return array_map(
            static fn (array $row): array => [
                'customer_id' => (int) ($row['customer_id'] ?? 0),
                'email' => (string) ($row['email'] ?? ''),
                'branch_name' => (string) (($row['unit_nickname'] ?? '') ?: ($row['full_name'] ?? '')),
                'status' => (string) ($row['status'] ?? ''),
            ],
            $rows
        );
    }

    private function getRegistrationByCustomerId(int $customerId): ?array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::REGISTRATION_TABLE);

        $row = $connection->fetchRow(
            $connection->select()
                ->from($tableName, ['customer_id', 'login_code'])
                ->where('customer_id = ?', $customerId)
                ->limit(1)
        );

        return is_array($row) ? $row : null;
    }

    private function getCustomerIdFromRequest(): int
    {
        $token = $this->extractToken();
        if ($token === '') {
            throw new AuthorizationException(__('Ban can dang nhap de xem bao cao co so.'));
        }

        $tokenModel = $this->tokenFactory->create()->loadByToken($token);
        $customerId = (int) $tokenModel->getCustomerId();
        if ($customerId <= 0) {
            throw new AuthorizationException(__('Token khong hop le hoac da het han.'));
        }

        return $customerId;
    }

    private function extractToken(): string
    {
        $header = trim((string) ($this->request->getHeader(self::AUTH_HEADER) ?? ''));
        if ($header !== '' && preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
            return trim((string) ($matches[1] ?? ''));
        }

        $payload = $this->getJsonPayload();
        return trim((string) ($payload['token'] ?? ($payload['payload']['token'] ?? '')));
    }

    private function getJsonPayload(): array
    {
        $content = (string) $this->request->getContent();
        if ($content === '') {
            return [];
        }

        $data = json_decode($content, true);
        return is_array($data) ? $data : [];
    }

    private function isOwnerCustomer(\Magento\Customer\Api\Data\CustomerInterface $customer): bool
    {
        $isOwnerAttr = $customer->getCustomAttribute('is_owner');
        $isSuperAttr = $customer->getCustomAttribute('is_super_admin');
        $roleAttr = $customer->getCustomAttribute('tmdt_role');
        $isOwner = $isOwnerAttr ? $this->normalizeBool($isOwnerAttr->getValue()) : false;
        $isSuper = $isSuperAttr ? $this->normalizeBool($isSuperAttr->getValue()) : false;
        $role = $roleAttr ? strtolower(trim((string) $roleAttr->getValue())) : '';
        return $role !== 'branch' && ($isOwner || $isSuper || $role === '' || $role === 'manager' || $role === 'seller');
    }

    private function normalizeBool(mixed $value): bool
    {
        $normalized = strtolower(trim((string) $value));
        return $normalized === '1' || $normalized === 'true' || $normalized === 'yes';
    }
}
