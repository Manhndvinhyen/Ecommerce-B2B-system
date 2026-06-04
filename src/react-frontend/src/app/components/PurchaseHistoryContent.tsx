import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Clock3,
  PackageSearch,
  ReceiptText,
  Sparkles,
  Truck,
  ChevronDown,
  Search,
  RefreshCw,
  LoaderCircle,
  ShoppingBag,
} from 'lucide-react';
import { toCurrencyTextFromNumber } from '../cart/CartProvider';
import { OrderTrackingMap } from './OrderTrackingMap';

type PurchaseHistoryItem = {
  item_id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  unit_price: number;
  row_total: number;
  image: string;
};

type PurchaseHistoryOrder = {
  history_id: number;
  order_reference: string;
  status?: string;
  status_label?: string;
  customer_name?: string;
  customer_region: string;
  supplier: string;
  subtotal: number;
  total_amount: number;
  delivery_date: string;
  delivery_time: string;
  shipping_address: string;
  note: string;
  transaction_id?: string;
  expires_at?: string;
  paid_at?: string;
  shipping_info?: Record<string, unknown>;
  created_at: string;
  items: PurchaseHistoryItem[];
};

type PurchaseHistoryContentProps = {
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

const getAuthToken = () =>
  window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';

const formatDateTime = (value: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('vi-VN');
};

const getStatusMeta = (status?: string) => {
  const normalized = (status || 'pending').trim().toLowerCase();
  if (normalized === 'paid') {
    return { label: 'Đã thanh toán', className: 'bg-emerald-50 text-emerald-700 border-emerald-100/80', dot: 'bg-emerald-500' };
  }
  if (normalized === 'processing') {
    return { label: 'Đang xử lý', className: 'bg-blue-50 text-blue-700 border-blue-100/80', dot: 'bg-blue-500' };
  }
  if (normalized === 'expired') {
    return { label: 'Hết hạn', className: 'bg-rose-50 text-rose-700 border-rose-100/80', dot: 'bg-rose-500' };
  }
  if (normalized === 'cancelled' || normalized === 'canceled') {
    return { label: 'Đã hủy', className: 'bg-slate-50 text-slate-500 border-slate-200/80', dot: 'bg-slate-400' };
  }
  return { label: 'Chờ thanh toán', className: 'bg-amber-50 text-amber-800 border-amber-100/80', dot: 'bg-amber-500' };
};

export function PurchaseHistoryContent({
  title = 'Lịch sử mua hàng',
  description = 'Theo dõi các đơn hàng đã mua, trạng thái thanh toán và thông tin giao nhận sỉ.',
  emptyTitle = 'Chưa có đơn hàng nào',
  emptyDescription = 'Các đơn hàng của bạn sẽ xuất hiện tại đây sau khi bạn đặt mua.',
}: PurchaseHistoryContentProps) {
  const [orders, setOrders] = useState<PurchaseHistoryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const summary = useMemo(() => {
    const totalPurchased = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    const paidOrders = orders.filter((order) => (order.status || '').toLowerCase() === 'paid').length;
    const pendingOrders = orders.filter((order) => {
      const status = (order.status || 'pending').toLowerCase();
      return status === 'pending' || status === 'processing';
    }).length;

    return {
      totalPurchased,
      orderCount: orders.length,
      paidOrders,
      pendingOrders,
    };
  }, [orders]);

  const fetchOrders = async (showSpinner = false, nextStatusFilter = statusFilter, nextSearchTerm = searchTerm) => {
    const token = getAuthToken();
    if (!token) {
      setErrorMessage('Vui lòng đăng nhập để xem lịch sử mua hàng.');
      setIsLoading(false);
      return;
    }

    if (showSpinner) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const params = new URLSearchParams();
      params.set('limit', '30');
      if (nextStatusFilter !== 'all') {
        params.set('status', nextStatusFilter);
      }
      if (nextSearchTerm.trim()) {
        params.set('q', nextSearchTerm.trim());
      }

      const response = await fetch(`/rest/V1/tmdt-search/purchase-history?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP ${response.status}`);
      }

      const json = await response.json();
      setOrders(Array.isArray(json?.items) ? json.items : []);
      setErrorMessage('');
    } catch {
      setErrorMessage('Không tải được lịch sử mua hàng. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchOrders(false);
  }, []);

  const toggleOrderExpand = (orderRef: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderRef]: !prev[orderRef],
    }));
  };

  const statusTabs = [
    { key: 'all', label: 'Tất cả' },
    { key: 'paid', label: 'Đã thanh toán' },
    { key: 'pending', label: 'Chờ thanh toán' },
    { key: 'processing', label: 'Đang xử lý' },
    { key: 'cancelled', label: 'Đã hủy' },
  ];

  const buildTrackingHref = (order: PurchaseHistoryOrder) => {
    const params = new URLSearchParams();
    params.set('view', 'order-tracking');
    params.set('orderId', order.order_reference);
    if (order.shipping_address) params.set('address', order.shipping_address);
    if (order.supplier) params.set('supplier', order.supplier);
    if (order.customer_region) params.set('region', order.customer_region);
    if (order.status) params.set('status', order.status);
    return `/react/index.html?${params.toString()}`;
  };

  return (
    <div className="flex-1 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-50 pb-5">
        <div>
          <h2 className="text-[17px] font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Sparkles className="text-green-600" size={20} />
            {title}
          </h2>
          <p className="text-xs text-slate-400 font-medium">{description}</p>
        </div>

        <button
          type="button"
          onClick={() => void fetchOrders(true)}
          className="p-2.5 border border-gray-200 hover:bg-gray-50 rounded-2xl text-slate-500 hover:text-slate-800 transition-all active:scale-95"
          title="Làm mới dữ liệu"
        >
          {isRefreshing ? <LoaderCircle className="size-4 animate-spin text-green-600" /> : <RefreshCw size={16} />}
        </button>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-700 border border-gray-100 shadow-sm shrink-0">
            <ReceiptText size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Đơn mua sỉ</p>
            <h4 className="text-base font-black text-slate-800">{summary.orderCount} đơn</h4>
          </div>
        </div>

        <div className="bg-[#E9F8EF]/40 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm shrink-0">
            <ShoppingBag size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng thanh toán</p>
            <h4 className="text-base font-black text-emerald-700">{toCurrencyTextFromNumber(summary.totalPurchased)}</h4>
          </div>
        </div>

        <div className="bg-blue-50/40 border border-blue-100 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm shrink-0">
            <Clock3 size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Đã hoàn tất</p>
            <h4 className="text-base font-black text-blue-700">{summary.paidOrders} đơn</h4>
          </div>
        </div>

        <div className="bg-amber-50/40 border border-amber-100 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-600 border border-amber-100 shadow-sm shrink-0">
            <Clock3 size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Đang chờ</p>
            <h4 className="text-base font-black text-amber-700">{summary.pendingOrders} đơn</h4>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void fetchOrders(true, statusFilter, searchTerm);
              }
            }}
            placeholder="Tìm kiếm theo mã đơn hàng, nhà cung cấp, hoặc sản phẩm..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 bg-gray-50/50 focus:bg-white rounded-2xl text-xs font-bold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>

        <div className="flex overflow-x-auto bg-gray-100 p-1 rounded-xl scrollbar-none">
          {statusTabs.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.key);
                  void fetchOrders(true, tab.key, searchTerm);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${
                  active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Order Content list */}
      {isLoading ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-xs text-blue-800">
          Đang tải lịch sử mua hàng...
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-3 text-xs text-amber-800">
          {errorMessage}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <PackageSearch className="mx-auto size-12 text-slate-300" />
          <p className="mt-4 text-sm font-bold text-slate-700">{emptyTitle}</p>
          <p className="mt-1 text-xs text-slate-500">{emptyDescription}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusMeta = getStatusMeta(order.status);
            const isExpanded = !!expandedOrders[order.order_reference];

            return (
              <section
                key={order.order_reference}
                className="rounded-2xl border border-gray-100 bg-white p-5 hover:shadow-md transition-all duration-300"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-black tracking-wide text-white">
                        <ReceiptText className="size-3.5" />
                        {order.order_reference}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusMeta.className}`}
                      >
                        <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                        {order.status_label || statusMeta.label}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-400 font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-3.5 text-slate-400" />
                        Đặt lúc: {formatDateTime(order.created_at)}
                      </span>
                      {order.paid_at && (
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="size-3.5 text-slate-400" />
                          Đã thanh toán lúc: {formatDateTime(order.paid_at)}
                        </span>
                      )}
                      {order.delivery_date && (
                        <span className="inline-flex items-center gap-1">
                          <Truck className="size-3.5 text-slate-400" />
                          Giao hàng: {order.delivery_date} {order.delivery_time ? ` · ${order.delivery_time}` : ''}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-xl bg-slate-50/70 p-3 border border-slate-100/50">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Nhà bán sỉ (Supplier)</p>
                        <p className="mt-1 truncate text-xs font-black text-slate-800">{order.supplier || 'Freso Supplier'}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50/70 p-3 border border-slate-100/50">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Địa chỉ giao hàng</p>
                        <p className="mt-1 truncate text-xs font-black text-slate-800" title={order.shipping_address}>
                          {order.shipping_address || 'Nhận tại cửa hàng'}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50/70 p-3 border border-slate-100/50">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Ghi chú</p>
                        <p className="mt-1 truncate text-xs font-black text-slate-600" title={order.note}>
                          {order.note || 'Không có ghi chú'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 lg:w-[250px] text-right flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Tổng thanh toán</p>
                      <p className="mt-1 text-xl font-black text-emerald-800">{toCurrencyTextFromNumber(order.total_amount)}</p>
                    </div>
                    <a
                      href={buildTrackingHref(order)}
                      className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 transition-colors hover:bg-emerald-50"
                    >
                      <Truck className="size-3.5" />
                      Mở bản đồ tracking
                    </a>
                    {order.transaction_id && (
                      <div className="mt-3 inline-flex items-center justify-end gap-1.5 rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 self-end">
                        Mã GD: {order.transaction_id}
                      </div>
                    )}
                  </div>
                </div>

                {/* Collapsible Order items details */}
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => toggleOrderExpand(order.order_reference)}
                    className="flex w-full items-center justify-between text-xs font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700 transition"
                  >
                    <span>{isExpanded ? 'Ẩn theo dõi đơn hàng' : `Theo dõi đơn hàng và sản phẩm (${order.items.length})`}</span>
                    <ChevronDown className={`size-4 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      <OrderTrackingMap
                        order={{
                          orderReference: order.order_reference,
                          status: order.status,
                          statusLabel: order.status_label,
                          supplier: order.supplier,
                          customerRegion: order.customer_region,
                          shippingAddress: order.shipping_address,
                          deliveryDate: order.delivery_date,
                          deliveryTime: order.delivery_time,
                        }}
                      />

                      <div className="rounded-2xl border border-slate-100 bg-white p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sản phẩm trong đơn</p>
                            <h3 className="text-sm font-black text-slate-900">{order.items.length} mặt hàng</h3>
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          {order.items.map((item) => (
                            <div key={item.item_id} className="flex items-center gap-3 rounded-xl bg-slate-50/60 p-3 hover:bg-slate-100/40 transition-colors">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="size-11 rounded-lg object-cover border border-slate-200" />
                              ) : (
                                <div className="flex size-11 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-300">
                                  <PackageSearch className="size-5" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold text-slate-900">{item.name}</p>
                                <p className="mt-0.5 text-[10px] text-slate-500 font-semibold">
                                  {item.sku} · {item.category || 'Chưa phân loại'}
                                </p>
                              </div>
                              <div className="text-right text-xs">
                                <p className="font-bold text-slate-900">
                                  {item.quantity} {item.unit || 'SP'}
                                </p>
                                <p className="text-slate-500 font-semibold">{toCurrencyTextFromNumber(item.row_total)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
