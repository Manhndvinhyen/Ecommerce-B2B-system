<?php
namespace Tmdt\Wishlist\Model\ResourceModel;

use Magento\Framework\Model\ResourceModel\Db\AbstractDb;

class WishlistList extends AbstractDb
{
    protected function _construct()
    {
        $this->_init('tmdt_wishlist_list', 'list_id');
    }
}
