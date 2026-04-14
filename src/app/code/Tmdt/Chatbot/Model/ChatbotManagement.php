<?php
namespace Tmdt\Chatbot\Model;

use Tmdt\Chatbot\Api\ChatbotInterface;
use Magento\Catalog\Api\ProductRepositoryInterface;
use Magento\Framework\Api\SearchCriteriaBuilder;
use Magento\Framework\App\DeploymentConfig;
use Magento\Store\Model\StoreManagerInterface;
use Magento\Framework\UrlInterface;
use Magento\Framework\App\CacheInterface;

class ChatbotManagement implements ChatbotInterface
{
    protected $productRepository;
    protected $searchCriteriaBuilder;
    protected $deploymentConfig;
    protected $storeManager;
    protected $cache;

    // Cache TTL: 10 phút cho intent, 5 phút cho reply
    private const INTENT_CACHE_TTL = 600;
    private const REPLY_CACHE_TTL  = 300;
    private const CACHE_TAG        = 'tmdt_chatbot';

    // Danh sách model theo thứ tự ưu tiên (fallback nếu model chính quá tải)
    // Lưu ý: gemini-2.0-flash không còn available với tài khoản mới (404)
    private $geminiModels = [
        'gemini-2.5-flash',        // Model chính — mạnh nhất
        'gemini-2.5-flash-lite',   // Backup nhẹ hơn
        'gemini-2.0-flash-lite',   // Fallback cuối
    ];

    public function __construct(
        ProductRepositoryInterface $productRepository,
        SearchCriteriaBuilder $searchCriteriaBuilder,
        DeploymentConfig $deploymentConfig,
        StoreManagerInterface $storeManager,
        CacheInterface $cache
    ) {
        $this->productRepository     = $productRepository;
        $this->searchCriteriaBuilder = $searchCriteriaBuilder;
        $this->deploymentConfig      = $deploymentConfig;
        $this->storeManager          = $storeManager;
        $this->cache                 = $cache;
    }

