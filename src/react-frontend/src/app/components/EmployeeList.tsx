import React, { useEffect, useMemo, useState } from 'react';

const readStorageValue = (key: string) =>
  window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || '';

type EmployeeItem = {
  customer_id: number;
  full_name: string;
  branch_name: string;
  email: string;
  phone_number: string;
  status: string;
  created_at: string;
};

type ApiResponse = {
  success?: boolean;
  items?: EmployeeItem[];
  message?: string;
};

const formatStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (!normalized || normalized === 'approved') return 'Đang hoạt động';
  if (normalized === 'pending') return 'Chờ duyệt';
  if (normalized === 'rejected') return 'Từ chối';
  return status;
};

const formatDate = (value: string) => {
  if (!value) return '---';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
};

export const EmployeeList = ({ isSuperAdmin }: { isSuperAdmin: boolean }) => {
  const [items, setItems] = useState<EmployeeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isSuperAdmin) return;
    const token = readStorageValue('freso_customer_token');
    if (!token) {
      setErrorMessage('Bạn cần đăng nhập để xem danh sách nhân viên.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    fetch(`${window.location.origin}/rest/V1/tmdt-registration/branch-managers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as ApiResponse;
        if (!res.ok || data?.success === false) {
          const message = data?.message || 'Không thể tải danh sách nhân viên.';
          throw new Error(message);
        }
        setItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Không thể tải danh sách nhân viên.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isSuperAdmin]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => {
      const haystack = [item.full_name, item.branch_name, item.email, item.phone_number]
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [items, search]);

  if (!isSuperAdmin) {
    return (
      <div className="flex-1 bg-white p-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          Chỉ tài khoản chủ nhà hàng (Super Admin) mới có quyền xem danh sách nhân viên.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tighter">Danh sách nhân viên</h1>
          <p className="text-[13px] text-gray-500 mt-1">Tổng cộng {items.length} nhân viên</p>
        </div>
        <div className="w-full md:w-[280px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên, email, SĐT"
            className="w-full rounded-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-green-500"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Tên nhân viên</th>
                <th className="px-4 py-3 text-left font-semibold">Chi nhánh</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Số điện thoại</th>
                <th className="px-4 py-3 text-left font-semibold">Trạng thái</th>
                <th className="px-4 py-3 text-left font-semibold">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              )}
              {!isLoading && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    Chưa có nhân viên nào.
                  </td>
                </tr>
              )}
              {!isLoading &&
                filteredItems.map((item) => (
                  <tr key={item.customer_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800 font-semibold">{item.full_name || '---'}</td>
                    <td className="px-4 py-3 text-gray-700">{item.branch_name || '---'}</td>
                    <td className="px-4 py-3 text-gray-700">{item.email || '---'}</td>
                    <td className="px-4 py-3 text-gray-700">{item.phone_number || '---'}</td>
                    <td className="px-4 py-3 text-gray-700">{formatStatus(item.status)}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDate(item.created_at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
