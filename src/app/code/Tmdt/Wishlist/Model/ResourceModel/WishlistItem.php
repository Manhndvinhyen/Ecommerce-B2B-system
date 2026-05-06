<?php
namespace Tmdt\Wishlist\Model\ResourceModel;

use Magento\Framework\Model\ResourceModel\Db\AbstractDb;

class WishlistItem extends AbstractDb
{
    protected function _construct()
    {
        $this->_init('tmdt_wishlist_item', 'item_id');
    }
}
