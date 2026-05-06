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

    public function getId();

    public function setId($id);

    public function getListId();

    public function setListId($listId);

    public function getSku();

    public function setSku($sku);

    public function getName();

    public function setName($name);

    public function getPrice();

    public function setPrice($price);

    public function getUnit();

    public function setUnit($unit);

    public function getImage();

    public function setImage($image);

    public function getCategory();

    public function setCategory($category);
}
