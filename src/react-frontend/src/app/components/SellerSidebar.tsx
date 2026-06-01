import React, { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ChevronRight, LogOut, Store } from 'lucide-react';
import { adminMenuItems, AdminMenuItem } from './SidebarMenu';

type OpenMenus = Record<string, boolean>;

type SellerSidebarProps = {
  activeTab?: string;
  setActiveTab?: Dispatch<SetStateAction<string>>;
  openMenus?: OpenMenus;
  setOpenMenus?: Dispatch<SetStateAction<OpenMenus>>;
  menuItems?: AdminMenuItem[];
};

export function SellerSidebar(props: SellerSidebarProps = {}) {
  const {
    activeTab: propActiveTab,
    setActiveTab: propSetActiveTab,
    menuItems: propMenuItems,
  } = props || {};

  const [internalActiveTab, setInternalActiveTab] = useState(propActiveTab ?? 'Dashboard');
  const activeTab = propActiveTab ?? internalActiveTab;
  const setActiveTab = propSetActiveTab ?? setInternalActiveTab;

  const [merchantName, setMerchantName] = useState('Đang tải...');
  const [branchName, setBranchName] = useState('Chi nhánh sỉ');

  useEffect(() => {
    const name = window.localStorage.getItem('freso_customer_name') || window.sessionStorage.getItem('freso_customer_name') || 'Nhà bán hàng sỉ';
    const branch = window.localStorage.getItem('freso_branch_name') || window.sessionStorage.getItem('freso_branch_name') || 'Chi nhánh Freso';
    setMerchantName(name);
    setBranchName(branch);
  }, []);

  const handleLogout = () => {
    const keysToClear = [
      'freso_customer_token',
      'freso_login_token',
      'freso_customer_email',
      'freso_customer_name',
      'freso_customer_phone',
      'freso_branch_name',
      'freso_login_code',
      'freso_is_owner',
      'freso_is_super_admin',
    ];

    keysToClear.forEach((key) => {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    });

    const params = new URLSearchParams(window.location.search);
    params.delete('view');
    params.delete('tab');
    params.delete('category');
    params.delete('subcategory');
    const query = params.toString();
    const target = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.location.href = target;
  };

  const menuItems = propMenuItems ?? adminMenuItems;

  return (
    <div style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }} className="w-full">
      <div className="w-full max-w-[270px] bg-white border border-slate-100 rounded-3xl p-5 shadow-lg shadow-slate-100/40 relative">
        {/* Identity Card Badge */}
        <div className="mb-6 p-4 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent rounded-2xl border border-green-500/10 flex items-center gap-3 relative overflow-hidden">
          <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md shadow-green-600/10">
            <Store size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-[13px] font-black text-slate-800 truncate tracking-tight">{merchantName}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex size-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] text-slate-400 font-extrabold truncate tracking-wider uppercase">{branchName}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Breadcrumbs */}
        <nav className="flex items-center gap-1.5 mb-5 px-1 whitespace-nowrap bg-slate-50/50 p-2.5 rounded-xl border border-slate-50">
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Seller Space</span>
          <ChevronRight size={12} className="text-slate-300" />
          <span className="text-[10px] font-black text-green-600 truncate uppercase tracking-wider">{activeTab}</span>
        </nav>

        {/* Menu Navigation Items */}
        <div className="space-y-1">
          {menuItems.map((item) => {
            const isActive = activeTab === item.label;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.label)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all duration-300 group border relative ${
                  isActive
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white border-transparent shadow-lg shadow-green-600/10 scale-[1.01]'
                    : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-50/70 hover:scale-[1.01]'
                }`}
              >
                <div className={`shrink-0 transition-transform duration-300 group-hover:scale-105 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2.2} />
                </div>
                <span className={`text-[12px] tracking-tight font-black flex-1 text-left truncate transition-colors duration-300 ${
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

        {/* Quick Merchant Actions / Logout */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full py-3 border border-slate-100 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 hover:border-rose-100 text-[11px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2"
          >
            <LogOut size={13} strokeWidth={2} />
            <span>Đăng xuất tài khoản</span>
          </button>
        </div>
      </div>
    </div>
  );
}
