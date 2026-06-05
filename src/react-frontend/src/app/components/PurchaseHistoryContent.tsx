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
  Store,
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
  parent_code?: string;
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
  shipping_info?: Record<string, any>;
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

  const groupedBlocks = useMemo(() => {
    const groups: Record<string, PurchaseHistoryOrder[]> = {};

    orders.forEach((order) => {
      if (order.parent_code === 'parent') {
        return;
      }
      const key = (order.parent_code && order.parent_code !== 'parent')
        ? order.parent_code
        : order.order_reference;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(order);
    });

    return Object.entries(groups).map(([parentCode, childOrders]) => {
      childOrders.sort((a, b) => a.order_reference.localeCompare(b.order_reference));
      const totalAmount = childOrders.reduce((sum, o) => sum + o.total_amount, 0);
      const createdAt = childOrders[0]?.created_at || '';
      return {
        parentCode,
        createdAt,
        totalAmount,
        orders: childOrders
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
      ) : groupedBlocks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <PackageSearch className="mx-auto size-12 text-slate-300" />
          <p className="mt-4 text-sm font-bold text-slate-700">{emptyTitle}</p>
          <p className="mt-1 text-xs text-slate-500">{emptyDescription}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedBlocks.map((block) => (
            <div
              key={block.parentCode}
              className="rounded-3xl border border-gray-150 bg-slate-50/20 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
            >
              {/* Parent Checkout Group Header */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-850 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ReceiptText className="size-4 text-emerald-400" />
                    <span className="text-[10px] font-black tracking-wider text-slate-300 uppercase">Đơn hàng tổng</span>
                    <span className="text-xs font-black text-white bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700">
                      #{block.parentCode}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1.5 flex items-center gap-1">
                    <CalendarClock className="size-3 text-slate-400" />
                    Đặt hàng lúc: {formatDateTime(block.createdAt)}
                  </p>
                </div>
                <div className="sm:text-right shrink-0">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Tổng thanh toán lần checkout</p>
                  <p className="text-lg font-black text-emerald-400 mt-0.5">{toCurrencyTextFromNumber(block.totalAmount)}</p>
                </div>
              </div>

              {/* Child Orders List */}
              <div className="p-4 space-y-4 bg-white divide-y divide-gray-100">
                {block.orders.map((order, index) => {
                  const statusMeta = getStatusMeta(order.status);
                  const isExpanded = !!expandedOrders[order.order_reference];

                  return (
                    <div key={order.order_reference} className={`pt-4 ${index === 0 ? 'pt-0' : 'pt-4'}`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3">
                            <div className="flex items-center gap-2">
                              <Store className="size-4.5 text-green-600 shrink-0" />
                              <span className="font-extrabold text-slate-800 text-sm tracking-tight hover:text-green-700 transition-colors">
                                {order.supplier || 'Freso Supplier'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                Mã: {order.order_reference}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusMeta.className}`}
                              >
                                <span className={`size-1.2 rounded-full ${statusMeta.dot}`} />
                                {order.status_label || statusMeta.label}
                              </span>
                            </div>
                          </div>

                          {(() => {
                            const supplierInfo = order.shipping_info?.supplier_info;
                            const carrierName = supplierInfo?.carrier || order.shipping_info?.carrier || 'Giao Hàng Tiết Kiệm (GHTK)';
                            const totalWeight = supplierInfo?.weight || order.shipping_info?.weight;

                            return (
                              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-xl bg-slate-50/70 p-2.5 border border-slate-100/30">
                                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Địa chỉ giao hàng</p>
                                  <p className="mt-1 truncate text-xs font-semibold text-slate-700" title={order.shipping_address}>
                                    {order.shipping_address || 'Nhận tại cửa hàng'}
                                  </p>
                                </div>
                                {order.delivery_date && (
                                  <div className="rounded-xl bg-slate-50/70 p-2.5 border border-slate-100/30">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Thời gian giao hàng</p>
                                    <p className="mt-1 truncate text-xs font-semibold text-slate-700">
                                      {order.delivery_date} {order.delivery_time ? ` · ${order.delivery_time}` : ''}
                                    </p>
                                  </div>
                                )}
                                <div className="rounded-xl bg-slate-50/70 p-2.5 border border-slate-100/30">
                                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Ghi chú đơn</p>
                                  <p className="mt-1 truncate text-xs font-semibold text-slate-600" title={order.note}>
                                    {order.note || 'Không có ghi chú'}
                                  </p>
                                </div>
                                <div className="rounded-xl bg-slate-50/70 p-2.5 border border-slate-100/30">
                                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Đơn vị vận chuyển</p>
                                  <p className="mt-1 truncate text-xs font-semibold text-slate-700">
                                    {carrierName} {totalWeight ? `(${Number(totalWeight).toFixed(1)} kg)` : ''}
                                  </p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/10 p-3 lg:w-[220px] text-right flex flex-col justify-between shrink-0">
                          <div className="flex justify-between items-center lg:block">
                            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-700">Tiền hàng & ship</p>
                            <p className="text-base font-black text-emerald-800 lg:mt-0.5">{toCurrencyTextFromNumber(order.total_amount)}</p>
                          </div>
                          <div className="flex gap-2 mt-3 justify-end">
                            <a
                              href={buildTrackingHref(order)}
                              className="inline-flex items-center justify-center gap-1 rounded-full border border-emerald-200 bg-white px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700 transition-colors hover:bg-emerald-50"
                            >
                              <Truck className="size-3" />
                              Tracking
                            </a>
                            {order.transaction_id && (
                              <div className="inline-flex items-center justify-center rounded-full border border-emerald-100 bg-white px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                                GD: {order.transaction_id}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Collapsible Order items details */}
                      <div className="mt-3 pt-3 border-t border-dashed border-slate-100">
                        <button
                          type="button"
                          onClick={() => toggleOrderExpand(order.order_reference)}
                          className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700 transition"
                        >
                          <span>{isExpanded ? 'Ẩn bản đồ & sản phẩm' : `Theo dõi đơn & sản phẩm (${order.items.length})`}</span>
                          <ChevronDown className={`size-3.5 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {isExpanded && (
                          <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
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

                            <div className="rounded-xl border border-slate-100 bg-slate-50/20 p-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">Chi tiết sản phẩm</p>
                              <div className="space-y-2">
                                {order.items.map((item) => (
                                  <div key={item.item_id} className="flex items-center gap-3 rounded-xl bg-white p-2.5 border border-slate-100 hover:bg-slate-50/50 transition-colors">
                                    {item.image ? (
                                      <img src={item.image} alt={item.name} className="size-10 rounded-lg object-cover border border-slate-200 shrink-0" />
                                    ) : (
                                      <div className="flex size-10 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-300 shrink-0">
                                        <PackageSearch className="size-4" />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-bold text-slate-900">{item.name}</p>
                                      <p className="mt-0.5 text-[9px] text-slate-500 font-semibold">
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
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
