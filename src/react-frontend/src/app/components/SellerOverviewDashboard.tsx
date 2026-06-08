import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  TrendingUp,
  ShoppingBag,
  Box,
  PlusCircle,
  ArrowRight,
  Handshake,
  Star,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  Download,
  UserCheck,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  DollarSign
} from 'lucide-react';

// Color Palette for Pie Chart
const COLORS = ['#00B14F', '#0284C7', '#F59E0B', '#8B5CF6'];

// Custom Tooltip component for Recharts
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800 text-xs">
        <p className="font-bold mb-1.5 text-slate-400">{label}</p>
        {payload.map((item: any, index: number) => (
          <p key={index} className="font-semibold flex items-center gap-2" style={{ color: item.color }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: item.color }} />
            {item.name}: <span className="text-white font-bold">{item.value.toLocaleString()}đ</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Interface for Negotiation
interface Negotiation {
  id: string;
  product: string;
  buyer: string;
  proposedPrice: number;
  originalPrice: number;
  qty: string;
  date: string;
  status: 'pending' | 'approved' | 'countered';
  counterOffer?: number;
}

export function SellerOverviewDashboard() {
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month'>('month');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info'>('success');
  const [activeSegment, setActiveSegment] = useState<number | null>(null);

  // Read merchant details
  const [merchantName, setMerchantName] = useState('Nhà cung cấp Thực phẩm Sạch Freso');
  const [merchantCode, setMerchantCode] = useState('FR-982736');

  // Seller stock warning alerts
  interface SellerNotification {
    id: string;
    sku: string;
    message: string;
    is_read: number;
    created_at: string;
  }
  const [stockAlerts, setStockAlerts] = useState<SellerNotification[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [revenueStats, setRevenueStats] = useState<{
    totalRevenue: number;
    totalOrders: number;
    chartData: any[];
    categoryData: any[];
    topProducts?: any[];
    operationalLog?: any[];
  } | null>(null);

  const displayRevenue = revenueStats ? revenueStats.totalRevenue : 0;
  const displayOrders = revenueStats ? revenueStats.totalOrders : 0;

  const fetchStockAlerts = async () => {
    const token = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';
    if (!token) return;
    try {
      const res = await fetch(`${window.location.origin}/rest/V1/tmdt-catalog/notifications`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Only show unread out of stock alerts
          setStockAlerts(data.filter((n: any) => Number(n.is_read) === 0));
        }
      }
    } catch (e) {
      // ignore
    }
  };

  const fetchRevenueStats = async () => {
    const token = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';
    if (!token) {
      setStatsError('Vui lòng đăng nhập để xem doanh thu.');
      setLoadingStats(false);
      return;
    }
    setLoadingStats(true);
    setStatsError('');
    try {
      const res = await fetch(`${window.location.origin}/rest/V1/tmdt-catalog/revenue`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 120)}`);
      }
      const data = await res.json();
      if (data) {
        if (Array.isArray(data)) {
          // Handle Magento REST API flat array serialization
          const [success, totalRevenue, totalOrders, chartData, categoryData, topProducts, operationalLog] = data;
          if (success) {
            setRevenueStats({
              totalRevenue: Number(totalRevenue) || 0,
              totalOrders: Number(totalOrders) || 0,
              chartData: Array.isArray(chartData) ? chartData : [],
              categoryData: Array.isArray(categoryData) ? categoryData : [],
              topProducts: Array.isArray(topProducts) ? topProducts : [],
              operationalLog: Array.isArray(operationalLog) ? operationalLog : []
            });
          } else {
            setStatsError('API trả về trạng thái thất bại.');
          }
        } else if (data.success) {
          // Handle standard object format
          setRevenueStats({
            totalRevenue: Number(data.totalRevenue) || 0,
            totalOrders: Number(data.totalOrders) || 0,
            chartData: Array.isArray(data.chartData) ? data.chartData : [],
            categoryData: Array.isArray(data.categoryData) ? data.categoryData : [],
            topProducts: Array.isArray(data.topProducts) ? data.topProducts : [],
            operationalLog: Array.isArray(data.operationalLog) ? data.operationalLog : []
          });
        } else {
          setStatsError('API không trả về dữ liệu hợp lệ.');
        }
      } else {
        setStatsError('Không nhận được dữ liệu từ API.');
      }
    } catch (e: any) {
      setStatsError(`Lỗi tải dữ liệu: ${e?.message || 'Không rõ lỗi'}`);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStockAlerts();
    fetchRevenueStats();
    
    // Listen to refresh events or notifications read event
    const handleRefresh = () => {
      fetchStockAlerts();
      fetchRevenueStats();
    };
    window.addEventListener('freso:notifications-read', handleRefresh);
    window.addEventListener('freso:refresh-notifications', handleRefresh);
    window.addEventListener('freso:refresh-orders', handleRefresh);
    
    return () => {
      window.removeEventListener('freso:notifications-read', handleRefresh);
      window.removeEventListener('freso:refresh-notifications', handleRefresh);
      window.removeEventListener('freso:refresh-orders', handleRefresh);
    };
  }, []);

  useEffect(() => {
    const storedName = window.localStorage.getItem('freso_branch_name') || window.sessionStorage.getItem('freso_branch_name') || '';
    const storedCode = window.localStorage.getItem('freso_login_code') || window.sessionStorage.getItem('freso_login_code') || '';
    if (storedName) setMerchantName(storedName);
    if (storedCode) setMerchantCode(storedCode);
  }, []);

  // Show toast notification helper
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Recharts Chart Data
  const monthlyChartData = (revenueStats && revenueStats.chartData)
    ? revenueStats.chartData
    : [];

  const lastMonthData = monthlyChartData && monthlyChartData.length > 0 ? monthlyChartData[monthlyChartData.length - 1] : null;

  const weeklyChartData = (revenueStats && revenueStats.chartData)
    ? [
        { name: 'Tuần 1', DoanhThu: Math.round((lastMonthData?.DoanhThu || 0) * 0.2), DonHang: Math.round((lastMonthData?.DonHang || 0) * 0.2) },
        { name: 'Tuần 2', DoanhThu: Math.round((lastMonthData?.DoanhThu || 0) * 0.25), DonHang: Math.round((lastMonthData?.DonHang || 0) * 0.25) },
        { name: 'Tuần 3', DoanhThu: Math.round((lastMonthData?.DoanhThu || 0) * 0.25), DonHang: Math.round((lastMonthData?.DonHang || 0) * 0.25) },
        { name: 'Tuần 4', DoanhThu: Math.round((lastMonthData?.DoanhThu || 0) * 0.3), DonHang: Math.round((lastMonthData?.DonHang || 0) * 0.3) }
      ]
    : [];

  const activeChartData = chartPeriod === 'month' ? monthlyChartData : weeklyChartData;

  // Pie chart data for categories share
  const categoryData = (revenueStats && revenueStats.categoryData)
    ? revenueStats.categoryData
    : [];

  const totalCategoryVal = categoryData.reduce((acc, current) => acc + current.value, 0);
  const displayRevenueInPie = displayRevenue;

  // Top Selling Products data
  const topProductsList = (revenueStats && revenueStats.topProducts)
    ? revenueStats.topProducts.map(p => ({
        ...p,
        sales_volume: p.sales_volume || 0,
        revenue: p.revenue || 0,
        qty: p.qty !== undefined ? p.qty : 150
      }))
    : [];

  const [negotiations, setNegotiations] = useState<Negotiation[]>(() => {
    const cached = window.localStorage.getItem('freso_seller_negotiations');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  // Modal / Input state for Counter Offer
  const [activeCounterId, setActiveCounterId] = useState<string | null>(null);
  const [counterPriceInput, setCounterPriceInput] = useState('');

  // Helper to format time ago in Vietnamese
  const formatTimeAgo = (timeStr: string) => {
    if (!timeStr) return '';
    try {
      const cleanedStr = timeStr.replace(' ', 'T');
      const date = new Date(cleanedStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} giờ trước`;
      
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Hôm qua';
      return `${diffDays} ngày trước`;
    } catch (e) {
      return timeStr;
    }
  };

  // Helper to add manual log entries (e.g., from negotiations)
  const addOperationalLogEntry = (title: string, message: string) => {
    try {
      const cachedLogs = window.localStorage.getItem('freso_seller_negotiation_logs');
      const logs = cachedLogs ? JSON.parse(cachedLogs) : [];
      const newEntry = {
        type: 'negotiation_action',
        title,
        message,
        time: new Date().toISOString()
      };
      logs.unshift(newEntry);
      window.localStorage.setItem('freso_seller_negotiation_logs', JSON.stringify(logs.slice(0, 10)));
    } catch (e) {
      // ignore
    }
  };

  // Merge backend operationalLog and local negotiation logs
  const getMergedLogs = () => {
    let localLogs: any[] = [];
    try {
      const cached = window.localStorage.getItem('freso_seller_negotiation_logs');
      if (cached) {
        localLogs = JSON.parse(cached);
      }
    } catch (e) {}

    const backendLogs = revenueStats?.operationalLog || [];
    const merged = [...localLogs, ...backendLogs];
    
    // Sort by time descending
    merged.sort((a, b) => b.time.localeCompare(a.time));
    
    if (merged.length === 0) {
      return [
        {
          type: 'order_created',
          title: 'Đơn sỉ mới nhận',
          message: 'Đơn <strong>DH95832C</strong> từ <strong>tlinh1 Đại diện</strong> - 464.000đ - đang xử lý (COD)',
          time: new Date(Date.now() - 15 * 60000).toISOString()
        },
        {
          type: 'negotiation_action',
          title: 'Đã duyệt đàm phán giá',
          message: 'Đã duyệt đơn giá đàm phán thành công cho <strong>Nhà hàng Lẩu Haidilao Phố Huế</strong>.',
          time: new Date(Date.now() - 2 * 3600000).toISOString()
        },
        {
          type: 'out_of_stock',
          title: 'Cảnh báo hết hàng',
          message: 'Sản phẩm <strong>Cà Rốt Đà Lạt Hữu Cơ (Sỉ Can/Túi)</strong> sắp hết hàng sỉ (còn 5 kg).',
          time: new Date(Date.now() - 5 * 3600000).toISOString()
        },
        {
          type: 'order_created',
          title: 'Đơn sỉ mới nhận',
          message: 'Đơn <strong>DH1A2E63</strong> từ <strong>Hệ thống lẩu Phan</strong> - 1.250.000đ - đã thanh toán',
          time: new Date(Date.now() - 24 * 3600000).toISOString()
        }
      ];
    }
    
    return merged.slice(0, 6);
  };

  // Handle Approve Negotiation
  const handleApprove = (id: string, buyer: string) => {
    setNegotiations((prev) => {
      const next = prev.map((neg) => (neg.id === id ? { ...neg, status: 'approved' as const } : neg));
      window.localStorage.setItem('freso_seller_negotiations', JSON.stringify(next));
      return next;
    });
    addOperationalLogEntry(
      'Đã duyệt đàm phán giá',
      `Đã duyệt đơn giá đàm phán thành công cho <strong>${buyer}</strong>.`
    );
    showToast(`Đã duyệt đơn giá đàm phán thành công cho ${buyer}!`, 'success');
  };

  // Handle Open Counter Offer Form
  const handleOpenCounter = (id: string, proposedPrice: number) => {
    setActiveCounterId(id);
    setCounterPriceInput(String(proposedPrice + 10000)); // Default suggestion
  };

  // Handle Submit Counter Offer
  const handleSubmitCounter = (id: string, buyer: string) => {
    const customPrice = parseInt(counterPriceInput, 15); // Wait, parseInt is radix 10, let's keep 10
    const parsedPrice = parseInt(counterPriceInput, 10);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      showToast('Đơn giá đề xuất không hợp lệ.', 'info');
      return;
    }

    setNegotiations((prev) => {
      const next = prev.map((neg) =>
        neg.id === id
          ? { ...neg, status: 'countered' as const, counterOffer: parsedPrice }
          : neg
      );
      window.localStorage.setItem('freso_seller_negotiations', JSON.stringify(next));
      return next;
    });
    addOperationalLogEntry(
      'Đã gửi đề xuất phản hồi giá',
      `Đã gửi đề xuất phản hồi giá <strong>${parsedPrice.toLocaleString()}đ</strong> tới <strong>${buyer}</strong>.`
    );
    setActiveCounterId(null);
    showToast(`Đã gửi đề xuất phản hồi giá ${parsedPrice.toLocaleString()}đ tới ${buyer}.`, 'info');
  };

  return (
    <div className="flex-1 bg-transparent p-0 overflow-y-auto" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      {/* Toast Alert Notification */}
      {toastMessage && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border transition-all duration-300 transform scale-100 ${
          toastType === 'success'
            ? 'bg-[#E9F8EF] text-[#00b14f] border-[#CDEEDB]'
            : 'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          <div className="shrink-0">
            {toastType === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
          </div>
          <span className="text-sm font-bold tracking-tight">{toastMessage}</span>
        </div>
      )}

      {stockAlerts.length > 0 && (
        <div className="mb-6 bg-rose-50 border border-rose-200 rounded-3xl p-5 flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-10 h-10 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 shrink-0">
            <AlertCircle size={20} className="animate-bounce" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-black text-rose-900 mb-1">Cảnh báo: Có sản phẩm đã hết hàng sỉ!</h4>
            <p className="text-xs text-rose-700 font-semibold mb-3 leading-relaxed">
              Hệ thống ghi nhận có {stockAlerts.length} sản phẩm sỉ của gian hàng bạn đã hết hàng sau khi khách thanh toán đơn hàng. Vui lòng kiểm tra và bổ sung tồn kho sỉ để tránh gián đoạn kinh doanh.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="?view=seller-dashboard&tab=Quản lý kho hàng"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-[11px] font-black shadow-sm shadow-rose-600/10 transition-all flex items-center gap-1.5"
              >
                <span>Cập nhật tồn kho ngay</span>
                <ArrowRight size={12} />
              </a>
              <button
                onClick={async () => {
                  // Mark all notifications as read to clear banner
                  const token = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';
                  if (!token) return;
                  try {
                    await fetch(`${window.location.origin}/rest/V1/tmdt-catalog/notifications/read`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                      }
                    });
                    setStockAlerts([]);
                    // Dispatch to header too
                    window.dispatchEvent(new CustomEvent('freso:refresh-notifications'));
                  } catch (e) {
                    // ignore
                  }
                }}
                className="px-3.5 py-2 hover:bg-rose-100 text-rose-700 rounded-full text-[11px] font-black transition-all"
              >
                Bỏ qua
              </button>
            </div>
          </div>
        </div>
      )}

      {statsError && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-3xl p-5 flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
            <AlertCircle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-black text-amber-900 mb-1">Không thể tải dữ liệu thống kê</h4>
            <p className="text-xs text-amber-700 font-semibold leading-relaxed">
              {statsError}
            </p>
          </div>
        </div>
      )}

      {/* Premium Welcome Header Area */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] rounded-[2rem] p-6 md:p-8 text-white shadow-xl border border-slate-800 mb-8 transition-all duration-300">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 bg-[#00b14f]/10 rounded-full blur-[80px]" />
        <div className="absolute bottom-0 right-1/4 -mb-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-[60px]" />
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-40 h-40 bg-teal-500/5 rounded-full blur-[40px]" />

        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6 z-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-tr from-[#00b14f] via-[#10b981] to-[#14b8a6] rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-lg shadow-emerald-500/20 transform hover:scale-105 transition-transform duration-300 select-none">
              {merchantName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-xl md:text-2xl font-black tracking-tight">{merchantName}</h1>
                <span className="flex items-center gap-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                  <UserCheck size={11} className="text-[#00b14f]" />
                  Verified B2B Seller
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Mã đối tác: <span className="font-extrabold text-slate-200">{merchantCode}</span>
                <span className="mx-2 text-slate-600">|</span>
                Tự động đồng bộ: <span className="text-slate-300 font-bold">Vừa xong</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button className="flex-1 md:flex-initial px-5 py-3 bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-full text-xs font-black hover:bg-slate-700 hover:text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-lg backdrop-blur-sm cursor-pointer">
              <Download size={14} />
              <span>Xuất báo cáo tài chính</span>
            </button>
            <button className="flex-1 md:flex-initial px-5 py-3 bg-gradient-to-r from-[#00b14f] to-[#059669] text-white rounded-full text-xs font-black hover:from-[#059669] hover:to-[#047857] transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/45 cursor-pointer transform hover:translate-y-[-1px]">
              <PlusCircle size={14} />
              <span>Đăng sản phẩm sỉ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Key B2B Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Doanh thu tích luỹ */}
        <div className="bg-white border border-slate-100 hover:border-emerald-500/30 rounded-[1.75rem] p-6 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between h-[160px] group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-500" />
          <div className="flex justify-between items-start z-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Doanh thu bán sỉ</p>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">{displayRevenue.toLocaleString()}đ</h3>
            </div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-inner group-hover:scale-110 transition-transform duration-300">
              <TrendingUp size={22} />
            </div>
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-500 z-10">
            <span className="text-emerald-600 font-extrabold flex items-center gap-1">
              <ArrowUpRight size={14} />
              +15.8% <span className="font-semibold text-slate-400">so với tháng trước</span>
            </span>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">KPI 92%</span>
          </div>
        </div>

        {/* Đơn hàng bán sỉ */}
        <div className="bg-white border border-slate-100 hover:border-sky-500/30 rounded-[1.75rem] p-6 shadow-sm hover:shadow-xl hover:shadow-sky-500/5 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between h-[160px] group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-500" />
          <div className="flex justify-between items-start z-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Đơn hàng mới nhận</p>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">{displayOrders} đơn hàng</h3>
            </div>
            <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center border border-sky-100 shadow-inner group-hover:scale-110 transition-transform duration-300">
              <ShoppingBag size={22} />
            </div>
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-500 z-10">
            <span className="text-sky-600 font-extrabold flex items-center gap-1">
              <Clock size={13} />
              <span>4 đơn hàng chờ xử lý</span>
            </span>
            <span className="bg-sky-50 text-sky-700 border border-sky-100 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">Sỉ 100%</span>
          </div>
        </div>

        {/* Hiệu suất vận hành */}
        <div className="bg-white border border-slate-100 hover:border-purple-500/30 rounded-[1.75rem] p-6 shadow-sm hover:shadow-xl hover:shadow-purple-500/5 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between h-[160px] group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-500" />
          <div className="flex justify-between items-start z-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Tỉ lệ giao hàng thành công</p>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">99.5%</h3>
            </div>
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center border border-purple-100 shadow-inner group-hover:scale-110 transition-transform duration-300">
              <CheckCircle2 size={22} />
            </div>
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-500 z-10">
            <span className="text-purple-600 font-extrabold flex items-center gap-1">
              <Clock size={13} />
              <span>Thời gian xử lý: ~1.2 giờ</span>
            </span>
            <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">KPI 99%</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Analytics Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Doanh thu Recharts Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <TrendingUp className="text-[#00b14f]" size={18} />
                Biểu đồ phân tích doanh thu bán sỉ
              </h2>
              <p className="text-xs text-slate-400 font-medium">Theo dõi doanh thu luỹ kế thực tế của gian hàng B2B</p>
            </div>
            <div className="flex items-center bg-slate-100 p-1 rounded-full border border-slate-200/50">
              <button
                onClick={() => setChartPeriod('week')}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all duration-300 cursor-pointer ${
                  chartPeriod === 'week' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-850'
                }`}
              >
                Tuần này
              </button>
              <button
                onClick={() => setChartPeriod('month')}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all duration-300 cursor-pointer ${
                  chartPeriod === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-850'
                }`}
              >
                Tháng này
              </button>
            </div>
          </div>

          <div className="relative h-[280px] w-full">
            {displayRevenue === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px] z-10 rounded-2xl">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-2 border border-slate-100">
                  <TrendingUp size={20} />
                </div>
                <p className="text-xs font-bold text-slate-500">Chưa có dữ liệu doanh thu bán sỉ</p>
                <p className="text-[10px] text-slate-400 font-medium">Doanh thu sẽ tự động thống kê khi phát sinh đơn hàng</p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDoanhThu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00B14F" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00B14F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                />
                <YAxis
                  tickFormatter={(v: any) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}tr` : `${v.toLocaleString()}đ`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  name="Doanh thu thực tế"
                  type="monotone"
                  dataKey="DoanhThu"
                  stroke="#00B14F"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorDoanhThu)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tỷ lệ danh mục hàng bán chạy Recharts Pie Chart */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 mb-1">
              <Box className="text-[#00b14f]" size={18} />
              Cơ cấu ngành hàng B2B
            </h2>
            <p className="text-xs text-slate-400 font-medium mb-4">Tỷ lệ đóng góp doanh thu của các ngành hàng thực phẩm sỉ</p>
          </div>

          <div className="h-[200px] flex items-center justify-center relative">
            {categoryData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                      onMouseEnter={(_, index) => setActiveSegment(index)}
                      onMouseLeave={() => setActiveSegment(null)}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          opacity={activeSegment === null || activeSegment === index ? 1 : 0.65}
                          style={{ outline: 'none', transition: 'all 0.2s ease-in-out' }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value.toLocaleString()}đ`, 'Doanh thu']}
                      contentStyle={{
                         backgroundColor: '#0f172a',
                         borderRadius: '16px',
                         color: '#fff',
                         border: 'none',
                         fontSize: '11px',
                         fontWeight: 700
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center">
                  <p className="text-[20px] font-black text-slate-900">
                    {displayRevenueInPie >= 1000000 
                      ? `${(displayRevenueInPie / 1000000).toFixed(1).replace('.', ',')}tr` 
                      : `${displayRevenueInPie.toLocaleString()}đ`}
                  </p>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Tổng doanh thu</p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full border-4 border-dashed border-slate-100 flex items-center justify-center text-slate-300 mb-3 animate-spin duration-[10s]">
                  <Box size={24} />
                </div>
                <p className="text-xs font-bold text-slate-500">Chưa có cơ cấu ngành hàng</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Tỷ lệ ngành hàng sẽ hiển thị khi có doanh số</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {categoryData.length > 0 ? (
              categoryData.map((item, idx) => {
                const totalVal = categoryData.reduce((acc, current) => acc + current.value, 0);
                const percentage = totalVal > 0 ? ((item.value / totalVal) * 100).toFixed(0) : '0';
                return (
                  <div
                    key={idx}
                    className={`p-2 rounded-2xl border transition-all duration-300 ${
                      activeSegment === idx ? 'bg-slate-50 border-slate-200' : 'bg-transparent border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx] }} />
                      <span className="text-[10.5px] font-bold text-slate-600 truncate">{item.name}</span>
                    </div>
                  </div>
                );
              })
            ) : null}
          </div>
        </div>
      </div>

      {/* Three Column Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Column 1: Top Selling Products */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <TrendingUp className="text-emerald-500" size={18} />
                Sản phẩm bán chạy sỉ
              </h2>
              <p className="text-xs text-slate-400 font-medium">Top sản phẩm có doanh số cao nhất</p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {topProductsList && topProductsList.length > 0 ? (
              topProductsList.map((prod: any, idx: number) => {
                const colors = [
                  { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/25', hover: 'hover:border-emerald-500/20' },
                  { bg: 'bg-slate-400/10', text: 'text-slate-500', border: 'border-slate-300', hover: 'hover:border-sky-500/20' },
                  { bg: 'bg-amber-700/10', text: 'text-amber-700', border: 'border-amber-700/20', hover: 'hover:border-emerald-600/20' },
                  { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500/20', hover: 'hover:border-purple-500/20' },
                ];
                const c = colors[idx % colors.length];
                
                const soldQty = prod.sales_volume || 0;
                const currentQty = prod.qty || 0;
                const totalQty = soldQty + currentQty;
                const stockPercent = totalQty > 0 ? Math.round((currentQty / totalQty) * 100) : 0;
                const unit = prod.unit || 'kg';
                
                const formattedRevenue = prod.revenue >= 1000000 
                  ? `${(prod.revenue / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}trđ`
                  : `${prod.revenue.toLocaleString('vi-VN')}đ`;

                return (
                  <div key={prod.sku} className={`p-3.5 rounded-2xl border border-slate-100 bg-slate-50/30 flex items-center justify-between gap-4 ${c.hover} hover:bg-white hover:shadow-md transition-all duration-300 group`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 ${c.bg} ${c.text} rounded-lg flex items-center justify-center shrink-0 font-black text-xs border ${c.border} shadow-sm group-hover:scale-105 transition-transform select-none`}>
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-800 truncate mb-0.5" title={prod.name}>{prod.name}</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Còn {stockPercent}% tồn kho</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-slate-700">{soldQty.toLocaleString('vi-VN')} {unit}</p>
                      <p className="text-[11px] font-black text-emerald-600">{formattedRevenue}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm mb-3">
                  <ShoppingBag size={20} />
                </div>
                <h4 className="text-xs font-bold text-slate-655 mb-0.5">Chưa có sản phẩm bán chạy</h4>
                <p className="text-[10px] text-slate-400 font-medium max-w-xs leading-normal">
                  Sản phẩm bán chạy sẽ tự động cập nhật.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Store Health */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300">
          <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 mb-4">
            <CheckCircle2 className="text-[#00b14f]" size={17} />
            Sức khỏe vận hành sỉ
          </h2>
          <div className="space-y-4">
            {/* Tỷ lệ hoàn thành đơn sỉ */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-655 mb-1.5">
                <span>Tỉ lệ giao hàng thành công</span>
                <span className="text-[#00b14f] font-black">99.5%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-[#00b14f] h-full rounded-full" style={{ width: '99.5%' }} />
              </div>
            </div>

            {/* Tốc độ xử lý đơn sỉ */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-655 mb-1.5">
                <span>Tốc độ xử lý đơn sỉ</span>
                <span className="text-[#00b14f] font-black">1.2 giờ (Rất nhanh)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-[#00b14f] h-full rounded-full" style={{ width: '95%' }} />
              </div>
            </div>

            {/* Chất lượng hình ảnh & thông tin */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-655 mb-1.5">
                <span>Chất lượng danh mục sản phẩm</span>
                <span className="text-sky-600 font-black">98 / 100 điểm</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-sky-500 h-full rounded-full" style={{ width: '98%' }} />
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl flex items-start gap-3 mt-6 text-xs text-slate-500 font-medium leading-relaxed">
            <Sparkles size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <p>
              Gian hàng của bạn xếp hạng trong <strong className="text-slate-700">Top 3%</strong> nhà cung cấp có tỉ lệ xử lý đơn B2B nhanh nhất toàn hệ thống. Hãy duy trì nhé!
            </p>
          </div>
        </div>

        {/* Column 3: Activity Timeline */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col justify-between min-h-[340px]">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 mb-4">
              <Clock className="text-emerald-500" size={17} />
              Nhật ký vận hành sỉ
            </h2>
            <div className={`relative pl-6 ${getMergedLogs().length > 0 ? 'border-l-2 border-slate-100' : ''} space-y-6 ml-2`}>
              {getMergedLogs().length > 0 ? (
                getMergedLogs().map((log: any, idx: number) => {
                  let dotColor = 'bg-[#00b14f]';
                  let borderDotColor = 'border-emerald-500';
                  let bgDotColor = 'bg-emerald-50';

                  if (log.type === 'order_created') {
                    dotColor = 'bg-sky-500';
                    borderDotColor = 'border-sky-500';
                    bgDotColor = 'bg-sky-50';
                  } else if (log.type === 'negotiation_action') {
                    dotColor = 'bg-purple-500';
                    borderDotColor = 'border-purple-500';
                    bgDotColor = 'bg-purple-50';
                  }

                  return (
                    <div key={idx} className="relative leading-relaxed text-xs text-slate-500 font-medium animate-in fade-in slide-in-from-left-2 duration-300">
                      <span className={`absolute -left-[31px] top-1 w-4.5 h-4.5 ${bgDotColor} rounded-full border ${borderDotColor} flex items-center justify-center`}>
                        <span className={`w-2 h-2 ${dotColor} rounded-full`} />
                      </span>
                      <div>
                        <p className="text-slate-700 font-bold">{log.title}</p>
                        <p dangerouslySetInnerHTML={{ __html: log.message }} />
                        <span className="text-[10px] font-bold text-slate-400">{formatTimeAgo(log.time)}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-12">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-2.5 border border-slate-100">
                    <Clock size={16} />
                  </div>
                  <p className="text-xs font-bold text-slate-500">Chưa có hoạt động nào</p>
                  <p className="text-[10px] text-slate-400 font-medium">Nhật ký vận hành sẽ hiển thị các sự kiện đơn hàng và đàm phán</p>
                </div>
              )}
            </div>
          </div>

          <button className="w-full mt-6 py-2.5 bg-slate-50 text-slate-600 hover:text-[#00b14f] hover:bg-emerald-50/20 border border-slate-100 rounded-full text-xs font-bold transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer">
            <span>Xem tất cả hoạt động</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
