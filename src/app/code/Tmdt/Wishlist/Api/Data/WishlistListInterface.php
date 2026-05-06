<?php
namespace Tmdt\Wishlist\Api\Data;

interface WishlistListInterface
{
    public const ID = 'id';
    public const NAME = 'name';
    public const ITEM_COUNT = 'item_count';

    /**
     * @return string|null
     */
    public function getId();

    /**
     * @param string $id
     * @return $this
     */
    public function setId($id);

    /**
     * @return string|null
     */
    public function getName();

    /**
     * @param string $name
     * @return $this
     */
    public function setName($name);

    /**
     * @return int|null
     */
    public function getItemCount();

    /**
     * @param int $count
     * @return $this
     */
    public function setItemCount($count);
}
