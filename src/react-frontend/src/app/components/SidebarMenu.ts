import {
  CircleUserRound,
  LayoutDashboard,
  FileText,
  History,
  Handshake,
  UserRoundSearch,
  Box,
  ShoppingCart
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AdminMenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  subItems?: string[];
};

export const adminMenuItems: AdminMenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'profile-seller', label: 'Thông tin hồ sơ', icon: CircleUserRound },
  { id: 'nhan-vien', label: 'Quản lý nhân viên', icon: UserRoundSearch },
  { id: 'quan-ly-san-pham', label: 'Quản lý sản phẩm', icon: Box },
  { id: 'quan-ly-gio-hang', label: 'Quản lý giỏ hàng', icon: ShoppingCart },
  { id: 'quan-ly-kho', label: 'Quản lý kho hàng', icon: History },
  { id: 'don-hang', label: 'Quản lý đơn hàng', icon: FileText },
  { id: 'bao-gia', label: 'Đàm phán giá', icon: Handshake }
];
