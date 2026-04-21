import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
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

export function ProductsPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const reactHomePath = '/react/index.html';

  const activeCategoryData = categories.find((category) => category.name === activeCategory);

  return (
    <section id="san-pham-hien-thi" className="py-6 bg-gray-50">
      <div className="container mx-auto px-4">
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
                    className={`w-full h-16 flex items-center gap-3 px-4 transition-colors border-b border-gray-100 last:border-b-0 group ${
                      activeCategory === category.name
                        ? 'bg-green-50 text-green-700'
                        : 'hover:bg-gray-50 hover:text-green-700'
                    }`}
                  >
                    <span className="text-xl">{categoryEmojiMap[category.name] ?? '🛒'}</span>
                    <span
                      className={`flex-1 min-w-0 text-left text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis ${
                        activeCategory === category.name
                          ? 'text-green-700'
                          : 'text-gray-700 group-hover:text-green-600'
                      }`}
                      title={category.name}
                    >
                      {category.name}
                    </span>
                    <ChevronRight
                      className={`size-4 transition-all ${
                        activeCategory === category.name
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

          {/* Main Banner - Center */}
          <div>
            <div className="relative h-full min-h-[452px] rounded-2xl overflow-hidden shadow-lg bg-gradient-to-r from-green-700 via-green-600 to-emerald-500">
              <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-24 left-8 h-64 w-64 rounded-full bg-emerald-300/30 blur-2xl" />

              <div className="relative h-full flex items-center justify-between px-8 lg:px-9 py-8">
                <div className="max-w-[56%] text-white">
                  <p className="inline-flex items-center rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium mb-4">
                    Ưu đãi đặc biệt hôm nay
                  </p>
                  <h2 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-3">
                    Tươi ngon mỗi ngày
                  </h2>
                  <p className="text-lg text-white/95 mb-4">
                    Giảm đến 35% cho combo rau củ & thực phẩm sạch.
                  </p>
                  <p className="text-sm text-white/85 mb-5">Áp dụng từ 01/04 - 30/04/2026</p>

                  <div className="flex flex-wrap gap-2.5">
                    <span className="rounded-full bg-white text-green-700 px-4 py-2 text-sm font-semibold">
                      Miễn phí vận chuyển
                    </span>
                    <span className="rounded-full bg-orange-500 text-white px-4 py-2 text-sm font-semibold">
                      Mua 4 tặng 1
                    </span>
                  </div>
                </div>

                <div className="w-[39%] flex justify-end">
                  <ImageWithFallback
                    src="https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=700&q=80"
                    alt="Sản phẩm ưu đãi"
                    className="h-[282px] w-[230px] object-cover rounded-2xl shadow-xl"
                  />
                </div>
              </div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                <span className="h-2.5 w-6 rounded-full bg-white" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/50" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/50" />
              </div>
            </div>
          </div>

          {/* Promotion Cards - Right */}
          <div className="flex flex-col gap-4 h-full min-h-[452px]">
            <div className="relative flex-1 rounded-2xl overflow-hidden shadow-md group cursor-pointer min-h-[216px]">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1556742400-b5a63d3f8d9f?auto=format&fit=crop&w=700&q=80"
                alt="Banner VAT"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-teal-700/90 to-cyan-700/90" />
              <div className="relative h-full p-5 text-white flex flex-col justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Doanh nghiệp an tâm</p>
                  <h3 className="text-2xl font-bold leading-tight">Hóa đơn VAT điện tử</h3>
                  <p className="text-sm opacity-95 mt-2">Xuất đầy đủ cho mọi đơn hàng</p>
                </div>
                <a href={`${reactHomePath}#ve-chung-toi`} className="mt-4 bg-white text-teal-700 px-4 py-2 rounded-full text-sm font-semibold hover:bg-teal-50 transition-colors inline-flex items-center gap-1.5 w-fit">
                  Xem chi tiết
                  <ChevronRight className="size-4" />
                </a>
              </div>
            </div>

            <div className="relative flex-1 rounded-2xl overflow-hidden shadow-md group cursor-pointer min-h-[216px]">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1484980859177-5ac1249fda6f?auto=format&fit=crop&w=700&q=80"
                alt="Banner khuyến mãi khách hàng"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-green-600/90 to-emerald-700/90" />
              <div className="relative h-full p-5 text-white flex flex-col justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Khách hàng mới</p>
                  <h3 className="text-3xl font-extrabold leading-tight">Tặng voucher 300K</h3>
                  <p className="text-sm opacity-95 mt-2">Khi mua đơn đầu tiên từ 699K</p>
                </div>
                <a href={`${reactHomePath}?view=register`} className="mt-4 bg-white text-green-700 px-4 py-2 rounded-full text-sm font-semibold hover:bg-green-50 transition-colors inline-flex items-center gap-1.5 w-fit">
                  Xem chi tiết
                  <ChevronRight className="size-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}