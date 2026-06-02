import React, { useEffect, useMemo, useState } from 'react';
import { AdminSidebar, adminMenuItems } from './AdminSidebar';
import { ProfileContent } from './ProfileContent';
import { BranchManagementPanel } from './BranchManagementPanel';
import { PurchaseHistoryContent } from './PurchaseHistoryContent';
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

  const getStoredCanManageBranches = () => {
    const isOwner = readStorageValue('freso_is_owner');
    const isSuperAdmin = readStorageValue('freso_is_super_admin');
    const role = readStorageValue('freso_role').trim().toLowerCase();
    return role !== 'branch' && (parseBoolFlag(isOwner) || parseBoolFlag(isSuperAdmin) || role === '' || role === 'manager' || role === 'seller');
  };

  const [canManageBranches, setCanManageBranches] = useState(getStoredCanManageBranches());

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
        const nextRole = roleAttr ? String(roleAttr.value ?? '').trim().toLowerCase() : readStorageValue('freso_role').trim().toLowerCase();
        if (roleAttr) {
          window.localStorage.setItem('freso_role', nextRole);
          window.sessionStorage.setItem('freso_role', nextRole);
        }
        const hasPrivilege =
          parseBoolFlag(String(ownerAttr?.value ?? '')) || parseBoolFlag(String(superAdminAttr?.value ?? ''));
        setCanManageBranches(nextRole !== 'branch' && (hasPrivilege || nextRole === '' || nextRole === 'manager' || nextRole === 'seller'));
      })
      .catch(() => {
        // ignore permission fetch failures
      });
  }, []);

  const menuItems = useMemo(
    () => adminMenuItems.filter((item) => item.id !== 'thong-tin' && (canManageBranches || item.id !== 'nhan-vien')),
    [canManageBranches]
  );

  const accountLabel = adminMenuItems.find((item) => item.id === 'tai-khoan')?.label ?? 'Tai khoan cua toi';
  const branchLabel = adminMenuItems.find((item) => item.id === 'nhan-vien')?.label ?? 'Quan ly co so';
  const branchSubLabels = adminMenuItems.find((item) => item.id === 'nhan-vien')?.subItems ?? [];
  const orderLabel = adminMenuItems.find((item) => item.id === 'don-hang')?.label ?? 'Quan ly don hang';
  const purchaseHistoryLabel = adminMenuItems.find((item) => item.id === 'lich-su-mua-hang')?.label ?? 'Lich su mua hang';
  const quoteLabel = adminMenuItems.find((item) => item.id === 'bao-gia')?.label ?? 'Dam phan gia';
  const params = new URLSearchParams(window.location.search);
  const tabFromQuery = params.get('tab');
  const tabLabels = new Set([
    ...menuItems.map((item) => item.label),
    ...menuItems.flatMap((item) => item.subItems ?? []),
  ]);
  const initialTab = tabFromQuery && tabLabels.has(tabFromQuery) ? tabFromQuery : accountLabel;
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

      <main className="bg-white px-6 py-0">
        <div className="mx-auto flex max-w-[1200px] items-start">
          <div className="w-[255px] flex-none border-r border-gray-200 pr-5">
            <AdminSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              openMenus={openMenus}
              setOpenMenus={setOpenMenus}
              menuItems={menuItems}
            />
          </div>

          <div className="flex-1">
            {activeTab === accountLabel && (
              <ProfileContent canManageBranches={canManageBranches} />
            )}
            {(activeTab === branchLabel || branchSubLabels.includes(activeTab)) && (
              <div className="p-8">
                <BranchManagementPanel canManageBranches={canManageBranches} />
              </div>
            )}
            {activeTab === purchaseHistoryLabel && <PurchaseHistoryContent />}
            {activeTab === orderLabel && (
              <div className="p-8">
                <h1 className="text-2xl font-bold text-gray-900">Quan ly don hang</h1>
                <p className="mt-2 text-sm text-gray-500">
                  Muc nay chua duoc noi voi API don hang Magento. Can them endpoint lay sales_order theo customer/co so.
                </p>
              </div>
            )}
            {activeTab === quoteLabel && (
              <div className="p-8">
                <h1 className="text-2xl font-bold text-gray-900">Dam phan gia</h1>
                <p className="mt-2 text-sm text-gray-500">
                  Muc nay chua co module bao gia/thuong luong. Can thiet ke bang du lieu va API truoc khi hien thi.
                </p>
              </div>
            )}
            {activeTab !== accountLabel &&
              activeTab !== branchLabel &&
              !branchSubLabels.includes(activeTab) &&
              activeTab !== purchaseHistoryLabel &&
              activeTab !== orderLabel &&
              activeTab !== quoteLabel && <div className="p-8">Noi dung cho: {activeTab}</div>}
          </div>
        </div>
      </main>

      <AuthPageFooter />
      <ChatbotWidget />
    </div>
  );
}
