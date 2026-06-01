import { useEffect, useMemo, useRef, useState } from 'react';
import { User, Bell, HelpCircle } from 'lucide-react';
import { adminMenuItems } from './AdminSidebar';

export function SellerHeader() {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerToken, setCustomerToken] = useState('');
  const [branchName, setBranchName] = useState('Chi nhanh 1');
  const [userRole, setUserRole] = useState('seller');
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const reactHomePath = '/react/index.html';
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

  const handleLogout = async () => {
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

    try {
      document.cookie.split(';').forEach((cookie) => {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        if (!name) return;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      });
    } catch (_err) {
      // ignore
    }

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
      // Ignore network errors and continue redirecting
    } finally {
      try {
        window.localStorage.setItem('freso_last_logout', String(Date.now()));
      } catch (_e) {
        // ignore
      }
      window.location.replace(reactHomePath);
    }
  };

  const displayedUserName = customerName || customerEmail || 'Tài khoản';
  const dashboardBase = `${reactHomePath}?view=seller-dashboard`;
  const getDashboardHref = (tabLabel: string) => `${dashboardBase}&tab=${encodeURIComponent(tabLabel)}`;
  const activeDashboardTab = new URLSearchParams(window.location.search).get('tab');

  const logoutAndBackHome = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    await handleLogout();
  };

  useEffect(() => {
    const syncAuthState = (ev?: StorageEvent | null) => {
      if (ev && ev.key === 'freso_last_logout') {
        setCustomerToken('');
        setCustomerEmail('');
        setCustomerName('');
        setBranchName('Chi nhanh 1');
        setUserRole('');
        setIsUserMenuOpen(false);
        return;
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
    
    syncAuthState(null);
    return () => {
      window.removeEventListener('storage', syncAuthState);
      window.removeEventListener('freso:profile-updated', handleProfileUpdated as EventListener);
    };
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

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)] transition-all duration-300" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }} onClickCapture={handleTopLevelNavigation}>
      {/* Top visual gradient border */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-green-500 via-[#00b14f] to-emerald-500" />
      
      <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4">
        {/* Left Side: Logo & Badge */}
        <div className="flex items-center gap-4">
          <a href={`${reactHomePath}?view=seller-dashboard`} className="flex items-center gap-2 group">
            <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00b14f] to-emerald-500 tracking-tight group-hover:opacity-90 transition-opacity">
              Freso
            </span>
            <span className="text-gray-300 font-light text-xl">|</span>
            <span className="text-gray-800 text-sm md:text-base font-extrabold tracking-tight bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100 shadow-sm whitespace-nowrap">
              Kênh Người Bán
            </span>
          </a>
          
          {/* Live Store Status Switch */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-green-50/80 text-green-700 rounded-full border border-green-100/60 shadow-sm animate-in fade-in duration-500">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2 bg-green-500"></span>
            </span>
            <span className="text-[10px] font-extrabold tracking-wider uppercase">Cửa hàng hoạt động</span>
          </div>
        </div>

        {/* Right Side: Navigation & User Dropdown */}
        <div className="flex items-center gap-4 lg:gap-5">
          {/* Back to Shopping Website Button */}
          <a
            href={reactHomePath}
            className="group flex items-center gap-2 px-4 py-2 border border-gray-200 hover:border-[#00b14f] hover:bg-green-50/20 text-gray-600 hover:text-[#00b14f] rounded-full text-xs font-bold transition-all duration-300 shadow-sm bg-white whitespace-nowrap"
          >
            <svg className="size-4 text-gray-400 group-hover:text-[#00b14f] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span>Đến trang mua sắm</span>
          </a>

          <div className="h-4 w-[1px] bg-gray-200 hidden md:block" />

          {/* Merchant Branch Info */}
          <div className="hidden md:flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-50 px-3 py-2 rounded-full border border-gray-100 shadow-sm">
            <svg className="size-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{branchName}</span>
          </div>

          <div className="h-4 w-[1px] bg-gray-200 hidden md:block" />

          {/* Support and Notifications */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button 
              type="button" 
              className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-500 hover:text-[#00b14f] group" 
              title="Hỗ trợ & Tài liệu"
            >
              <HelpCircle className="size-5 transition-transform group-hover:scale-105" />
            </button>
            
            <button 
              type="button" 
              className="relative p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-500 hover:text-[#00b14f] group" 
              title="Thông báo"
            >
              <Bell className="size-5 transition-transform group-hover:scale-105" />
              <span className="absolute top-1.5 right-1.5 bg-rose-500 size-2 rounded-full ring-2 ring-white animate-pulse"></span>
            </button>
          </div>

          <div className="h-4 w-[1px] bg-gray-200" />

          {/* User Dropdown Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 text-xs font-black text-gray-700 hover:text-[#00b14f] transition-colors p-1.5 hover:bg-gray-50 rounded-xl transition-all"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full flex items-center justify-center font-black shadow-sm ring-2 ring-green-100 group-hover:ring-green-200 transition-all">
                {displayedUserName.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:inline font-bold text-gray-800">{displayedUserName}</span>
            </button>
            
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-3 w-[260px] bg-white border border-gray-200 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="px-3 py-2.5 text-[11px] font-extrabold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                  Tài khoản của tôi
                </div>
                <div className="grid grid-cols-1 gap-0.5 text-sm">
                  {adminMenuItems.map((item) => {
                    const isActive = activeDashboardTab === item.label;
                    return (
                      <a
                        key={item.id}
                        href={getDashboardHref(item.label)}
                        className={`w-full rounded-xl px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${
                          isActive
                            ? 'bg-green-50 text-[#00b14f] font-bold'
                            : 'text-gray-700 hover:bg-green-50 hover:text-[#00b14f]'
                        }`}
                      >
                        {item.label}
                      </a>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50 px-2 pb-1">
                  <button
                    type="button"
                    onClick={logoutAndBackHome}
                    className="w-full py-2 rounded-full border border-gray-200 hover:bg-red-50 text-gray-600 hover:text-red-600 text-xs font-bold transition-all"
                  >
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