    /**
     * @inheritdoc
     */
    public function ask($message)
    {
        // ==========================================
        // BƯỚC 1: Gemini sinh danh sách TÊN SẢN PHẨM CỤ THỂ
        //
        // Cốt lõi của "semantic search không cần vector DB":
        // Thay vì AI sinh khái niệm trừu tượng ("nguyên liệu nấu canh"),
        // prompt yêu cầu sinh ra tên sản phẩm cụ thể có thể tồn tại trong DB
        // ("súp lơ", "bắp cải", "cà chua") → LIKE search sẽ khớp được.
        //
        // Cache key dựa trên message đã chuẩn hóa (lowercase, trim whitespace)
        // để cùng câu hỏi không gọi Gemini 2 lần.
        // ==========================================
        $normalizedMsg  = mb_strtolower(preg_replace('/\s+/', ' ', trim($message)));
        $intentCacheKey = 'chatbot_intent_' . md5($normalizedMsg);

        $intentResponse = null;

        // Đọc từ cache trước
        $cached = $this->cache->load($intentCacheKey);
        if ($cached !== false) {
            $intentResponse = $cached;
        } else {
            $intentPrompt = "Cửa hàng thực phẩm/tạp hóa VN. Khách: \"$message\"."
                . " Sinh TÊN SẢN PHẨM CỤ THỂ (1-3 từ) cửa hàng có thể bán đáp ứng nhu cầu."
                . " Gồm tên chính xác, đồng nghĩa, liên quan."
                . " VD 'nấu canh'→[\"bắp cải\",\"cà chua\",\"cà rốt\",\"thịt heo\"]"
                . " VD 'đồ ăn sáng'→[\"trứng\",\"bánh mì\",\"sữa\",\"xúc xích\"]"
                . " Tối đa 5 từ khóa. Trích max_price VNĐ nếu có, else 0."
                . " Chỉ JSON: {\"keywords\":[\"...\"],\"max_price\":0}. Không markdown.";

            $intentResponse = $this->callGemini($intentPrompt, 256, 0.1);

            // Lưu vào cache nếu hợp lệ
            if ($intentResponse && !str_starts_with($intentResponse, 'Lỗi')) {
                $this->cache->save($intentResponse, $intentCacheKey, [self::CACHE_TAG], self::INTENT_CACHE_TTL);
            }
        }

        // Fallback: tách từng từ trong câu để dùng làm keyword tìm kiếm
        $fallbackKeywords = array_values(array_filter(
            array_unique(explode(' ', preg_replace('/\s+/', ' ', trim($message))))
        ));

        $keywords = $fallbackKeywords ?: [$message];
        $maxPrice = 0;

        if ($intentResponse && !str_starts_with($intentResponse, 'Lỗi')) {
            $cleanJson  = preg_replace('/```json|```|\n/', '', $intentResponse);
            $intentData = json_decode(trim($cleanJson), true);

            if (isset($intentData['keywords']) && is_array($intentData['keywords'])) {
                $expanded = array_values(array_filter(
                    array_map('trim', $intentData['keywords'])
                ));
                if (!empty($expanded)) {
                    $keywords = $expanded;
                }
            }
            if (isset($intentData['max_price'])) {
                $maxPrice = (float)$intentData['max_price'];
            }
        }

        // ==========================================
        // BƯỚC 2: Multi-keyword search
        // Lần lượt tìm theo từng keyword, merge & deduplicate theo SKU.
        // Không filter status để tránh SQL error trên một số cấu hình Magento;
        // sản phẩm disabled thường bị filter ở collection layer tự động.
        // ==========================================
        $baseUrl      = $this->storeManager->getStore()->getBaseUrl(UrlInterface::URL_TYPE_WEB);
        $mediaBaseUrl = $this->storeManager->getStore()->getBaseUrl(UrlInterface::URL_TYPE_MEDIA);

        $seenSkus     = [];
        $productsData = [];
        $productInfo  = '';

        foreach (array_slice($keywords, 0, 5) as $kw) {
            $kw = trim($kw);
            if ($kw === '') {
                continue;
            }

            // Xây dựng search criteria cho từng keyword độc lập.
            // create() tự reset builder state sau khi trả về SearchCriteria.
            $this->searchCriteriaBuilder->addFilter('name', '%' . $kw . '%', 'like');
            if ($maxPrice > 0) {
                $this->searchCriteriaBuilder->addFilter('price', $maxPrice, 'lteq');
            }

            try {
                $criteria = $this->searchCriteriaBuilder->setPageSize(3)->create();
                $items    = $this->productRepository->getList($criteria)->getItems();
            } catch (\Exception $e) {
                // Nếu keyword này gây lỗi, bỏ qua và thử keyword tiếp theo
                continue;
            }

            foreach ($items as $product) {
                $sku = $product->getSku();
                if (isset($seenSkus[$sku])) {
                    continue;
                }
                if (count($productsData) >= 5) {
                    break 2;
                }

                $seenSkus[$sku] = true;

                $price  = number_format((float)$product->getPrice(), 0, ',', '.');
                $urlKey = $product->getUrlKey();
                $url    = rtrim($baseUrl, '/') . '/' . $urlKey . '.html';

                // Ảnh thumbnail
                $thumbAttr = $product->getCustomAttribute('thumbnail');
                $thumbPath = $thumbAttr ? (string)$thumbAttr->getValue() : '';
                $imageUrl  = ($thumbPath && $thumbPath !== 'no_selection')
                    ? rtrim($mediaBaseUrl, '/') . '/catalog/product' . $thumbPath
                    : '';

                // Short description cho ngữ cảnh RAG
                $descAttr  = $product->getCustomAttribute('short_description');
                $shortDesc = $descAttr
                    ? mb_substr(strip_tags((string)$descAttr->getValue()), 0, 120)
                    : '';

                $productsData[] = [
                    'name'  => $product->getName(),
                    'price' => $price . ' VNĐ',
                    'url'   => $url,
                    'image' => $imageUrl,
                ];

                $productInfo .= '- ' . $product->getName()
                    . ' | Giá: ' . $price . ' VNĐ'
                    . ($shortDesc ? ' | Mô tả: ' . $shortDesc : '')
                    . "\n";
            }
        }

        // ==========================================
        // BƯỚC 3: Gemini tư vấn dựa trên kết quả RAG
        // ==========================================
        if ($productInfo !== '') {
            $replyPrompt = "Bạn là nhân viên tư vấn bán hàng nhiệt tình và chuyên nghiệp."
                . " Khách hỏi: \"$message\"."
                . " Hệ thống đã tìm thấy các sản phẩm phù hợp:\n$productInfo\n"
                . "Hãy viết câu trả lời ngắn gọn (2-4 câu), thân thiện,"
                . " giải thích tại sao những sản phẩm này phù hợp với nhu cầu của khách."
                . " Danh sách thẻ sản phẩm kèm ảnh, giá, đường dẫn sẽ được hiển thị riêng bên dưới,"
                . " nên bạn KHÔNG cần liệt kê link hay giá cụ thể."
                . " Luôn trả lời bằng tiếng Việt.";
        } else {
            $replyPrompt = "Bạn là nhân viên tư vấn bán hàng."
                . " Khách hỏi: \"$message\"."
                . " Hệ thống đã tìm với các từ khóa: " . implode(', ', array_slice($keywords, 0, 5)) . "."
                . " Kết quả: KHÔNG có sản phẩm phù hợp trong kho."
                . " Hãy xin lỗi thân thiện, đề xuất khách thử từ khóa khác hoặc liên hệ nhân viên."
                . " Luôn trả lời bằng tiếng Việt.";
        }

        // Cache reply theo (message + danh sách sản phẩm tìm được)
        $replyCacheKey = 'chatbot_reply_' . md5($normalizedMsg . $productInfo);
        $finalAnswer   = false;

        $cachedReply = $this->cache->load($replyCacheKey);
        if ($cachedReply !== false) {
            $finalAnswer = $cachedReply;
        } else {
            $finalAnswer = $this->callGemini($replyPrompt, 512, 0.7);
            if ($finalAnswer && !str_starts_with($finalAnswer, 'Lỗi')) {
                $this->cache->save($finalAnswer, $replyCacheKey, [self::CACHE_TAG], self::REPLY_CACHE_TTL);
            }
        }

        $result = [
            'message'  => $finalAnswer
                ?: 'Dạ em đang gặp chút sự cố kết nối, anh/chị vui lòng hỏi lại sau giây lát nhé!',
            'products' => $productsData,
        ];

        return json_encode($result, JSON_UNESCAPED_UNICODE);
    }

