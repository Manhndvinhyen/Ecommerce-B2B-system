import React, { useState, useEffect, useRef } from 'react';

interface Rfq {
  id: string;
  customer_id: string;
  product_name: string;
  quantity: string;
  unit: string;
  desired_price: string;
  shipping_address: string;
  delivery_date: string;
  expiry_date: string;
  status: 'open' | 'closed' | 'ordered';
  created_at: string;
  updated_at: string;
  quote_count?: string;
  buyer_email?: string;
  buyer_name?: string;
  seller_quoted?: boolean;
}

interface Quote {
  id: string;
  rfq_id: string;
  seller_id: string;
  price: string;
  quantity: string;
  delivery_date: string;
  note: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  seller_name?: string;
  seller_nickname?: string;
  seller_province?: string;
  product_name?: string;
  rfq_quantity?: string;
  rfq_unit?: string;
  rfq_desired_price?: string;
  rfq_status?: string;
}

interface Message {
  id: string;
  rfq_id: string;
  quote_id: string | null;
  sender_id: string;
  sender_role: 'buyer' | 'seller';
  message: string;
  created_at: string;
  sender_name?: string;
  seller_name?: string;
  seller_nickname?: string;
}

interface RfqDashboardProps {
  mode: 'buyer' | 'seller';
}

