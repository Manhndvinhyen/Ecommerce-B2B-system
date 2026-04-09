import { useState } from 'react';
import { ShoppingCart, User, Menu, Search, ChevronRight, Heart } from 'lucide-react';

const categoryMenu = [
  {
    name: 'Rau củ quả',
    subcategories: ['Rau gia vị', 'Rau phổ thông', 'Củ quả', 'Rau đặc biệt', 'Nấm', 'Rau củ chế biến sẵn']
  },
  {
    name: 'Trái cây',
    subcategories: ['Trái cây phổ thông', 'Trái cây nhập khẩu']
  },
  {
    name: 'Thực phẩm tươi sống',
    subcategories: ['Thịt heo', 'Thịt bò-bê', 'Thịt trâu-nghé', 'Thịt dê', 'Thịt gà', 'Thịt vịt-gan-ngỗng', 'Thịt chim', 'Thịt ếch', 'Trứng', 'Giò-chả-nem']
  },
  {
    name: 'Thuỷ hải sản',
    subcategories: ['Cá', 'Tôm', 'Cua', 'Mực', 'Ngao ốc', 'Hải sản chế biến']
  },
  {
    name: 'Thực phẩm đông lạnh',
    subcategories: ['Thịt heo', 'Thịt bò-bê', 'Thịt trâu-nghé', 'Thịt dê', 'Thịt gà', 'Thịt vịt-gan-ngỗng', 'Thịt chim', 'Thịt ếch', 'Trứng', 'Giò-chả-nem', 'Xúc xích - lạp xưởng']
  },
  {
    name: 'Thực phẩm khô',
    subcategories: ['Gia vị', 'Gạo', 'Bột', 'Bún-miến-phở-nui', 'Hạt khô', 'Đồ uống', 'Kem-bơ-phô mai', 'Mứt siro', 'Trà - cà phê đóng gói', 'Thực phẩm khô khác']
  },
  {
    name: 'Tiện ích bếp',
    subcategories: ['Dụng cụ ăn uống', 'Đồ dùng bếp', 'Chất tẩy rửa', 'Dụng cụ vệ sinh', 'Sản phẩm khác']
  }
];

export function Header() {
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(categoryMenu[0].name);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);

  const currentCategory = categoryMenu.find((category) => category.name === activeCategory) ?? categoryMenu[0];

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      {/* Top Bar - Auth Buttons - Tầng 1 */}
      <div className="bg-gray-50 border-b">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-end gap-3">
            <button className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors">
              Đăng nhập
            </button>
            <button className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors">
              Đăng ký
            </button>
            <button className="px-4 py-1.5 text-sm border-2 border-orange-500 text-orange-500 rounded-full hover:bg-orange-50 transition-colors whitespace-nowrap">
              Đăng ký bán hàng
            </button>
          </div>
        </div>
      </div>

      {/* Main Header - Logo, Menu, Search, Cart - Tầng 2 */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <a href="/" className="text-2xl font-bold text-green-600">
                Freso
              </a>
              
              {/* Navigation */}
              <nav className="hidden lg:flex items-center gap-6">
                <div
                  className="relative pb-3 -mb-3"
                  onMouseEnter={() => {
                    setIsCategoryMenuOpen(true);
                    setActiveCategory((prev) => prev || categoryMenu[0].name);
                  }}
                  onMouseLeave={() => setIsCategoryMenuOpen(false)}
                >
                  <button
                    className="text-gray-700 hover:text-green-600 transition-colors font-medium"
                  >
                    Danh mục sản phẩm
                  </button>

                  {isCategoryMenuOpen && (
                    <div className="absolute top-full left-0 w-[760px] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden z-50">
                      <div className="grid grid-cols-[280px_1fr] min-h-[360px]">
                        <div className="bg-gray-50 border-r border-gray-100 p-3">
                          {categoryMenu.map((category) => {
                            const isActive = activeCategory === category.name;
                            return (
                              <button
                                key={category.name}
                                onMouseEnter={() => setActiveCategory(category.name)}
                                className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                                  isActive
                                    ? 'bg-green-100 text-green-700 font-semibold shadow-sm'
                                    : 'text-gray-700 hover:bg-white hover:shadow-sm hover:text-green-700'
                                }`}
                              >
                                <span className="pr-3">{category.name}</span>
                                <ChevronRight className={`size-4 transition-transform ${isActive ? 'translate-x-0.5' : ''}`} />
                              </button>
                            );
                          })}
                        </div>

                        <div className="p-5">
                          <h3 className="font-bold text-gray-900 mb-4">{currentCategory.name}</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {currentCategory.subcategories.map((subcategory) => (
                              <a
                                key={subcategory}
                                href="#"
                                className="text-sm text-gray-700 px-3 py-2 rounded-lg hover:bg-green-50 hover:text-green-700 transition-colors"
                              >
                                {subcategory}
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <a href="#" className="text-gray-700 hover:text-green-600 transition-colors">
                  Về chúng tôi
                </a>
                <a href="#" className="text-gray-700 hover:text-green-600 transition-colors">
                  Liên hệ
                </a>
              </nav>
            </div>

            {/* Search Bar */}
            <div className="hidden lg:flex items-center flex-1 max-w-xl mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-5" />
                <input
                  type="text"
                  placeholder="Tìm kiếm sản phẩm..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-green-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors hidden md:block">
                <User className="size-6 text-gray-700" />
              </button>
              <div
                className="relative hidden md:block pb-2 -mb-2"
                onMouseLeave={() => setIsFavoritesOpen(false)}
              >
                <button
                  onClick={() => setIsFavoritesOpen((prev) => !prev)}
                  onMouseEnter={() => setIsFavoritesOpen(true)}
                  className={`p-2 rounded-full transition-all duration-200 ${
                    isFavoritesOpen
                      ? 'bg-rose-50 text-rose-600 ring-2 ring-rose-100 shadow-sm'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                  aria-label="Mục yêu thích"
                >
                  <Heart className={`size-6 transition-all ${isFavoritesOpen ? 'fill-rose-500 text-rose-500 scale-105' : 'text-gray-700'}`} />
                </button>

                {isFavoritesOpen && (
                  <div className="absolute top-full right-0 w-56 bg-white border border-rose-100 rounded-xl shadow-xl p-2 z-50">
                    <a
                      href="#"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                    >
                      <Heart className="size-4" />
                      Sản phẩm yêu thích
                    </a>
                    <a
                      href="#"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                    >
                      <Heart className="size-4" />
                      Đơn hàng yêu thích
                    </a>
                  </div>
                )}
              </div>
              <button className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ShoppingCart className="size-6 text-gray-700" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full size-5 flex items-center justify-center">
                  0
                </span>
              </button>
              <button className="md:hidden p-2 hover:bg-gray-100 rounded-full transition-colors">
                <Menu className="size-6 text-gray-700" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
