import { useEffect, useMemo, useState } from 'react';
import { CustomerSidebar } from './CustomerSidebar';
import { adminMenuItems } from './SidebarMenu';
import { ProfileContent } from './ProfileContent';
import { BranchManagementPanel } from './BranchManagementPanel';
import { PurchaseHistoryContent } from './PurchaseHistoryContent';
import { RecurringSubscriptionsContent } from './RecurringSubscriptionsContent';
import { Header } from './Header';
import { AuthPageFooter } from './auth/AuthPageFooter';
import { ChatbotWidget } from './ChatbotWidget';
import { RfqDashboard } from './RfqDashboard';
import { parseRegistrationProfilePayload } from '../utils/registrationProfile';

export function UserDashboardPage() {
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

  const [canManageBranches, setCanManageBranches] = useState(getStoredCanManageBranches());

  useEffect(() => {
    const token = readStorageValue('freso_customer_token');
    if (!token) return;

    fetch(`${window.location.origin}/rest/V1/tmdt-registration/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((payload) => {
        const data = parseRegistrationProfilePayload(payload);

        const nextRole = String(data.role ?? readStorageValue('freso_role')).trim().toLowerCase();
        const status = String(data.status ?? '').trim().toLowerCase();
        const nextOwner = parseBoolFlag(String(data.is_owner ?? ''));
        const nextSuperAdmin = parseBoolFlag(String(data.is_super_admin ?? ''));
        const sellerAccess = parseBoolFlag(String(data.seller_access ?? ''));
        console.info('[FresoUserDashboard] Registration profile loaded.', {
          role: nextRole,
          status,
          sellerAccess,
          isOwner: nextOwner,
          isSuperAdmin: nextSuperAdmin,
          raw: data,
        });

        window.localStorage.setItem('freso_role', nextRole);
        window.sessionStorage.setItem('freso_role', nextRole);
        window.localStorage.setItem('freso_status', status);
        window.sessionStorage.setItem('freso_status', status);
        window.localStorage.setItem('freso_seller_access', sellerAccess ? '1' : '0');
        window.sessionStorage.setItem('freso_seller_access', sellerAccess ? '1' : '0');
        window.localStorage.setItem('freso_is_owner', nextOwner ? '1' : '0');
        window.sessionStorage.setItem('freso_is_owner', nextOwner ? '1' : '0');
        window.localStorage.setItem('freso_is_super_admin', nextSuperAdmin ? '1' : '0');
        window.sessionStorage.setItem('freso_is_super_admin', nextSuperAdmin ? '1' : '0');

        if (sellerAccess || ((nextRole === 'seller' || nextRole === 'branch') && (status === 'approved' || status === 'active'))) {
          console.info('[FresoUserDashboard] Approved seller/branch detected, redirecting to seller dashboard.');
          window.location.replace('/react/index.html?view=seller-dashboard');
          return;
        }

        const hasPrivilege =
          nextOwner || nextSuperAdmin;
        setCanManageBranches(nextRole === 'seller' && hasPrivilege);
        window.dispatchEvent(new CustomEvent('freso:profile-updated'));
      })
      .catch((error: unknown) => {
        console.error('[FresoUserDashboard] Could not load registration profile.', error);
      });
  }, []);

  const menuItems = useMemo(() => {
    const visibleIds = new Set(['profile-seller', 'nhan-vien', 'lich-su-mua-hang', 'bao-gia', 'dat-hang-dinh-ky']);
    return adminMenuItems.filter((item) => visibleIds.has(item.id) && (canManageBranches || item.id !== 'nhan-vien'));
  }, [canManageBranches]);

  const profileLabel = adminMenuItems.find((item) => item.id === 'profile-seller')?.label ?? 'Thông tin hồ sơ';
  const branchLabel = adminMenuItems.find((item) => item.id === 'nhan-vien')?.label ?? 'Quản lý cơ sở';
  const orderLabel = adminMenuItems.find((item) => item.id === 'don-hang')?.label ?? 'Quản lý đơn hàng';
  const purchaseHistoryLabel = adminMenuItems.find((item) => item.id === 'lich-su-mua-hang')?.label ?? 'Lịch sử mua hàng';
  const quoteLabel = adminMenuItems.find((item) => item.id === 'bao-gia')?.label ?? 'Đàm phán giá';
  const recurringLabel = adminMenuItems.find((item) => item.id === 'dat-hang-dinh-ky')?.label ?? 'Đăng ký mua định kỳ';

  const params = new URLSearchParams(window.location.search);
  const tabFromQuery = params.get('tab');
  const tabLabels = new Set(menuItems.map((item) => item.label));
  const initialTab = tabFromQuery && tabLabels.has(tabFromQuery) ? tabFromQuery : profileLabel;
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="bg-white py-6 px-6">
        <div className="mx-auto flex max-w-[1200px] items-start gap-6">
          <div className="w-[255px] flex-none border-r border-gray-200 pr-5 sticky top-6 max-h-[calc(100vh-48px)] overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'thin' }}>
            <CustomerSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              menuItems={menuItems}
            />
          </div>

          <div className="flex-1 min-w-0">
            {activeTab === profileLabel && <ProfileContent />}
            {activeTab === branchLabel && (
              <div className="p-8">
                <BranchManagementPanel canManageBranches={canManageBranches} />
              </div>
            )}
            {activeTab === purchaseHistoryLabel && <PurchaseHistoryContent />}
            {activeTab === recurringLabel && <RecurringSubscriptionsContent />}
            {activeTab === orderLabel && (
              <PurchaseHistoryContent
                title="Quản lý đơn hàng của tôi"
                description="Theo dõi toàn bộ đơn gần đây, trạng thái thanh toán và thông tin giao hàng ở một nơi."
                emptyTitle="Chưa có đơn hàng nào"
                emptyDescription="Khi bạn đặt hàng, danh sách đơn sẽ xuất hiện tại đây cùng trạng thái xử lý."
              />
            )}
            {activeTab === quoteLabel && (
              <RfqDashboard mode="buyer" />
            )}
            {activeTab !== profileLabel &&
              activeTab !== branchLabel &&
              activeTab !== purchaseHistoryLabel &&
              activeTab !== recurringLabel &&
              activeTab !== orderLabel &&
              activeTab !== quoteLabel && <div className="p-8">Nội dung cho: {activeTab}</div>}
          </div>
        </div>
      </main>

      <AuthPageFooter />
      <ChatbotWidget />
    </div>
  );
}
