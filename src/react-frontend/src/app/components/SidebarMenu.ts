import {
  Box,
  CalendarDays,
  CircleUserRound,
  Clock3,
  FileText,
  Handshake,
  History,
  LayoutDashboard,
  ShoppingCart,
  UserRoundSearch,
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
  { id: 'nhan-vien', label: 'Quản lý cơ sở', icon: UserRoundSearch },
  { id: 'quan-ly-san-pham', label: 'Quản lý sản phẩm', icon: Box },
  { id: 'quan-ly-gio-hang', label: 'Yêu cầu báo giá', icon: ShoppingCart },
  { id: 'quan-ly-kho', label: 'Quản lý kho hàng', icon: History },
  { id: 'lich-su-mua-hang', label: 'Lịch sử mua hàng', icon: Clock3 },
  { id: 'don-hang', label: 'Quản lý đơn hàng', icon: FileText },
  { id: 'bao-gia', label: 'Đàm phán giá', icon: Handshake },
  { id: 'dat-hang-dinh-ky', label: 'Đăng ký mua định kỳ', icon: CalendarDays },
];
