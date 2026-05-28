import React, { useCallback, useEffect, useMemo, useState } from 'react';

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

type ApiArrayResponse = [boolean, EmployeeItem[]?];

const formatStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (!normalized || normalized === 'approved') return 'Đang hoạt động';
  if (normalized === 'pending') return 'Chờ duyệt';
  if (normalized === 'rejected') return 'Từ chối';
  if (normalized === 'inactive') return 'Không hoạt động';
  return status;
};

const isValidPhone = (value: string) => /^\s*(\+?84|0)\d{9,10}\s*$/.test(value.replace(/\s/g, ''));
const isValidEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editEmployee, setEditEmployee] = useState<EmployeeItem | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editErrors, setEditErrors] = useState<{ email?: string; phone?: string }>({});
  const [actionMessage, setActionMessage] = useState('');

  const loadEmployees = useCallback(async () => {
    if (!isSuperAdmin) return;
    const token = readStorageValue('freso_customer_token');
    if (!token) {
      setErrorMessage('Bạn cần đăng nhập để xem danh sách nhân viên.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${window.location.origin}/rest/V1/tmdt-registration/branch-managers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const raw = (await res.json().catch(() => ({}))) as ApiResponse | ApiArrayResponse;
      const arrayPayload = Array.isArray(raw) ? (raw as ApiArrayResponse) : null;
      const data = (!Array.isArray(raw) ? (raw as ApiResponse) : null) || null;
      const isSuccess = arrayPayload ? arrayPayload[0] !== false : data?.success !== false;
      if (!res.ok || !isSuccess) {
        const message = data?.message || 'Không thể tải danh sách nhân viên.';
        throw new Error(message);
      }
      const itemsFromArray = arrayPayload && Array.isArray(arrayPayload[1]) ? arrayPayload[1] : [];
      const itemsFromObject = data && Array.isArray(data.items) ? data.items : [];
      setItems(itemsFromArray.length ? itemsFromArray : itemsFromObject);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể tải danh sách nhân viên.');
    } finally {
      setIsLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

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

      {actionMessage && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm">
          {actionMessage}
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
                <th className="px-4 py-3 text-left font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              )}
              {!isLoading && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
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
                    <td className="px-4 py-3 text-gray-700">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditEmployee(item);
                            setEditEmail(item.email || '');
                            setEditPhone(item.phone_number || '');
                            setEditErrors({});
                          }}
                          className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const token = readStorageValue('freso_customer_token');
                            if (!token) {
                              setErrorMessage('Bạn cần đăng nhập để xóa nhân viên.');
                              return;
                            }
                            const confirmDelete = window.confirm('Bạn có chắc muốn đánh dấu nhân viên này là không hoạt động?');
                            if (!confirmDelete) return;
                            setIsSubmitting(true);
                            setErrorMessage('');
                            setActionMessage('');
                            try {
                              const res = await fetch(
                                `${window.location.origin}/rest/V1/tmdt-registration/branch-managers/${item.customer_id}`,
                                {
                                  method: 'DELETE',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`,
                                  },
                                }
                              );
                              const payload = (await res.json().catch(() => ({}))) as ApiResponse | ApiArrayResponse;
                              const data = Array.isArray(payload) ? null : (payload as ApiResponse);
                              if (!res.ok || data?.success === false) {
                                const message = data?.message || 'Không thể xóa nhân viên.';
                                throw new Error(message);
                              }
                              setActionMessage('Đã cập nhật trạng thái nhân viên.');
                              await loadEmployees();
                            } catch (err) {
                              setErrorMessage(err instanceof Error ? err.message : 'Không thể xóa nhân viên.');
                            } finally {
                              setIsSubmitting(false);
                            }
                          }}
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {editEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-800">Chỉnh sửa nhân viên</h2>
              <p className="text-xs text-gray-500 mt-1">Cập nhật email hoặc số điện thoại.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700">Email</label>
                <input
                  value={editEmail}
                  onChange={(event) => {
                    setEditEmail(event.target.value);
                    setEditErrors((prev) => ({ ...prev, email: '' }));
                  }}
                  className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none ${
                    editErrors.email ? 'border-rose-400 bg-rose-50' : 'border-gray-200 focus:border-green-500'
                  }`}
                />
                {editErrors.email && <p className="mt-1 text-xs text-rose-500">{editErrors.email}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">Số điện thoại</label>
                <input
                  value={editPhone}
                  onChange={(event) => {
                    setEditPhone(event.target.value);
                    setEditErrors((prev) => ({ ...prev, phone: '' }));
                  }}
                  className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none ${
                    editErrors.phone ? 'border-rose-400 bg-rose-50' : 'border-gray-200 focus:border-green-500'
                  }`}
                />
                {editErrors.phone && <p className="mt-1 text-xs text-rose-500">{editErrors.phone}</p>}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditEmployee(null)}
                className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  const nextErrors: { email?: string; phone?: string } = {};
                  if (!editEmail.trim()) {
                    nextErrors.email = 'Vui lòng nhập email.';
                  } else if (!isValidEmail(editEmail)) {
                    nextErrors.email = 'Email chưa hợp lệ.';
                  }
                  if (!editPhone.trim()) {
                    nextErrors.phone = 'Vui lòng nhập số điện thoại.';
                  } else if (!isValidPhone(editPhone)) {
                    nextErrors.phone = 'Số điện thoại chưa hợp lệ.';
                  }

                  if (Object.keys(nextErrors).length > 0) {
                    setEditErrors(nextErrors);
                    return;
                  }

                  const token = readStorageValue('freso_customer_token');
                  if (!token) {
                    setErrorMessage('Bạn cần đăng nhập để cập nhật nhân viên.');
                    return;
                  }

                  setIsSubmitting(true);
                  setErrorMessage('');
                  setActionMessage('');
                  try {
                    const res = await fetch(
                      `${window.location.origin}/rest/V1/tmdt-registration/branch-managers/${editEmployee.customer_id}`,
                      {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          payload: {
                            email: editEmail.trim(),
                            phoneNumber: editPhone.trim(),
                          },
                        }),
                      }
                    );
                    const payload = (await res.json().catch(() => ({}))) as ApiResponse | ApiArrayResponse;
                    const data = Array.isArray(payload) ? null : (payload as ApiResponse);
                    if (!res.ok || data?.success === false) {
                      const message = data?.message || 'Không thể cập nhật nhân viên.';
                      throw new Error(message);
                    }
                    setActionMessage('Cập nhật nhân viên thành công.');
                    setEditEmployee(null);
                    await loadEmployees();
                  } catch (err) {
                    setErrorMessage(err instanceof Error ? err.message : 'Không thể cập nhật nhân viên.');
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="rounded-full bg-[#00b14f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#009845] disabled:opacity-60"
              >
                {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
