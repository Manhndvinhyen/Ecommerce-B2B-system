import React, { useEffect, useMemo, useState } from 'react';
import { SellerSidebar } from './SellerSidebar';
import { adminMenuItems } from './SidebarMenu';
import { SellerProfile } from './SellerProfile';
import { SellerOverviewDashboard } from './SellerOverviewDashboard';
import { SellerProductManager } from './SellerProductManager';
import { SellerInventoryManager } from './SellerInventoryManager';
import { SellerCartManager } from './SellerCartManager';
import { SellerOrderManager } from './SellerOrderManager';
import { BranchManagementPanel } from './BranchManagementPanel';
import { SellerHeader } from './SellerHeader';
import { AuthPageFooter } from './auth/AuthPageFooter';
import { ChatbotWidget } from './ChatbotWidget';

export function SellerDashboardPage() {
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
    return role !== 'branch' && (parseBoolFlag(isOwner) || parseBoolFlag(isSuperAdmin) || role === '' || role === 'manager' || role === 'seller');
  };

  const [canManageBranches, setCanManageBranches] = useState(getStoredCanManageBranches());
  const [, setUserRole] = useState('seller');

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
          const nextValue =
            parseBoolFlag(String(ownerAttr?.value ?? '')) || parseBoolFlag(String(superAdminAttr?.value ?? ''));
          window.localStorage.setItem('freso_is_owner', nextValue ? '1' : '0');
          window.sessionStorage.setItem('freso_is_owner', nextValue ? '1' : '0');
          window.localStorage.setItem('freso_is_super_admin', nextValue ? '1' : '0');
          window.sessionStorage.setItem('freso_is_super_admin', nextValue ? '1' : '0');
        }

        let resolvedRole = readStorageValue('freso_role').trim().toLowerCase();
        if (roleAttr) {
          const nextRole = String(roleAttr.value ?? '').trim().toLowerCase();
          window.localStorage.setItem('freso_role', nextRole);
          window.sessionStorage.setItem('freso_role', nextRole);
          setUserRole(nextRole);
          resolvedRole = nextRole;
          window.dispatchEvent(new CustomEvent('freso:profile-updated'));
        }
        const hasPrivilege =
          parseBoolFlag(String(ownerAttr?.value ?? '')) || parseBoolFlag(String(superAdminAttr?.value ?? ''));
        setCanManageBranches(resolvedRole !== 'branch' && (hasPrivilege || resolvedRole === '' || resolvedRole === 'manager' || resolvedRole === 'seller'));
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
      'quan-ly-gio-hang',
      'quan-ly-kho',
      'don-hang',
      'bao-gia'
    ]);
    return adminMenuItems.filter((item) => visibleIds.has(item.id) && (canManageBranches || item.id !== 'nhan-vien'));
  }, [canManageBranches]);

  const dashboardLabel = adminMenuItems.find((item) => item.id === 'dashboard')?.label ?? 'Dashboard';
  const profileLabel = adminMenuItems.find((item) => item.id === 'profile-seller')?.label ?? 'Thông tin hồ sơ';
  const branchLabel = adminMenuItems.find((item) => item.id === 'nhan-vien')?.label ?? 'Quản lý cơ sở';
  const productLabel = adminMenuItems.find((item) => item.id === 'quan-ly-san-pham')?.label ?? 'Quản lý sản phẩm';
  const cartLabel = adminMenuItems.find((item) => item.id === 'quan-ly-gio-hang')?.label ?? 'Quản lý giỏ hàng';
  const inventoryLabel = adminMenuItems.find((item) => item.id === 'quan-ly-kho')?.label ?? 'Quản lý kho hàng';
  const orderLabel = adminMenuItems.find((item) => item.id === 'don-hang')?.label ?? 'Quản lý đơn hàng';
  const quoteLabel = adminMenuItems.find((item) => item.id === 'bao-gia')?.label ?? 'Đàm phán giá';

  const params = new URLSearchParams(window.location.search);
  const tabFromQuery = params.get('tab');
  const tabLabels = new Set(menuItems.map((item) => item.label));
  const initialTab = tabFromQuery && tabLabels.has(tabFromQuery) ? tabFromQuery : dashboardLabel;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({ 'nhan-vien': false, 'bao-cao': false });

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
            {activeTab === productLabel && <SellerProductManager />}
            {activeTab === cartLabel && <SellerCartManager />}
            {activeTab === inventoryLabel && <SellerInventoryManager />}
            {activeTab === branchLabel && (
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                <BranchManagementPanel canManageBranches={canManageBranches} />
              </div>
            )}
            {activeTab === orderLabel && <SellerOrderManager />}
            {activeTab === quoteLabel && (
              <div className="p-8">Nội dung cho: {activeTab}</div>
            )}
            {activeTab !== dashboardLabel &&
              activeTab !== profileLabel &&
              activeTab !== productLabel &&
              activeTab !== cartLabel &&
              activeTab !== inventoryLabel &&
              activeTab !== branchLabel &&
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