export function RfqDashboard({ mode }: RfqDashboardProps) {
  // Lists
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected details
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);
  const [selectedRfqQuotes, setSelectedRfqQuotes] = useState<Quote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  // Chat/Negotiation State
  const [activeChatRfq, setActiveChatRfq] = useState<Rfq | null>(null);
  const [activeChatQuote, setActiveChatQuote] = useState<Quote | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [biddingRfq, setBiddingRfq] = useState<Rfq | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    productName: '',
    quantity: '',
    unit: 'kg',
    desiredPrice: '',
    shippingAddress: '',
    deliveryDate: '',
    expiryDate: '',
  });

  const [bidForm, setBidForm] = useState({
    price: '',
    quantity: '',
    deliveryDate: '',
    note: '',
  });

  // Notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getHeaders = () => {
    const token = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Load Initial Data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'buyer') {
        const res = await fetch('/rest/V1/tmdt-rfq/buyer-list', { headers: getHeaders() });
        const data = await res.json();
        if (res.ok) {
          setRfqs(Array.isArray(data) ? data : []);
        } else {
          setError(data.message || 'Không thể tải danh sách RFQ.');
        }
      } else {
        // Seller gets open RFQs and submitted Quotes
        const [rfqsRes, quotesRes] = await Promise.all([
          fetch('/rest/V1/tmdt-rfq/open-list', { headers: getHeaders() }),
          fetch('/rest/V1/tmdt-rfq/seller-quotes', { headers: getHeaders() }),
        ]);

        const rfqsData = await rfqsRes.json();
        const quotesData = await quotesRes.json();

        if (rfqsRes.ok) setRfqs(Array.isArray(rfqsData) ? rfqsData : []);
        if (quotesRes.ok) setQuotes(Array.isArray(quotesData) ? quotesData : []);
      }
    } catch (err) {
      setError('Đã xảy ra lỗi kết nối hệ thống.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [mode]);

  // Load Quotes for selected RFQ (for Buyer)
  const loadRfqQuotes = async (rfqId: string) => {
    setLoadingQuotes(true);
    try {
      const res = await fetch(`/rest/V1/tmdt-rfq/quotes/${rfqId}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setSelectedRfqQuotes(Array.isArray(data) ? data : []);
      } else {
        showToast(data.message || 'Không thể tải báo giá của RFQ này.', 'error');
      }
    } catch (err) {
      showToast('Lỗi tải dữ liệu báo giá.', 'error');
    } finally {
      setLoadingQuotes(false);
    }
  };

  // Load Messages
  const loadMessages = async (rfqId: string, quoteId?: string | null) => {
    setLoadingMessages(true);
    try {
      let url = `/rest/V1/tmdt-rfq/messages/${rfqId}`;
      if (quoteId) {
        url += `?quoteId=${quoteId}`;
      }
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeChatRfq) {
      loadMessages(activeChatRfq.id, activeChatQuote?.id);
      const interval = setInterval(() => {
        loadMessages(activeChatRfq.id, activeChatQuote?.id);
      }, 5000); // Poll every 5s for chat updates
      return () => clearInterval(interval);
    }
  }, [activeChatRfq, activeChatQuote]);

  useEffect(() => {
    // Scroll to bottom of chat
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Form Submission: Create RFQ
  const handleCreateRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/rest/V1/tmdt-rfq/create', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Tạo RFQ thành công!');
        setShowCreateModal(false);
        setCreateForm({
          productName: '',
          quantity: '',
          unit: 'kg',
          desiredPrice: '',
          shippingAddress: '',
          deliveryDate: '',
          expiryDate: '',
        });
        loadData();
      } else {
        showToast(data.message || 'Tạo RFQ thất bại.', 'error');
      }
    } catch (err) {
      showToast('Đã xảy ra lỗi khi tạo yêu cầu.', 'error');
    }
  };

  // Handle Form Submission: Submit Bid/Quote
  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!biddingRfq) return;

    try {
      const res = await fetch('/rest/V1/tmdt-rfq/quote/submit', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          rfqId: parseInt(biddingRfq.id),
          price: parseFloat(bidForm.price),
          quantity: parseFloat(bidForm.quantity),
          deliveryDate: bidForm.deliveryDate,
          note: bidForm.note,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Nộp báo giá thành công!');
        setShowBidModal(false);
        setBidForm({ price: '', quantity: '', deliveryDate: '', note: '' });
        loadData();
      } else {
        showToast(data.message || 'Nộp báo giá thất bại.', 'error');
      }
    } catch (err) {
      showToast('Đã xảy ra lỗi khi gửi báo giá.', 'error');
    }
  };

  // Handle Quote Acceptance
  const handleAcceptQuote = async (quoteId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn CHẤP NHẬN báo giá này không? Đơn hàng B2B sẽ được tạo lập tự động lập tức.')) {
      return;
    }

    try {
      const res = await fetch('/rest/V1/tmdt-rfq/quote/accept', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ quoteId: parseInt(quoteId) }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Chấp nhận báo giá thành công!');
        setSelectedRfq(null);
        loadData();
      } else {
        showToast(data.message || 'Chấp nhận báo giá thất bại.', 'error');
      }
    } catch (err) {
      showToast('Lỗi khi chấp nhận báo giá.', 'error');
    }
  };

  // Handle Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatRfq || !newMessageText.trim()) return;

    try {
      const res = await fetch('/rest/V1/tmdt-rfq/message/add', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          rfqId: parseInt(activeChatRfq.id),
          quoteId: activeChatQuote ? parseInt(activeChatQuote.id) : null,
          message: newMessageText.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewMessageText('');
        loadMessages(activeChatRfq.id, activeChatQuote?.id);
      } else {
        showToast(data.message || 'Gửi tin nhắn thất bại.', 'error');
      }
    } catch (err) {
      showToast('Lỗi gửi tin nhắn.', 'error');
    }
  };

  // Helper formats
  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // Identify Best Bid (Lowest price)
  const bestQuoteId = selectedRfqQuotes.length > 0 
    ? [...selectedRfqQuotes].sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0].id 
    : null;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg transition-all transform duration-300 translate-y-0 ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header and Hero Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-600 p-6 md:p-8 text-white shadow-md">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {mode === 'buyer' ? 'Yêu Cầu Báo Giá (RFQ)' : 'Đấu Thầu Báo Giá (RFQ)'}
          </h1>
          <p className="mt-2 text-emerald-100 max-w-xl text-sm leading-relaxed">
            {mode === 'buyer'
              ? 'Tạo yêu cầu mua nông sản sỉ với giá mong muốn. Nhận các báo giá tối ưu từ nhà vườn, so sánh giá cả và thương lượng trực tiếp.'
              : 'Tiếp cận nhu cầu đặt mua số lượng lớn trực tiếp từ các đại lý, doanh nghiệp nông nghiệp B2B và gửi báo giá cạnh tranh.'}
          </p>
        </div>
        {mode === 'buyer' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-white text-emerald-700 font-bold px-6 py-3 rounded-2xl shadow-sm hover:bg-emerald-50 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Đăng yêu cầu mua
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 text-sm font-medium">Đang đồng bộ dữ liệu nông sản...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center text-red-600">
          <p className="font-semibold">{error}</p>
          <button onClick={loadData} className="mt-3 inline-flex text-sm bg-red-600 text-white font-medium px-4 py-2 rounded-xl hover:bg-red-700">
            Thử lại
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* RFQs List */}
          <div className={`${selectedRfq || activeChatRfq ? 'lg:col-span-1 hidden lg:block' : 'lg:col-span-3'} space-y-4`}>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 px-1">
              <span>{mode === 'buyer' ? 'Danh sách yêu cầu của tôi' : 'Yêu cầu nông sản đang mở thầu'}</span>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                {rfqs.length}
              </span>
            </h2>

            {rfqs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-4 text-sm font-medium text-gray-900">Không có yêu cầu báo giá</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {mode === 'buyer'
                    ? 'Bạn chưa tạo bất kỳ yêu cầu báo giá nông sản nào.'
                    : 'Hiện tại chưa có yêu cầu báo giá nông sản nào đang mở.'}
                </p>
                {mode === 'buyer' && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm"
                  >
                    Tạo yêu cầu đầu tiên
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                {rfqs.map((rfq) => (
                  <div
                    key={rfq.id}
                    onClick={() => {
                      setSelectedRfq(rfq);
                      setActiveChatRfq(null);
                      if (mode === 'buyer') {
                        loadRfqQuotes(rfq.id);
                      }
                    }}
                    className={`group relative rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-all cursor-pointer ${
                      selectedRfq?.id === rfq.id ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">
                        {rfq.product_name}
                      </h3>
                      <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        rfq.status === 'open' ? 'bg-blue-50 text-blue-700' :
                        rfq.status === 'ordered' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {rfq.status === 'open' ? 'Đang mở' :
                         rfq.status === 'ordered' ? 'Đã lên đơn' : 'Đã đóng'}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-y-2 text-xs text-gray-500">
                      <div>
                        <span className="block text-gray-400">Số lượng mua</span>
                        <strong className="text-gray-700 text-sm">{rfq.quantity} {rfq.unit}</strong>
                      </div>
                      <div>
                        <span className="block text-gray-400">Giá mong muốn</span>
                        <strong className="text-emerald-600 text-sm">{formatCurrency(rfq.desired_price)}/{rfq.unit}</strong>
                      </div>
                      <div>
                        <span className="block text-gray-400">Nơi nhận hàng</span>
                        <span className="text-gray-700 truncate block max-w-[140px]">{rfq.shipping_address}</span>
                      </div>
                      <div>
                        <span className="block text-gray-400">Hạn nhận báo giá</span>
                        <span className="text-gray-700">{formatDate(rfq.expiry_date)}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                      <span className="text-gray-400">Ngày tạo: {formatDate(rfq.created_at)}</span>
                      
                      {mode === 'buyer' ? (
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                          </svg>
                          <span>{rfq.quote_count || 0} báo giá</span>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {rfq.seller_quoted ? (
                            <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                              Đã báo giá
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setBiddingRfq(rfq);
                                setBidForm(prev => ({ ...prev, quantity: rfq.quantity }));
                                setShowBidModal(true);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-semibold shadow-sm text-xs"
                            >
                              Gửi báo giá
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details & Quote Comparison / Chat (Middle & Right Columns) */}
          {(selectedRfq || activeChatRfq) && (
            <div className="lg:col-span-2 space-y-6">
              {/* Back to List Button (Mobile only) */}
              <button
                onClick={() => {
                  setSelectedRfq(null);
                  setActiveChatRfq(null);
                  setActiveChatQuote(null);
                }}
                className="lg:hidden inline-flex items-center gap-1 text-gray-500 font-semibold mb-2 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Quay lại danh sách
              </button>

              {selectedRfq && (
                <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-6">
                  {/* RFQ Header in Details */}
                  <div className="flex justify-between items-start gap-4 pb-4 border-b border-gray-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-gray-900">{selectedRfq.product_name}</h3>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                          selectedRfq.status === 'open' ? 'bg-blue-50 text-blue-700' :
                          selectedRfq.status === 'ordered' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {selectedRfq.status === 'open' ? 'Đang mở' :
                           selectedRfq.status === 'ordered' ? 'Đã lên đơn' : 'Đã đóng'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Yêu cầu mã số #{selectedRfq.id} • Tạo ngày {formatDate(selectedRfq.created_at)}</p>
                    </div>
                    {mode === 'buyer' && selectedRfq.status === 'open' && (
                      <button
                        onClick={() => {
                          setActiveChatRfq(selectedRfq);
                          setActiveChatQuote(null);
                        }}
                        className="bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                        </svg>
                        Kênh trao đổi chung
                      </button>
                    )}
                  </div>

                  {/* RFQ Meta Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-emerald-50/50 rounded-2xl p-4 text-xs">
                    <div>
                      <span className="block text-gray-400">Số lượng cần mua</span>
                      <strong className="text-gray-900 text-sm">{selectedRfq.quantity} {selectedRfq.unit}</strong>
                    </div>
                    <div>
                      <span className="block text-gray-400">Giá kỳ vọng</span>
                      <strong className="text-emerald-700 text-sm">{formatCurrency(selectedRfq.desired_price)}/{selectedRfq.unit}</strong>
                    </div>
                    <div>
                      <span className="block text-gray-400">Thời gian nhận</span>
                      <strong className="text-gray-900 text-sm">{formatDate(selectedRfq.delivery_date)}</strong>
                    </div>
                    <div>
                      <span className="block text-gray-400">Địa điểm giao nhận</span>
                      <strong className="text-gray-900 block truncate text-sm" title={selectedRfq.shipping_address}>{selectedRfq.shipping_address}</strong>
                    </div>
                  </div>

                  {/* Received Quotes Section (For Buyers) */}
                  {mode === 'buyer' && (
                    <div className="space-y-4">
                      <h4 className="text-md font-bold text-gray-900 flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-emerald-600">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                        Bảng so sánh báo giá nhận được ({selectedRfqQuotes.length})
                      </h4>

                      {loadingQuotes ? (
                        <div className="flex justify-center py-6">
                          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : selectedRfqQuotes.length === 0 ? (
                        <div className="rounded-xl border border-gray-100 bg-gray-50/50 py-8 text-center text-xs text-gray-500">
                          Chưa nhận được báo giá nào từ nhà vườn cho yêu cầu này.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedRfqQuotes.map((quote) => {
                            const isBest = quote.id === bestQuoteId;
                            const isAccepted = quote.status === 'accepted';
                            return (
                              <div
                                key={quote.id}
                                className={`relative rounded-2xl border p-4 shadow-sm transition-all ${
                                  isAccepted ? 'border-emerald-500 bg-emerald-50/20' : 
                                  isBest ? 'border-amber-400 bg-amber-50/10' : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                {isBest && (
                                  <span className="absolute -top-2.5 left-4 bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5 shadow-sm">
                                    👑 Giá tốt nhất
                                  </span>
                                )}

                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <strong className="text-gray-900 text-sm sm:text-md">{quote.seller_name || 'Nhà vườn B2B'}</strong>
                                      <span className="text-xs text-gray-400 font-medium">({quote.seller_province})</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">Biệt danh cửa hàng: <span className="font-semibold text-emerald-800">{quote.seller_nickname || 'Chưa cập nhật'}</span></p>
                                    <div className="flex items-center gap-4 mt-2">
                                      <span className="text-xs text-gray-500">
                                        Đơn giá: <strong className="text-emerald-700 text-sm">{formatCurrency(quote.price)}/{selectedRfq.unit}</strong>
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        Cung ứng: <strong className="text-gray-700">{quote.quantity} {selectedRfq.unit}</strong>
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      Giao hàng dự kiến: <strong className="text-gray-700">{formatDate(quote.delivery_date)}</strong>
                                    </div>
                                    {quote.note && (
                                      <div className="mt-2 text-xs italic bg-gray-50 text-gray-600 rounded-lg p-2 max-w-lg border border-gray-100">
                                        " {quote.note} "
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex sm:flex-col gap-2 w-full sm:w-auto items-stretch">
                                    <button
                                      onClick={() => {
                                        setActiveChatRfq(selectedRfq);
                                        setActiveChatQuote(quote);
                                      }}
                                      className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-bold px-3 py-2 rounded-xl flex items-center justify-center gap-1"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.92 1.786c-.082.095-.009.24.117.218a5.203 5.203 0 002.535-1.011c.264-.179.573-.218.879-.11 1.01.353 2.1.536 3.208.536z" />
                                      </svg>
                                      Đàm phán
                                    </button>

                                    {selectedRfq.status === 'open' && (
                                      <button
                                        onClick={() => handleAcceptQuote(quote.id)}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm text-center"
                                      >
                                        Chấp nhận
                                      </button>
                                    )}

                                    {isAccepted && (
                                      <span className="text-center text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1">
                                        Đã chấp nhận
                                      </span>
                                    )}

                                    {quote.status === 'rejected' && (
                                      <span className="text-center text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-1">
                                        Đã từ chối
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submission detail logs (For Sellers) */}
                  {mode === 'seller' && (
                    <div className="pt-4 border-t border-gray-100 space-y-4">
                      <h4 className="text-md font-bold text-gray-900">Báo giá nông sản của bạn</h4>
                      {quotes.filter(q => q.rfq_id === selectedRfq.id).length === 0 ? (
                        <div className="rounded-xl border border-gray-100 bg-gray-50/50 py-6 text-center text-xs text-gray-500">
                          Bạn chưa gửi báo giá cho yêu cầu này.
                          <div className="mt-3">
                            <button
                              onClick={() => {
                                setBiddingRfq(selectedRfq);
                                setBidForm(prev => ({ ...prev, quantity: selectedRfq.quantity }));
                                setShowBidModal(true);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm"
                            >
                              Gửi báo giá ngay
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {quotes.filter(q => q.rfq_id === selectedRfq.id).map((quote) => (
                            <div key={quote.id} className="rounded-2xl border border-gray-200 p-4 bg-gray-50/50 text-xs text-gray-600 space-y-2">
                              <div className="flex justify-between items-center">
                                <span>Mã báo giá: <strong>#{quote.id}</strong></span>
                                <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                                  quote.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                                  quote.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                                }`}>
                                  {quote.status === 'pending' ? 'Chờ duyệt' :
                                   quote.status === 'accepted' ? 'Đã chấp nhận' : 'Không trúng thầu'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                <div>Giá chào bán: <strong className="text-emerald-700 text-sm">{formatCurrency(quote.price)}/{selectedRfq.unit}</strong></div>
                                <div>Khả năng cung cấp: <strong className="text-gray-900">{quote.quantity} {selectedRfq.unit}</strong></div>
                                <div className="col-span-2">Giao hàng dự kiến: <strong>{formatDate(quote.delivery_date)}</strong></div>
                              </div>
                              {quote.note && <div className="mt-2 text-gray-500 italic">"Ghi chú: {quote.note}"</div>}

                              <div className="pt-3 border-t border-gray-200/60 flex justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setActiveChatRfq(selectedRfq);
                                    setActiveChatQuote(quote);
                                  }}
                                  className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                                  </svg>
                                  Thương lượng
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Chat Negotiation Thread */}
              {activeChatRfq && (
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm flex flex-col h-[520px] overflow-hidden">
                  {/* Chat Header */}
                  <div className="bg-emerald-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 flex items-center gap-1.5 text-sm sm:text-base">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        {activeChatQuote 
                          ? `Thương lượng: ${activeChatQuote.seller_name || 'Nhà vườn'} (${activeChatRfq.product_name})`
                          : `Trao đổi chung: ${activeChatRfq.product_name}`
                        }
                      </h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">Mã RFQ: #{activeChatRfq.id} {activeChatQuote ? `• Báo giá: #${activeChatQuote.id}` : ''}</p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedRfq(activeChatRfq);
                        setActiveChatRfq(null);
                        setActiveChatQuote(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Chat Message Box */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
                    {loadingMessages ? (
                      <div className="flex justify-center py-12">
                        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-12 text-xs text-gray-400 italic">
                        Chưa có tin nhắn nào. Gửi câu hỏi, đề xuất giá để bắt đầu thương thảo thương mại.
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isSystem = msg.message.startsWith('Nhà cung cấp') || msg.message.startsWith('Người mua đã CHẤP NHẬN');
                        
                        if (isSystem) {
                          return (
                            <div key={msg.id} className="flex justify-center">
                              <div className="bg-emerald-50 border border-emerald-100/60 rounded-xl px-4 py-2 text-center max-w-md shadow-xs">
                                <p className="text-[11px] text-emerald-800 font-semibold leading-relaxed whitespace-pre-line">{msg.message}</p>
                                <span className="text-[9px] text-emerald-600/70 block mt-1">{formatDate(msg.created_at)}</span>
                              </div>
                            </div>
                          );
                        }

                        const senderId = msg.sender_id;
                        const isMe = (mode === 'buyer' && msg.sender_role === 'buyer') || (mode === 'seller' && msg.sender_role === 'seller');

                        return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-2xl p-3 shadow-xs ${
                              isMe ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                            }`}>
                              {!isMe && (
                                <span className={`block text-[10px] font-bold mb-1 ${
                                  msg.sender_role === 'buyer' ? 'text-blue-600' : 'text-emerald-700'
                                }`}>
                                  {msg.sender_role === 'buyer' ? (msg.sender_name || 'Khách mua') : (msg.seller_name || msg.seller_nickname || 'Nhà cung cấp')}
                                </span>
                              )}
                              <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                              <span className={`block text-[9px] text-right mt-1.5 ${isMe ? 'text-emerald-100' : 'text-gray-400'}`}>
                                {new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat Input form */}
                  <form onSubmit={handleSendMessage} className="border-t border-gray-100 p-4 bg-white flex gap-2">
                    <textarea
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      placeholder="Nhập nội dung thương lượng giá, điều kiện giao hàng..."
                      rows={1}
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!newMessageText.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2 flex items-center justify-center font-bold text-xs shadow-sm disabled:opacity-50 transition-colors"
                    >
                      Gửi đi
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Create RFQ (Buyer only) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-emerald-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">Đăng yêu cầu mua sỉ (RFQ)</h3>
                <p className="text-xs text-gray-500 mt-0.5">Nhận báo giá rẻ nhất trực tiếp từ các nhà vườn</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateRfq} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">Tên nông sản / Mô tả nhu cầu <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Khoai lang mật Đà Lạt loại 1, củ to đều"
                  value={createForm.productName}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, productName: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700">Số lượng đặt mua <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ví dụ: 1000"
                    value={createForm.quantity}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700">Đơn vị tính <span className="text-red-500">*</span></label>
                  <select
                    value={createForm.unit}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                  >
                    <option value="kg">kg (Kilôgam)</option>
                    <option value="tấn">tấn</option>
                    <option value="tạ">tạ</option>
                    <option value="thùng">thùng</option>
                    <option value="hộp">hộp</option>
                    <option value="bó">bó</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">Giá mua mong muốn (VND / Đơn vị) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="Ví dụ: 15000"
                  value={createForm.desiredPrice}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, desiredPrice: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">Địa chỉ giao nhận hàng sỉ <span className="text-red-500">*</span></label>
                <textarea
                  required
                  rows={2}
                  placeholder="Nhập địa chỉ nhận hàng chi tiết..."
                  value={createForm.shippingAddress}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, shippingAddress: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700">Thời gian nhận hàng mong muốn <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={createForm.deliveryDate}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, deliveryDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700">Thời hạn nhận báo giá <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={createForm.expiryDate}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 text-xs font-bold px-4 py-2.5 rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm"
                >
                  Đăng yêu cầu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Submit Bid (Seller only) */}
      {showBidModal && biddingRfq && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-emerald-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">Gửi Báo Giá Nông Sản</h3>
                <p className="text-xs text-gray-500 mt-0.5">Báo giá cạnh tranh cho yêu cầu sỉ: {biddingRfq.product_name}</p>
              </div>
              <button onClick={() => setShowBidModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Info Box */}
            <div className="mx-6 mt-4 p-3 bg-emerald-50/50 rounded-xl text-xs space-y-1">
              <div>Đại lý yêu cầu: <strong>{biddingRfq.buyer_name || 'Khách mua B2B'}</strong></div>
              <div>Số lượng mong muốn: <strong>{biddingRfq.quantity} {biddingRfq.unit}</strong></div>
              <div>Giá mong muốn: <strong className="text-emerald-700">{formatCurrency(biddingRfq.desired_price)}/{biddingRfq.unit}</strong></div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitBid} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">Đơn giá chào bán (VND / {biddingRfq.unit}) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="Nhập giá chào hàng tốt nhất của bạn..."
                  value={bidForm.price}
                  onChange={(e) => setBidForm(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">Số lượng có thể cung ứng <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Nhập số lượng cung cấp..."
                  value={bidForm.quantity}
                  onChange={(e) => setBidForm(prev => ({ ...prev, quantity: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">Ngày giao hàng dự kiến <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={bidForm.deliveryDate}
                  onChange={(e) => setBidForm(prev => ({ ...prev, deliveryDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">Ghi chú thêm</label>
                <textarea
                  rows={2}
                  placeholder="Ví dụ: Đóng gói hộp xốp cẩn thận, bao đổi trả nếu hư hỏng..."
                  value={bidForm.note}
                  onChange={(e) => setBidForm(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBidModal(false)}
                  className="bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 text-xs font-bold px-4 py-2.5 rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm"
                >
                  Nộp báo giá
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
