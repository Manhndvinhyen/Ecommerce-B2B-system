<?php
declare(strict_types=1);

namespace Tmdt\Rfq\Api;

interface RfqManagementInterface
{
    /**
     * Create a new Request For Quotation (RFQ).
     *
     * @param string $productName
     * @param float $quantity
     * @param string $unit
     * @param float $desiredPrice
     * @param string $shippingAddress
     * @param string $deliveryDate
     * @param string $expiryDate
     * @return mixed[]
     */
    public function createRfq(
        string $productName,
        float $quantity,
        string $unit,
        float $desiredPrice,
        string $shippingAddress,
        string $deliveryDate,
        string $expiryDate
    ): array;

    /**
     * List RFQs created by the currently logged-in buyer.
     *
     * @return mixed[]
     */
    public function getBuyerRfqs(): array;

    /**
     * List all active open RFQs (for sellers).
     *
     * @return mixed[]
     */
    public function getOpenRfqs(): array;

    /**
     * Submit a quote bid for an RFQ (for sellers).
     *
     * @param int $rfqId
     * @param float $price
     * @param float $quantity
     * @param string $deliveryDate
     * @param string|null $note
     * @return mixed[]
     */
    public function submitQuote(
        int $rfqId,
        float $price,
        float $quantity,
        string $deliveryDate,
        ?string $note = null
    ): array;

    /**
     * List all quotes submitted for a specific RFQ (for the buyer).
     *
     * @param int $rfqId
     * @return mixed[]
     */
    public function getQuotesForRfq(int $rfqId): array;

    /**
     * List quotes submitted by the currently logged-in seller.
     *
     * @return mixed[]
     */
    public function getSellerQuotes(): array;

    /**
     * Accept a seller's quote, closing the RFQ and automatically creating a B2B order.
     *
     * @param int $quoteId
     * @return mixed[]
     */
    public function acceptQuote(int $quoteId): array;

    /**
     * Add a message/comment to an RFQ negotiation thread.
     *
     * @param int $rfqId
     * @param string $message
     * @param int|null $quoteId
     * @return mixed[]
     */
    public function addRfqMessage(int $rfqId, string $message, ?int $quoteId = null): array;

    /**
     * Retrieve the negotiation chat logs for a specific RFQ thread.
     *
     * @param int $rfqId
     * @param int|null $quoteId
     * @return mixed[]
     */
    public function getRfqMessages(int $rfqId, ?int $quoteId = null): array;
}
