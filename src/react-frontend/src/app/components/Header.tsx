import { useState } from 'react';
import { ShoppingCart, User, Menu, Search, ChevronRight, Heart } from 'lucide-react';
import { categoryMenu, getCategoryPageLink } from '../data/categories';

export function Header() {
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(categoryMenu[0].name);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const registerParams = new URLSearchParams(window.location.search);
  registerParams.set('view', 'register');
  registerParams.delete('category');
  registerParams.delete('subcategory');
  const registerHref = `${window.location.pathname}?${registerParams.toString()}`;

  const loginParams = new URLSearchParams(window.location.search);
  loginParams.set('view', 'login');
  loginParams.delete('category');
  loginParams.delete('subcategory');
  const loginHref = `${window.location.pathname}?${loginParams.toString()}`;

  const currentCategory = categoryMenu.find((category) => category.name === activeCategory) ?? categoryMenu[0];

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      {/* Top Bar - Auth Buttons - Tầng 1 */}
      <div className="bg-gray-50 border-b">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-end gap-3">
            <a href={loginHref} className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors">
              Đăng nhập
            </a>
            <a href={registerHref} className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors">
              Đăng ký
            </a>
            <a href="/contact" className="px-4 py-1.5 text-sm border-2 border-orange-500 text-orange-500 rounded-full hover:bg-orange-50 transition-colors whitespace-nowrap">
              Đăng ký bán hàng
            </a>
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
                    type="button"
                    onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
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
                              <a
                                key={category.name}
                                href={getCategoryPageLink(category.name)}
                                onMouseEnter={() => setActiveCategory(category.name)}
                                className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                                  isActive
                                    ? 'bg-green-100 text-green-700 font-semibold shadow-sm'
                                    : 'text-gray-700 hover:bg-white hover:shadow-sm hover:text-green-700'
                                }`}
                              >
                                <span className="pr-3">{category.name}</span>
                                <ChevronRight className={`size-4 transition-transform ${isActive ? 'translate-x-0.5' : ''}`} />
                              </a>
                            );
                          })}
                        </div>

                        <div className="p-5">
                          <h3 className="font-bold text-gray-900 mb-4">{currentCategory.name}</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {currentCategory.subcategories.map((subcategory) => (
                              <a
                                key={subcategory}
                                href={getCategoryPageLink(currentCategory.name, subcategory)}
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
                <a href="/contact" className="text-gray-700 hover:text-green-600 transition-colors">
                  Về chúng tôi
                </a>
                <a href="/contact" className="text-gray-700 hover:text-green-600 transition-colors">
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
              <a href="/customer/account" className="p-2 hover:bg-gray-100 rounded-full transition-colors hidden md:block">
                <User className="size-6 text-gray-700" />
              </a>
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
                      href="/wishlist"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                    >
                      <Heart className="size-4" />
                      Sản phẩm yêu thích
                    </a>
                    <a
                      href="/sales/order/history"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                    >
                      <Heart className="size-4" />
                      Đơn hàng yêu thích
                    </a>
                  </div>
                )}
              </div>
              <a href="/checkout/cart" className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ShoppingCart className="size-6 text-gray-700" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full size-5 flex items-center justify-center">
                  0
                </span>
              </a>
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
