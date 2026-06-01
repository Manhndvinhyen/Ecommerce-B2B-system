import React, { useEffect, useMemo, useState } from 'react';
import { SellerSidebar } from './SellerSidebar';
import { adminMenuItems } from './SidebarMenu';
import { SellerProfile } from './SellerProfile';
import { SellerOverviewDashboard } from './SellerOverviewDashboard';
import { SellerProductManager } from './SellerProductManager';
import { SellerInventoryManager } from './SellerInventoryManager';
import { SellerCartManager } from './SellerCartManager';
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

  const getStoredSuperAdmin = () => {
    const isOwner = readStorageValue('freso_is_owner');
    const isSuperAdmin = readStorageValue('freso_is_super_admin');
    return parseBoolFlag(isOwner) || parseBoolFlag(isSuperAdmin);
  };

  const [isSuperAdmin, setIsSuperAdmin] = useState(getStoredSuperAdmin());
  const [userRole, setUserRole] = useState('seller');

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

        const hasOwnerAttr = Boolean(ownerAttr);
        const hasSuperAdminAttr = Boolean(superAdminAttr);

        if (hasOwnerAttr || hasSuperAdminAttr) {
          const nextValue =
            parseBoolFlag(String(ownerAttr?.value ?? '')) || parseBoolFlag(String(superAdminAttr?.value ?? ''));
          window.localStorage.setItem('freso_is_owner', nextValue ? '1' : '0');
          window.sessionStorage.setItem('freso_is_owner', nextValue ? '1' : '0');
          window.localStorage.setItem('freso_is_super_admin', nextValue ? '1' : '0');
          window.sessionStorage.setItem('freso_is_super_admin', nextValue ? '1' : '0');
          setIsSuperAdmin(nextValue);
        }

        if (roleAttr) {
          const nextRole = String(roleAttr.value ?? '').trim().toLowerCase();
          window.localStorage.setItem('freso_role', nextRole);
          window.sessionStorage.setItem('freso_role', nextRole);
          setUserRole(nextRole);
          window.dispatchEvent(new CustomEvent('freso:profile-updated'));
        }
      })
      .catch(() => {
        // ignore permission fetch failures
      });
  }, []);

  const menuItems = useMemo(() => {
    return adminMenuItems.filter((item) => item.id !== 'nhan-vien');
  }, []);

  const params = new URLSearchParams(window.location.search);
  const tabFromQuery = params.get('tab');

  const tabLabels = new Set([
    ...menuItems.map((item) => item.label),
    ...menuItems.flatMap((item) => item.subItems ?? []),
  ]);
  
  const initialTab = tabFromQuery && tabLabels.has(tabFromQuery) ? tabFromQuery : 'Dashboard';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [openMenus, setOpenMenus] = useState(() => {
    const defaults: Record<string, boolean> = { 'nhan-vien': false, 'bao-cao': false };
    return menuItems.reduce((acc, item) => {
      if (!item.subItems) {
        return acc;
      }
      if (item.label === initialTab || item.subItems.includes(initialTab)) {
        acc[item.id] = true;
      }
      return acc;
    }, defaults);
  });

  return (
    <div className="min-h-screen bg-[#F5FAF6]">
      <SellerHeader />

      <main className="bg-[#F5FAF6] py-6 px-6">
        <div className="max-w-[1200px] mx-auto flex items-start gap-6">
          {/* Left sidebar */}
          <div className="w-[255px] flex-none border-r border-gray-100 pr-5">
            <SellerSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              openMenus={openMenus}
              setOpenMenus={setOpenMenus}
              menuItems={menuItems}
            />
          </div>

          {/* Right content area */}
          <div className="flex-1 min-w-0">
            {activeTab === 'Dashboard' && <SellerOverviewDashboard />}
            {activeTab === 'Thông tin hồ sơ' && <SellerProfile />}
            {activeTab === 'Quản lý sản phẩm' && <SellerProductManager />}
            {activeTab === 'Quản lý giỏ hàng' && <SellerCartManager />}
            {activeTab === 'Quản lý kho hàng' && <SellerInventoryManager />}
            {activeTab !== 'Dashboard' &&
              activeTab !== 'Thông tin hồ sơ' &&
              activeTab !== 'Quản lý sản phẩm' &&
              activeTab !== 'Quản lý giỏ hàng' &&
              activeTab !== 'Quản lý kho hàng' && (
              <div className="p-8">Nội dung cho: {activeTab}</div>
            )}
          </div>
        </div>
      </main>

      <AuthPageFooter />
      <ChatbotWidget />
    </div>
  );
}
