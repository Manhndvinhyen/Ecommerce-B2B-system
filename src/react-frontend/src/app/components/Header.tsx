import { useEffect, useMemo, useRef, useState } from 'react';
import { ShoppingCart, User, Menu, Search, ChevronRight, Heart, Bell, HelpCircle, Store } from 'lucide-react';
import { categoryMenu, getCategoryPageLink } from '../data/categories';
import { getDefaultWishlistList, hasWishlistAuth } from '../utils/wishlistApi';
import { adminMenuItems } from './SidebarMenu';
import { useCart } from '../cart/CartProvider';

export function Header() {
  const { cartItems } = useCart();
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(categoryMenu[0].name);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerToken, setCustomerToken] = useState('');
  const [branchName, setBranchName] = useState('Chi nhanh 1');
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState('');
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const reactHomePath = '/react/index.html';
  const [wishlistDetailHref, setWishlistDetailHref] = useState(`${reactHomePath}?view=wishlist`);
  const registerParams = new URLSearchParams(window.location.search);
  registerParams.set('view', 'register');
  registerParams.delete('category');
  registerParams.delete('subcategory');
  registerParams.delete('seller');
  const registerHref = `${reactHomePath}?${registerParams.toString()}`;

  const loginParams = new URLSearchParams(window.location.search);
  loginParams.set('view', 'login');
  loginParams.delete('category');
  loginParams.delete('subcategory');
  const loginHref = `${window.location.pathname}?${loginParams.toString()}`;

  const currentCategory = categoryMenu.find((category) => category.name === activeCategory) ?? categoryMenu[0];
  const isLoggedIn = useMemo(() => Boolean(customerToken), [customerToken]);
  const isEmbeddedInIframe = window.self !== window.top;

  const handleTopLevelNavigation = (event: React.MouseEvent<HTMLElement>) => {
    if (!isEmbeddedInIframe) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
    if (!anchor) {
      return;
    }

    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || anchor.target === '_blank') {
      return;
    }

    event.preventDefault();

    const nextUrl = anchor.href || href;
    if (window.top) {
      window.top.location.href = nextUrl;
    }
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const keyword = searchTerm.trim();
    if (!keyword) {
      console.info('[FresoSearch][Header] submit ignored because keyword is empty');
      return;
    }

    const params = new URLSearchParams({
      view: 'search',
      q: keyword
    });

    const nextUrl = `${reactHomePath}?${params.toString()}`;
    console.info('[FresoSearch][Header] submit accepted, navigating to search page', {
      keyword,
      nextUrl
    });

    window.location.href = nextUrl;
  };

  useEffect(() => {
    const storedToken = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';
    const storedEmail = window.localStorage.getItem('freso_customer_email') || window.sessionStorage.getItem('freso_customer_email') || '';
    const storedName = window.localStorage.getItem('freso_customer_name') || window.sessionStorage.getItem('freso_customer_name') || '';
    const storedRole = window.localStorage.getItem('freso_role') || window.sessionStorage.getItem('freso_role') || '';

    setCustomerToken(storedToken);
    setCustomerEmail(storedEmail);
    setCustomerName(storedName);
    setUserRole(storedRole);

    const storedBranch = window.localStorage.getItem('freso_branch_name') || window.sessionStorage.getItem('freso_branch_name') || '';
    if (storedBranch.trim()) {
      setBranchName(storedBranch.trim());
    }
  }, []);

  useEffect(() => {
    if (!customerToken) return;

    fetch(`${window.location.origin}/rest/V1/customers/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data || typeof data !== 'object') return;
        
        const firstname = String(data.firstname || '').trim();
        const lastname = String(data.lastname || '').trim();
        const fullName = `${firstname} ${lastname}`.trim();
        if (fullName) {
          window.localStorage.setItem('freso_customer_name', fullName);
          window.sessionStorage.setItem('freso_customer_name', fullName);
          setCustomerName(fullName);
        }

        const customAttributes = Array.isArray((data as { custom_attributes?: unknown }).custom_attributes)
          ? ((data as { custom_attributes?: unknown }).custom_attributes as Array<{ attribute_code?: string; value?: unknown }>)
          : [];
        const roleAttr = customAttributes.find((attr) => attr?.attribute_code === 'tmdt_role');
        const ownerAttr = customAttributes.find((attr) => attr?.attribute_code === 'is_owner');
        const superAdminAttr = customAttributes.find((attr) => attr?.attribute_code === 'is_super_admin');

        const parseBoolFlag = (value: string) => {
          const normalized = value.trim().toLowerCase();
          return normalized === '1' || normalized === 'true' || normalized === 'yes';
        };

        if (ownerAttr || superAdminAttr) {
          const isOwner = ownerAttr ? parseBoolFlag(String(ownerAttr.value ?? '')) : false;
          const isSuper = superAdminAttr ? parseBoolFlag(String(superAdminAttr.value ?? '')) : false;
          const hasPrivilege = isOwner || isSuper;
          window.localStorage.setItem('freso_is_owner', hasPrivilege ? '1' : '0');
          window.sessionStorage.setItem('freso_is_owner', hasPrivilege ? '1' : '0');
          window.localStorage.setItem('freso_is_super_admin', hasPrivilege ? '1' : '0');
          window.sessionStorage.setItem('freso_is_super_admin', hasPrivilege ? '1' : '0');
        }

        if (roleAttr) {
          const nextRole = String(roleAttr.value ?? '').trim().toLowerCase();
          const currentRole = window.localStorage.getItem('freso_role') || window.sessionStorage.getItem('freso_role') || '';
          
          if (nextRole !== currentRole) {
            window.localStorage.setItem('freso_role', nextRole);
            window.sessionStorage.setItem('freso_role', nextRole);
            setUserRole(nextRole);
            window.dispatchEvent(new CustomEvent('freso:profile-updated'));
          }
        }
      })
      .catch(() => {
        // ignore background sync errors
      });
  }, [customerToken]);

  useEffect(() => {
    const loadWishlistLink = async () => {
      if (!hasWishlistAuth()) {
        setWishlistDetailHref(`${reactHomePath}?view=wishlist`);
        return;
      }

      const list = await getDefaultWishlistList();
      if (!list) {
        setWishlistDetailHref(`${reactHomePath}?view=wishlist`);
        return;
      }

      setWishlistDetailHref(`${reactHomePath}?view=wishlist&listId=${encodeURIComponent(list.id)}`);
    };

    loadWishlistLink();
  }, [customerToken]);

  const handleLogout = async () => {
    // Clear any application-specific storage keys (freso_*) from both storages.
    try {
      const localKeys = Object.keys(window.localStorage || {}).filter((k) => k.startsWith('freso_'));
      localKeys.forEach((k) => window.localStorage.removeItem(k));
    } catch (_err) {
      // ignore
    }

    try {
      const sessionKeys = Object.keys(window.sessionStorage || {}).filter((k) => k.startsWith('freso_'));
      sessionKeys.forEach((k) => window.sessionStorage.removeItem(k));
    } catch (_err) {
      // ignore
    }

    // Clear any accessible cookies to reduce chance of stale admin/session indicators
    try {
      document.cookie.split(';').forEach((cookie) => {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        if (!name) return;
        // try clearing with and without domain to increase chance of removal for accessible cookies
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      });
    } catch (_err) {
      // ignore
    }

    // Reset local component state
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
      try {
        // notify other tabs about logout (storage events don't fire in same tab)
        window.localStorage.setItem('freso_last_logout', String(Date.now()));
      } catch (_e) {
        // ignore
      }
      // Use replace so back doesn't go back to an authenticated page
      window.location.replace(reactHomePath);
    }
  };

  const displayedUserName = customerName || customerEmail || 'Tài khoản';
  const currentView = new URLSearchParams(window.location.search).get('view');
  const dashboardBase = currentView === 'seller-dashboard'
    ? `${reactHomePath}?view=seller-dashboard`
    : `${reactHomePath}?view=dashboard`;
  const getDashboardHref = (tabLabel: string) => `${dashboardBase}&tab=${encodeURIComponent(tabLabel)}`;
  const activeDashboardTab = new URLSearchParams(window.location.search).get('tab');
  const visibleMenuItems = currentView === 'dashboard'
    ? adminMenuItems.filter((item) => item.id === 'profile-seller' || item.id === 'nhan-vien')
    : adminMenuItems.filter((item) => userRole === 'seller' ? true : item.id !== 'thong-tin');

  const logoutAndBackHome = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    await handleLogout();
  };

  useEffect(() => {
    const syncAuthState = (ev?: StorageEvent | null) => {
      // If storage event indicates a logout, clear local state.
      if (ev && ev.key === 'freso_last_logout') {
        setCustomerToken('');
        setCustomerEmail('');
        setCustomerName('');
        setBranchName('Chi nhanh 1');
        setUserRole('');
        setIsUserMenuOpen(false);
        return;
      }

      if (ev && ev.key === 'freso_last_profile_update') {
        // Fall through to re-sync state from storage.
      }

      const token = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';
      const email = window.localStorage.getItem('freso_customer_email') || window.sessionStorage.getItem('freso_customer_email') || '';
      const name = window.localStorage.getItem('freso_customer_name') || window.sessionStorage.getItem('freso_customer_name') || '';
      const branch = window.localStorage.getItem('freso_branch_name') || window.sessionStorage.getItem('freso_branch_name') || '';
      const role = window.localStorage.getItem('freso_role') || window.sessionStorage.getItem('freso_role') || '';

      setCustomerToken(token);
      setCustomerEmail(email);
      setCustomerName(name);
      setUserRole(role);
      if (branch.trim()) {
        setBranchName(branch.trim());
      }
    };

    const handleProfileUpdated = () => syncAuthState(null);

    window.addEventListener('storage', syncAuthState);
    window.addEventListener('freso:profile-updated', handleProfileUpdated as EventListener);
    // Also call once on mount to sync state
    syncAuthState(null);
    return () => {
      window.removeEventListener('storage', syncAuthState);
      window.removeEventListener('freso:profile-updated', handleProfileUpdated as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && userMenuRef.current?.contains(target)) {
        return;
      }

      setIsUserMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  if (!isLoggedIn) {
    return (
  <header className="sticky top-0 z-50 bg-white shadow-sm" onClickCapture={handleTopLevelNavigation}>
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
              <a href="/react/index.html?view=register&seller=1" className="px-4 py-1.5 text-sm border-2 border-orange-500 text-orange-500 rounded-full hover:bg-orange-50 transition-colors whitespace-nowrap">
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
                <a href={reactHomePath} className="text-2xl font-bold text-green-600">
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
                    <span
                      className="text-gray-700 font-medium select-none cursor-default"
                    >
                      Danh mục sản phẩm
                    </span>

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
                  
                </nav>
              </div>

              {/* Search Bar */}
              <form onSubmit={handleSearchSubmit} className="hidden lg:flex items-center flex-1 max-w-xl mx-8">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-5" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm sản phẩm..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-green-500"
                  />
                </div>
              </form>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <a href={isLoggedIn ? '/customer/account' : '/?view=login'} className="p-2 hover:bg-gray-100 rounded-full transition-colors hidden md:block">
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
                        href={`${reactHomePath}?view=wishlist`}
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
                <a href={`${reactHomePath}?view=cart`} className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
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

  return (
  <header className="sticky top-0 z-50 bg-white shadow-sm" onClickCapture={handleTopLevelNavigation}>
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
                  href="/react/index.html?view=register&seller=1"
                  className="px-4 py-1.5 text-sm border-2 border-orange-500 text-orange-500 rounded-full hover:bg-orange-50 transition-colors whitespace-nowrap"
                >
                  Đăng ký bán hàng
                </a>
              </>
            ) : (
              <>
                {userRole === 'customer' ? (
                  <>
                    <a
                      href="/react/index.html?view=register&seller=1"
                      className="px-3 py-1 text-xs border border-orange-500 text-orange-500 rounded-full hover:bg-orange-50 transition-colors font-bold whitespace-nowrap"
                    >
                      Đăng ký người bán
                    </a>
                    <span className="text-gray-300">|</span>
                  </>
                ) : userRole === 'seller' ? (
                  <>
                    <a
                      href={`${reactHomePath}?view=seller-dashboard`}
                      className="px-3 py-1 text-xs bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors font-bold whitespace-nowrap shadow-sm"
                    >
                      Trang người bán
                    </a>
                    <span className="text-gray-300">|</span>
                  </>
                ) : null}
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{branchName}</span>
                </div>
                <span className="text-gray-300">|</span>
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-green-600"
                  >
                    <User className="size-4" />
                    {displayedUserName}
                  </button>
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-[280px] bg-white border border-gray-200 rounded-2xl shadow-xl p-2 z-50">
                      <div className="px-3 py-2 text-sm font-semibold text-gray-900">{displayedUserName}</div>
                      <div className="grid grid-cols-1 gap-1 text-sm">
                        {visibleMenuItems.map((item) => {
                            const isActive = activeDashboardTab === item.label;
                            return (
                              <a
                                key={item.id}
                                href={getDashboardHref(item.label)}
                                className={`w-full rounded-xl px-4 py-2.5 text-[14px] font-semibold transition-colors ${
                                  isActive
                                    ? 'bg-green-50 text-green-700'
                                    : 'text-gray-700 hover:bg-green-50 hover:text-green-700'
                                }`}
                              >
                                {item.label}
                              </a>
                            );
                          })}
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
          <div className="flex items-center justify-between gap-4">
            {/* Logo + Navigation */}
            <div className="flex items-center gap-8">
              <a href={reactHomePath} className="text-2xl font-bold text-green-600">
                Freso
              </a>

              <nav className="hidden lg:flex items-center gap-6">
                <div
                  className="relative pb-3 -mb-3"
                  onMouseEnter={() => {
                    setIsCategoryMenuOpen(true);
                    setActiveCategory((prev) => prev || categoryMenu[0].name);
                  }}
                  onMouseLeave={() => setIsCategoryMenuOpen(false)}
                >
                  <span className="text-gray-700 font-medium select-none cursor-default">Danh mục sản phẩm</span>

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
              </nav>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} className="hidden lg:flex items-center flex-1 max-w-xl mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-5" />
                <input
                  type="text"
                  placeholder="Tìm kiếm sản phẩm..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-green-500"
                />
              </div>
            </form>

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

              <a id="header-cart-icon" href={`${reactHomePath}?view=cart`} className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ShoppingCart className="size-6 text-gray-700" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full size-5 flex items-center justify-center">
                  {cartItems.length}
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
