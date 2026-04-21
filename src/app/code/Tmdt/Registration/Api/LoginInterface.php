<?php

namespace Tmdt\Registration\Api;

interface LoginInterface
{
    /**
     * @return array
     */
    public function save(): array;
}