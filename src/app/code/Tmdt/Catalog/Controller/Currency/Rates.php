<?php
declare(strict_types=1);

namespace Tmdt\Catalog\Controller\Currency;

use Magento\Framework\App\Action\HttpGetActionInterface;
use Magento\Framework\Controller\Result\JsonFactory;
use Psr\Log\LoggerInterface;

/**
 * Fetch and cache Vietcombank Exchange Rates
 * Route: /tmdt/currency/rates
 */
class Rates implements HttpGetActionInterface
{
    private const VCB_URL = 'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx?b=68';
    private const CACHE_LIFETIME = 1800; // 30 minutes

    public function __construct(
        private readonly JsonFactory $jsonFactory,
        private readonly LoggerInterface $logger
    ) {}

    public function execute()
    {
        $result = $this->jsonFactory->create();
        $result->setHeader('Access-Control-Allow-Origin', '*');
        $result->setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        $result->setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
        $cacheFile = BP . '/var/vcb_rates.json';

        // Try to read from cache first
        if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < self::CACHE_LIFETIME)) {
            $cachedContent = file_get_contents($cacheFile);
            if ($cachedContent) {
                $data = json_decode($cachedContent, true);
                if (json_last_error() === JSON_ERROR_NONE && !empty($data)) {
                    return $result->setData($data);
                }
            }
        }

        // Cache expired or not found, fetch from Vietcombank
        try {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, self::VCB_URL);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 15);
            curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            // Bypass SSL verification in case local certificates are outdated
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

            $xmlContent = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode !== 200 || !$xmlContent) {
                throw new \Exception("Failed to fetch XML from Vietcombank. HTTP Code: {$httpCode}");
            }

            // Parse XML
            $xml = simplexml_load_string($xmlContent);
            if ($xml === false) {
                throw new \Exception("Failed to parse Vietcombank XML content.");
            }

            $rates = [];
            $dateTime = (string)$xml->DateTime;

            foreach ($xml->Exrate as $exrate) {
                $code = strtoupper(trim((string)$exrate['CurrencyCode']));
                if (!$code) {
                    continue;
                }

                $rates[$code] = [
                    'name'     => trim((string)$exrate['CurrencyName']),
                    'buy'      => $this->cleanPriceValue((string)$exrate['Buy']),
                    'transfer' => $this->cleanPriceValue((string)$exrate['Transfer']),
                    'sell'     => $this->cleanPriceValue((string)$exrate['Sell']),
                ];
            }

            // Always add VND to the rates list with 1:1 mapping
            $rates['VND'] = [
                'name'     => 'VIETNAMESE DONG',
                'buy'      => 1.0,
                'transfer' => 1.0,
                'sell'     => 1.0
            ];

            $output = [
                'success'    => true,
                'updated_at' => $dateTime ?: date('Y-m-d H:i:s'),
                'rates'      => $rates
            ];

            // Save to cache file (create directory if it doesn't exist)
            $dir = dirname($cacheFile);
            if (!is_dir($dir)) {
                mkdir($dir, 0777, true);
            }
            file_put_contents($cacheFile, json_encode($output, JSON_PRETTY_PRINT));

            return $result->setData($output);

        } catch (\Throwable $e) {
            $this->logger->error("[VCB Rates] Error fetching exchange rates: " . $e->getMessage());

            // Fallback to cache even if expired
            if (file_exists($cacheFile)) {
                $cachedContent = file_get_contents($cacheFile);
                if ($cachedContent) {
                    $data = json_decode($cachedContent, true);
                    if (json_last_error() === JSON_ERROR_NONE && !empty($data)) {
                        // Mark it as from stale cache
                        $data['stale'] = true;
                        return $result->setData($data);
                    }
                }
            }

            return $result->setData([
                'success' => false,
                'message' => 'Unable to fetch exchange rates: ' . $e->getMessage()
            ]);
        }
    }

    private function cleanPriceValue(string $val): float
    {
        $cleaned = str_replace(',', '', trim($val));
        if ($cleaned === '-' || $cleaned === '') {
            return 0.0;
        }
        return (float)$cleaned;
    }
}
