<?php
namespace Tmdt\Wishlist\Model;

use Magento\Authorization\Model\UserContextInterface;
use Magento\Framework\Exception\AuthorizationException;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Phrase;
use Magento\Framework\Webapi\Rest\Request as RestRequest;
use Magento\Integration\Model\Oauth\TokenFactory;
use Tmdt\Wishlist\Api\WishlistManagementInterface;
use Tmdt\Wishlist\Api\Data\WishlistListInterfaceFactory;
use Tmdt\Wishlist\Api\Data\WishlistItemInterfaceFactory;
use Tmdt\Wishlist\Model\ResourceModel\WishlistList as WishlistListResource;
use Tmdt\Wishlist\Model\ResourceModel\WishlistItem as WishlistItemResource;
use Tmdt\Wishlist\Model\ResourceModel\WishlistList\CollectionFactory as ListCollectionFactory;
use Tmdt\Wishlist\Model\ResourceModel\WishlistItem\CollectionFactory as ItemCollectionFactory;

class WishlistManagement implements WishlistManagementInterface
{
    private UserContextInterface $userContext;
    private WishlistListInterfaceFactory $listDataFactory;
    private WishlistItemInterfaceFactory $itemDataFactory;
    private WishlistListFactory $listFactory;
    private WishlistItemFactory $itemFactory;
    private WishlistListResource $listResource;
    private WishlistItemResource $itemResource;
    private ListCollectionFactory $listCollectionFactory;
    private ItemCollectionFactory $itemCollectionFactory;
    private RestRequest $request;
    private TokenFactory $tokenFactory;

    public function __construct(
        UserContextInterface $userContext,
        WishlistListInterfaceFactory $listDataFactory,
        WishlistItemInterfaceFactory $itemDataFactory,
        WishlistListFactory $listFactory,
        WishlistItemFactory $itemFactory,
        WishlistListResource $listResource,
        WishlistItemResource $itemResource,
        ListCollectionFactory $listCollectionFactory,
        ItemCollectionFactory $itemCollectionFactory,
        RestRequest $request,
        TokenFactory $tokenFactory
    ) {
        $this->userContext = $userContext;
        $this->listDataFactory = $listDataFactory;
        $this->itemDataFactory = $itemDataFactory;
        $this->listFactory = $listFactory;
        $this->itemFactory = $itemFactory;
        $this->listResource = $listResource;
        $this->itemResource = $itemResource;
        $this->listCollectionFactory = $listCollectionFactory;
        $this->itemCollectionFactory = $itemCollectionFactory;
        $this->request = $request;
        $this->tokenFactory = $tokenFactory;
    }

    public function getLists()
    {
        $customerId = $this->getCustomerId();
        $collection = $this->listCollectionFactory->create();
        $collection->addFieldToFilter('customer_id', $customerId);
        $collection->setOrder('updated_at', 'DESC');

        $lists = [];
        foreach ($collection as $listModel) {
            $listId = (string)$listModel->getData('list_id');
            $itemCount = $this->itemCollectionFactory->create()
                ->addFieldToFilter('list_id', $listId)
                ->getSize();

            $listData = $this->listDataFactory->create();
            $listData->setId($listId);
            $listData->setName((string)$listModel->getData('name'));
            $listData->setItemCount((int)$itemCount);
            $lists[] = $listData;
        }

        return $lists;
    }

    public function getListItems($listId)
    {
        $this->assertListOwner($listId);

        $collection = $this->itemCollectionFactory->create();
        $collection->addFieldToFilter('list_id', $listId);
        $collection->setOrder('created_at', 'DESC');

        $items = [];
        foreach ($collection as $itemModel) {
            $itemData = $this->itemDataFactory->create();
            $itemData->setId((string)$itemModel->getData('item_id'));
            $itemData->setListId((string)$itemModel->getData('list_id'));
            $itemData->setSku((string)$itemModel->getData('sku'));
            $itemData->setName((string)$itemModel->getData('name'));
            $itemData->setPrice((float)$itemModel->getData('price'));
            $itemData->setUnit((string)$itemModel->getData('unit'));
            $itemData->setImage((string)$itemModel->getData('image'));
            $itemData->setCategory((string)$itemModel->getData('category'));
            $items[] = $itemData;
        }

        return $items;
    }

