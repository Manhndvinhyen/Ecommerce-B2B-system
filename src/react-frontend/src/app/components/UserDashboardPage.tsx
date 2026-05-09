import React, { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { ProfileContent } from './ProfileContent';
import { Header } from './Header';
import { AuthPageFooter } from './auth/AuthPageFooter';
import { ChatbotWidget } from './ChatbotWidget';

export function UserDashboardPage() {
  const [activeTab, setActiveTab] = useState('Tài khoản của tôi');
  const [openMenus, setOpenMenus] = useState({ 'nhan-vien': false, 'bao-cao': false });

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
            {activeTab !== 'Tài khoản của tôi' && (
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
