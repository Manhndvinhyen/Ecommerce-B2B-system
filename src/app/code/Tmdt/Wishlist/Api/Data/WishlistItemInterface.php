<?php
namespace Tmdt\Wishlist\Api\Data;

interface WishlistItemInterface
{
    public const ID = 'id';
    public const LIST_ID = 'list_id';
    public const SKU = 'sku';
    public const NAME = 'name';
    public const PRICE = 'price';
    public const UNIT = 'unit';
    public const IMAGE = 'image';
    public const CATEGORY = 'category';

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
    public function getListId();

    /**
     * @param string $listId
     * @return $this
     */
    public function setListId($listId);

    /**
     * @return string|null
     */
    public function getSku();

    /**
     * @param string $sku
     * @return $this
     */
    public function setSku($sku);

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
     * @return float|null
     */
    public function getPrice();

    /**
     * @param float $price
     * @return $this
     */
    public function setPrice($price);

    /**
     * @return string|null
     */
    public function getUnit();

    /**
     * @param string $unit
     * @return $this
     */
    public function setUnit($unit);

    /**
     * @return string|null
     */
    public function getImage();

    /**
     * @param string $image
     * @return $this
     */
    public function setImage($image);

    /**
     * @return string|null
     */
    public function getCategory();

    /**
     * @param string $category
     * @return $this
     */
    public function setCategory($category);
}
