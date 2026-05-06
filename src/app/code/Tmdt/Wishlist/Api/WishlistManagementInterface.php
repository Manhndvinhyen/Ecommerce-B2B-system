<?php
namespace Tmdt\Wishlist\Api;

use Tmdt\Wishlist\Api\Data\WishlistListInterface;
use Tmdt\Wishlist\Api\Data\WishlistItemInterface;

interface WishlistManagementInterface
{
    /**
     * @return \Tmdt\Wishlist\Api\Data\WishlistListInterface[]
     */
    public function getLists();

    /**
     * @param string $listId
     * @return \Tmdt\Wishlist\Api\Data\WishlistItemInterface[]
     */
    public function getListItems($listId);

    /**
     * @param string $name
     * @return \Tmdt\Wishlist\Api\Data\WishlistListInterface
     */
    public function createList($name);

    /**
     * @param string $itemId
     * @return bool
     */
    public function removeItem($itemId);

    /**
     * @param string $listId
     * @param string $sku
     * @param string $name
     * @param float $price
     * @param string $unit
     * @param string|null $image
     * @param string|null $category
     * @return \Tmdt\Wishlist\Api\Data\WishlistItemInterface
     */
    public function addItem($listId, $sku, $name, $price, $unit, $image = null, $category = null);
}
