// src/app/components/ChatbotWidget.tsx
// Chatbot AI tư vấn sản phẩm — gọi Magento REST API /rest/V1/chatbot/ask
import React, { useState, useRef, useEffect } from 'react';

// ========== TYPES ==========
interface Product {
  name: string;
  price: string;
  url: string;
  image: string;
}

interface Message {
  sender: 'user' | 'bot';
  text: string;
  products?: Product[];
  isError?: boolean;
}

// ========== CONSTANTS ==========
const CHATBOT_API = '/rest/V1/chatbot/ask';
const CHATBOT_STORAGE_KEY = 'freso_chatbot_session_v1';
const CHATBOT_REQUEST_TIMEOUT_MS = 120000;
const DEFAULT_MESSAGES: Message[] = [
  {
    sender: 'bot',
    text: 'Xin chào! 👋 Tôi là trợ lý AI của **TMDT Shop**. Tôi có thể giúp bạn tìm sản phẩm phù hợp. Bạn đang tìm kiếm gì hôm nay?',
  },
];

const loadChatbotSession = () => {
  if (typeof window === 'undefined') {
    return { messages: DEFAULT_MESSAGES, input: '', isOpen: false };
  }

  try {
    const raw = window.sessionStorage.getItem(CHATBOT_STORAGE_KEY);
    if (!raw) {
      return { messages: DEFAULT_MESSAGES, input: '', isOpen: false };
    }

    const parsed = JSON.parse(raw) as Partial<{
      messages: Message[];
      input: string;
      isOpen: boolean;
    }>;

    return {
      messages: Array.isArray(parsed.messages) && parsed.messages.length > 0 ? parsed.messages : DEFAULT_MESSAGES,
      input: typeof parsed.input === 'string' ? parsed.input : '',
      isOpen: Boolean(parsed.isOpen),
    };
  } catch {
    return { messages: DEFAULT_MESSAGES, input: '', isOpen: false };
  }
};

const parseChatbotResponse = (raw: string): { reply: string; products: Product[] } => {
  const parseValue = (value: unknown): { reply: string; products: Product[] } => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return { reply: '', products: [] };
      }

      try {
        return parseValue(JSON.parse(trimmed));
      } catch {
        return { reply: trimmed, products: [] };
      }
    }

    if (value && typeof value === 'object') {
      const objectValue = value as Record<string, unknown>;
      if ('message' in objectValue || 'products' in objectValue) {
        return {
          reply: String(objectValue.message ?? '').trim(),
          products: Array.isArray(objectValue.products) ? (objectValue.products as Product[]) : [],
        };
      }
    }

    return { reply: String(value ?? '').trim(), products: [] };
  };

  return parseValue(raw);
};

// ========== HELPER: Render markdown đơn giản ==========
function renderMarkdown(text: string): string {
  return text
    // **bold**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // *italic*
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Newlines
    .replace(/\n/g, '<br>')
    // Bullet list dạng "- item"
    .replace(/<br>-\s+/g, '<br>• ');
}

