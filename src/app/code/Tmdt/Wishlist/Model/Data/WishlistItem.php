<?php
namespace Tmdt\Wishlist\Model\Data;

use Magento\Framework\DataObject;
use Tmdt\Wishlist\Api\Data\WishlistItemInterface;

class WishlistItem extends DataObject implements WishlistItemInterface
{
    public function getId()
    {
        return $this->getData(self::ID);
    }

    public function setId($id)
    {
        return $this->setData(self::ID, $id);
    }

    public function getListId()
    {
        return $this->getData(self::LIST_ID);
    }

    public function setListId($listId)
    {
        return $this->setData(self::LIST_ID, $listId);
    }

    public function getSku()
    {
        return $this->getData(self::SKU);
    }

    public function setSku($sku)
    {
        return $this->setData(self::SKU, $sku);
    }

    public function getName()
    {
        return $this->getData(self::NAME);
    }

    public function setName($name)
    {
        return $this->setData(self::NAME, $name);
    }

    public function getPrice()
    {
        return $this->getData(self::PRICE);
    }

    public function setPrice($price)
    {
        return $this->setData(self::PRICE, $price);
    }

    public function getUnit()
    {
        return $this->getData(self::UNIT);
    }

    public function setUnit($unit)
    {
        return $this->setData(self::UNIT, $unit);
    }

    public function getImage()
    {
        return $this->getData(self::IMAGE);
    }

    public function setImage($image)
    {
        return $this->setData(self::IMAGE, $image);
    }

    public function getCategory()
    {
        return $this->getData(self::CATEGORY);
    }

    public function setCategory($category)
    {
        return $this->setData(self::CATEGORY, $category);
    }
}
