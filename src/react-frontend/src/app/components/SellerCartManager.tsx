import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle,
  FileText,
  Filter,
  Image,
  Search,
  Send,
} from 'lucide-react';

type RfqRequest = {
  request_id: number;
  buyer_name: string;
  buyer_email: string;
  product_name: string;
  category: string;
  quantity: number;
  unit: string;
  delivery_region: string;
  needed_by: string;
  target_price: number | null;
  description: string;
  image_url: string;
  status: string;
  created_at: string;
  my_quote_id?: number | null;
  my_unit_price?: number | null;
  my_available_quantity?: number | null;
  my_delivery_time?: string;
  my_quality_grade?: string;
  my_quote_status?: string;
};

type QuoteFormState = {
  unitPrice: string;
  availableQuantity: string;
  deliveryTime: string;
  qualityGrade: string;
  imageUrl: string;
  description: string;
};

const emptyQuoteForm: QuoteFormState = {
  unitPrice: '',
  availableQuantity: '',
  deliveryTime: '',
  qualityGrade: '',
  imageUrl: '',
  description: '',
};

const readStorageValue = (key: string) =>
  window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || '';

const formatCurrency = (value?: number | null) => {
  if (!value || value <= 0) return '-';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (value: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
};

export function SellerCartManager() {
  const [requests, setRequests] = useState<RfqRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState<RfqRequest | null>(null);
  const [quoteForm, setQuoteForm] = useState<QuoteFormState>(emptyQuoteForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3200);
  };

  const loadRequests = useCallback(async () => {
    const token = readStorageValue('freso_customer_token');
    if (!token) {
      setRequests([]);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('query', searchQuery.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const query = params.toString();
      const response = await fetch(`${window.location.origin}/rest/V1/tmdt-rfq/seller/requests${query ? `?${query}` : ''}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json().catch(() => ({}))) as { success?: boolean; items?: RfqRequest[]; message?: string };
      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Khong the tai danh sach yeu cau bao gia.');
      }
      setRequests(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Khong the tai danh sach yeu cau bao gia.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    const id = window.setTimeout(loadRequests, 250);
    return () => window.clearTimeout(id);
  }, [loadRequests]);

  const openQuotePanel = (request: RfqRequest) => {
    setSelectedRequest(request);
    setQuoteForm({
      unitPrice: request.my_unit_price ? String(Math.round(request.my_unit_price)) : '',
      availableQuantity: request.my_available_quantity ? String(request.my_available_quantity) : String(request.quantity || ''),
      deliveryTime: request.my_delivery_time || '',
      qualityGrade: request.my_quality_grade || '',
      imageUrl: '',
      description: '',
    });
  };

  const submitQuote = async () => {
    if (!selectedRequest) return;
    const token = readStorageValue('freso_customer_token');
    if (!token) {
      showToast('Ban can dang nhap de gui bao gia.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${window.location.origin}/rest/V1/tmdt-rfq/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payload: {
            requestId: selectedRequest.request_id,
            unitPrice: Number(quoteForm.unitPrice),
            availableQuantity: quoteForm.availableQuantity ? Number(quoteForm.availableQuantity) : null,
            deliveryTime: quoteForm.deliveryTime,
            qualityGrade: quoteForm.qualityGrade,
            imageUrl: quoteForm.imageUrl,
            description: quoteForm.description,
          },
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Khong the gui bao gia.');
      }
      showToast('Da gui bao gia cho nguoi mua.');
      setSelectedRequest(null);
      await loadRequests();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Khong the gui bao gia.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const summary = useMemo(() => {
    const quoted = requests.filter((item) => item.my_quote_id).length;
    return {
      total: requests.length,
      quoted,
      waiting: requests.length - quoted,
    };
  }, [requests]);

  return (
    <div className="flex-1 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      {toast && (
        <div className={`fixed right-6 top-6 z-[100] flex items-center gap-3 rounded-2xl border px-5 py-4 shadow-2xl ${
          toast.type === 'success'
            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
            : 'border-rose-200 bg-rose-50 text-rose-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="size-5" /> : <AlertCircle className="size-5" />}
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 border-b border-gray-50 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-[18px] font-black tracking-tight text-slate-800">
            <FileText className="text-green-600" size={20} />
            Yeu cau bao gia
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-400">
            Xem nhu cau mua hang cua buyer va gui bao gia kem chat luong, thoi gian giao hang, hinh anh thuc te.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-gray-100 px-3 py-2">
            <p className="text-[10px] font-black uppercase text-slate-400">Tong</p>
            <p className="text-lg font-black text-slate-800">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-black uppercase text-amber-700">Cho bao gia</p>
            <p className="text-lg font-black text-amber-800">{summary.waiting}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2">
            <p className="text-[10px] font-black uppercase text-emerald-700">Da gui</p>
            <p className="text-lg font-black text-emerald-800">{summary.quoted}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
          <input
            type="text"
            placeholder="Tim theo san pham, danh muc hoac khu vuc giao hang..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-4 text-xs font-bold outline-none transition-all focus:border-green-500 focus:bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-slate-400" size={15} />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-2xl border border-gray-200 bg-gray-50/50 px-3 py-2.5 text-xs font-bold outline-none focus:border-green-500"
          >
            <option value="all">Tat ca trang thai</option>
            <option value="open">Dang mo</option>
            <option value="quoted">Da co bao gia</option>
            <option value="closed">Da dong</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm font-semibold text-slate-400">
            Dang tai yeu cau bao gia...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm font-semibold text-slate-400">
            Chua co yeu cau bao gia phu hop.
          </div>
        ) : (
          requests.map((request) => (
            <div key={request.request_id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-gray-200 hover:shadow-md">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">RFQ-{request.request_id}</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                      request.my_quote_id ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {request.my_quote_id ? 'Da bao gia' : 'Cho bao gia'}
                    </span>
                    <span className="rounded bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">{request.category || 'Chua phan loai'}</span>
                  </div>
                  <h3 className="text-base font-black tracking-tight text-slate-800">{request.product_name}</h3>
                  <p className="line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">{request.description || 'Nguoi mua chua bo sung mo ta chi tiet.'}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-400">
                    <span>
                      Nhu cau: <strong className="text-slate-700">{request.quantity} {request.unit || 'don vi'}</strong>
                    </span>
                    <span>
                      Giao tai: <strong className="text-slate-700">{request.delivery_region || '-'}</strong>
                    </span>
                    <span>
                      Can truoc: <strong className="text-slate-700">{formatDate(request.needed_by)}</strong>
                    </span>
                    <span>
                      Gia ky vong: <strong className="text-slate-700">{formatCurrency(request.target_price)}</strong>
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 md:items-end">
                  <div className="text-xs font-semibold text-slate-500">
                    <Building2 className="mr-1 inline size-3.5" />
                    {request.buyer_name || request.buyer_email || 'Buyer'}
                  </div>
                  {request.my_unit_price && (
                    <div className="rounded-xl bg-emerald-50 px-3 py-2 text-right text-xs font-bold text-emerald-700">
                      Bao gia cua ban: {formatCurrency(request.my_unit_price)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => openQuotePanel(request)}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white transition-all hover:bg-slate-800"
                  >
                    {request.my_quote_id ? 'Cap nhat bao gia' : 'Gui bao gia'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-[520px] flex-col bg-white p-6 shadow-2xl">
            <div className="mb-5 border-b border-gray-100 pb-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">RFQ-{selectedRequest.request_id}</p>
              <h3 className="mt-1 text-lg font-black text-slate-900">{selectedRequest.product_name}</h3>
              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{selectedRequest.description}</p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-600">
                  Gia bao / {selectedRequest.unit || 'don vi'}
                  <input
                    type="number"
                    min="0"
                    value={quoteForm.unitPrice}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, unitPrice: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500"
                  />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  So luong dap ung
                  <input
                    type="number"
                    min="0"
                    value={quoteForm.availableQuantity}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, availableQuantity: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500"
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-600">
                  Thoi gian giao hang
                  <input
                    type="text"
                    placeholder="VD: 2 ngay"
                    value={quoteForm.deliveryTime}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, deliveryTime: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500"
                  />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Chat luong/phan hang
                  <input
                    type="text"
                    placeholder="VD: Loai 1, VietGAP"
                    value={quoteForm.qualityGrade}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, qualityGrade: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500"
                  />
                </label>
              </div>
              <label className="block text-xs font-bold text-slate-600">
                Anh san pham thuc te
                <div className="relative mt-1">
                  <Image className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    placeholder="https://..."
                    value={quoteForm.imageUrl}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                    className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-500"
                  />
                </div>
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Mo ta bao gia
                <textarea
                  rows={5}
                  placeholder="Nguon hang, quy cach dong goi, dieu kien giao nhan..."
                  value={quoteForm.description}
                  onChange={(event) => setQuoteForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="mt-1 w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500"
                />
              </label>
            </div>

            <div className="mt-5 flex gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-xs font-black text-slate-600 hover:bg-gray-50"
              >
                Dong
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={submitQuote}
                className="flex-1 rounded-xl bg-green-600 py-3 text-xs font-black text-white shadow-lg shadow-green-600/10 hover:bg-green-700 disabled:bg-green-300"
              >
                <Send className="mr-1 inline size-3.5" />
                {isSubmitting ? 'Dang gui...' : 'Gui bao gia'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
