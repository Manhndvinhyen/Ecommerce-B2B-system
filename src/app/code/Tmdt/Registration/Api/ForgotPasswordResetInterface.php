<?php

namespace Tmdt\Registration\Api;

interface ForgotPasswordResetInterface
{
    /**
     * Verify OTP and set a new password.
     *
     * @return array
     */
    public function save(): array;
}