    public function createList($name)
    {
        $customerId = $this->getCustomerId();
        $name = trim((string)$name);
        if ($name === '') {
            throw new LocalizedException(new Phrase('Tên danh sách không được để trống.'));
        }

        $model = $this->listFactory->create();
        $model->setData('customer_id', $customerId);
        $model->setData('name', $name);
        $this->listResource->save($model);

        $listData = $this->listDataFactory->create();
        $listData->setId((string)$model->getData('list_id'));
        $listData->setName($name);
        $listData->setItemCount(0);
        return $listData;
    }

    public function removeItem($itemId)
    {
        $item = $this->itemFactory->create();
        $this->itemResource->load($item, $itemId);
        if (!$item->getId()) {
            throw new LocalizedException(new Phrase('Không tìm thấy sản phẩm trong wishlist.'));
        }

        $listId = (string)$item->getData('list_id');
        $this->assertListOwner($listId);
        $this->itemResource->delete($item);
        return true;
    }

    public function addItem($listId, $sku, $name, $price, $unit, $image = null, $category = null)
    {
        $this->assertListOwner((string)$listId);
        $sku = trim((string)$sku);
        $name = trim((string)$name);
        if ($sku === '' || $name === '') {
            throw new LocalizedException(new Phrase('SKU và tên sản phẩm là bắt buộc.'));
        }

        $model = $this->itemFactory->create();
        $model->setData('list_id', (int)$listId);
        $model->setData('sku', $sku);
        $model->setData('name', $name);
        $model->setData('price', (float)$price);
        $model->setData('unit', (string)$unit);
        $model->setData('image', (string)$image);
        $model->setData('category', (string)$category);
        $this->itemResource->save($model);

        $itemData = $this->itemDataFactory->create();
        $itemData->setId((string)$model->getData('item_id'));
        $itemData->setListId((string)$model->getData('list_id'));
        $itemData->setSku($sku);
        $itemData->setName($name);
        $itemData->setPrice((float)$price);
        $itemData->setUnit((string)$unit);
        $itemData->setImage((string)$image);
        $itemData->setCategory((string)$category);
        return $itemData;
    }

    private function getCustomerId(): int
    {
        if ($this->userContext->getUserType() !== UserContextInterface::USER_TYPE_CUSTOMER) {
            $token = $this->resolveBearerToken();
            if ($token === '') {
                throw new AuthorizationException(new Phrase('Yêu cầu đăng nhập.'));
            }

            $tokenModel = $this->tokenFactory->create()->loadByToken($token);
            $customerId = (int) $tokenModel->getCustomerId();
            if ($customerId <= 0) {
                throw new AuthorizationException(new Phrase('Yêu cầu đăng nhập.'));
            }

            return $customerId;
        }

        return (int)$this->userContext->getUserId();
    }

    private function resolveBearerToken(): string
    {
        $header = (string) $this->request->getHeader('Authorization');
        if ($header === '' && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $header = (string) $_SERVER['HTTP_AUTHORIZATION'];
        }

        if ($header === '') {
            return '';
        }

        if (stripos($header, 'Bearer ') === 0) {
            return trim(substr($header, 7));
        }

        return trim($header);
    }

    private function assertListOwner(string $listId): void
    {
        $customerId = $this->getCustomerId();
        $list = $this->listFactory->create();
        $this->listResource->load($list, $listId);
        if (!$list->getId() || (int)$list->getData('customer_id') !== $customerId) {
            throw new AuthorizationException(new Phrase('Không có quyền truy cập danh sách này.'));
        }
    }
}
