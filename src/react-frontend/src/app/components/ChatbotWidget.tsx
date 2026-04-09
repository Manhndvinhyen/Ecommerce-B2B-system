// src/app/components/ChatbotWidget.tsx
// Chatbot AI tư vấn sản phẩm — gọi Magento REST API /rest/V1/chatbot/ask
import React, { useState, useRef, useEffect } from 'react';

// ========== TYPES ==========
interface Message {
  sender: 'user' | 'bot';
  text: string;
  isError?: boolean;
}

// ========== CONSTANTS ==========
// Trong production (React được serve từ Magento :8081), gọi trực tiếp same-origin
// Trong dev mode (Vite :5173), proxy trong vite.config.ts sẽ forward sang :8081
const CHATBOT_API = '/rest/V1/chatbot/ask';

// ========== HELPER: Render markdown đơn giản ==========
function renderMarkdown(text: string): string {
  return text
    // Links
    .replace(
      /(https?:\/\/[^\s<>"]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#6366f1;text-decoration:underline;font-weight:600">$1</a>'
    )
    // **bold**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // *italic*
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Newlines
    .replace(/\n/g, '<br>')
    // Bullet list dạng "- item"
    .replace(/<br>-\s+/g, '<br>• ');
}

// ========== COMPONENT ==========
export const ChatbotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: 'Xin chào! 👋 Tôi là trợ lý AI của **TMDT Shop**. Tôi có thể giúp bạn tìm sản phẩm phù hợp. Bạn đang tìm kiếm gì hôm nay?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const chatBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll xuống cuối khi có tin nhắn mới
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input khi mở chat
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    // Thêm tin nhắn user vào UI
    setMessages(prev => [...prev, { sender: 'user', text }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(CHATBOT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Magento REST trả về chuỗi JSON-encoded (string có dấu ngoặc kép)
      const raw = await response.text();
      // Bỏ dấu ngoặc kép bao ngoài nếu có
      let reply = raw.trim().replace(/^"|"$/g, '');
      // Decode unicode escapes (\uXXXX) do PHP json_encode tạo ra
      try {
        reply = JSON.parse(`"${reply.replace(/"/g, '\\"')}"`);
      } catch {
        // Giữ nguyên nếu parse lỗi
      }

      setMessages(prev => [...prev, { sender: 'bot', text: reply }]);
    } catch (error) {
      console.error('[ChatbotWidget] API Error:', error);
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: '⚠️ AI đang bảo trì, vui lòng thử lại sau.',
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ===== NÚT TRIGGER ===== */}
      <button
        id="chat-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Mở chatbot tư vấn"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: isOpen
            ? 'linear-gradient(135deg,#764ba2,#667eea)'
            : 'linear-gradient(135deg,#667eea,#764ba2)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(102,126,234,0.55)',
          zIndex: 99998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          fontSize: '24px',
          animation: isOpen ? 'none' : 'tmdtPulse 2.5s infinite',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* ===== CỬA SỔ CHAT ===== */}
      <div
        id="chat-container"
        style={{
          position: 'fixed',
          bottom: '96px',
          right: '24px',
          width: '370px',
          maxWidth: 'calc(100vw - 20px)',
          height: '560px',
          maxHeight: 'calc(100vh - 120px)',
          borderRadius: '20px',
          background: '#fff',
          boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 99997,
          overflow: 'hidden',
          transformOrigin: 'bottom right',
          transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(20px)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease',
        }}
        role="dialog"
        aria-label="Chatbot tư vấn sản phẩm"
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg,#667eea,#764ba2)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', flexShrink: 0,
          }}>🤖</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px', fontFamily: 'system-ui,sans-serif' }}>
              Trợ lý AI TMDT
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontFamily: 'system-ui,sans-serif', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{
                display: 'inline-block', width: '7px', height: '7px',
                borderRadius: '50%', background: '#4ade80',
              }} />
              Đang hoạt động
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={chatBoxRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            background: '#f7f8fc',
          }}
          aria-live="polite"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: '18px',
                fontSize: '14px',
                lineHeight: '1.6',
                fontFamily: 'system-ui,sans-serif',
                wordBreak: 'break-word',
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                background: msg.sender === 'user'
                  ? 'linear-gradient(135deg,#667eea,#764ba2)'
                  : msg.isError ? '#fff3f3' : '#fff',
                color: msg.sender === 'user' ? '#fff' : '#1a1a2e',
                borderBottomRightRadius: msg.sender === 'user' ? '4px' : '18px',
                borderBottomLeftRadius: msg.sender === 'bot' ? '4px' : '18px',
                boxShadow: msg.sender === 'bot' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
            />
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div style={{
              display: 'flex', gap: '5px', padding: '12px 16px',
              background: '#fff', borderRadius: '18px', borderBottomLeftRadius: '4px',
              alignSelf: 'flex-start', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}>
              {[0, 1, 2].map(n => (
                <span key={n} style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: '#9ca3af', display: 'inline-block',
                  animation: `tmdtBounce 1.3s ${n * 0.2}s infinite ease-in-out`,
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={{
          display: 'flex', gap: '8px', padding: '12px 14px',
          borderTop: '1px solid #eef0f7', background: '#fff', flexShrink: 0,
          alignItems: 'center',
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập câu hỏi của bạn..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '1.5px solid #e2e5f0',
              borderRadius: '24px',
              outline: 'none',
              fontSize: '14px',
              color: '#1a1a2e',
              background: '#f7f8fc',
              fontFamily: 'system-ui,sans-serif',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => (e.target.style.borderColor = '#667eea')}
            onBlur={e => (e.target.style.borderColor = '#e2e5f0')}
            aria-label="Nhập tin nhắn"
            autoComplete="off"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            style={{
              width: '42px', height: '42px', borderRadius: '50%',
              background: isLoading || !input.trim()
                ? '#d1d5db'
                : 'linear-gradient(135deg,#667eea,#764ba2)',
              border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: isLoading ? 'none' : '0 2px 10px rgba(102,126,234,0.4)',
              transition: 'all 0.2s',
              fontSize: '16px',
            }}
            aria-label="Gửi tin nhắn"
          >
            ➤
          </button>
        </div>
      </div>

      {/* CSS Animations (inline để không conflict với Tailwind) */}
      <style>{`
        @keyframes tmdtPulse {
          0%,100% { box-shadow: 0 4px 20px rgba(102,126,234,0.5); }
          50%      { box-shadow: 0 4px 30px rgba(102,126,234,0.85), 0 0 0 10px rgba(102,126,234,0.1); }
        }
        @keyframes tmdtBounce {
          0%,60%,100% { transform: translateY(0); }
          30%         { transform: translateY(-8px); background: #667eea; }
        }
        #chat-container *::-webkit-scrollbar { width: 5px; }
        #chat-container *::-webkit-scrollbar-thumb { background: #d0d4e8; border-radius: 10px; }
      `}</style>
    </>
  );
};
