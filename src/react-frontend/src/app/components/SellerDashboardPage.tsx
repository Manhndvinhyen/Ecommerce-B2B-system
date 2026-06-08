import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ShoppingBag, AlertCircle, Info } from 'lucide-react';
import { SellerSidebar } from './SellerSidebar';
import { adminMenuItems } from './SidebarMenu';
import { SellerProfile } from './SellerProfile';
import { SellerOverviewDashboard } from './SellerOverviewDashboard';
import { SellerProductManager } from './SellerProductManager';
import { SellerInventoryManager } from './SellerInventoryManager';
import { SellerOrderManager } from './SellerOrderManager';
import { BranchManagementPanel } from './BranchManagementPanel';
import { SellerHeader } from './SellerHeader';
import { AuthPageFooter } from './auth/AuthPageFooter';
import { ChatbotWidget } from './ChatbotWidget';
import { RfqDashboard } from './RfqDashboard';
import { parseRegistrationProfilePayload } from '../utils/registrationProfile';

export function SellerDashboardPage() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);

  useEffect(() => {
    const handleNewNotification = (e: Event) => {
      const customEvent = e as CustomEvent;
      const notif = customEvent.detail;
      if (!notif) return;

      const isOutOfStock = notif.message.includes('hết hàng') || notif.message.includes('tồn kho');
      const isOrder = notif.message.includes('đơn hàng mới') || notif.message.includes('DH');

      setToast({
        message: notif.message,
        type: isOutOfStock ? 'warning' : isOrder ? 'success' : 'info'
      });

      // Dispatch refresh events to notify child views
      window.dispatchEvent(new CustomEvent('freso:refresh-notifications'));
      window.dispatchEvent(new CustomEvent('freso:refresh-orders'));
    };

    window.addEventListener('freso:new-notification', handleNewNotification);
    return () => {
      window.removeEventListener('freso:new-notification', handleNewNotification);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const readStorageValue = (key: string) =>
    window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || '';

  const parseBoolFlag = (value: string) => {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  };

  const getStoredCanManageBranches = () => {
    const isOwner = readStorageValue('freso_is_owner');
    const isSuperAdmin = readStorageValue('freso_is_super_admin');
    const role = readStorageValue('freso_role').trim().toLowerCase();
    return role === 'seller' && (parseBoolFlag(isOwner) || parseBoolFlag(isSuperAdmin));
  };

  const getStoredSellerAccess = () => parseBoolFlag(readStorageValue('freso_seller_access'));

  const [canManageBranches, setCanManageBranches] = useState(getStoredCanManageBranches());
  const [, setUserRole] = useState('seller');
  const [isCheckingSellerAccess, setIsCheckingSellerAccess] = useState(true);
  const [hasSellerAccess, setHasSellerAccess] = useState(getStoredSellerAccess());
  const [sellerAccessError, setSellerAccessError] = useState('');
  const storedToken = readStorageValue('freso_customer_token');

  useEffect(() => {
    if (storedToken) return;

    window.location.replace('/react/index.html?view=login');
  }, [storedToken]);

  useEffect(() => {
    const token = readStorageValue('freso_customer_token');
    if (!token) {
      console.warn('[FresoSellerAccess] Missing customer token, cannot verify seller dashboard access.');
      setIsCheckingSellerAccess(false);
      return;
    }

    setSellerAccessError('');
    console.info('[FresoSellerAccess] Verifying seller profile before opening dashboard.');
    fetch(`${window.location.origin}/rest/V1/tmdt-registration/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const message =
            payload && typeof payload === 'object' && 'message' in payload
              ? String((payload as { message?: unknown }).message ?? '')
              : '';
          console.error('[FresoSellerAccess] Profile API rejected seller access check.', {
            status: res.status,
            payload,
          });
          throw new Error(message || `Khong the kiem tra quyen nguoi ban (HTTP ${res.status}).`);
        }
        return payload;
      })
      .then((payload) => {
        const data = parseRegistrationProfilePayload(payload);
        const role = String((data as { role?: unknown }).role ?? readStorageValue('freso_role')).trim().toLowerCase();
        const status = String((data as { status?: unknown }).status ?? '').trim().toLowerCase();
        const isOwner = parseBoolFlag(String((data as { is_owner?: unknown; isOwner?: unknown }).is_owner ?? (data as { isOwner?: unknown }).isOwner ?? ''));
        const isSuperAdmin = parseBoolFlag(String((data as { is_super_admin?: unknown; isSuperAdmin?: unknown }).is_super_admin ?? (data as { isSuperAdmin?: unknown }).isSuperAdmin ?? ''));
        const profileSellerAccess = parseBoolFlag(String((data as { seller_access?: unknown; sellerAccess?: unknown }).seller_access ?? (data as { sellerAccess?: unknown }).sellerAccess ?? ''));
        const approvedSeller = role === 'seller' && status === 'approved';
        const approvedBranch = role === 'branch' && (status === 'approved' || status === 'active');
        const sellerAccess = profileSellerAccess || approvedSeller || approvedBranch;
        console.info('[FresoSellerAccess] Profile check result.', {
          role,
          status,
          isOwner,
          isSuperAdmin,
          sellerAccess,
          approvedSeller,
          approvedBranch,
          raw: data,
        });

        if (!sellerAccess) {
          console.warn('[FresoSellerAccess] Account is not allowed to enter seller dashboard, redirecting to customer dashboard.', {
            role,
            status,
          });
          window.localStorage.setItem('freso_role', 'customer');
          window.sessionStorage.setItem('freso_role', 'customer');
          window.localStorage.setItem('freso_seller_access', '0');
          window.sessionStorage.setItem('freso_seller_access', '0');
          window.localStorage.setItem('freso_is_owner', '0');
          window.sessionStorage.setItem('freso_is_owner', '0');
          window.localStorage.setItem('freso_is_super_admin', '0');
          window.sessionStorage.setItem('freso_is_super_admin', '0');
          window.location.replace('/react/index.html?view=dashboard');
          return;
        }

        window.localStorage.setItem('freso_role', role);
        window.sessionStorage.setItem('freso_role', role);
        window.localStorage.setItem('freso_status', status);
        window.sessionStorage.setItem('freso_status', status);
        window.localStorage.setItem('freso_seller_access', sellerAccess ? '1' : '0');
        window.sessionStorage.setItem('freso_seller_access', sellerAccess ? '1' : '0');
        window.localStorage.setItem('freso_is_owner', isOwner ? '1' : '0');
        window.sessionStorage.setItem('freso_is_owner', isOwner ? '1' : '0');
        window.localStorage.setItem('freso_is_super_admin', isSuperAdmin ? '1' : '0');
        window.sessionStorage.setItem('freso_is_super_admin', isSuperAdmin ? '1' : '0');
        setUserRole(role);
        setCanManageBranches((role === 'seller' || approvedSeller) && (isOwner || isSuperAdmin));
        setHasSellerAccess(true);
        window.dispatchEvent(new CustomEvent('freso:profile-updated'));
      })
      .catch((error: unknown) => {
        console.error('[FresoSellerAccess] Could not verify seller dashboard access.', error);
        setSellerAccessError(
          error instanceof Error && error.message
            ? error.message
            : 'Khong the kiem tra quyen nguoi ban. Vui long thu lai.'
        );
      })
      .finally(() => {
        setIsCheckingSellerAccess(false);
      });
  }, []);

  useEffect(() => {
    const token = readStorageValue('freso_customer_token');
    if (!token) return;

    fetch(`${window.location.origin}/rest/V1/customers/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data || typeof data !== 'object') return;
        const customAttributes = Array.isArray((data as { custom_attributes?: unknown }).custom_attributes)
          ? ((data as { custom_attributes?: unknown }).custom_attributes as Array<{ attribute_code?: string; value?: unknown }>)
          : [];
        const ownerAttr = customAttributes.find((attr) => attr?.attribute_code === 'is_owner');
        const superAdminAttr = customAttributes.find((attr) => attr?.attribute_code === 'is_super_admin');
        const roleAttr = customAttributes.find((attr) => attr?.attribute_code === 'tmdt_role');

        if (ownerAttr || superAdminAttr) {
          const nextOwner = parseBoolFlag(String(ownerAttr?.value ?? ''));
          const nextSuperAdmin = parseBoolFlag(String(superAdminAttr?.value ?? ''));
          window.localStorage.setItem('freso_is_owner', nextOwner ? '1' : '0');
          window.sessionStorage.setItem('freso_is_owner', nextOwner ? '1' : '0');
          window.localStorage.setItem('freso_is_super_admin', nextSuperAdmin ? '1' : '0');
          window.sessionStorage.setItem('freso_is_super_admin', nextSuperAdmin ? '1' : '0');
        }

        let resolvedRole = readStorageValue('freso_role').trim().toLowerCase();
        if (roleAttr) {
          const nextRole = String(roleAttr.value ?? '').trim().toLowerCase();
          const shouldKeepRegistrationRole =
            (resolvedRole === 'seller' || resolvedRole === 'branch') && nextRole === 'customer';
          if (!shouldKeepRegistrationRole) {
            console.info('[FresoSellerAccess] Syncing role from customers/me.', {
              previousRole: resolvedRole,
              nextRole,
            });
            window.localStorage.setItem('freso_role', nextRole);
            window.sessionStorage.setItem('freso_role', nextRole);
            setUserRole(nextRole);
            resolvedRole = nextRole;
            window.dispatchEvent(new CustomEvent('freso:profile-updated'));
          } else {
            console.info('[FresoSellerAccess] Ignoring stale customers/me role downgrade.', {
              registrationRole: resolvedRole,
              customersMeRole: nextRole,
            });
          }
        }
        const hasPrivilege =
          parseBoolFlag(String(ownerAttr?.value ?? '')) || parseBoolFlag(String(superAdminAttr?.value ?? ''));
        setCanManageBranches(resolvedRole === 'seller' && hasPrivilege);
      })
      .catch(() => {
        // ignore permission fetch failures
      });
  }, []);

  const menuItems = useMemo(() => {
    const visibleIds = new Set([
      'dashboard',
      'profile-seller',
      'nhan-vien',
      'quan-ly-san-pham',
      'quan-ly-kho',
      'don-hang',
      'bao-gia'
    ]);
    return adminMenuItems.filter(
      (item) =>
        visibleIds.has(item.id) &&
        (canManageBranches || (item.id !== 'nhan-vien' && item.id !== 'quan-ly-san-pham'))
    );
  }, [canManageBranches]);

  const dashboardLabel = adminMenuItems.find((item) => item.id === 'dashboard')?.label ?? 'Dashboard';
  const profileLabel = adminMenuItems.find((item) => item.id === 'profile-seller')?.label ?? 'Thông tin hồ sơ';
  const branchLabel = adminMenuItems.find((item) => item.id === 'nhan-vien')?.label ?? 'Quản lý cơ sở';
  const productLabel = adminMenuItems.find((item) => item.id === 'quan-ly-san-pham')?.label ?? 'Quản lý sản phẩm';
  const inventoryLabel = adminMenuItems.find((item) => item.id === 'quan-ly-kho')?.label ?? 'Quản lý kho hàng';
  const orderLabel = adminMenuItems.find((item) => item.id === 'don-hang')?.label ?? 'Quản lý đơn hàng';
  const quoteLabel = adminMenuItems.find((item) => item.id === 'bao-gia')?.label ?? 'Đàm phán giá';

  const params = new URLSearchParams(window.location.search);
  const tabFromQuery = params.get('tab');
  const tabLabels = new Set(menuItems.map((item) => item.label));
  const initialTab = tabFromQuery && tabLabels.has(tabFromQuery) ? tabFromQuery : dashboardLabel;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({ 'nhan-vien': false, 'bao-cao': false });

  useEffect(() => {
    if (!tabLabels.has(activeTab)) {
      setActiveTab(dashboardLabel);
    }
  }, [activeTab, dashboardLabel, tabLabels]);

  if (!storedToken || isCheckingSellerAccess) {
    return null;
  }

  if (!hasSellerAccess) {
    return (
      <div className="min-h-screen bg-[#F5FAF6]">
        <SellerHeader />
        <main className="mx-auto flex min-h-[60vh] max-w-[720px] flex-col items-center justify-center px-6 text-center">
          <div className="rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
            <h1 className="mb-3 text-2xl font-extrabold text-[#004d39]">Chua the mo giao dien nguoi ban</h1>
            <p className="mb-6 text-sm font-medium text-gray-600">
              {sellerAccessError || 'He thong chua xac nhan duoc quyen nguoi ban cua tai khoan nay.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-[#00b14f] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#009642]"
              >
                Thu lai
              </button>
              <a
                href="/react/index.html?view=dashboard"
                className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                Ve trang tai khoan
              </a>
            </div>
          </div>
        </main>
        <AuthPageFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5FAF6]">
      <SellerHeader />

      <main className="bg-[#F5FAF6] py-6 px-6">
        <div className="max-w-[1200px] mx-auto flex items-start gap-6">
          <div className="w-[255px] flex-none border-r border-gray-100 pr-5 sticky top-6 max-h-[calc(100vh-48px)] overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'thin' }}>
            <SellerSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              openMenus={openMenus}
              setOpenMenus={setOpenMenus}
              menuItems={menuItems}
            />
          </div>

          <div className="flex-1 min-w-0">
            {activeTab === dashboardLabel && <SellerOverviewDashboard />}
            {activeTab === profileLabel && <SellerProfile />}
            {activeTab === productLabel && canManageBranches && <SellerProductManager />}
            {activeTab === inventoryLabel && <SellerInventoryManager />}
            {activeTab === branchLabel && (
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                <BranchManagementPanel canManageBranches={canManageBranches} />
              </div>
            )}
            {activeTab === orderLabel && <SellerOrderManager />}
            {activeTab === quoteLabel && (
              <RfqDashboard mode="seller" />
            )}
            {activeTab !== dashboardLabel &&
              activeTab !== profileLabel &&
              activeTab !== productLabel &&
              activeTab !== inventoryLabel &&
              activeTab !== branchLabel &&
              activeTab !== orderLabel &&
              activeTab !== quoteLabel && <div className="p-8">Nội dung cho: {activeTab}</div>}
          </div>
        </div>
      </main>

      <AuthPageFooter />
      <ChatbotWidget />

      {/* Premium In-App Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] flex items-center gap-4 px-5 py-4 rounded-2xl shadow-2xl border transition-all duration-300 transform scale-100 animate-in fade-in slide-in-from-top-4 select-none min-w-[320px] max-w-[450px] backdrop-blur-md ${
          toast.type === 'success'
            ? 'bg-[#E9F8EF]/95 text-[#00b14f] border-[#CDEEDB]'
            : toast.type === 'warning'
            ? 'bg-rose-50/95 text-rose-700 border-rose-200'
            : 'bg-blue-50/95 text-blue-700 border-blue-200'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            toast.type === 'success'
              ? 'bg-[#E9F8EF] border border-[#CDEEDB] text-[#00b14f]'
              : toast.type === 'warning'
              ? 'bg-rose-100/50 border border-rose-200 text-rose-600'
              : 'bg-blue-100/50 border border-blue-200 text-blue-600'
          }`}>
            {toast.type === 'success' ? (
              <ShoppingBag className="w-5 h-5" />
            ) : toast.type === 'warning' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <Info className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
              {toast.type === 'success' ? 'Đơn hàng sỉ mới' : toast.type === 'warning' ? 'Cảnh báo tồn kho sỉ' : 'Thông báo hệ thống'}
            </span>
            <span className="text-xs font-bold leading-snug text-slate-800 break-words">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
