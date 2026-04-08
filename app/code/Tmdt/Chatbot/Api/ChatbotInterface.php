<?php
namespace Tmdt\Chatbot\Api;

interface ChatbotInterface
{
    /**
     * Nhận câu hỏi từ khách và trả về câu trả lời
     * (Magento sẽ tự động đọc đoạn chú thích @param và @return này để hiểu kiểu dữ liệu)
     *
     * @param string $message
     * @return string
     */
    public function ask($message);
}