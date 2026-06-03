import React, { useState, useEffect } from 'react';
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

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800 text-xs">
        <p className="font-bold mb-1.5 text-slate-400">{label}</p>
        {payload.map((item, index) => (
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
  const [revenueStats, setRevenueStats] = useState<{
    totalRevenue: number;
    totalOrders: number;
    chartData: any[];
    categoryData: any[];
  } | null>(null);

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
    if (!token) return;
    try {
      const res = await fetch(`${window.location.origin}/rest/V1/tmdt-catalog/revenue`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          setRevenueStats({
            totalRevenue: data.totalRevenue,
            totalOrders: data.totalOrders,
            chartData: data.chartData,
            categoryData: data.categoryData
          });
        }
      }
    } catch (e) {
      // ignore
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
    
    return () => {
      window.removeEventListener('freso:notifications-read', handleRefresh);
      window.removeEventListener('freso:refresh-notifications', handleRefresh);
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

  // Recharts Chart Mock Data
  const monthlyChartData = (revenueStats && revenueStats.chartData && revenueStats.chartData.length > 0)
    ? revenueStats.chartData
    : [
        { name: 'Tháng 1', DoanhThu: 120000000, DonHang: 12 },
        { name: 'Tháng 2', DoanhThu: 185000000, DonHang: 18 },
        { name: 'Tháng 3', DoanhThu: 210000000, DonHang: 22 },
        { name: 'Tháng 4', DoanhThu: 295000000, DonHang: 25 },
        { name: 'Tháng 5', DoanhThu: 342850000, DonHang: 28 },
        { name: 'Tháng 6 (Dự kiến)', DoanhThu: 390000000, DonHang: 32 }
      ];

  const weeklyChartData = [
    { name: 'Tuần 1', DoanhThu: 72000000, DonHang: 6 },
    { name: 'Tuần 2', DoanhThu: 95000000, DonHang: 8 },
    { name: 'Tuần 3', DoanhThu: 88000000, DonHang: 7 },
    { name: 'Tuần 4', DoanhThu: 110000000, DonHang: 9 }
  ];

  const activeChartData = chartPeriod === 'month' ? monthlyChartData : weeklyChartData;

  // Pie chart data for categories share
  const categoryData = (revenueStats && revenueStats.categoryData && revenueStats.categoryData.length > 0)
    ? revenueStats.categoryData
    : [
        { name: 'Hải sản cấp đông', value: 120000000 },
        { name: 'Thịt tươi sống', value: 96000000 },
        { name: 'Rau củ hữu cơ', value: 75420000 },
        { name: 'Gia vị & Đồ khô', value: 51430000 }
      ];

  // B2B Price Negotiation mock state
  const [negotiations, setNegotiations] = useState<Negotiation[]>([
    {
      id: 'NEG-101',
      product: 'Cá Hồi Na Uy Nguyên Con (Nhập Khẩu)',
      buyer: 'Nhà hàng Lẩu Haidilao Phố Huế',
      proposedPrice: 260000,
      originalPrice: 310000,
      qty: '150 kg',
      date: 'Hôm nay, 10:24',
      status: 'pending'
    },
    {
      id: 'NEG-102',
      product: 'Nấm Đùi Gà Xuất Khẩu Loại A',
      buyer: 'Chuỗi Siêu Thị Lotte Mart Tây Hồ',
      proposedPrice: 38000,
      originalPrice: 48000,
      qty: '800 kg',
      date: 'Hôm nay, 08:15',
      status: 'pending'
    },
    {
      id: 'NEG-103',
      product: 'Thịt Bò Mỹ Cắt Lát Khay 500g',
      buyer: 'Chuỗi BBQ King Meat Hà Nội',
      proposedPrice: 145000,
      originalPrice: 165000,
      qty: '400 khay',
      date: 'Hôm qua, 15:40',
      status: 'approved'
    },
    {
      id: 'NEG-104',
      product: 'Nước Sốt Lẩu Thái Cô Đặc Can 5L',
      buyer: 'Hệ thống Buffet Sen Tây Hồ',
      proposedPrice: 85000,
      originalPrice: 98000,
      qty: '200 chai',
      date: '2 ngày trước',
      status: 'pending'
    }
  ]);

  // Modal / Input state for Counter Offer
  const [activeCounterId, setActiveCounterId] = useState<string | null>(null);
  const [counterPriceInput, setCounterPriceInput] = useState('');

  // Handle Approve Negotiation
  const handleApprove = (id: string, buyer: string) => {
    setNegotiations((prev) =>
      prev.map((neg) => (neg.id === id ? { ...neg, status: 'approved' } : neg))
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
    const customPrice = parseInt(counterPriceInput, 10);
    if (isNaN(customPrice) || customPrice <= 0) {
      showToast('Đơn giá đề xuất không hợp lệ.', 'info');
      return;
    }

    setNegotiations((prev) =>
      prev.map((neg) =>
        neg.id === id
          ? { ...neg, status: 'countered', counterOffer: customPrice }
          : neg
      )
    );
    setActiveCounterId(null);
    showToast(`Đã gửi đề xuất phản hồi giá ${customPrice.toLocaleString()}đ tới ${buyer}.`, 'info');
  };

  const displayRevenue = revenueStats ? revenueStats.totalRevenue : 342850000;
  const displayOrders = revenueStats ? revenueStats.totalOrders : 28;

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

      {/* Premium Welcome Header Area */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-slate-800 mb-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 -mb-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl" />

        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-tr from-[#00b14f] via-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center font-black text-2xl text-slate-900 shadow-md">
              {merchantName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-xl md:text-2xl font-black tracking-tight">{merchantName}</h1>
                <span className="flex items-center gap-1 bg-[#E9F8EF]/20 text-[#c8f9db] border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                  <UserCheck size={11} className="text-[#00b14f]" />
                  Verified Merchant
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Mã nhà bán hàng B2B: <span className="font-extrabold text-slate-200">{merchantCode}</span>
                <span className="mx-2 text-slate-600">|</span>
                Hệ thống Freso tự động đồng bộ: <span className="text-slate-300 font-bold">1 phút trước</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button className="flex-1 md:flex-initial px-5 py-3 bg-white text-slate-900 rounded-full text-xs font-extrabold hover:bg-slate-100 transition-all flex items-center justify-center gap-2 shadow-lg">
              <Download size={14} />
              <span>Xuất báo cáo tài chính</span>
            </button>
            <button className="flex-1 md:flex-initial px-5 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-full text-xs font-extrabold hover:from-emerald-600 hover:to-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
              <PlusCircle size={14} />
              <span>Đăng sản phẩm sỉ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Key B2B Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {/* Doanh thu tích luỹ */}
        <div className="bg-gradient-to-br from-[#EBF9F0] to-[#D5F3DF] border border-[#BBEBCC] rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[155px] group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11.5px] font-black uppercase tracking-wider text-[#066e33] mb-1">Tổng doanh thu tháng</p>
              <h3 className="text-2xl font-black text-[#0c3c1e] tracking-tight">{displayRevenue.toLocaleString()}đ</h3>
            </div>
            <div className="w-10 h-10 bg-white/70 rounded-xl flex items-center justify-center text-[#00b14f] border border-[#A4E0B9]">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#A8E5BE]/30 text-[11px] font-bold text-slate-600">
            <span className="text-[#066e33] font-black">+15.8% <span className="font-normal text-slate-500">tháng trước</span></span>
            <span className="bg-white/60 px-1.5 py-0.5 rounded text-[10px] text-slate-600 font-extrabold">KPI 92%</span>
          </div>
        </div>

        {/* Đơn hàng bán sỉ */}
        <div className="bg-gradient-to-br from-[#E6F3FB] to-[#C9E5F7] border border-[#ABD6F2] rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[155px] group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11.5px] font-black uppercase tracking-wider text-[#0e6191] mb-1">Đơn hàng mới nhận</p>
              <h3 className="text-2xl font-black text-[#0a3a57] tracking-tight">{displayOrders} đơn hàng</h3>
            </div>
            <div className="w-10 h-10 bg-white/70 rounded-xl flex items-center justify-center text-sky-600 border border-[#91CBEF]">
              <ShoppingBag size={20} />
            </div>
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#9BCEF0]/30 text-[11px] font-bold text-slate-600">
            <span className="text-[#0e6191] font-black">4 đơn hàng <span className="font-normal text-slate-500">chờ giao</span></span>
            <span className="bg-white/60 px-1.5 py-0.5 rounded text-[10px] text-slate-600 font-extrabold">Sỉ 100%</span>
          </div>
        </div>

        {/* Đàm phán đang chờ */}
        <div className="bg-gradient-to-br from-[#EBF8F6] to-[#D1F2EC] border border-[#A3E4D7] rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[155px] group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11.5px] font-black uppercase tracking-wider text-[#0b6c5f] mb-1">Yêu cầu đàm phán giá</p>
              <h3 className="text-2xl font-black text-[#083c35] tracking-tight">8 yêu cầu</h3>
            </div>
            <div className="w-10 h-10 bg-white/70 rounded-xl flex items-center justify-center text-teal-600 border border-[#A3E4D7]">
              <Handshake size={20} />
            </div>
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#A3E4D7]/30 text-[11px] font-bold text-slate-600">
            <span className="text-[#0b6c5f] font-black">3 chiết khấu lớn</span>
            <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider animate-pulse">Gấp</span>
          </div>
        </div>

        {/* Điểm sức khỏe gian hàng */}
        <div className="bg-gradient-to-br from-[#FBF2F4] to-[#F5DCE2] border border-[#EBB6C3] rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[155px] group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11.5px] font-black uppercase tracking-wider text-[#a0364d] mb-1">Đánh giá & Uy tín</p>
              <h3 className="text-2xl font-black text-[#5e1927] tracking-tight flex items-center gap-1">
                4.9 <Star size={20} className="fill-rose-500 text-rose-500 shrink-0" />
              </h3>
            </div>
            <div className="w-10 h-10 bg-white/70 rounded-xl flex items-center justify-center text-rose-600 border border-[#DF98AA]">
              <Sparkles size={20} />
            </div>
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#DE90A3]/30 text-[11px] font-bold text-slate-600">
            <span className="text-[#a0364d] font-black">Phản hồi: <span className="text-emerald-600">98%</span></span>
            <span className="bg-white/60 px-1.5 py-0.5 rounded text-[10px] text-slate-600 font-extrabold">Top Rated</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Analytics Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Doanh thu Recharts Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <TrendingUp className="text-[#00b14f]" size={18} />
                Biểu đồ phân tích doanh thu bán sỉ
              </h2>
              <p className="text-xs text-slate-400 font-medium">Theo dõi doanh thu luỹ kế thực tế của gian hàng B2B</p>
            </div>
            <div className="flex items-center bg-gray-100 p-1.5 rounded-full">
              <button
                onClick={() => setChartPeriod('week')}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${
                  chartPeriod === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tuần này
              </button>
              <button
                onClick={() => setChartPeriod('month')}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${
                  chartPeriod === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tháng này
              </button>
            </div>
          </div>

          <div className="h-[280px] w-full">
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
                  tickFormatter={(v) => `${(v / 1000000).toFixed(0)}tr`}
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
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 mb-1">
              <Box className="text-[#00b14f]" size={18} />
              Cơ cấu ngành hàng B2B
            </h2>
            <p className="text-xs text-slate-400 font-medium mb-4">Tỷ lệ đóng góp doanh thu của các ngành hàng thực phẩm sỉ</p>
          </div>

          <div className="h-[200px] flex items-center justify-center relative">
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
                {displayRevenue >= 1000000 
                  ? `${(displayRevenue / 1000000).toFixed(1).replace('.', ',')}tr` 
                  : `${displayRevenue.toLocaleString()}đ`}
              </p>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Tổng doanh thu</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {categoryData.map((item, idx) => {
              const totalVal = categoryData.reduce((acc, current) => acc + current.value, 0);
              const percentage = ((item.value / totalVal) * 100).toFixed(0);
              return (
                <div
                  key={idx}
                  className={`p-2 rounded-2xl border transition-all ${
                    activeSegment === idx ? 'bg-slate-50 border-gray-200' : 'bg-transparent border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx] }} />
                    <span className="text-[10.5px] font-bold text-slate-600 truncate">{item.name}</span>
                  </div>
                  <p className="text-[12.5px] font-extrabold text-slate-900 ml-4">
                    {percentage}% <span className="text-[10px] font-bold text-slate-400">({(item.value / 1000000).toFixed(0)}tr)</span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* B2B Price Negotiation Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start mb-8">
        {/* B2B Negotiation list */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Handshake className="text-emerald-500" size={19} />
                Yêu cầu đàm phán giá B2B chờ duyệt
              </h2>
              <p className="text-xs text-slate-400 font-medium">Khách hàng mua sỉ đề xuất giá chiết khấu cho số lượng lớn</p>
            </div>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-extrabold px-3 py-1 rounded-full shrink-0">
              {negotiations.filter((n) => n.status === 'pending').length} việc cần làm
            </span>
          </div>

          <div className="space-y-4">
            {negotiations.map((neg) => {
              const discountPercent = ((1 - neg.proposedPrice / neg.originalPrice) * 100).toFixed(0);
              return (
                <div
                  key={neg.id}
                  className={`p-5 rounded-2xl border transition-all duration-300 ${
                    neg.status === 'approved'
                      ? 'bg-[#E9F8EF]/20 border-emerald-100 shadow-sm'
                      : neg.status === 'countered'
                        ? 'bg-blue-50/30 border-blue-100 shadow-sm'
                        : 'bg-slate-50/50 border-gray-100 hover:border-gray-200 hover:shadow-sm'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
                        {neg.id}
                      </span>
                      <h4 className="text-[13.5px] font-black text-slate-800">{neg.product}</h4>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">{neg.date}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 bg-white/70 p-3.5 rounded-xl border border-slate-100/70 text-xs">
                    <div>
                      <p className="text-slate-400 font-medium mb-0.5">Khách hàng</p>
                      <p className="font-extrabold text-slate-700 truncate" title={neg.buyer}>
                        {neg.buyer}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium mb-0.5">Số lượng đặt</p>
                      <p className="font-extrabold text-slate-700">{neg.qty}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium mb-0.5">Giá gốc niêm yết</p>
                      <p className="font-extrabold text-slate-500 line-through">
                        {neg.originalPrice.toLocaleString()}đ/đơn vị
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium mb-0.5">Đề xuất khách sỉ</p>
                      <p className="font-black text-emerald-600 flex items-center gap-1.5">
                        {neg.proposedPrice.toLocaleString()}đ
                        <span className="text-[10px] font-extrabold bg-rose-50 text-rose-600 px-1.5 py-0.2 rounded">
                          -{discountPercent}%
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Status Indicator or Interactive buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div>
                      {neg.status === 'approved' && (
                        <div className="flex items-center gap-1.5 text-[#00b14f] text-xs font-extrabold">
                          <CheckCircle2 size={16} />
                          <span>Đã phê duyệt đơn giá đàm phán</span>
                        </div>
                      )}
                      {neg.status === 'countered' && (
                        <div className="flex items-center gap-1.5 text-blue-600 text-xs font-extrabold">
                          <Clock size={16} />
                          <span>Đã phản hồi giá mới: {neg.counterOffer?.toLocaleString()}đ (Chờ khách phản hồi)</span>
                        </div>
                      )}
                      {neg.status === 'pending' && (
                        <div className="flex items-center gap-1 text-emerald-600 text-[11px] font-bold">
                          <AlertCircle size={14} strokeWidth={2.2} />
                          <span>Yêu cầu đang chờ phản hồi từ bạn</span>
                        </div>
                      )}
                    </div>

                    {neg.status === 'pending' && (
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {activeCounterId === neg.id ? (
                          <div className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-full p-1 w-full sm:w-auto">
                            <input
                              type="number"
                              placeholder="Nhập giá mới..."
                              value={counterPriceInput}
                              onChange={(e) => setCounterPriceInput(e.target.value)}
                              className="text-xs font-bold text-slate-700 bg-transparent px-3 outline-none w-28"
                            />
                            <button
                              onClick={() => handleSubmitCounter(neg.id, neg.buyer)}
                              className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-extrabold hover:bg-blue-700 transition-all whitespace-nowrap"
                            >
                              Gửi đề xuất
                            </button>
                            <button
                              onClick={() => setActiveCounterId(null)}
                              className="px-3 py-1.5 bg-gray-100 text-slate-500 rounded-full text-[10px] font-extrabold hover:bg-gray-200 transition-all whitespace-nowrap"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenCounter(neg.id, neg.proposedPrice)}
                              className="flex-1 sm:flex-initial px-4 py-2 border border-slate-200 hover:border-blue-500 text-slate-600 hover:text-blue-600 rounded-full text-xs font-bold transition-all bg-white"
                            >
                              Đề xuất giá mới
                            </button>
                            <button
                              onClick={() => handleApprove(neg.id, neg.buyer)}
                              className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-full text-xs font-black hover:from-emerald-600 hover:to-green-700 transition-all shadow-sm shadow-emerald-500/10"
                            >
                              Phê duyệt nhanh
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Store Health Status & Quick Navigation */}
        <div className="space-y-6">
          {/* Quick Operations Grid */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 mb-4">
              <Sparkles className="text-emerald-500" size={17} />
              Vận hành nhanh
            </h2>
            <div className="grid grid-cols-2 gap-3.5 text-center">
              <a
                href="?view=seller-dashboard&tab=Qu%E1%BA%A3n%20l%C3%BD%20s%E1%BA%A3n%20ph%E1%BA%A9m"
                className="p-3 bg-gray-50 hover:bg-emerald-50/20 border border-gray-100 hover:border-emerald-500/30 rounded-2xl transition-all group flex flex-col items-center"
              >
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 border border-gray-100 shadow-sm group-hover:scale-110 transition-transform mb-2">
                  <Box size={18} />
                </div>
                <span className="text-[11.5px] font-bold text-slate-700">Đăng sản phẩm sỉ</span>
              </a>
              <a
                href="?view=seller-dashboard&tab=%C4%90%C3%A0m%20ph%C3%A1n%20gi%C3%A1"
                className="p-3 bg-gray-50 hover:bg-emerald-50/20 border border-gray-100 hover:border-emerald-500/30 rounded-2xl transition-all group flex flex-col items-center"
              >
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 border border-gray-100 shadow-sm group-hover:scale-110 transition-transform mb-2">
                  <Handshake size={18} />
                </div>
                <span className="text-[11.5px] font-bold text-slate-700">Đàm phán giá</span>
              </a>
              <a
                href="?view=seller-dashboard&tab=%C4%90%E1%BB%91i%20so%C3%A1t%20ho%C3%A1%20%C4%91%C6%A1n%20%C4%91i%E1%BB%87n%20t%E1%BB%AD"
                className="p-3 bg-gray-50 hover:bg-sky-50/20 border border-gray-100 hover:border-sky-500/30 rounded-2xl transition-all group flex flex-col items-center"
              >
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-sky-600 border border-gray-100 shadow-sm group-hover:scale-110 transition-transform mb-2">
                  <Download size={18} />
                </div>
                <span className="text-[11.5px] font-bold text-slate-700">Đối soát hóa đơn</span>
              </a>
              <a
                href="?view=seller-dashboard&tab=Th%C3%B4ng%20tin%20doanh%20nghi%E1%BB%87p"
                className="p-3 bg-gray-50 hover:bg-purple-50/20 border border-gray-100 hover:border-purple-500/30 rounded-2xl transition-all group flex flex-col items-center"
              >
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-purple-600 border border-gray-100 shadow-sm group-hover:scale-110 transition-transform mb-2">
                  <CheckCircle2 size={18} />
                </div>
                <span className="text-[11.5px] font-bold text-slate-700">Hồ sơ pháp lý</span>
              </a>
            </div>
          </div>

          {/* Store Health Indicators */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 mb-4">
              <CheckCircle2 className="text-[#00b14f]" size={17} />
              Sức khỏe vận hành sỉ
            </h2>
            <div className="space-y-4">
              {/* Tỷ lệ hoàn thành đơn sỉ */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                  <span>Tỉ lệ giao hàng thành công</span>
                  <span className="text-[#00b14f]">99.5%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#00b14f] h-full rounded-full" style={{ width: '99.5%' }} />
                </div>
              </div>

              {/* Tỷ lệ phản hồi đàm phán */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                  <span>Tốc độ phản hồi đàm phán sỉ</span>
                  <span className="text-[#00b14f]">1,2 giờ (Rất nhanh)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-[#00b14f] h-full rounded-full" style={{ width: '95%' }} />
                </div>
              </div>

              {/* Chất lượng hình ảnh & thông tin */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                  <span>Chất lượng danh mục sản phẩm</span>
                  <span className="text-sky-600">98 / 100 điểm</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-sky-500 h-full rounded-full" style={{ width: '98%' }} />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-start gap-3 mt-6 text-xs text-slate-500 font-medium leading-relaxed">
              <Sparkles size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <p>
                Gian hàng của bạn xếp hạng trong <strong className="text-slate-700">Top 3%</strong> nhà cung cấp có tỉ lệ xử lý đơn B2B nhanh nhất toàn hệ thống. Hãy duy trì nhé!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Selling Products List & Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Top Selling Products Grid */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Box className="text-[#00b14f]" size={19} />
                Sản phẩm bán chạy nhất tháng này
              </h2>
              <p className="text-xs text-slate-400 font-medium">Xếp hạng dựa trên khối lượng bán buôn và doanh thu tích luỹ</p>
            </div>
            <button className="text-slate-400 hover:text-slate-700 transition-colors">
              <RefreshCw size={15} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Top Product 1 */}
            <div className="p-4 rounded-2xl border border-gray-100 bg-slate-50/50 flex flex-col justify-between h-[155px]">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center shrink-0 text-emerald-500 font-bold shadow-sm">
                  1
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-800 truncate mb-1">Ba Chỉ Bò Mỹ Nhập Khẩu (Thùng 20kg)</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ngành: Thịt tươi sống</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1 mt-3">
                  <span>Khối lượng: 180 thùng</span>
                  <span className="text-[#00b14f]">144tr đ</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#00b14f] h-full rounded-full" style={{ width: '85%' }} />
                </div>
                <p className="text-[9px] text-slate-400 text-right mt-1 font-bold">Còn 15% tồn kho</p>
              </div>
            </div>

            {/* Top Product 2 */}
            <div className="p-4 rounded-2xl border border-gray-100 bg-slate-50/50 flex flex-col justify-between h-[155px]">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center shrink-0 text-emerald-500 font-bold shadow-sm">
                  2
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-800 truncate mb-1">Tôm Sú Quảng Ninh Đông Lạnh (Hộp 1kg)</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ngành: Hải sản đông lạnh</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1 mt-3">
                  <span>Khối lượng: 250 hộp</span>
                  <span className="text-sky-600">87,5tr đ</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-sky-500 h-full rounded-full" style={{ width: '92%' }} />
                </div>
                <p className="text-[9px] text-slate-400 text-right mt-1 font-bold">Còn 8% tồn kho</p>
              </div>
            </div>

            {/* Top Product 3 */}
            <div className="p-4 rounded-2xl border border-gray-100 bg-slate-50/50 flex flex-col justify-between h-[155px]">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center shrink-0 text-emerald-500 font-bold shadow-sm">
                  3
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-800 truncate mb-1">Cải Thảo Đà Lạt Loại 1 (Bao 30kg)</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ngành: Rau củ hữu cơ</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1 mt-3">
                  <span>Khối lượng: 420 bao</span>
                  <span className="text-emerald-600">63tr đ</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '70%' }} />
                </div>
                <p className="text-[9px] text-slate-400 text-right mt-1 font-bold">Còn 30% tồn kho</p>
              </div>
            </div>

            {/* Top Product 4 */}
            <div className="p-4 rounded-2xl border border-gray-100 bg-slate-50/50 flex flex-col justify-between h-[155px]">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center shrink-0 text-emerald-500 font-bold shadow-sm">
                  4
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-800 truncate mb-1">Dầu Ăn Cái Lân Can 5L (Thùng 4 Can)</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ngành: Đồ khô gia vị</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1 mt-3">
                  <span>Khối lượng: 110 thùng</span>
                  <span className="text-purple-600">48,4tr đ</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full" style={{ width: '55%' }} />
                </div>
                <p className="text-[9px] text-slate-400 text-right mt-1 font-bold">Còn 45% tồn kho</p>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Stream/Timeline */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between min-h-[340px]">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 mb-4">
              <Clock className="text-emerald-500" size={17} />
              Nhật ký vận hành sỉ
            </h2>
            <div className="space-y-4">
              {/* Event 1 */}
              <div className="flex items-start gap-3 text-xs leading-relaxed text-slate-500 font-medium">
                <div className="w-2.5 h-2.5 bg-[#00b14f] rounded-full shrink-0 mt-1 shadow shadow-emerald-500/50" />
                <div>
                  <p className="text-slate-700 font-bold">Đồng bộ hoá đơn hoàn tất</p>
                  <p>Hệ thống vừa tự động đối soát hoá đơn số <strong className="text-slate-600">#HD9821-B2B</strong>.</p>
                  <span className="text-[10px] font-bold text-slate-400">10 phút trước</span>
                </div>
              </div>

              {/* Event 2 */}
              <div className="flex items-start gap-3 text-xs leading-relaxed text-slate-500 font-medium">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0 mt-1 shadow shadow-emerald-500/50" />
                <div>
                  <p className="text-slate-700 font-bold">Yêu cầu đàm phán giá mới</p>
                  <p>Khách hàng <strong className="text-slate-600">Lotte Mart</strong> vừa gửi đề xuất chiết khấu cho mã hàng nấm đùi gà.</p>
                  <span className="text-[10px] font-bold text-slate-400">1 giờ trước</span>
                </div>
              </div>

              {/* Event 3 */}
              <div className="flex items-start gap-3 text-xs leading-relaxed text-slate-500 font-medium">
                <div className="w-2.5 h-2.5 bg-slate-300 rounded-full shrink-0 mt-1" />
                <div>
                  <p className="text-slate-700 font-bold">Cập nhật bởi nhân viên</p>
                  <p>Quản lý <strong className="text-slate-600">Nguyễn Văn A</strong> vừa điều chỉnh giá niêm yết của Tôm Sú Quảng Ninh.</p>
                  <span className="text-[10px] font-bold text-slate-400">4 giờ trước</span>
                </div>
              </div>
            </div>
          </div>

          <button className="w-full mt-6 py-2.5 bg-slate-50 text-slate-600 hover:text-[#00b14f] hover:bg-[#E9F8EF]/20 border border-gray-100 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5">
            <span>Xem tất cả hoạt động</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