// ========== PRODUCT CARD ==========
const ProductCard: React.FC<{ product: Product }> = ({ product }) => (
  <a
    href={product.url}
    target="_blank"
    rel="noopener noreferrer"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: '#fff',
      border: '1px solid #e8eaf0',
      borderRadius: '12px',
      padding: '10px',
      textDecoration: 'none',
      color: 'inherit',
      alignSelf: 'flex-start',
      width: '88%',
      boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
      transition: 'box-shadow 0.2s, transform 0.2s',
      fontFamily: 'system-ui,sans-serif',
      cursor: 'pointer',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 5px 18px rgba(102,126,234,0.25)';
      (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.05)';
      (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
    }}
  >
    {product.image ? (
      <img
        src={product.image}
        alt={product.name}
        style={{
          width: '58px',
          height: '58px',
          objectFit: 'cover',
          borderRadius: '8px',
          border: '1px solid #f0f0f0',
          flexShrink: 0,
          background: '#f7f8fc',
        }}
        onError={e => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    ) : (
      <div style={{
        width: '58px',
        height: '58px',
        borderRadius: '8px',
        background: '#f0f2ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        flexShrink: 0,
      }}>🛍️</div>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: '13px',
        fontWeight: 600,
        color: '#1a1a2e',
        lineHeight: 1.3,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>{product.name}</div>
      <div style={{
        fontSize: '13px',
        fontWeight: 700,
        color: '#667eea',
        marginTop: '3px',
      }}>{product.price}</div>
      <div style={{
        fontSize: '11px',
        color: '#9ca3af',
        marginTop: '2px',
      }}>Xem sản phẩm →</div>
    </div>
  </a>
);

// ========== COMPONENT ==========
export const ChatbotWidget: React.FC = () => {
  const initialSessionRef = useRef(loadChatbotSession());
  const [isOpen, setIsOpen] = useState(initialSessionRef.current.isOpen);
  const [messages, setMessages] = useState<Message[]>(initialSessionRef.current.messages);
  const [input, setInput] = useState(initialSessionRef.current.input);
  const [isLoading, setIsLoading] = useState(false);

  const chatBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(
      CHATBOT_STORAGE_KEY,
      JSON.stringify({
        messages,
        input,
        isOpen,
      })
    );
  }, [messages, input, isOpen]);

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

    setMessages(prev => [...prev, { sender: 'user', text }]);
    setInput('');
    setIsLoading(true);
    if (import.meta.env.DEV) {
      console.info('[FresoChatbot] Sending chatbot request.', {
        message: text,
        endpoint: CHATBOT_API,
        timeoutMs: CHATBOT_REQUEST_TIMEOUT_MS,
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        console.warn('[FresoChatbot] Chatbot request timed out.', {
          message: text,
          timeoutMs: CHATBOT_REQUEST_TIMEOUT_MS,
        });
        controller.abort(new DOMException('Chatbot request timed out', 'TimeoutError'));
      }, CHATBOT_REQUEST_TIMEOUT_MS);
      const response = await fetch(CHATBOT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timeoutId));

      const raw = await response.text();
      if (import.meta.env.DEV) {
        console.info('[FresoChatbot] Chatbot API response received.', {
          ok: response.ok,
          status: response.status,
          rawPreview: raw.slice(0, 500),
        });
      }
      if (!response.ok) {
        throw new Error(raw.trim() || `HTTP ${response.status}`);
      }

      const { reply, products } = parseChatbotResponse(raw);
      if (import.meta.env.DEV) {
        console.info('[FresoChatbot] Chatbot response parsed.', {
          hasReply: Boolean(reply),
          productCount: products.length,
          replyPreview: reply.slice(0, 300),
        });
      }
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: reply || 'Minh chua nhan duoc noi dung tra loi tu he thong. Ban vui long thu lai sau it phut.',
          products,
          isError: !reply,
        },
      ]);
    } catch (error) {
      console.error('[ChatbotWidget] API Error:', error);
      const isTimeoutError = error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError');
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: isTimeoutError
            ? 'He thong tu van dang phan hoi cham. Ban vui long thu lai sau it phut.'
            : 'AI dang tam thoi khong phan hoi. Ban vui long thu lai sau.',
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
    return;

    try {
      const response = await fetch(CHATBOT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Magento REST trả về chuỗi JSON-encoded.
      // Backend giờ trả về JSON string của object {message, products},
      // nên cần parse 2 lần: lần 1 ra string, lần 2 ra object.
      const raw = await response.text();
      let reply = '';
      let products: Product[] = [];

      try {
        const firstParse = JSON.parse(raw);

        if (typeof firstParse === 'string') {
          // Magento double-encoded: firstParse là string chứa JSON object
          try {
            const secondParse = JSON.parse(firstParse);
            if (secondParse && typeof secondParse === 'object' && 'message' in secondParse) {
              reply    = String(secondParse.message || '');
              products = Array.isArray(secondParse.products) ? secondParse.products : [];
            } else {
              reply = firstParse;
            }
          } catch {
            reply = firstParse;
          }
        } else if (firstParse && typeof firstParse === 'object' && 'message' in firstParse) {
          reply    = String(firstParse.message || '');
          products = Array.isArray(firstParse.products) ? firstParse.products : [];
        } else {
          reply = String(firstParse);
        }
      } catch {
        reply = raw;
      }

      setMessages(prev => [...prev, { sender: 'bot', text: reply, products }]);
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
            <React.Fragment key={i}>
              {/* Bong bóng tin nhắn */}
              <div
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

              {/* Thẻ sản phẩm (chỉ hiển thị khi bot trả về danh sách) */}
              {msg.sender === 'bot' && msg.products && msg.products.length > 0 && (
                <>
                  <div style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    fontFamily: 'system-ui,sans-serif',
                    alignSelf: 'flex-start',
                    paddingLeft: '2px',
                  }}>
                    Sản phẩm liên quan:
                  </div>
                  {msg.products.map((p, pi) => (
                    <ProductCard key={pi} product={p} />
                  ))}
                </>
              )}
            </React.Fragment>
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
