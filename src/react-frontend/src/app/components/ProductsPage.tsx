import { useEffect, useState } from 'react';
import { ChevronRight, Ticket, Check, AlertCircle, Percent, Gift, Sparkles } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { categoryMenu as categories, getCategoryPageLink } from '../data/categories';

const categoryEmojiMap: Record<string, string> = {
  'Rau củ quả': '🥬',
  'Trái cây': '🍎',
  'Thực phẩm tươi sống': '🍖',
  'Thuỷ hải sản': '🦐',
  'Thực phẩm đông lạnh': '❄️',
  'Thực phẩm khô': '🥜',
  'Tiện ích bếp': '🍳'
};

type PromotionItem = {
  id: number;
  title: string;
  description: string;
  image: string;
  button_text: string;
  button_action: string;
  type: 'banner' | 'voucher' | 'seasonal';
  discount_code?: string | null;
  discount_value?: number | null;
  min_order_amount?: number | null;
};

const defaultPromotions: PromotionItem[] = [
  {
    id: 1,
    title: 'Mùa vụ sầu riêng Ri6 - Đắk Lắk',
    description: 'Sầu riêng Ri6 cơm vàng hạt lép, thơm lừng chín cây từ nhà vườn Đắk Lắk. Ưu đãi chiết khấu sỉ đến 25% cho đơn hàng từ 100kg.',
    image: 'https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&w=1200&q=80',
    button_text: 'Xem sản phẩm',
    button_action: 'category:rau-cu-qua',
    type: 'banner'
  },
  {
    id: 2,
    title: 'Rau củ hữu cơ Đà Lạt tươi sạch',
    description: 'Nguồn rau sạch đạt chuẩn VietGAP & Organic từ hợp tác xã Đà Lạt. Hóa đơn VAT đầy đủ, giao nhanh xe lạnh bảo quản chuẩn.',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=80',
    button_text: 'Mua ngay',
    button_action: 'category:rau-cu-qua',
    type: 'banner'
  },
  {
    id: 3,
    title: 'Thủy hải sản tươi sống mỗi ngày',
    description: 'Tôm sú, mực ống, cá hồi tươi rói đánh bắt tự nhiên từ vùng biển Ninh Thuận. Ưu đãi giá sỉ cực tốt cho nhà hàng & đại lý.',
    image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1200&q=80',
    button_text: 'Xem sản phẩm',
    button_action: 'category:thuy-hai-san',
    type: 'banner'
  },
  {
    id: 4,
    title: 'Voucher Khách Hàng Mới',
    description: 'Giảm 100.000đ cho đơn hàng sỉ đầu tiên của khách hàng doanh nghiệp từ 1.000.000đ.',
    image: '',
    button_text: 'Nhận voucher',
    button_action: 'coupon:ORGANICA100',
    type: 'voucher',
    discount_code: 'ORGANICA100',
    discount_value: 100000,
    min_order_amount: 1000000
  },
  {
    id: 5,
    title: 'Miễn Phí Vận Chuyển Sỉ',
    description: 'Freeship tối đa 200.000đ cho đơn hàng sỉ có tổng giá trị từ 3.000.000đ.',
    image: '',
    button_text: 'Lưu mã',
    button_action: 'coupon:FREESHIP200',
    type: 'voucher',
    discount_code: 'FREESHIP200',
    discount_value: 200000,
    min_order_amount: 3000000
  },
  {
    id: 6,
    title: 'VAT 0% - Hóa Đơn Đầy Đủ',
    description: 'Hỗ trợ xuất hóa đơn VAT điện tử nhanh chóng cho khách hàng doanh nghiệp và nhà hàng.',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=700&q=80',
    button_text: 'Xem chi tiết',
    button_action: 'page:ve-chung-toi',
    type: 'seasonal'
  },
  {
    id: 7,
    title: 'Combo Rau Củ Quả Tiện Lợi',
    description: 'Combo rau quả tổng hợp đóng gói sẵn phục vụ cho các bếp ăn công nghiệp và nhà hàng lớn.',
    image: 'https://images.unsplash.com/photo-1543083505-590d22e4764d?auto=format&fit=crop&w=700&q=80',
    button_text: 'Xem khuyến mãi',
    button_action: 'category:rau-cu-qua',
    type: 'seasonal'
  }
];

