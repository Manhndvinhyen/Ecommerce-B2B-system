<?php
namespace Tmdt\Wishlist\Model\Data;

use Magento\Framework\DataObject;
use Tmdt\Wishlist\Api\Data\WishlistListInterface;

class WishlistList extends DataObject implements WishlistListInterface
{
    public function getId()
    {
        return $this->getData(self::ID);
    }

    public function setId($id)
    {
        return $this->setData(self::ID, $id);
    }

    public function getName()
    {
        return $this->getData(self::NAME);
    }

    public function setName($name)
    {
        return $this->setData(self::NAME, $name);
    }

    public function getItemCount()
    {
        return $this->getData(self::ITEM_COUNT);
    }

    public function setItemCount($count)
    {
        return $this->setData(self::ITEM_COUNT, $count);
    }
}
