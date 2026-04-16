<?php

namespace Tmdt\Registration\Api;

interface RegisterInterface
{
    /**
     * @return array
     */
    public function save(): array;
}