<?php

namespace Tmdt\Registration\Api;

interface GoogleLoginInterface
{
    /**
     * @return array
     */
    public function save(): array;
}
