<?php

declare(strict_types=1);

namespace Tmdt\Registration\Model;

use Magento\Customer\Api\CustomerRepositoryInterface;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Exception\AlreadyExistsException;
use Magento\Framework\Exception\AuthorizationException;
use Magento\Framework\Exception\InputException;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Integration\Model\Oauth\TokenFactory;
use Magento\Store\Model\StoreManagerInterface;
use Tmdt\Registration\Api\BranchManagerUpdateInterface;

class BranchManagerUpdateManagement implements BranchManagerUpdateInterface
{
    private const TABLE_NAME = 'tmdt_customer_registration';
    private const AUTH_HEADER = 'Authorization';

    public function __construct(
        private readonly CustomerRepositoryInterface $customerRepository,
        private readonly ResourceConnection $resourceConnection,
        private readonly TokenFactory $tokenFactory,
        private readonly RestRequest $request,
        private readonly StoreManagerInterface $storeManager
    ) {
    }

    public function update(int $managerId): array
    {
        $ownerId = $this->getCustomerIdFromRequest();
        $owner = $this->customerRepository->getById($ownerId);
        if (!$this->isOwnerCustomer($owner)) {
            throw new AuthorizationException(__('Ban khong co quyen cap nhat nhan vien.'));
        }

        if ($managerId <= 0 || $managerId === $ownerId) {
            throw new InputException(__('Thong tin nhan vien khong hop le.'));
        }

        $bodyParams = $this->request->getBodyParams();
        $payload = is_array($bodyParams) && isset($bodyParams['payload']) ? $bodyParams['payload'] : $bodyParams;
        if (!is_array($payload)) {
            throw new InputException(__('Du lieu cap nhat khong hop le.'));
        }

        $email = array_key_exists('email', $payload) ? $this->normalizeEmail((string) $payload['email']) : '';
        $phoneNumber = array_key_exists('phoneNumber', $payload)
            ? $this->normalizePhone((string) $payload['phoneNumber'])
            : '';

        if ($email === '' && $phoneNumber === '') {
            throw new InputException(__('Khong co du lieu can cap nhat.'));
        }

        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InputException(__('Email khong hop le.'));
        }

        $ownerRegistration = $this->getRegistrationByCustomerId($ownerId);
        if (!$ownerRegistration) {
            throw new InputException(__('Khong tim thay thong tin nha hang.'));
        }

        $loginCode = trim((string) ($ownerRegistration['login_code'] ?? ''));
        if ($loginCode === '') {
            throw new InputException(__('Khong tim thay ma nha hang.'));
        }

        $managerRegistration = $this->getRegistrationByCustomerId($managerId);
        if (!$managerRegistration) {
            throw new InputException(__('Khong tim thay nhan vien.'));
        }

        $managerLoginCode = trim((string) ($managerRegistration['login_code'] ?? ''));
        if ($managerLoginCode !== $loginCode) {
            throw new AuthorizationException(__('Ban khong co quyen cap nhat nhan vien nay.'));
        }

        if ($email !== '' && $this->emailExists($email, $managerId)) {
            throw new InputException(__('Email da ton tai.'));
        }

        if ($phoneNumber !== '' && $this->phoneExists($phoneNumber, $managerId)) {
            throw new InputException(__('So dien thoai da ton tai.'));
        }

        $tableUpdate = [];

        if ($email !== '') {
            try {
                $customer = $this->customerRepository->getById($managerId);
                $customer->setEmail($email);
                $this->customerRepository->save($customer);
                $tableUpdate['email'] = $email;
            } catch (AlreadyExistsException) {
                throw new InputException(__('Email da ton tai.'));
            } catch (LocalizedException $exception) {
                $message = trim((string) $exception->getMessage());
                throw new InputException(__($message !== '' ? $message : 'Khong the cap nhat nhan vien.'));
            } catch (\Throwable) {
                throw new InputException(__('Khong the cap nhat nhan vien.'));
            }
        }

        if ($phoneNumber !== '') {
            $tableUpdate['phone_number'] = $phoneNumber;
        }

        if ($tableUpdate) {
            $connection = $this->resourceConnection->getConnection();
            $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);
            $connection->update($tableName, $tableUpdate, ['customer_id = ?' => $managerId]);
        }

        return [
            'success' => true,
            'message' => (string) __('Cap nhat nhan vien thanh cong.'),
        ];
    }

    private function getRegistrationByCustomerId(int $customerId): ?array
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $row = $connection->fetchRow(
            $connection->select()
                ->from($tableName)
                ->where('customer_id = ?', $customerId)
                ->order('registration_id ASC')
                ->limit(1)
        );

        return is_array($row) ? $row : null;
    }

    private function emailExists(string $email, int $excludeCustomerId): bool
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $row = $connection->fetchOne(
            $connection->select()
                ->from($tableName, ['customer_id'])
                ->where('LOWER(email) = ?', strtolower($email))
                ->where('customer_id <> ?', $excludeCustomerId)
                ->limit(1)
        );

        return (bool) $row;
    }

    private function phoneExists(string $phoneNumber, int $excludeCustomerId): bool
    {
        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);

        $row = $connection->fetchOne(
            $connection->select()
                ->from($tableName, ['customer_id'])
                ->where('phone_number = ?', $phoneNumber)
                ->where('customer_id <> ?', $excludeCustomerId)
                ->limit(1)
        );

        return (bool) $row;
    }

    private function getCustomerIdFromRequest(): int
    {
        $token = $this->extractToken();
        if ($token === '') {
            throw new AuthorizationException(__('Ban can dang nhap de cap nhat nhan vien.'));
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

    private function normalizePhone(string $value): string
    {
        return preg_replace('/\D+/', '', $value) ?? '';
    }

    private function normalizeEmail(string $value): string
    {
        return strtolower(trim($value));
    }

    private function isOwnerCustomer(\Magento\Customer\Api\Data\CustomerInterface $customer): bool
    {
        $isOwnerAttr = $customer->getCustomAttribute('is_owner');
        $isSuperAttr = $customer->getCustomAttribute('is_super_admin');
        $isOwner = $isOwnerAttr ? $this->normalizeBool($isOwnerAttr->getValue()) : false;
        $isSuper = $isSuperAttr ? $this->normalizeBool($isSuperAttr->getValue()) : false;
        return $isOwner || $isSuper;
    }

    private function normalizeBool(mixed $value): bool
    {
        $normalized = strtolower(trim((string) $value));
        return $normalized === '1' || $normalized === 'true' || $normalized === 'yes';
    }
}
