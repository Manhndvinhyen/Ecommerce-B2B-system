import React, { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ChevronRight, CircleUserRound, LogOut } from 'lucide-react';
import { adminMenuItems, AdminMenuItem } from './SidebarMenu';
import { logoutCurrentDevice } from '../utils/authSession';

type OpenMenus = Record<string, boolean>;

type CustomerSidebarProps = {
  activeTab?: string;
  setActiveTab?: Dispatch<SetStateAction<string>>;
  openMenus?: OpenMenus;
  setOpenMenus?: Dispatch<SetStateAction<OpenMenus>>;
  menuItems?: AdminMenuItem[];
};

export function CustomerSidebar(props: CustomerSidebarProps = {}) {
  const {
    activeTab: propActiveTab,
    setActiveTab: propSetActiveTab,
    menuItems: propMenuItems,
  } = props || {};

  const [internalActiveTab, setInternalActiveTab] = useState(propActiveTab ?? 'Thông tin hồ sơ');
  const activeTab = propActiveTab ?? internalActiveTab;
  const setActiveTab = propSetActiveTab ?? setInternalActiveTab;

  const [customerName, setCustomerName] = useState('Đang tải...');
  const [roleLabel, setRoleLabel] = useState('Khách hàng');

  useEffect(() => {
    const name = window.localStorage.getItem('freso_customer_name') || window.sessionStorage.getItem('freso_customer_name') || 'Khách hàng';
    const role = window.localStorage.getItem('freso_role') || window.sessionStorage.getItem('freso_role') || '';
    const normalizedRole = String(role || '').trim().toLowerCase();

    setCustomerName(name);
    if (normalizedRole === 'seller') {
      setRoleLabel('Người bán');
    } else if (normalizedRole === 'customer') {
      setRoleLabel('Khách hàng');
    } else {
      setRoleLabel('Tài khoản');
    }
  }, []);

  const handleLogout = () => {
    void logoutCurrentDevice();
  };

  const menuItems = propMenuItems ?? adminMenuItems;

  return (
    <div style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }} className="w-full">
      <div className="relative w-full rounded-2xl border border-slate-100 bg-white p-3 shadow-lg shadow-slate-100/40 sm:p-4 lg:max-w-[270px] lg:rounded-3xl lg:p-5">
        {/* Identity Card Badge */}
        <div className="mb-3 flex items-center gap-3 overflow-hidden rounded-2xl border border-green-500/10 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent p-3 sm:p-4 lg:mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md shadow-green-600/10">
            <CircleUserRound size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-[13px] font-black text-slate-800 truncate tracking-tight">{customerName}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex size-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] text-slate-400 font-extrabold truncate tracking-wider uppercase">{roleLabel}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Breadcrumbs */}
        <nav className="mb-3 hidden items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-50 bg-slate-50/50 p-2.5 px-1 lg:mb-5 lg:flex">
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Customer Space</span>
          <ChevronRight size={12} className="text-slate-300" />
          <span className="text-[10px] font-black text-green-600 truncate uppercase tracking-wider">{activeTab}</span>
        </nav>

        {/* Menu Navigation Items */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
          {menuItems.map((item) => {
            const isActive = activeTab === item.label;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.label)}
                className={`group relative flex min-w-[132px] items-center gap-2 rounded-2xl border px-3 py-2.5 transition-all duration-300 sm:min-w-[150px] lg:w-full lg:min-w-0 lg:gap-3 lg:px-3.5 lg:py-3 ${
                  isActive
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white border-transparent shadow-lg shadow-green-600/10 scale-[1.01]'
                    : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-50/70 hover:scale-[1.01]'
                }`}
              >
                <div className={`shrink-0 transition-transform duration-300 group-hover:scale-105 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2.2} />
                </div>
                <span className={`flex-1 truncate text-left text-[11px] font-black tracking-tight transition-colors duration-300 sm:text-[12px] ${
                  isActive ? 'text-white' : 'text-slate-600 group-hover:text-slate-900'
                }`}>
                  {item.label}
                </span>

                {/* Right glowing active indicators */}
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Account Actions / Logout */}
        <div className="mt-3 border-t border-slate-100 pt-3 lg:mt-6 lg:pt-5">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-100 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-400 transition-all duration-300 hover:border-rose-100 hover:bg-rose-50/50 hover:text-rose-600 lg:py-3"
          >
            <LogOut size={13} strokeWidth={2} />
            <span>Đăng xuất tài khoản</span>
          </button>
        </div>
      </div>
    </div>
  );
}
