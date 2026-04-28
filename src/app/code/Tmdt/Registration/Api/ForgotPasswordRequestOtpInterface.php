<?php

namespace Tmdt\Registration\Api;

interface ForgotPasswordRequestOtpInterface
{
    /**
     * Request OTP code for password reset.
     *
     * @return array
     */
    public function save(): array;
}
