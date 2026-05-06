<?php
namespace Tmdt\Wishlist\Model\ResourceModel\WishlistItem;

use Magento\Framework\Model\ResourceModel\Db\Collection\AbstractCollection;

class Collection extends AbstractCollection
{
    protected function _construct()
    {
        $this->_init(
            \Tmdt\Wishlist\Model\WishlistItem::class,
            \Tmdt\Wishlist\Model\ResourceModel\WishlistItem::class
        );
    }
}
