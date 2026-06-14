import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Clock3,
  FileText,
  LoaderCircle,
  PackageSearch,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
  ChevronDown,
  CheckSquare,
  PackageCheck,
  XCircle,
} from 'lucide-react';
import { toCurrencyTextFromNumber } from '../cart/CartProvider';
import { OrderTrackingMap } from './OrderTrackingMap';

type SellerOrderItem = {
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

type SellerOrder = {
  order_reference: string;
  status: string;
  status_label: string;
  customer_name: string;
  customer_email: string;
  customer_region: string;
  supplier: string;
  subtotal: number;
  seller_subtotal: number;
  total_amount: number;
  delivery_date: string;
  delivery_time: string;
  shipping_address: string;
  shipping_info?: Record<string, unknown>;
  note: string;
  created_at: string;
  transaction_id: string;
  expires_at: string;
  paid_at: string;
  payment_method?: string;
  item_count: number;
  quantity_total: number;
  items: SellerOrderItem[];
};

const getAuthToken = () =>
  window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';

const formatDateTime = (value: string) => {
  if (!value) return 'Chưa cập nhật';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('vi-VN');
};

const getStatusMeta = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'paid') {
    return { label: 'Đã thanh toán', className: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' };
  }
  if (normalized === 'processing') {
    return { label: 'Đang xử lý', className: 'bg-blue-50 text-blue-700 border-blue-100', dot: 'bg-blue-500' };
  }
  if (normalized === 'preparing') {
    return { label: 'Đang chuẩn bị hàng', className: 'bg-indigo-50 text-indigo-700 border-indigo-100', dot: 'bg-indigo-500' };
  }
  if (normalized === 'handed_over' || normalized === 'shipping') {
    return { label: 'Đang giao hàng', className: 'bg-orange-50 text-orange-700 border-orange-100', dot: 'bg-orange-500' };
  }
  if (normalized === 'delivered') {
    return { label: 'Đã giao hàng', className: 'bg-teal-50 text-teal-700 border-teal-100', dot: 'bg-teal-500' };
  }
  if (normalized === 'cancelled' || normalized === 'canceled') {
    return { label: 'Đã hủy', className: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-500' };
  }
  if (normalized === 'expired') {
    return { label: 'Hết hạn', className: 'bg-rose-50 text-rose-700 border-rose-100', dot: 'bg-rose-500' };
  }
  return { label: 'Chờ thanh toán', className: 'bg-amber-50 text-amber-800 border-amber-100', dot: 'bg-amber-500' };
};

export function SellerOrderManager() {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const summary = useMemo(() => {
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.seller_subtotal || 0), 0);
    const paidOrders = orders.filter((order) => ['paid', 'preparing', 'handed_over', 'shipping', 'delivered'].includes(order.status.trim().toLowerCase())).length;
    const pendingOrders = orders.filter((order) => order.status.trim().toLowerCase() === 'pending').length;
    const processingOrders = orders.filter((order) => order.status.trim().toLowerCase() === 'processing').length;

    return {
      totalRevenue,
      totalOrders: orders.length,
      paidOrders,
      pendingOrders,
      processingOrders,
    };
  }, [orders]);

  const fetchOrders = async (showSpinner = false, nextStatusFilter = statusFilter, nextSearchTerm = searchTerm) => {
    const token = getAuthToken();
    if (!token) {
      setErrorMessage('Vui lòng đăng nhập để xem danh sách đơn hàng.');
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
      params.set('limit', '20');
      if (nextStatusFilter !== 'all') {
        params.set('status', nextStatusFilter);
      }
      if (nextSearchTerm.trim()) {
        params.set('q', nextSearchTerm.trim());
      }

      const response = await fetch(`/rest/V1/tmdt-catalog/orders?${params.toString()}`, {
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
      if (Array.isArray(json)) {
        if (json[0] === true && Array.isArray(json[2])) {
          setOrders(json[2]);
        } else if (Array.isArray(json[1])) {
          setOrders(json[1]);
        } else {
          setOrders(json as SellerOrder[]);
        }
      } else if (json && Array.isArray(json.items)) {
        setOrders(json.items);
      } else {
        setOrders([]);
      }
      setErrorMessage('');
    } catch {
      setErrorMessage('Không tải được danh sách đơn hàng. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const statusFilterRef = useRef(statusFilter);
  const searchTermRef = useRef(searchTerm);

  useEffect(() => {
    statusFilterRef.current = statusFilter;
  }, [statusFilter]);

  useEffect(() => {
    searchTermRef.current = searchTerm;
  }, [searchTerm]);

  useEffect(() => {
    void fetchOrders(false);

    const handleRefreshOrders = () => {
      void fetchOrders(true, statusFilterRef.current, searchTermRef.current);
    };

    window.addEventListener('freso:refresh-orders', handleRefreshOrders);
    return () => {
      window.removeEventListener('freso:refresh-orders', handleRefreshOrders);
    };
  }, []);

  const toggleOrderExpand = (orderRef: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderRef]: !prev[orderRef],
    }));
  };

  const handleConfirmPayment = async (orderCode: string) => {
    const token = getAuthToken();
    if (!token) return;

    if (!window.confirm(`Bạn có chắc chắn muốn xác nhận đã thu tiền cho đơn hàng ${orderCode}?`)) {
      return;
    }

    try {
      const res = await fetch(`${window.location.origin}/rest/V1/tmdt-orders/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderCode }),
      });

      if (res.ok) {
        alert('Xác nhận thanh toán đơn hàng thành công!');
        void fetchOrders(true);
      } else {
        const data = await res.json();
        alert(data.message || 'Có lỗi xảy ra khi xác nhận thanh toán.');
      }
    } catch {
      alert('Không thể kết nối đến máy chủ.');
    }
  };

  const handleUpdateFulfillment = async (orderCode: string, targetStatus: string, actionLabel: string) => {
    const token = getAuthToken();
    if (!token) return;

    const confirmMessage = targetStatus === 'cancelled'
      ? `Bạn có chắc chắn muốn hủy đơn hàng ${orderCode}?`
      : `Bạn có chắc chắn muốn chuyển trạng thái đơn hàng ${orderCode} sang "${actionLabel}"?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const res = await fetch(`${window.location.origin}/rest/V1/tmdt-orders/update-fulfillment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderCode, status: targetStatus }),
      });

      if (res.ok) {
        const successMessage = targetStatus === 'cancelled'
          ? `Đơn hàng ${orderCode} đã được hủy thành công!`
          : `Đơn hàng ${orderCode} đã chuyển sang trạng thái "${actionLabel}" thành công!`;
        alert(successMessage);
        void fetchOrders(true);
      } else {
        const data = await res.json();
        alert(data.message || 'Có lỗi xảy ra khi cập nhật trạng thái đơn hàng.');
      }
    } catch {
      alert('Không thể kết nối đến máy chủ.');
    }
  };

  const statusTabs = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Chờ thanh toán' },
    { key: 'processing', label: 'Đang xử lý' },
    { key: 'paid', label: 'Đã thanh toán' },
    { key: 'preparing', label: 'Chuẩn bị hàng' },
    { key: 'shipping', label: 'Đang giao' },
    { key: 'delivered', label: 'Đã giao' },
    { key: 'cancelled', label: 'Đã hủy' },
    { key: 'expired', label: 'Hết hạn' },
  ];

  return (
    <div className="flex-1 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-50 pb-5">
        <div>
          <h2 className="text-[17px] font-black text-slate-800 tracking-tight flex items-center gap-2">
            <FileText className="text-green-600" size={20} />
            Quản lý đơn hàng sỉ (Seller Orders)
          </h2>
          <p className="text-xs text-slate-400 font-medium">Theo dõi trạng thái đơn hàng B2B, doanh thu sỉ và thông tin khách hàng</p>
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
            <FileText size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng số đơn</p>
            <h4 className="text-base font-black text-slate-800">{summary.totalOrders} đơn</h4>
          </div>
        </div>

        <div className="bg-[#E9F8EF]/40 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm shrink-0">
            <ShoppingBag size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Doanh thu sỉ</p>
            <h4 className="text-base font-black text-emerald-700">{toCurrencyTextFromNumber(summary.totalRevenue)}</h4>
          </div>
        </div>

        <div className="bg-blue-50/40 border border-blue-100 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm shrink-0">
            <Clock3 size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Đã trả</p>
            <h4 className="text-base font-black text-blue-700">{summary.paidOrders} đơn</h4>
          </div>
        </div>

        <div className="bg-amber-50/40 border border-amber-100 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-600 border border-amber-100 shadow-sm shrink-0">
            <Clock3 size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cần xử lý</p>
            <h4 className="text-base font-black text-amber-700">{summary.pendingOrders + summary.processingOrders} đơn</h4>
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
            placeholder="Tìm theo mã đơn, khách hàng, SKU, ghi chú..."
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

      {/* Main orders content */}
      {isLoading ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-xs text-blue-800">
          Đang tải danh sách đơn hàng...
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-xs text-rose-800">
          {errorMessage}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <PackageSearch className="mx-auto size-12 text-slate-300" />
          <p className="mt-4 text-sm font-bold text-slate-700">Chưa có đơn hàng phù hợp</p>
          <p className="mt-1 text-xs text-slate-500">Hãy thử thay đổi bộ lọc trạng thái hoặc từ khoá tìm kiếm.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = !!expandedOrders[order.order_reference];
            return (
              <article
                key={order.order_reference}
                className="rounded-2xl border border-gray-100 bg-white p-5 hover:shadow-md transition-all duration-300"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-black tracking-wide text-white">
                        <ShoppingBag className="size-3.5" />
                        {order.order_reference}
                      </div>
                      {(() => {
                        const statusMeta = getStatusMeta(order.status);
                        return (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusMeta.className}`}
                          >
                            <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                            {order.status_label || statusMeta.label}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-400 font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3.5 text-slate-400" />
                        Đặt lúc: {formatDateTime(order.created_at)}
                      </span>
                      {order.delivery_date && (
                        <span className="inline-flex items-center gap-1">
                          <Truck className="size-3.5 text-slate-400" />
                          Giao nhận: {order.delivery_date} {order.delivery_time ? ` · ${order.delivery_time}` : ''}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl bg-slate-50/70 p-3 border border-slate-100/50">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Khách hàng</p>
                        <p className="mt-1 truncate text-xs font-black text-slate-800">{order.customer_name || 'Chưa có tên'}</p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-500">{order.customer_email || 'Chưa có email'}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50/70 p-3 border border-slate-100/50">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Khu vực</p>
                        <p className="mt-1 text-xs font-black text-slate-800">{order.customer_region || 'Chưa xác định'}</p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-500" title={order.shipping_address}>
                          {order.shipping_address || 'Nhận trực tiếp'}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50/70 p-3 border border-slate-100/50">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Sản phẩm sỉ</p>
                        <p className="mt-1 text-xs font-black text-slate-800">{order.item_count} dòng mặt hàng</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{order.quantity_total} đơn vị số lượng</p>
                      </div>
                      <div className="rounded-xl bg-green-50/40 p-3 border border-green-100/50">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-green-700">Doanh thu seller</p>
                        <p className="mt-1 text-xs font-black text-green-800">{toCurrencyTextFromNumber(order.seller_subtotal)}</p>
                        <p className="mt-0.5 text-[10px] text-green-600">Tổng tiền chia sẻ cho seller</p>
                      </div>
                    </div>

                    {order.note && (
                      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-500 font-semibold leading-relaxed">
                        Ghi chú từ khách hàng: {order.note}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 lg:w-[250px] text-right flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Tổng hóa đơn</p>
                      <p className="mt-1 text-xl font-black text-emerald-800">{toCurrencyTextFromNumber(order.total_amount)}</p>
                      <p className="mt-1 text-[11px] text-emerald-600">
                        Seller chia sẻ: <span className="font-bold">{toCurrencyTextFromNumber(order.seller_subtotal)}</span>
                      </p>
                    </div>

                    <div className="mt-4 flex flex-col gap-1 items-end">
                      {order.transaction_id && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          Mã GD: {order.transaction_id}
                        </span>
                      )}
                      {order.paid_at && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          Đã trả: {formatDateTime(order.paid_at)}
                        </span>
                      )}
                      {(order.status === 'paid' || order.status === 'processing') && (
                        <button
                          type="button"
                          onClick={() => void handleUpdateFulfillment(order.order_reference, 'preparing', 'Chuẩn bị hàng')}
                          className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <PackageCheck className="size-3.5" />
                          Chuẩn bị hàng
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          type="button"
                          onClick={() => void handleUpdateFulfillment(order.order_reference, 'shipping', 'Giao hàng')}
                          className="mt-3 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-full text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5 animate-in fade-in duration-300"
                        >
                          <Truck className="size-3.5" />
                          Giao hàng
                        </button>
                      )}
                      {['pending', 'paid', 'processing', 'preparing'].includes(order.status) && (
                        <button
                          type="button"
                          onClick={() => void handleUpdateFulfillment(order.order_reference, 'cancelled', 'Hủy đơn hàng')}
                          className="mt-3 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-full text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border border-rose-200"
                        >
                          <XCircle className="size-3.5" />
                          Hủy đơn hàng
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Collapsible Order items details */}
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => toggleOrderExpand(order.order_reference)}
                    className="flex w-full items-center justify-between text-xs font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700 transition"
                  >
                    <span>{isExpanded ? 'Ẩn bản đồ & sản phẩm' : `Theo dõi đơn & sản phẩm (${order.items.length})`}</span>
                    <ChevronDown className={`size-4 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      <OrderTrackingMap
                        order={{
                          orderReference: order.order_reference,
                          status: order.status,
                          statusLabel: order.status_label,
                          supplier: order.supplier || 'Organica Supplier',
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
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
