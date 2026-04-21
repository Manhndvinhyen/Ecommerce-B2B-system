import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, User, Menu, Search, ChevronRight, Heart } from 'lucide-react';
import { categoryMenu, getCategoryPageLink } from '../data/categories';
import { useCart } from '../cart/CartProvider';

export function Header() {
  const { cartItemCount } = useCart();
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(categoryMenu[0].name);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerToken, setCustomerToken] = useState('');
  const [branchName, setBranchName] = useState('Chi nhanh 1');
  const reactHomePath = '/react/index.html';
  const registerParams = new URLSearchParams(window.location.search);
  registerParams.set('view', 'register');
  registerParams.delete('category');
  registerParams.delete('subcategory');
  const registerHref = `${reactHomePath}?${registerParams.toString()}`;

  const loginParams = new URLSearchParams(window.location.search);
  loginParams.set('view', 'login');
  loginParams.delete('category');
  loginParams.delete('subcategory');
  const loginHref = `${window.location.pathname}?${loginParams.toString()}`;

  const currentCategory = categoryMenu.find((category) => category.name === activeCategory) ?? categoryMenu[0];
  const isLoggedIn = useMemo(() => Boolean(customerToken), [customerToken]);

  useEffect(() => {
    const storedToken = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';
    const storedEmail = window.localStorage.getItem('freso_customer_email') || window.sessionStorage.getItem('freso_customer_email') || '';
    const storedName = window.localStorage.getItem('freso_customer_name') || window.sessionStorage.getItem('freso_customer_name') || '';

    setCustomerToken(storedToken);
    setCustomerEmail(storedEmail);
    setCustomerName(storedName);

    const storedBranch = window.localStorage.getItem('freso_branch_name') || window.sessionStorage.getItem('freso_branch_name') || '';
    if (storedBranch.trim()) {
      setBranchName(storedBranch.trim());
    }
  }, []);

  const handleLogout = async () => {
    window.localStorage.removeItem('freso_customer_token');
    window.localStorage.removeItem('freso_customer_email');
    window.localStorage.removeItem('freso_customer_name');
    window.localStorage.removeItem('freso_branch_name');
    window.sessionStorage.removeItem('freso_customer_token');
    window.sessionStorage.removeItem('freso_customer_email');
    window.sessionStorage.removeItem('freso_customer_name');
    window.sessionStorage.removeItem('freso_branch_name');
    setCustomerToken('');
    setCustomerEmail('');
    setCustomerName('');
    setBranchName('Chi nhanh 1');
    setIsUserMenuOpen(false);

    try {
      await fetch('/customer/account/logout/', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
    } catch (_error) {
      // Ignore network errors and continue redirecting to home.
    } finally {
      window.location.href = reactHomePath;
    }
  };

  const displayedUserName = customerName || customerEmail;

  const logoutAndBackHome = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    await handleLogout();
  };

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const syncAuthState = () => {
      const token = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';
      const email = window.localStorage.getItem('freso_customer_email') || window.sessionStorage.getItem('freso_customer_email') || '';
      const name = window.localStorage.getItem('freso_customer_name') || window.sessionStorage.getItem('freso_customer_name') || '';
      const branch = window.localStorage.getItem('freso_branch_name') || window.sessionStorage.getItem('freso_branch_name') || '';

      setCustomerToken(token);
      setCustomerEmail(email);
      setCustomerName(name);
      if (branch.trim()) {
        setBranchName(branch.trim());
      }
    };

    window.addEventListener('storage', syncAuthState);
    return () => {
      window.removeEventListener('storage', syncAuthState);
    };
  }, [isLoggedIn]);

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      {/* Top Bar - Tầng 1 */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-2.5">
          <div className="flex items-center justify-end gap-3">
            {!isLoggedIn ? (
              <>
                <a href={loginHref} className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors">
                  Đăng nhập
                </a>
                <a href={registerHref} className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors">
                  Đăng ký
                </a>
                <a
                  href="/react/index.html?view=register"
                  className="px-4 py-1.5 text-sm border-2 border-orange-500 text-orange-500 rounded-full hover:bg-orange-50 transition-colors whitespace-nowrap"
                >
                  Đăng ký bán hàng
                </a>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Vuachaca</span>
                </div>
                <span className="text-gray-300">|</span>
                <span className="text-sm text-gray-700">{branchName}</span>
                <span className="text-gray-300">|</span>
                <div
                  className="relative"
                  onMouseLeave={() => setIsUserMenuOpen(false)}
                >
                  <button
                    type="button"
                    onMouseEnter={() => setIsUserMenuOpen(true)}
                    onClick={() => setIsUserMenuOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-green-600"
                  >
                    <User className="size-4" />
                    {displayedUserName}
                  </button>
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-[320px] bg-white border border-gray-200 rounded-2xl shadow-xl p-4 z-50">
                      <div className="text-sm font-semibold text-gray-900 mb-3">{displayedUserName}</div>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <a href="/customer/account" className="px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                          Thong tin chung
                        </a>
                        <a href="/sales/order/history" className="px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                          Quan ly don hang
                        </a>
                        <a href="/wishlist" className="px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                          San pham yeu thich
                        </a>
                        <a href="/sales/order/history" className="px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                          Don hang yeu thich
                        </a>
                        <a href="/tmdt/branch" className="px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                          Quan ly chi nhanh
                        </a>
                        <a href="/tmdt/staff" className="px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                          Nhan vien
                        </a>
                        <a href="/tmdt/supplier" className="px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                          Nha cung cap
                        </a>
                        <a href="/tmdt/report" className="px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700">
                          Bao cao
                        </a>
                      </div>
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={logoutAndBackHome}
                          className="w-full px-4 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Dang xuat
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Header - Logo, Menu, Search, Cart - Tầng 2 */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <a href={reactHomePath} className="flex flex-col">
              <span className="text-2xl font-bold text-green-600">Freso</span>
            </a>

            {/* Category Menu Button */}
            <div
              className="relative"
              onMouseEnter={() => {
                setIsCategoryMenuOpen(true);
                setActiveCategory((prev) => prev || categoryMenu[0].name);
              }}
              onMouseLeave={() => setIsCategoryMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 text-gray-700 hover:text-green-600 transition-colors"
              >
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="font-medium">Danh mục sản phẩm</span>
              </button>

              {isCategoryMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-[760px] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden z-50">
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

            {/* Search Bar */}
            <div className="flex items-center flex-1">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 size-5" />
                <input
                  type="text"
                  placeholder="Tìm kiếm sản phẩm, nhà cung cấp"
                  className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
              {isLoggedIn && (
                <button
                  onClick={() => setIsFavoritesOpen((prev) => !prev)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Mục yêu thích"
                >
                  <Heart className="size-6 text-gray-700" />
                </button>
              )}

              {isLoggedIn && (
                <a
                  href="/sales/order/history"
                  className="flex items-center gap-2 text-gray-700 hover:text-green-600 transition-colors"
                >
                  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Quản lý đơn hàng</span>
                </a>
              )}

              <a id="header-cart-icon" href="/checkout/cart" className="flex items-center gap-2 text-gray-700 hover:text-green-600 transition-colors">
                <div className="relative">
                  <ShoppingCart className="size-6" />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full size-5 flex items-center justify-center">
                      {cartItemCount}
                    </span>
                  )}
                </div>
                <span>Giỏ hàng</span>
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
