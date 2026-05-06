<?php
namespace Tmdt\Wishlist\Model;

use Magento\Framework\Model\AbstractModel;

class WishlistList extends AbstractModel
{
    protected function _construct()
    {
        $this->_init(\Tmdt\Wishlist\Model\ResourceModel\WishlistList::class);
    }
}
