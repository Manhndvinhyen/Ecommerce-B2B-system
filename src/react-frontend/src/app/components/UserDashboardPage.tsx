import React, { useEffect, useMemo, useState } from 'react';
import { AdminSidebar, adminMenuItems } from './AdminSidebar';
import { ProfileContent } from './ProfileContent';
import { GeneralInfo } from './GeneralInfo';
import { CreateBranchManager } from './CreateBranchManager';
import { Header } from './Header';
import { AuthPageFooter } from './auth/AuthPageFooter';
import { ChatbotWidget } from './ChatbotWidget';

export function UserDashboardPage() {
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
      })
      .catch(() => {
        // ignore permission fetch failures
      });
  }, []);

  const menuItems = useMemo(() => {
    return adminMenuItems.map((item) => {
      if (item.id !== 'nhan-vien' || !item.subItems) {
        return item;
      }
      const nextSubItems = isSuperAdmin
        ? item.subItems
        : item.subItems.filter((subItem) => subItem !== 'Tạo mới nhân viên');
      return {
        ...item,
        subItems: nextSubItems,
      };
    });
  }, [isSuperAdmin]);

  const params = new URLSearchParams(window.location.search);
  const tabFromQuery = params.get('tab');
  const tabLabels = new Set([
    ...menuItems.map((item) => item.label),
    ...menuItems.flatMap((item) => item.subItems ?? []),
  ]);
  const initialTab = tabFromQuery && tabLabels.has(tabFromQuery) ? tabFromQuery : 'Tài khoản của tôi';
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
    <div className="min-h-screen bg-white">
      <Header />

          <main className="bg-white py-0 px-6">
          <div className="max-w-[1200px] mx-auto flex items-start">
          {/* Left sidebar */}
          <div className="w-[255px] flex-none border-r border-gray-200 pr-5">
            <AdminSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              openMenus={openMenus}
              setOpenMenus={setOpenMenus}
              menuItems={menuItems}
            />
          </div>

          {/* Right content area */}
          <div className="flex-1">
            {activeTab === 'Tài khoản của tôi' && <ProfileContent />}
            {activeTab === 'Thông tin chung' && <GeneralInfo />}
            {(activeTab === 'Quản lý nhân viên' || activeTab === 'Tạo mới nhân viên') && (
              <CreateBranchManager isSuperAdmin={isSuperAdmin} />
            )}
            {activeTab !== 'Tài khoản của tôi' &&
              activeTab !== 'Thông tin chung' &&
              activeTab !== 'Tạo mới nhân viên' &&
              activeTab !== 'Quản lý nhân viên' && (
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
