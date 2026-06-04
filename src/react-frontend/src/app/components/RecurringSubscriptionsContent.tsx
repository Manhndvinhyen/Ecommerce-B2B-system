import React, { useEffect, useState } from 'react';
import { CalendarDays, Clock, Trash2, MapPin, AlertCircle, RefreshCw, ShoppingBag, CheckCircle, XCircle } from 'lucide-react';
import { toCurrencyTextFromNumber } from '../cart/CartProvider';

interface SubscriptionItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
}

interface Subscription {
  id: string;
  customer_email: string;
  customer_name: string;
  frequency: 'weekly' | 'monthly';
  weekdays: string | null;
  month_day: number | null;
  delivery_time: string;
  items_json: string;
  shipping_json: string;
  status: 'active' | 'cancelled';
  last_run_date: string | null;
  next_run_date: string;
  created_at: string;
}

export function RecurringSubscriptionsContent() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const getCustomerEmail = () =>
    window.localStorage.getItem('freso_customer_email') || window.sessionStorage.getItem('freso_customer_email') || '';

  const getAuthToken = () =>
    window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';

  const fetchSubscriptions = async () => {
    setLoading(true);
    setError('');
    const email = getCustomerEmail();
    if (!email) {
      setError('Bạn cần đăng nhập để xem lịch đăng ký mua hàng.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/rest/V1/tmdt-recurring/list?customerEmail=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`
        }
      });
      if (!res.ok) {
        throw new Error('Không thể tải danh sách đăng ký mua.');
      }
      const data = await res.json();
      setSubscriptions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleCancel = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy lịch đăng ký mua hàng định kỳ này không?')) {
      return;
    }

    setCancellingId(id);
    try {
      const res = await fetch('/rest/V1/tmdt-recurring/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ id: parseInt(id, 10) })
      });

      if (!res.ok) {
        throw new Error('Hủy đăng ký thất bại.');
      }

      const data = await res.json();
      if (data.success) {
        // Refresh local state status instead of full reload for smoother UI
        setSubscriptions(prev =>
          prev.map(sub => (sub.id === id ? { ...sub, status: 'cancelled' } : sub))
        );
      } else {
        alert(data.message || 'Không thể hủy đăng ký.');
      }
    } catch (err: any) {
      alert(err.message || 'Có lỗi xảy ra.');
    } finally {
      setCancellingId(null);
    }
  };

  const formatWeekdays = (weekdaysStr: string | null) => {
    if (!weekdaysStr) return '';
    const map: Record<string, string> = {
      '0': 'Chủ Nhật',
      '1': 'Thứ Hai',
      '2': 'Thứ Ba',
      '3': 'Thứ Tư',
      '4': 'Thứ Năm',
      '5': 'Thứ Sáu',
      '6': 'Thứ Bảy'
    };
    return weekdaysStr
      .split(',')
      .map(w => map[w.trim()] || '')
      .filter(Boolean)
      .join(', ');
  };

  const parseShippingAddress = (shippingJson: string) => {
    try {
      const parsed = JSON.parse(shippingJson);
      return `${parsed.receiver} - ${parsed.phone} (${parsed.branch ? parsed.branch + ' - ' : ''}${parsed.address})`;
    } catch {
      return 'Không xác định';
    }
  };

  const parseItems = (itemsJson: string): SubscriptionItem[] => {
    try {
      return JSON.parse(itemsJson);
    } catch {
      return [];
    }
  };

  const calculateTotal = (items: SubscriptionItem[]) => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  return (
    <div style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }} className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <CalendarDays className="text-green-600" size={26} />
            Đăng ký mua định kỳ
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Quản lý lịch đặt hàng tự động hàng tuần hoặc hàng tháng của bạn.
          </p>
        </div>
        <button
          onClick={fetchSubscriptions}
          className="p-2 border border-slate-100 rounded-xl text-slate-500 hover:text-green-600 hover:bg-slate-50 transition-all"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-xs">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="text-center py-16 bg-slate-50/50 border border-dashed border-slate-200 rounded-3xl p-8">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4">
            <ShoppingBag size={28} />
          </div>
          <h3 className="text-[15px] font-bold text-slate-700">Chưa có lịch đăng ký nào</h3>
          <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto">
            Khi thanh toán đơn hàng, bạn có thể chọn Đăng ký mua định kỳ để tự động lên đơn trong tương lai.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {subscriptions.map((sub) => {
            const items = parseItems(sub.items_json);
            const total = calculateTotal(items);
            const isActive = sub.status === 'active';

            return (
              <div
                key={sub.id}
                className={`bg-white border rounded-3xl p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden ${
                  isActive ? 'border-slate-100' : 'border-slate-100 opacity-70'
                }`}
              >
                {/* Status Badge */}
                <div className="absolute top-6 right-6 flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {isActive ? 'Đang hoạt động' : 'Đã hủy'}
                  </span>
                </div>

                {/* Header Information */}
                <div className="mb-4">
                  <span className="text-[11px] font-black uppercase text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">
                    Lịch trình: {sub.frequency === 'weekly' ? 'Hàng tuần' : 'Hàng tháng'}
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 mt-3 flex items-center gap-2">
                    {sub.frequency === 'weekly' ? (
                      <>Tự động đặt hàng mỗi: {formatWeekdays(sub.weekdays)}</>
                    ) : (
                      <>Tự động đặt hàng ngày: {sub.month_day} hàng tháng</>
                    )}
                  </h3>
                </div>

                {/* Sub details grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-b border-slate-50 py-4 my-4 text-xs text-slate-500">
                  <div className="flex items-center gap-2.5">
                    <Clock size={15} className="text-slate-400 shrink-0" />
                    <span>Khung giờ giao: <strong>{sub.delivery_time}</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CalendarDays size={15} className="text-slate-400 shrink-0" />
                    <span>Lên đơn tiếp theo: <strong className="text-green-600">{sub.next_run_date}</strong></span>
                  </div>
                  <div className="flex items-start gap-2.5 md:col-span-2">
                    <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">
                      Giao đến: <strong>{parseShippingAddress(sub.shipping_json)}</strong>
                    </span>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Danh sách sản phẩm</h4>
                  <div className="max-h-36 overflow-y-auto pr-2 space-y-2.5">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-slate-700 font-medium">
                          {item.name} <span className="text-slate-400">x{item.quantity} {item.unit}</span>
                        </span>
                        <span className="text-slate-600 font-bold">
                          {toCurrencyTextFromNumber(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer totals & actions */}
                <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-50">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Tổng giá trị ước tính / chu kỳ</span>
                    <span className="text-[16px] font-black text-green-600">{toCurrencyTextFromNumber(total)}</span>
                  </div>
                  {isActive && (
                    <button
                      onClick={() => handleCancel(sub.id)}
                      disabled={cancellingId === sub.id}
                      className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl text-[11px] font-black uppercase tracking-wider hover:bg-rose-100 hover:text-rose-700 transition-all flex items-center gap-1.5"
                    >
                      <Trash2 size={13} />
                      {cancellingId === sub.id ? 'Đang hủy...' : 'Hủy đăng ký'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
