<?php

declare(strict_types=1);

namespace Tmdt\Registration\Model;

use Magento\Authorization\Model\UserContextInterface;
use Magento\Customer\Api\CustomerRepositoryInterface;
use Magento\Customer\Api\Data\CustomerInterface;
use Magento\Framework\App\ResourceConnection;
use Magento\Framework\Exception\AuthorizationException;
use Magento\Framework\Exception\InputException;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Tmdt\Registration\Api\ProfileUpdateInterface;

class ProfileUpdateManagement implements ProfileUpdateInterface
{
    private const TABLE_NAME = 'tmdt_customer_registration';

    public function __construct(
        private readonly ResourceConnection $resourceConnection,
        private readonly RestRequest $request,
        private readonly CustomerRepositoryInterface $customerRepository,
        private readonly UserContextInterface $userContext
    ) {
    }

    public function save(): array
    {
        $customerId = (int) $this->userContext->getUserId();
        if ($customerId <= 0 || $this->userContext->getUserType() !== UserContextInterface::USER_TYPE_CUSTOMER) {
            throw new AuthorizationException(__('Ban can dang nhap de cap nhat thong tin.'));
        }

        $bodyParams = $this->request->getBodyParams();
        $payload = is_array($bodyParams) && isset($bodyParams['payload']) ? $bodyParams['payload'] : $bodyParams;

        if (!is_array($payload)) {
            throw new InputException(__('Du lieu cap nhat khong hop le.'));
        }

        $hasUpdate = false;
        $tableUpdate = [];

        $customer = $this->customerRepository->getById($customerId);

        if (array_key_exists('email', $payload)) {
            $email = $this->normalizeEmail((string) $payload['email']);
            if ($email === '') {
                throw new InputException(__('Email khong hop le.'));
            }
            $customer->setEmail($email);
            $tableUpdate['email'] = $email;
            $hasUpdate = true;
        }

        if (array_key_exists('fullName', $payload)) {
            $fullName = trim((string) $payload['fullName']);
            if ($fullName !== '') {
                [$firstName, $lastName] = $this->splitName($fullName);
                $customer->setFirstname($firstName);
                $customer->setLastname($lastName);
                $tableUpdate['full_name'] = $fullName;
                $hasUpdate = true;
            }
        }

        if (array_key_exists('phoneNumber', $payload)) {
            $phoneNumber = $this->normalizePhone((string) $payload['phoneNumber']);
            if ($phoneNumber !== '') {
                $tableUpdate['phone_number'] = $phoneNumber;
                $hasUpdate = true;
            }
        }

        if (array_key_exists('taxCode', $payload)) {
            $taxCode = $this->normalize((string) $payload['taxCode']);
            if ($taxCode !== '') {
                $customer->setTaxvat($taxCode);
                $tableUpdate['tax_code'] = $taxCode;
                $hasUpdate = true;
            }
        }

        if (array_key_exists('businessName', $payload)) {
            $businessName = trim((string) $payload['businessName']);
            if ($businessName !== '') {
                $this->setCustomAttribute($customer, 'tmdt_business_name', $businessName);
                $tableUpdate['business_name'] = $businessName;
                $hasUpdate = true;
            }
        }

        if (array_key_exists('registrationType', $payload)) {
            $registrationType = trim((string) $payload['registrationType']);
            if ($registrationType !== '') {
                $this->setCustomAttribute($customer, 'tmdt_registration_type', $registrationType);
                $tableUpdate['registration_type'] = $registrationType;
                $hasUpdate = true;
            }
        }

        if (array_key_exists('unitNickname', $payload)) {
            $unitNickname = trim((string) $payload['unitNickname']);
            if ($unitNickname !== '') {
                $this->setCustomAttribute($customer, 'tmdt_unit_nickname', $unitNickname);
                $tableUpdate['unit_nickname'] = $unitNickname;
                $hasUpdate = true;
            }
        }

        if (array_key_exists('loginCode', $payload)) {
            $loginCode = trim((string) $payload['loginCode']);
            if ($loginCode !== '') {
                $this->setCustomAttribute($customer, 'tmdt_login_code', $loginCode);
                $tableUpdate['login_code'] = $loginCode;
                $hasUpdate = true;
            }
        }

        if (array_key_exists('province', $payload)) {
            $tableUpdate['province'] = trim((string) $payload['province']);
            $hasUpdate = true;
        }

        if (array_key_exists('district', $payload)) {
            $tableUpdate['district'] = trim((string) $payload['district']);
            $hasUpdate = true;
        }

        if (array_key_exists('ward', $payload)) {
            $tableUpdate['ward'] = trim((string) $payload['ward']);
            $hasUpdate = true;
        }

        if (array_key_exists('detailAddress', $payload)) {
            $tableUpdate['detail_address'] = trim((string) $payload['detailAddress']);
            $hasUpdate = true;
        }

        if (!$hasUpdate) {
            throw new InputException(__('Khong co du lieu can cap nhat.'));
        }

        try {
            $this->customerRepository->save($customer);
        } catch (LocalizedException $exception) {
            throw $exception;
        } catch (\Exception $exception) {
            throw new LocalizedException(__('Khong the cap nhat thong tin khach hang.'));
        }

        $connection = $this->resourceConnection->getConnection();
        $tableName = $this->resourceConnection->getTableName(self::TABLE_NAME);
        $registrationId = $connection->fetchOne(
            $connection->select()
                ->from($tableName, ['registration_id'])
                ->where('customer_id = ?', $customerId)
                ->limit(1)
        );

        if (!$registrationId) {
            throw new LocalizedException(__('Khong tim thay du lieu dang ky cua khach hang.'));
        }

        if ($tableUpdate) {
            $connection->update($tableName, $tableUpdate, ['customer_id = ?' => $customerId]);
        }

        return [
            'success' => true,
            'message' => (string) __('Cap nhat thong tin thanh cong.'),
        ];
    }

    private function normalize(string $value): string
    {
        return trim((string) preg_replace('/\s+/', ' ', $value));
    }

    private function normalizeEmail(string $value): string
    {
        return mb_strtolower($this->normalize($value));
    }

    private function normalizePhone(string $value): string
    {
        return preg_replace('/\D+/', '', $value) ?? '';
    }

    private function splitName(string $fullName): array
    {
        $parts = preg_split('/\s+/', trim($fullName)) ?: [];
        if (!$parts) {
            return ['', ''];
        }
        if (count($parts) === 1) {
            return [$parts[0], ''];
        }
        $lastName = array_pop($parts);
        return [implode(' ', $parts), (string) $lastName];
    }

    private function setCustomAttribute(CustomerInterface $customer, string $code, string $value): void
    {
        $customer->setCustomAttribute($code, $value);
    }
}