    /**
     * Gọi Gemini API sử dụng native PHP curl với fallback model.
     * Thử lần lượt gemini-2.5-flash → gemini-2.5-flash-lite → gemini-2.0-flash-lite
     *
     * @param string $prompt
     * @param int    $maxTokens  Giới hạn output tokens (256 cho intent JSON, 512 cho reply)
     * @param float  $temperature 0.1 cho structured output, 0.7 cho creative reply
     * @return string|null
     */
    private function callGemini(string $prompt, int $maxTokens = 512, float $temperature = 0.7): ?string
    {
        $apiKey = $this->deploymentConfig->get('tmdt_chatbot/gemini/api_key');

        if (empty($apiKey)) {
            return 'Lỗi: Chưa cấu hình Gemini API Key trong file app/etc/env.php';
        }

        $payload = json_encode([
            'contents' => [
                ['parts' => [['text' => $prompt]]],
            ],
            'generationConfig' => [
                'temperature'     => $temperature,
                'maxOutputTokens' => $maxTokens,
                'candidateCount'  => 1,
            ],
        ]);

        foreach ($this->geminiModels as $modelName) {
            $url    = 'https://generativelanguage.googleapis.com/v1beta/models/'
                . $modelName . ':generateContent?key=' . $apiKey;
            $result = $this->doCurlPost($url, $payload);

            if ($result === null) {
                // Lỗi curl cứng — không thử model khác
                return 'Lỗi kết nối mạng đến Gemini API. Vui lòng kiểm tra internet server.';
            }

            $decoded = json_decode($result, true);

            // Thành công
            if (isset($decoded['candidates'][0]['content']['parts'][0]['text'])) {
                return $decoded['candidates'][0]['content']['parts'][0]['text'];
            }

            // Các lỗi có thể thử model tiếp theo:
            // 503 = quá tải, 429 = rate limit, 404 = model deprecated/not available
            $errorCode = $decoded['error']['code'] ?? 0;
            if (in_array($errorCode, [503, 429, 404])) {
                continue;
            }

            // Lỗi cấu hình thực sự (400 bad request, 403 forbidden...) → dừng ngay
            $errorMsg = $decoded['error']['message'] ?? 'Unknown error';
            return 'Lỗi Gemini [' . $errorCode . ']: ' . $errorMsg;
        }

        // Tất cả model đều quá tải
        return 'Hệ thống AI đang bận, vui lòng thử lại sau vài giây.';
    }

    /**
     * Thực hiện HTTP POST bằng native PHP curl.
     * Trả về chuỗi body phản hồi, hoặc null nếu lỗi curl cứng.
     *
     * @param string $url
     * @param string $payload JSON string
     * @return string|null
     */
    private function doCurlPost(string $url, string $payload): ?string
    {
        $ch = curl_init($url);
        if ($ch === false) {
            return null;
        }

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Content-Length: ' . strlen($payload),
            ],
            // SSL verification — bật true trong production (cần CA bundle)
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        $response = curl_exec($ch);
        $errno    = curl_errno($ch);
        curl_close($ch);

        if ($errno !== 0 || $response === false) {
            return null;
        }

        return (string)$response;
    }
}