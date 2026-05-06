<?php
namespace Tmdt\Wishlist\Model\ResourceModel\WishlistList;

use Magento\Framework\Model\ResourceModel\Db\Collection\AbstractCollection;

class Collection extends AbstractCollection
{
    protected function _construct()
    {
        $this->_init(
            \Tmdt\Wishlist\Model\WishlistList::class,
            \Tmdt\Wishlist\Model\ResourceModel\WishlistList::class
        );
    }
}
