<?php
namespace Tmdt\Chatbot\Model;

use Tmdt\Chatbot\Api\ChatbotInterface;
use Magento\Catalog\Api\ProductRepositoryInterface;
use Magento\Framework\Api\SearchCriteriaBuilder;
use Magento\Framework\App\DeploymentConfig;

class ChatbotManagement implements ChatbotInterface
{
    protected $productRepository;
    protected $searchCriteriaBuilder;
    protected $deploymentConfig;

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
        DeploymentConfig $deploymentConfig
    ) {
        $this->productRepository     = $productRepository;
        $this->searchCriteriaBuilder = $searchCriteriaBuilder;
        $this->deploymentConfig      = $deploymentConfig;
    }

    /**
     * @inheritdoc
     */
    public function ask($message)
    {
        // ==========================================
        // BƯỚC 1: Dùng Gemini bóc tách yêu cầu khách hàng
        // ==========================================
        $intentPrompt = "Phân tích câu hỏi sau của khách: '$message'."
            . " Trích xuất từ khóa sản phẩm và mức giá tối đa (nếu có, tính bằng VNĐ)."
            . " Trả về CHỈ 1 chuỗi JSON định dạng: {\"keyword\": \"...\", \"max_price\": 0}."
            . " Tuyệt đối không thêm text hay markdown.";

        $intentResponse = $this->callGemini($intentPrompt);

        $keyword  = $message; // Mặc định nếu lỗi
        $maxPrice = 0;

        if ($intentResponse && !str_starts_with($intentResponse, 'Lỗi')) {
            $cleanJson  = preg_replace('/```json|```|\n/', '', $intentResponse);
            $intentData = json_decode(trim($cleanJson), true);
            if (isset($intentData['keyword']) && !empty($intentData['keyword'])) {
                $keyword = $intentData['keyword'];
            }
            if (isset($intentData['max_price'])) {
                $maxPrice = (float)$intentData['max_price'];
            }
        }

        // ==========================================
        // BƯỚC 2: Tìm kiếm trong Database Magento
        // ==========================================
        $this->searchCriteriaBuilder->addFilter('name', '%' . $keyword . '%', 'like');
        if ($maxPrice > 0) {
            $this->searchCriteriaBuilder->addFilter('price', $maxPrice, 'lteq');
        }
        $searchCriteria = $this->searchCriteriaBuilder->setPageSize(3)->create();
        $products       = $this->productRepository->getList($searchCriteria)->getItems();

        $productInfo = '';
        if (count($products) > 0) {
            foreach ($products as $product) {
                $price       = number_format((float)$product->getPrice(), 0, ',', '.');
                $urlKey      = $product->getUrlKey();
                $url         = 'http://localhost:8081/' . $urlKey . '.html';
                $productInfo .= '- Tên SP: ' . $product->getName()
                    . ' | Giá: ' . $price . ' VNĐ'
                    . ' | Link mua: ' . $url . "\n";
            }
        }

        // ==========================================
        // BƯỚC 3: Dùng Gemini "Đóng vai" tư vấn
        // ==========================================
        if ($productInfo !== '') {
            $replyPrompt = "Bạn là nhân viên tư vấn bán hàng nhiệt tình và chuyên nghiệp."
                . " Khách hỏi: '$message'."
                . " Trong kho hiện có các sản phẩm:\n$productInfo\n"
                . "Hãy viết câu trả lời ngắn gọn, thân thiện,"
                . " tư vấn sản phẩm phù hợp và giữ nguyên đường dẫn Link mua để khách bấm vào.";
        } else {
            $replyPrompt = "Bạn là nhân viên tư vấn bán hàng."
                . " Khách hỏi: '$message'."
                . " Trong kho KHÔNG có sản phẩm nào phù hợp với yêu cầu này."
                . " Hãy viết một câu xin lỗi thân thiện và gợi ý khách thử tìm kiếm bằng từ khóa khác.";
        }

        $finalAnswer = $this->callGemini($replyPrompt);

        return $finalAnswer
            ? $finalAnswer
            : 'Dạ em đang gặp chút sự cố kết nối, anh/chị vui lòng hỏi lại sau giây lát nhé!';
    }

    /**
     * Gọi Gemini API sử dụng native PHP curl với fallback model.
     * Thử lần lượt gemini-2.5-flash → gemini-2.0-flash → gemini-2.0-flash-lite
     *
     * @param string $prompt
     * @return string|null
     */
    private function callGemini(string $prompt): ?string
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
                'temperature'     => 0.7,
                'maxOutputTokens' => 1024,
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