<?php

declare(strict_types=1);

namespace Tmdt\Chatbot\Model;

use Magento\Catalog\Model\Product\Attribute\Source\Status;
use Magento\Catalog\Model\Product\Visibility;
use Magento\Catalog\Model\ResourceModel\Product\CollectionFactory as ProductCollectionFactory;
use Magento\Framework\App\CacheInterface;
use Magento\Framework\App\DeploymentConfig;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\Encryption\EncryptorInterface;
use Magento\Framework\UrlInterface;
use Magento\Store\Model\StoreManagerInterface;
use Tmdt\Chatbot\Api\ChatbotInterface;
use Tmdt\Search\Model\SearchDictionary;

class ChatbotManagement implements ChatbotInterface
{
    private const CACHE_TAG = 'tmdt_chatbot';
    private const REPLY_CACHE_TTL = 300;
    private const PRODUCT_LIMIT = 3;
    private const KEYWORD_LIMIT = 12;
    private const SEARCH_ATTRIBUTE = 'tmdt_search_keywords';

    private string $deepSeekModel = 'deepseek-chat';

    public function __construct(
        private readonly ProductCollectionFactory $productCollectionFactory,
        private readonly DeploymentConfig $deploymentConfig,
        private readonly ScopeConfigInterface $scopeConfig,
        private readonly EncryptorInterface $encryptor,
        private readonly StoreManagerInterface $storeManager,
        private readonly CacheInterface $cache,
        private readonly SearchDictionary $searchDictionary
    ) {
    }

    /**
     * @inheritdoc
     */
    public function ask($message): string
    {
        $message = trim((string) $message);
        if ($message === '') {
            return json_encode([
                'message' => 'Ban hay nhap nhu cau mua hang de minh goi y san pham phu hop nhe.',
                'products' => [],
            ], JSON_UNESCAPED_UNICODE);
        }

        $keywords = $this->buildSearchKeywords($message);
        $products = $this->findTopProducts($keywords, self::PRODUCT_LIMIT);
        $productInfo = $this->buildProductInfo($products);

        $replyCacheKey = 'chatbot_reply_' . md5($this->searchDictionary->normalize($message) . $productInfo);
        $cachedReply = $this->cache->load($replyCacheKey);
        if ($cachedReply !== false) {
            $reply = $cachedReply;
        } else {
            $reply = $this->buildReply($message, $keywords, $productInfo);
            $this->cache->save($reply, $replyCacheKey, [self::CACHE_TAG], self::REPLY_CACHE_TTL);
        }

        return json_encode([
            'message' => $reply,
            'products' => $products,
        ], JSON_UNESCAPED_UNICODE);
    }

    private function buildSearchKeywords(string $message): array
    {
        $normalized = $this->searchDictionary->normalize($message);
        $terms = [$message, $normalized];

        foreach (preg_split('/\s+/', $normalized) ?: [] as $part) {
            $part = trim((string) $part);
            if (mb_strlen($part) >= 3) {
                $terms[] = $part;
            }
        }

        preg_match_all('/[\p{L}\p{N}\s_-]{2,}/u', $message, $matches);
        foreach ($matches[0] ?? [] as $phrase) {
            $phrase = trim((string) $phrase);
            if ($phrase !== '') {
                $terms[] = $phrase;
            }
        }

        return array_slice($this->searchDictionary->expand($terms), 0, self::KEYWORD_LIMIT);
    }

    private function findTopProducts(array $keywords, int $limit): array
    {
        $filters = [];
        foreach ($keywords as $keyword) {
            $keyword = trim((string) $keyword);
            if ($keyword === '') {
                continue;
            }
            $filters[] = ['attribute' => 'name', 'like' => '%' . $keyword . '%'];
            $filters[] = ['attribute' => 'sku', 'like' => '%' . $keyword . '%'];
            $filters[] = ['attribute' => self::SEARCH_ATTRIBUTE, 'like' => '%' . $keyword . '%'];
        }

        if (empty($filters)) {
            return [];
        }

        $collection = $this->productCollectionFactory->create();
        $collection->addAttributeToSelect([
            'name',
            'sku',
            'price',
            'url_key',
            'thumbnail',
            'small_image',
            'short_description',
            self::SEARCH_ATTRIBUTE,
        ]);
        $collection->addAttributeToFilter('status', Status::STATUS_ENABLED);
        $collection->addAttributeToFilter('visibility', ['in' => [
            Visibility::VISIBILITY_IN_CATALOG,
            Visibility::VISIBILITY_IN_SEARCH,
            Visibility::VISIBILITY_BOTH,
        ]]);
        $collection->addAttributeToFilter($filters);
        $collection->setPageSize(30);

        $scored = [];
        foreach ($collection as $product) {
            $score = $this->scoreProduct($product, $keywords);
            if ($score <= 0) {
                continue;
            }
            $scored[] = [
                'score' => $score,
                'product' => $product,
            ];
        }

        usort($scored, static fn (array $a, array $b): int => $b['score'] <=> $a['score']);

        $products = [];
        foreach (array_slice($scored, 0, $limit) as $item) {
            $products[] = $this->formatProduct($item['product']);
        }

        return $products;
    }

