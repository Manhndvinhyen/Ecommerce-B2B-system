import React, { useState } from 'react';
import {
  ShoppingCart,
  Search,
  Filter,
  DollarSign,
  Percent,
  CheckCircle,
  Clock,
  ChevronRight,
  Eye,
  Send,
  Check,
  AlertCircle,
  X,
  Building2,
  FileSpreadsheet
} from 'lucide-react';

interface CartItem {
  name: string;
  qty: number;
  unit: string;
  price: number;
}

interface BuyerCart {
  id: string;
  companyName: string;
  buyerName: string;
  region: string;
  updatedAt: string;
  status: 'shopping' | 'awaiting_discount' | 'approved_quote';
  items: CartItem[];
  appliedDiscount: number; // percentage
}

export function SellerCartManager() {
  const [carts, setCarts] = useState<BuyerCart[]>([
    {
      id: 'B2B-CART-01',
      companyName: 'Chuỗi Nhà Hàng Sen Tây Hồ',
      buyerName: 'Nguyễn Văn Hải (Quản lý thu mua)',
      region: 'Hà Nội',
      updatedAt: '10 phút trước',
      status: 'awaiting_discount',
      appliedDiscount: 0,
      items: [
        { name: 'Cá Hồi Na Uy Cắt Lát Khay 500g', qty: 50, unit: 'khay', price: 165000 },
        { name: 'Cải Thảo Sạch Đà Lạt (Bao 30kg)', qty: 20, unit: 'bao', price: 90000 },
        { name: 'Thịt Bò Mỹ Khay 1kg', qty: 30, unit: 'khay', price: 280000 }
      ]
    },
    {
      id: 'B2B-CART-02',
      companyName: 'Đại Lý Thực Phẩm Sạch An Bình',
      buyerName: 'Trần Thị Mai',
      region: 'TP. Hồ Chí Minh',
      updatedAt: '25 phút trước',
      status: 'shopping',
      appliedDiscount: 0,
      items: [
        { name: 'Táo Envy Mỹ Nhập Khẩu', qty: 120, unit: 'kg', price: 110000 },
        { name: 'Hành Tây Đà Lạt Hộp 10kg', qty: 15, unit: 'hộp', price: 145000 }
      ]
    },
    {
      id: 'B2B-CART-03',
      companyName: 'Siêu Thị Mini Mart Cầu Giấy',
      buyerName: 'Lê Hoàng Nam',
      region: 'Hà Nội',
      updatedAt: '1 giờ trước',
      status: 'approved_quote',
      appliedDiscount: 8,
      items: [
        { name: 'Tôm Sú Đông Lạnh Hộp 1kg', qty: 80, unit: 'hộp', price: 210000 },
        { name: 'Khoai Tây Sạch Đà Lạt (Bao 20kg)', qty: 10, unit: 'bao', price: 130000 }
      ]
    },
    {
      id: 'B2B-CART-04',
      companyName: 'Bếp Ăn Công Nghiệp Samsung Thái Nguyên',
      buyerName: 'Phạm Đức Long',
      region: 'Miền Bắc',
      updatedAt: '2 giờ trước',
      status: 'awaiting_discount',
      appliedDiscount: 0,
      items: [
        { name: 'Thịt Heo Đông Lạnh Thùng 25kg', qty: 45, unit: 'thùng', price: 1450000 },
        { name: 'Rau Muống Sạch (Bao 10kg)', qty: 50, unit: 'bao', price: 75000 }
      ]
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCart, setSelectedCart] = useState<BuyerCart | null>(null);
  const [customDiscount, setCustomDiscount] = useState('5');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getCartTotal = (cart: BuyerCart) => {
    const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const discountAmount = (subtotal * cart.appliedDiscount) / 100;
    return subtotal - discountAmount;
  };

  const getCartSubtotal = (cart: BuyerCart) => {
    return cart.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  };

  // Apply B2B Discount
  const handleApplyDiscount = (cartId: string, pct: number) => {
    setCarts(
      carts.map((c) => {
        if (c.id === cartId) {
          return {
            ...c,
            appliedDiscount: pct,
            status: pct > 0 ? 'approved_quote' : c.status
          };
        }
        return c;
      })
    );
    if (selectedCart && selectedCart.id === cartId) {
      setSelectedCart({
        ...selectedCart,
        appliedDiscount: pct,
        status: pct > 0 ? 'approved_quote' : selectedCart.status
      });
    }
    showToast(`Đã áp dụng mức chiết khấu ${pct}% cho giỏ hàng sỉ!`);
  };

  // Send Direct B2B Quotation
  const handleSendQuote = (cartId: string) => {
    setCarts(
      carts.map((c) => {
        if (c.id === cartId) {
          return { ...c, status: 'approved_quote' };
        }
        return c;
      })
    );
    setSelectedCart(null);
    showToast('Đã gửi báo giá sỉ & ưu đãi trực tiếp tới tài khoản người mua!');
  };

  const filteredCarts = carts.filter((c) => {
    const matchesSearch =
      c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      {/* Toast alert */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border transition-all duration-300 transform scale-100 ${
          toast.type === 'success'
            ? 'bg-[#E9F8EF] text-[#00b14f] border-[#CDEEDB]'
            : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          <div className="shrink-0">
            {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          </div>
          <span className="text-sm font-bold tracking-tight">{toast.message}</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-50 pb-5">
        <div>
          <h2 className="text-[17px] font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ShoppingCart className="text-green-600" size={20} />
            Quản lý giỏ hàng sỉ B2B
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            Theo dõi ý định mua sắm của các đại lý, chủ động phê duyệt chiết khấu & chốt báo giá sỉ
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-black uppercase">
            {carts.filter((c) => c.status === 'awaiting_discount').length} Chờ duyệt chiết khấu
          </span>
        </div>
      </div>

      {/* Filter operations */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
          <input
            type="text"
            placeholder="Tìm kiếm theo mã giỏ, tên công ty hoặc người mua..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 bg-gray-50/50 focus:bg-white rounded-2xl text-xs font-bold outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="text-slate-400" size={15} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 bg-gray-50/50 px-3 py-2.5 rounded-2xl text-xs font-bold outline-none focus:border-green-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="shopping">Đang mua sắm</option>
            <option value="awaiting_discount">Chờ duyệt chiết khấu</option>
            <option value="approved_quote">Đã gửi báo giá sỉ</option>
          </select>
        </div>
      </div>

      {/* Cart lists grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredCarts.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium border border-dashed border-slate-200 rounded-2xl">
            Không tìm thấy giỏ hàng sỉ nào.
          </div>
        ) : (
          filteredCarts.map((cart) => {
            const subtotal = getCartSubtotal(cart);
            const total = getCartTotal(cart);
            const itemsCount = cart.items.reduce((sum, item) => sum + item.qty, 0);

            return (
              <div
                key={cart.id}
                className="p-5 border border-gray-100 hover:border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all bg-white flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider">{cart.id}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight ${
                      cart.status === 'shopping'
                        ? 'bg-blue-50 text-blue-600 border border-blue-100'
                        : cart.status === 'awaiting_discount'
                        ? 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse'
                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    }`}>
                      {cart.status === 'shopping' && 'Đang mua sắm'}
                      {cart.status === 'awaiting_discount' && 'Yêu cầu chiết khấu'}
                      {cart.status === 'approved_quote' && 'Đã gửi báo giá'}
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                    <Building2 size={15} className="text-slate-400" />
                    {cart.companyName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-medium">
                    <span>Người liên hệ: <strong className="text-slate-600">{cart.buyerName}</strong></span>
                    <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:inline" />
                    <span>Khu vực: <strong className="text-slate-600">{cart.region}</strong></span>
                    <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:inline" />
                    <span>Cập nhật: <strong className="text-slate-600">{cart.updatedAt}</strong></span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  {/* Totals info */}
                  <div className="text-left md:text-right space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Quy mô giỏ hàng ({itemsCount} sản phẩm)</p>
                    <p className="text-sm font-black text-slate-800">
                      {total.toLocaleString()}đ
                      {cart.appliedDiscount > 0 && (
                        <span className="text-[10px] text-[#00b14f] bg-emerald-50 px-1.5 py-0.5 rounded ml-2">
                          Đã giảm {cart.appliedDiscount}%
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Actions area */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => setSelectedCart(cart)}
                      className="px-3.5 py-2.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-slate-100"
                    >
                      <Eye size={13} />
                      <span>Xem giỏ</span>
                    </button>

                    {cart.status === 'awaiting_discount' && (
                      <button
                        onClick={() => {
                          setSelectedCart(cart);
                          setCustomDiscount('10');
                        }}
                        className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl text-xs font-black hover:from-emerald-600 hover:to-green-700 transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <Percent size={13} />
                        <span>Duyệt chiết khấu</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cart detail modal drawer */}
      {selectedCart && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-end p-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white h-full w-full max-w-[500px] p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
            {/* Header info */}
            <div>
              <div className="flex justify-between items-center border-b border-gray-50 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{selectedCart.id}</span>
                    <span className="text-xs bg-slate-50 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                      {selectedCart.region}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-800 tracking-tight mt-1">{selectedCart.companyName}</h3>
                </div>
                <button
                  onClick={() => setSelectedCart(null)}
                  className="p-1.5 hover:bg-gray-100 text-slate-400 hover:text-slate-800 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Items in cart list */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Danh sách sản phẩm trong giỏ</p>
                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {selectedCart.items.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center">
                      <div>
                        <p className="font-black text-slate-700">{item.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                          Số lượng: {item.qty} {item.unit} x {item.price.toLocaleString()}đ
                        </p>
                      </div>
                      <span className="font-extrabold text-slate-800">
                        {(item.price * item.qty).toLocaleString()}đ
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Calculations & Discounts */}
            <div className="border-t border-gray-100 pt-5 mt-5 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-500">
                  <span>Tổng tiền hàng tạm tính:</span>
                  <span>{getCartSubtotal(selectedCart).toLocaleString()}đ</span>
                </div>
                {selectedCart.appliedDiscount > 0 && (
                  <div className="flex justify-between text-xs font-black text-[#00b14f]">
                    <span>Chiết khấu sỉ B2B ({selectedCart.appliedDiscount}%):</span>
                    <span>-{(getCartSubtotal(selectedCart) * selectedCart.appliedDiscount / 100).toLocaleString()}đ</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-800 pt-2 border-t border-dashed border-gray-100">
                  <span>Giá trị giỏ hàng chốt:</span>
                  <span className="text-[#00b14f] text-[16px]">{getCartTotal(selectedCart).toLocaleString()}đ</span>
                </div>
              </div>

              {/* Quotation / discount editor */}
              {selectedCart.status !== 'approved_quote' ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <label className="block text-[11px] font-black text-slate-500 uppercase">Thiết lập chiết khấu B2B nhanh</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customDiscount}
                      onChange={(e) => setCustomDiscount(e.target.value)}
                      className="w-20 px-3 py-2 border border-gray-200 bg-white rounded-xl text-xs font-bold outline-none focus:border-green-500"
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>

                    <div className="flex gap-1 flex-1">
                      {['5', '8', '10', '15'].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setCustomDiscount(d)}
                          className={`px-2.5 py-1.5 text-[11px] font-black rounded-lg border transition-all ${
                            customDiscount === d
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {d}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyDiscount(selectedCart.id, parseFloat(customDiscount) || 0)}
                    className="w-full py-2.5 bg-slate-800 text-white rounded-xl text-xs font-black hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Percent size={14} />
                    <span>Áp dụng chiết khấu ngay</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                  <CheckCircle className="text-[#00b14f] shrink-0" size={20} />
                  <div>
                    <p className="text-xs font-black text-slate-800">Đã chốt báo giá thành công!</p>
                    <p className="text-[10px] text-slate-500 font-medium">Báo giá ưu đãi kèm chiết khấu đã được gửi tới người thu mua.</p>
                  </div>
                </div>
              )}

              {/* Confirm quotation delivery */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCart(null)}
                  className="flex-1 py-3 border border-gray-200 text-slate-600 rounded-xl text-xs font-black hover:bg-gray-50 transition-all text-center"
                >
                  Đóng panel
                </button>
                {selectedCart.status !== 'approved_quote' && (
                  <button
                    type="button"
                    onClick={() => handleSendQuote(selectedCart.id)}
                    className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl text-xs font-black hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-green-600/10"
                  >
                    <Send size={13} />
                    <span>Gửi báo giá sỉ</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
