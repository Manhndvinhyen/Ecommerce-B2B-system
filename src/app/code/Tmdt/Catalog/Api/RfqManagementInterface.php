<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Api;

interface RfqManagementInterface
{
    /**
     * Create RFQ request for the authenticated buyer.
     *
     * @return mixed[]
     */
    public function createRequest(): array;

    /**
     * List RFQ requests visible to the authenticated seller.
     *
     * @return mixed[]
     */
    public function getSellerRequests(): array;

    /**
     * List RFQ requests created by the authenticated buyer.
     *
     * @return mixed[]
     */
    public function getBuyerRequests(): array;

    /**
     * Submit a seller quote for an RFQ request.
     *
     * @return mixed[]
     */
    public function submitQuote(): array;
}