export function ProductsPage() {
  const registerParams = new URLSearchParams(window.location.search);
  registerParams.set('view', 'register');
  registerParams.delete('category');
  registerParams.delete('subcategory');
  const registerHref = `${window.location.pathname}?${registerParams.toString()}`;

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<PromotionItem[]>(defaultPromotions);
  const [claimedCodes, setClaimedCodes] = useState<string[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const activeCategoryData = categories.find((category) => category.name === activeCategory);

  // 1. Fetch promotions dynamically from Magento REST API
  useEffect(() => {
    const fetchPromos = async () => {
      try {
        const response = await fetch('/rest/V1/tmdt-catalog/promotions', {
          method: 'GET',
          cache: 'no-store'
        });
        if (response.ok) {
          const json = await response.json();
          let items: PromotionItem[] = [];
          if (Array.isArray(json)) {
            if (json[0] === true && Array.isArray(json[1])) {
              items = json[1];
            } else {
              items = json;
            }
          } else if (json && Array.isArray(json.items)) {
            items = json.items;
          }
          if (items.length > 0) {
            setPromotions(items);
          }
        }
      } catch (err) {
        console.error('[Banners] Failed to fetch promotions:', err);
      }
    };
    void fetchPromos();
  }, []);

  // 2. Load claimed vouchers state
  const loadClaimedVouchers = () => {
    try {
      const raw = window.localStorage.getItem('freso_claimed_vouchers') || '[]';
      setClaimedCodes(JSON.parse(raw) as string[]);
    } catch {
      setClaimedCodes([]);
    }
  };

  useEffect(() => {
    loadClaimedVouchers();
    window.addEventListener('storage', loadClaimedVouchers);
    return () => window.removeEventListener('storage', loadClaimedVouchers);
  }, []);

  // Group promotions
  const bannerPromos = promotions.filter(p => p.type === 'banner');
  const voucherPromos = promotions.filter(p => p.type === 'voucher');
  const seasonalPromos = promotions.filter(p => p.type === 'seasonal');

  // 3. Auto slide effect for main banner
  useEffect(() => {
    if (bannerPromos.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % bannerPromos.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [bannerPromos]);

  // Show premium Toast alerts
  const triggerToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // 4. Resolve link helper based on action string
  const getActionHref = (action: string) => {
    const parts = action.split(':');
    const type = parts[0];
    const target = parts.slice(1).join(':');

    if (type === 'register') {
      return registerHref;
    }
    if (type === 'category') {
      return `/react/index.html?view=category&category=${target}`;
    }
    if (type === 'page') {
      return `/react/index.html#${target}`;
    }
    return '#';
  };

  // 5. Handle action triggers, especially voucher claims
  const handleAction = (e: React.MouseEvent, promo: PromotionItem) => {
    const action = promo.button_action;
    if (action.startsWith('coupon:')) {
      e.preventDefault();
      const code = promo.discount_code || action.split(':')[1];
      if (!code) return;

      try {
        const raw = window.localStorage.getItem('freso_claimed_vouchers') || '[]';
        const claimedList: string[] = JSON.parse(raw);
        if (claimedList.includes(code)) {
          triggerToast(`Voucher ${code} đã có sẵn trong ví của bạn!`, 'info');
          return;
        }

        claimedList.push(code);
        window.localStorage.setItem('freso_claimed_vouchers', JSON.stringify(claimedList));
        window.dispatchEvent(new Event('storage'));
        triggerToast(`Nhận voucher ${code} thành công! Voucher sẽ tự động áp dụng khi thanh toán.`, 'success');
      } catch {
        triggerToast('Không thể lưu voucher vào ví, vui lòng thử lại.', 'error');
      }
    } else if (action.startsWith('page:')) {
      const anchor = action.split(':')[1];
      const targetElement = document.getElementById(anchor);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const formatCurrency = (val?: number | null) => {
    if (!val) return '0đ';
    return new Intl.NumberFormat('vi-VN').format(Math.round(val)) + 'đ';
  };

  return (
    <section id="san-pham-hien-thi" className="py-6 bg-gray-50 font-sans">
      <div className="container mx-auto px-4">
        {/* Toast Alert */}
        {toast && (
          <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border transition-all duration-300 transform scale-100 ${toast.type === 'success'
              ? 'bg-[#E9F8EF] text-[#00b14f] border-[#CDEEDB]'
              : toast.type === 'info'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
            <div className="shrink-0">
              {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            <span className="text-sm font-bold tracking-tight">{toast.message}</span>
          </div>
        )}

        {/* Top Grid: Sidebar Categories + Main Banner + Right Column Promo Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-[23%_49%_28%] xl:grid-cols-[24%_47%_29%] gap-5 items-stretch">
          {/* Category Sidebar - Left */}
          <aside className="relative z-30">
            <div
              className="relative h-full overflow-visible"
              onMouseLeave={() => setActiveCategory(null)}
            >
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full">
                {categories.map((category, index) => (
                  <a
                    key={index}
                    href={getCategoryPageLink(category.name)}
                    onMouseEnter={() => setActiveCategory(category.name)}
                    className={`w-full h-16 flex items-center gap-3 px-4 transition-colors border-b border-gray-100 last:border-b-0 group ${activeCategory === category.name
                        ? 'bg-green-50 text-green-700'
                        : 'hover:bg-gray-50 hover:text-green-700'
                      }`}
                  >
                    <span className="text-xl">{categoryEmojiMap[category.name] ?? '🛒'}</span>
                    <span
                      className={`flex-1 min-w-0 text-left text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis ${activeCategory === category.name
                          ? 'text-green-700'
                          : 'text-gray-700 group-hover:text-green-600'
                        }`}
                      title={category.name}
                    >
                      {category.name}
                    </span>
                    <ChevronRight
                      className={`size-4 transition-all ${activeCategory === category.name
                          ? 'text-green-600 translate-x-0.5'
                          : 'text-gray-400 group-hover:text-green-600'
                        }`}
                    />
                  </a>
                ))}
              </div>

              {activeCategoryData && (
                <div className="absolute top-0 left-[calc(100%-1px)] z-20 w-[360px] h-full bg-white border border-gray-200 rounded-r-2xl shadow-xl p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">{activeCategoryData.name}</h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    {activeCategoryData.subcategories.map((subcategory) => (
                      <a
                        key={subcategory}
                        href={getCategoryPageLink(activeCategoryData.name, subcategory)}
                        className="text-sm text-gray-700 px-3 py-2 rounded-lg hover:bg-green-50 hover:text-green-700 transition-colors whitespace-normal break-words leading-snug"
                      >
                        {subcategory}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Main Slider Banner - Center */}
          <div className="relative overflow-hidden rounded-2xl shadow-lg min-h-[452px] bg-gradient-to-r from-green-700 via-green-600 to-emerald-500">
            <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-24 left-8 h-64 w-64 rounded-full bg-emerald-300/30 blur-2xl pointer-events-none" />

            {bannerPromos.map((promo, idx) => {
              const isActive = idx === activeSlide;
              return (
                <div
                  key={promo.id}
                  className={`absolute inset-0 transition-opacity duration-700 flex items-center justify-between px-8 lg:px-9 py-8 ${isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                >
                  <div className="max-w-[58%] text-white">
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-4">
                      <Sparkles size={12} className="text-yellow-300 fill-yellow-300 animate-pulse" />
                      Ưu đãi mùa vụ nông sản
                    </p>
                    <h2 className="text-3xl lg:text-4xl font-black leading-tight mb-3 tracking-tight drop-shadow-sm">
                      {promo.title}
                    </h2>
                    <p className="text-sm lg:text-base text-white/90 mb-5 leading-relaxed font-medium">
                      {promo.description}
                    </p>

                    <a
                      href={getActionHref(promo.button_action)}
                      onClick={(e) => handleAction(e, promo)}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-white text-green-700 rounded-full text-sm font-bold shadow-md hover:bg-green-50 transition-all hover:scale-105"
                    >
                      {promo.button_text}
                      <ChevronRight size={16} />
                    </a>
                  </div>

                  <div className="w-[36%] flex justify-end shrink-0">
                    <ImageWithFallback
                      src={promo.image}
                      alt={promo.title}
                      className="h-[280px] w-[210px] object-cover rounded-2xl shadow-2xl border-4 border-white/10"
                    />
                  </div>
                </div>
              );
            })}

            {/* Slider Dots */}
            {bannerPromos.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {bannerPromos.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveSlide(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${idx === activeSlide ? 'w-6 bg-white' : 'w-2 bg-white/50'
                      }`}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Promotion Cards - Right */}
          <div className="flex flex-col gap-4 h-full min-h-[452px]">
            {seasonalPromos.slice(0, 2).map((promo) => (
              <div
                key={promo.id}
                className="relative flex-1 rounded-2xl overflow-hidden shadow-md group border border-gray-100 min-h-[216px]"
              >
                <ImageWithFallback
                  src={promo.image}
                  alt={promo.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-green-950/85 via-emerald-900/75 to-teal-900/85" />
                <div className="relative h-full p-5 text-white flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-black tracking-widest text-emerald-300 uppercase block mb-1">
                      Chiến dịch B2B
                    </span>
                    <h3 className="text-xl font-bold leading-tight tracking-tight">
                      {promo.title}
                    </h3>
                    <p className="text-xs opacity-90 mt-2 leading-relaxed">
                      {promo.description}
                    </p>
                  </div>
                  <a
                    href={getActionHref(promo.button_action)}
                    onClick={(e) => handleAction(e, promo)}
                    className="mt-4 bg-white text-emerald-800 px-4 py-2 rounded-full text-xs font-bold hover:bg-emerald-50 transition-colors inline-flex items-center gap-1 w-fit shadow-md"
                  >
                    {promo.button_text}
                    <ChevronRight className="size-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Voucher Tickets Section - Full Width Bottom Row */}
        {voucherPromos.length > 0 && (
          <div className="mt-8 bg-white border border-orange-100 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-orange-50 text-orange-500 rounded-lg">
                <Ticket className="size-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 tracking-tight text-[16px]">
                  Bảng Vàng Voucher - Ưu Đãi Độc Quyền
                </h3>
                <p className="text-xs text-slate-400 font-medium">Lưu mã ưu đãi để tự động giảm trừ trực tiếp trên hoá đơn thanh toán</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {voucherPromos.map((promo) => {
                const code = promo.discount_code || '';
                const isClaimed = claimedCodes.includes(code);

                return (
                  <div
                    key={promo.id}
                    className="flex items-stretch border border-orange-200/60 rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Left Coupon Badge */}
                    <div className="w-[30%] bg-gradient-to-br from-orange-500 to-amber-500 text-white flex flex-col items-center justify-center p-3 text-center shrink-0 border-r border-dashed border-orange-200 relative">
                      {/* Ticket Notch effect */}
                      <div className="absolute -top-1.5 left-full -translate-x-1/2 w-3 h-3 bg-white border-b border-orange-200/60 rounded-full" />
                      <div className="absolute -bottom-1.5 left-full -translate-x-1/2 w-3 h-3 bg-white border-t border-orange-200/60 rounded-full" />

                      <Percent className="size-5 opacity-90 mb-1" />
                      <span className="text-[17px] font-black tracking-tight leading-none">
                        {promo.discount_value && promo.discount_value > 0 ? `${promo.discount_value / 1000}K` : 'FREE'}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold mt-1 opacity-90">
                        {promo.discount_value && promo.discount_value > 0 ? 'Giảm Giá' : 'Freeship'}
                      </span>
                    </div>

                    {/* Right Coupon Body */}
                    <div className="flex-1 bg-white p-4 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="font-extrabold text-slate-800 text-[14px] truncate" title={promo.title}>
                            {promo.title}
                          </h4>
                          <span className="text-[11px] font-black font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                            {code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed" title={promo.description}>
                          {promo.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-4 mt-3 pt-3 border-t border-gray-50">
                        <span className="text-[10px] text-slate-400 font-bold">
                          Đơn tối thiểu: {formatCurrency(promo.min_order_amount)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleAction(e, promo)}
                          disabled={isClaimed}
                          className={`px-4 py-1.5 rounded-full text-xs font-black transition-all flex items-center gap-1 ${isClaimed
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                              : 'bg-orange-500 hover:bg-orange-600 text-white shadow-md hover:scale-105 active:scale-95'
                            }`}
                        >
                          {isClaimed ? (
                            <>
                              <Check size={12} strokeWidth={3} />
                              <span>Đã lưu</span>
                            </>
                          ) : (
                            <span>Lưu mã</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
