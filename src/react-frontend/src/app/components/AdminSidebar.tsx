import React, { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { 
  CircleUserRound, 
  LayoutDashboard, 
  FileText, 
  Handshake, 
  UserRoundSearch, 
  PieChart, 
  ChevronRight,
  LogOut,
  ChevronDown
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AdminMenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  subItems?: string[];
};

export const adminMenuItems: AdminMenuItem[] = [
  { id: 'tai-khoan', label: 'Tài khoản của tôi', icon: CircleUserRound },
  { id: 'thong-tin', label: 'Thông tin chung', icon: LayoutDashboard },
  { id: 'don-hang', label: 'Quản lý đơn hàng', icon: FileText },
  { id: 'bao-gia', label: 'Đàm phán giá', icon: Handshake },
  {
    id: 'nhan-vien',
    label: 'Quản lý nhân viên',
    icon: UserRoundSearch,
    subItems: ['Danh sách nhân viên', 'Tạo mới nhân viên'],
  },
  {
    id: 'bao-cao',
    label: 'Báo cáo',
    icon: PieChart,
    subItems: ['Đối soát hoá đơn điện tử', 'Hoàn tiền đơn hàng'],
  },
];

type OpenMenus = Record<string, boolean>;

type SidebarItemProps = {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  hasSubmenu: boolean;
  isOpen: boolean;
  onClick: () => void;
  onSubItemClick?: (label: string) => void;
  subItems?: string[];
};

type AdminSidebarProps = {
  activeTab?: string;
  setActiveTab?: Dispatch<SetStateAction<string>>;
  openMenus?: OpenMenus;
  setOpenMenus?: Dispatch<SetStateAction<OpenMenus>>;
  menuItems?: AdminMenuItem[];
};

const SidebarItem = ({
  icon: Icon,
  label,
  isActive,
  hasSubmenu,
  isOpen,
  onClick,
  onSubItemClick,
  subItems = [],
}: SidebarItemProps) => {
  return (
    <div className="mb-3">
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3.5 px-4 py-4 rounded-xl transition-all duration-200 group ${
          isActive
            ? 'bg-[#E9F8EF] text-[#00b14f] border border-[#CDEEDB] shadow-sm'
            : 'bg-[#F8F9FA] text-[#4e4e4e] border border-transparent hover:bg-white hover:shadow-sm'
        }`}
      >
        <div className={`shrink-0 ${isActive ? 'text-[#00b14f]' : 'text-[#4e4e4e]'}`}>
          <Icon size={22} strokeWidth={isActive ? 2.5 : 2.2} />
        </div>
        <span
          className={`text-[14.5px] tracking-tight font-bold flex-1 text-left truncate ${
            isActive ? 'text-[#00b14f]' : 'text-[#475569]'
          }`}
        >
          {label}
        </span>
        {hasSubmenu && (
          <ChevronDown 
            size={13} 
            className={`transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''} ${
              isActive ? 'text-[#00b14f]' : 'text-gray-300'
            }`} 
          />
        )}
      </button>

      {/* Submenu rendering */}
      {hasSubmenu && isOpen && (
        <div className="mt-2 mb-4 ml-12 space-y-3.5 py-1">
          {subItems.map((sub, idx) => (
            <button
              type="button"
              key={idx}
              onClick={() => onSubItemClick?.(sub)}
              className="text-[14px] font-medium text-gray-500 hover:text-[#00b14f] transition-colors whitespace-nowrap text-left"
            >
              {sub}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export function AdminSidebar(props: AdminSidebarProps = {}) {
  const {
    activeTab: propActiveTab,
    setActiveTab: propSetActiveTab,
    openMenus: propOpenMenus,
    setOpenMenus: propSetOpenMenus,
    menuItems: propMenuItems,
  } = props || {};

  // internal state used when parent doesn't control the component
  const [internalActiveTab, setInternalActiveTab] = useState(propActiveTab ?? 'Tài khoản của tôi');
  const [internalOpenMenus, setInternalOpenMenus] = useState<OpenMenus>(propOpenMenus ?? { 'nhan-vien': false, 'bao-cao': false });

  const activeTab = propActiveTab ?? internalActiveTab;
  const setActiveTab = propSetActiveTab ?? setInternalActiveTab;
  const openMenus = propOpenMenus ?? internalOpenMenus;
  const setOpenMenus = propSetOpenMenus ?? setInternalOpenMenus;

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  const toggleSubmenu = (id: string, label: string) => {
    setActiveTab(label);
    setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const menuItems = propMenuItems ?? adminMenuItems;

  return (
    <div style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }} className="w-full">
<div className="w-full max-w-[270px] py-6 px-0">        
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 mb-4 px-1 whitespace-nowrap">
          <span className="text-[13.5px] text-gray-500 font-medium shrink-0">Trang chủ</span>
          <ChevronRight size={16} className="text-gray-300 shrink-0" />
          <span className="text-[13.5px] font-semibold text-gray-90 truncate">{activeTab}</span>
        </nav>

        {/* Menu Items */}
        <div className="flex-1">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={activeTab === item.label}
              hasSubmenu={!!item.subItems}
              subItems={item.subItems}
              isOpen={openMenus[item.id]}
              onClick={() => {
                if (item.subItems) {
                  toggleSubmenu(item.id, item.label);
                } else {
                  setActiveTab(item.label);
                }
              }}
              onSubItemClick={(subLabel) => {
                setActiveTab(subLabel);
                setOpenMenus((prev) => ({ ...prev, [item.id]: true }));
              }}
            />
          ))}
        </div>

        {/* Action Area */}
        <div className="mt-6 pt-5 border-t border-gray-50">
          <button className="w-full py-2.5 border border-gray-100 rounded-full text-gray-400 text-[11px] font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
            <LogOut size={13} strokeWidth={1.5} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    </div>
  );
}
