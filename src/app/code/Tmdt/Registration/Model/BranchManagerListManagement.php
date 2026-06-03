<?php

declare(strict_types=1);

namespace Tmdt\Registration\Model;

use Magento\Customer\Api\CustomerRepositoryInterface;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Exception\AuthorizationException;
use Magento\Framework\Exception\InputException;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Integration\Model\Oauth\TokenFactory;
use Tmdt\Registration\Api\BranchManagerListInterface;

class BranchManagerListManagement implements BranchManagerListInterface
{
    private const TABLE_NAME = 'tmdt_customer_registration';
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
            throw new AuthorizationException(__('Ban khong co quyen xem danh sach co so.'));
        }

        $ownerRegistration = $this->getRegistrationByCustomerId($ownerId);
        if (!$ownerRegistration) {
            throw new InputException(__('Khong tim thay thong tin nha hang.'));
        }

        $loginCode = trim((string) ($ownerRegistration['login_code'] ?? ''));
        if ($loginCode === '') {
            throw new InputException(__('Khong tim thay ma nha hang.'));
        }

        $items = $this->getManagersByLoginCode($loginCode, $ownerId);

        return [
            'success' => true,
            'items' => $items,
        ];
    }

    private function getManagersByLoginCode(string $loginCode, int $ownerId): array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $rows = $connection->fetchAll(
            $connection->select()
                ->from($tableName, [
                    'customer_id',
                    'email',
                    'full_name',
                    'unit_nickname',
                    'phone_number',
                    'status',
                    'created_at',
                ])
                ->where('login_code = ?', $loginCode)
                ->where('customer_id <> ?', $ownerId)
                ->order('registration_id DESC')
        );

        if (!is_array($rows)) {
            return [];
        }

        return array_map(
            static function (array $row): array {
                return [
                    'customer_id' => (int) ($row['customer_id'] ?? 0),
                    'email' => (string) ($row['email'] ?? ''),
                    'full_name' => (string) ($row['full_name'] ?? ''),
                    'branch_name' => (string) ($row['unit_nickname'] ?? ''),
                    'phone_number' => (string) ($row['phone_number'] ?? ''),
                    'status' => (string) ($row['status'] ?? ''),
                    'created_at' => (string) ($row['created_at'] ?? ''),
                ];
            },
            $rows
        );
    }

    private function getRegistrationByCustomerId(int $customerId): ?array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

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
            throw new AuthorizationException(__('Ban can dang nhap de xem danh sach co so.'));
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
