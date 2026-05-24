import React, { useState } from 'react';
import { AdminSidebar, adminMenuItems } from './AdminSidebar';
import { ProfileContent } from './ProfileContent';
import { GeneralInfo } from './GeneralInfo';
import { Header } from './Header';
import { AuthPageFooter } from './auth/AuthPageFooter';
import { ChatbotWidget } from './ChatbotWidget';

export function UserDashboardPage() {
  const params = new URLSearchParams(window.location.search);
  const tabFromQuery = params.get('tab');
  const tabLabels = new Set([
    ...adminMenuItems.map((item) => item.label),
    ...adminMenuItems.flatMap((item) => item.subItems ?? []),
  ]);
  const initialTab = tabFromQuery && tabLabels.has(tabFromQuery) ? tabFromQuery : 'Tài khoản của tôi';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [openMenus, setOpenMenus] = useState(() => {
    const defaults: Record<string, boolean> = { 'nhan-vien': false, 'bao-cao': false };
    return adminMenuItems.reduce((acc, item) => {
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
            />
          </div>

          {/* Right content area */}
          <div className="flex-1">
            {activeTab === 'Tài khoản của tôi' && <ProfileContent />}
            {activeTab === 'Thông tin chung' && <GeneralInfo />}
            {activeTab !== 'Tài khoản của tôi' && activeTab !== 'Thông tin chung' && (
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