    private function scoreProduct(object $product, array $keywords): int
    {
        $name = $this->searchDictionary->normalize((string) $product->getName());
        $sku = $this->searchDictionary->normalize((string) $product->getSku());
        $searchKeywords = $this->searchDictionary->normalize((string) $product->getData(self::SEARCH_ATTRIBUTE));

        $score = 0;
        foreach ($keywords as $keyword) {
            $needle = $this->searchDictionary->normalize((string) $keyword);
            if ($needle === '') {
                continue;
            }
            if ($name === $needle) {
                $score += 80;
            } elseif (str_contains($name, $needle)) {
                $score += 45;
            }
            if ($sku === $needle || str_contains($sku, $needle)) {
                $score += 30;
            }
            if (str_contains($searchKeywords, $needle)) {
                $score += 25;
            }
        }

        return $score;
    }

    private function formatProduct(object $product): array
    {
        $baseUrl = $this->storeManager->getStore()->getBaseUrl(UrlInterface::URL_TYPE_WEB);
        $mediaBaseUrl = $this->storeManager->getStore()->getBaseUrl(UrlInterface::URL_TYPE_MEDIA);
        $query = http_build_query([
            'view' => 'product',
            'id' => (int) $product->getId(),
            'sku' => (string) $product->getSku(),
        ]);
        $url = rtrim($baseUrl, '/') . '/react/index.html?' . $query;

        $imagePath = (string) ($product->getData('small_image') ?: $product->getData('thumbnail') ?: '');
        $image = ($imagePath !== '' && $imagePath !== 'no_selection')
            ? rtrim($mediaBaseUrl, '/') . '/catalog/product' . $imagePath
            : '';

        return [
            'name' => (string) $product->getName(),
            'price' => number_format((float) $product->getPrice(), 0, ',', '.') . ' VND',
            'url' => $url,
            'image' => $image,
        ];
    }

    private function buildProductInfo(array $products): string
    {
        $lines = [];
        foreach ($products as $product) {
            $lines[] = '- ' . $product['name'] . ' | Gia: ' . $product['price'];
        }

        return implode("\n", $lines);
    }

    private function buildReply(string $message, array $keywords, string $productInfo): string
    {
        if ($productInfo === '') {
            $fallback = 'Minh chua tim thay san pham that su phu hop voi yeu cau nay. Ban co the thu noi ro hon ten mat hang, loai nguyen lieu hoac muc gia mong muon.';
            $aiReply = $this->callDeepSeek(
                'Khach hoi: "' . $message . '". He thong khong tim thay san pham phu hop voi cac tu khoa: '
                . implode(', ', array_slice($keywords, 0, 5))
                . '. Hay xin loi ngan gon va goi y khach thu tu khoa khac. Tra loi bang tieng Viet.',
                256,
                0.5
            );

            return $aiReply ?: $fallback;
        }

        $aiReply = $this->callDeepSeek(
            'Ban la nhan vien tu van ban hang B2B. Khach hoi: "' . $message . "\".\n"
            . "Top 3 san pham lien quan nhat:\n" . $productInfo . "\n"
            . 'Hay tra loi ngan gon 2-4 cau bang tieng Viet, giai thich vi sao cac san pham nay phu hop. Khong lap lai link vi he thong hien thi the san pham rieng.',
            512,
            0.7
        );

        if ($aiReply) {
            return $aiReply;
        }

        return 'Minh da tim thay 3 san pham phu hop nhat voi nhu cau cua ban. Ban co the xem nhanh cac san pham ben duoi de so sanh gia va chon mat hang phu hop.';
    }

    private function callDeepSeek(string $prompt, int $maxTokens = 512, float $temperature = 0.7): ?string
    {
        $apiKey = $this->getDeepSeekApiKey();
        if ($apiKey === '') {
            return null;
        }

        $payload = json_encode([
            'model' => $this->deepSeekModel,
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
            'temperature' => $temperature,
            'max_tokens' => $maxTokens,
        ], JSON_UNESCAPED_UNICODE);

        if (!is_string($payload)) {
            return null;
        }

        $result = $this->doCurlPost('https://api.deepseek.com/chat/completions', $payload, $apiKey);
        if ($result === null) {
            return null;
        }

        $decoded = json_decode($result, true);
        return isset($decoded['choices'][0]['message']['content'])
            ? trim((string) $decoded['choices'][0]['message']['content'])
            : null;
    }

    private function doCurlPost(string $url, string $payload, string $apiKey): ?string
    {
        $ch = curl_init($url);
        if ($ch === false) {
            return null;
        }

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
                'Content-Length: ' . strlen($payload),
            ],
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        $response = curl_exec($ch);
        $errno = curl_errno($ch);
        curl_close($ch);

        if ($errno !== 0 || $response === false) {
            return null;
        }

        return (string) $response;
    }

    private function getDeepSeekApiKey(): string
    {
        $apiKey = trim((string) $this->deploymentConfig->get('tmdt_chatbot/deepseek/api_key'));
        if ($apiKey === '') {
            $apiKey = trim((string) $this->scopeConfig->getValue('tmdt_chatbot/deepseek/api_key'));
        }

        if ($apiKey !== '' && !str_starts_with($apiKey, 'sk-')) {
            try {
                $decrypted = trim((string) $this->encryptor->decrypt($apiKey));
                if ($decrypted !== '') {
                    $apiKey = $decrypted;
                }
            } catch (\Throwable) {
                // Keep the configured value as-is when it was stored unencrypted.
            }
        }

        return $apiKey;
    }
}
