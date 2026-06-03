import React, { useCallback, useEffect, useMemo, useState } from 'react';

const readStorageValue = (key: string) =>
  window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || '';

export type BranchLocationItem = {
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
  items?: BranchLocationItem[];
  message?: string;
};

type ApiArrayResponse = [boolean, BranchLocationItem[]?];

type EmployeeListProps = {
  isSuperAdmin: boolean;
  compact?: boolean;
  onChanged?: () => void;
};

const formatStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (!normalized || normalized === 'approved' || normalized === 'active') return 'Dang hoat dong';
  if (normalized === 'pending') return 'Cho duyet';
  if (normalized === 'rejected') return 'Tu choi';
  if (normalized === 'inactive') return 'Khong hoat dong';
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

export const EmployeeList = ({ isSuperAdmin, compact = false, onChanged }: EmployeeListProps) => {
  const [items, setItems] = useState<BranchLocationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editBranch, setEditBranch] = useState<BranchLocationItem | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editErrors, setEditErrors] = useState<{ email?: string; phone?: string }>({});
  const [actionMessage, setActionMessage] = useState('');

  const loadBranches = useCallback(async () => {
    if (!isSuperAdmin) return;
    const token = readStorageValue('freso_customer_token');
    if (!token) {
      setErrorMessage('Ban can dang nhap de xem danh sach co so.');
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
      const arrayPayload = Array.isArray(raw) ? raw : null;
      const data = !Array.isArray(raw) ? raw : null;
      const isSuccess = arrayPayload ? arrayPayload[0] !== false : data?.success !== false;
      if (!res.ok || !isSuccess) {
        throw new Error(data?.message || 'Khong the tai danh sach co so.');
      }
      const itemsFromArray = arrayPayload && Array.isArray(arrayPayload[1]) ? arrayPayload[1] : [];
      const itemsFromObject = data && Array.isArray(data.items) ? data.items : [];
      setItems(itemsFromArray.length ? itemsFromArray : itemsFromObject);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Khong the tai danh sach co so.');
    } finally {
      setIsLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => {
      const haystack = [item.full_name, item.branch_name, item.email, item.phone_number].join(' ').toLowerCase();
      return haystack.includes(keyword);
    });
  }, [items, search]);

  const refreshAfterChange = async () => {
    await loadBranches();
    onChanged?.();
  };

  if (!isSuperAdmin) {
    return (
      <div className={compact ? 'bg-white' : 'flex-1 bg-white p-8'}>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Chi tai khoan chu so huu moi co quyen xem danh sach co so.
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? 'bg-white' : 'flex-1 bg-white p-8'}>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-gray-800">Danh sach co so</h1>
          <p className="mt-1 text-[13px] text-gray-500">Tong cong {items.length} co so</p>
        </div>
        <div className="w-full md:w-[280px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tim theo ten, email, SDT"
            className="w-full rounded-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-green-500"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}

      {actionMessage && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {actionMessage}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Ten co so</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">So dien thoai</th>
                <th className="px-4 py-3 text-left font-semibold">Trang thai</th>
                <th className="px-4 py-3 text-left font-semibold">Ngay tao</th>
                <th className="px-4 py-3 text-left font-semibold">Thao tac</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    Dang tai du lieu...
                  </td>
                </tr>
              )}
              {!isLoading && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    Chua co co so nao.
                  </td>
                </tr>
              )}
              {!isLoading &&
                filteredItems.map((item) => (
                  <tr key={item.customer_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-800">
                      {item.branch_name || item.full_name || '---'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{item.email || '---'}</td>
                    <td className="px-4 py-3 text-gray-700">{item.phone_number || '---'}</td>
                    <td className="px-4 py-3 text-gray-700">{formatStatus(item.status)}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditBranch(item);
                            setEditEmail(item.email || '');
                            setEditPhone(item.phone_number || '');
                            setEditErrors({});
                          }}
                          className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          Sua
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const token = readStorageValue('freso_customer_token');
                            if (!token) {
                              setErrorMessage('Ban can dang nhap de cap nhat co so.');
                              return;
                            }
                            const confirmDelete = window.confirm('Ban co chac muon danh dau co so nay la khong hoat dong?');
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
                              const data = Array.isArray(payload) ? null : payload;
                              if (!res.ok || data?.success === false) {
                                throw new Error(data?.message || 'Khong the cap nhat co so.');
                              }
                              setActionMessage('Da cap nhat trang thai co so.');
                              await refreshAfterChange();
                            } catch (err) {
                              setErrorMessage(err instanceof Error ? err.message : 'Khong the cap nhat co so.');
                            } finally {
                              setIsSubmitting(false);
                            }
                          }}
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          Vo hieu hoa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {editBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-800">Chinh sua co so</h2>
              <p className="mt-1 text-xs text-gray-500">Cap nhat email hoac so dien thoai dang nhap.</p>
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
                <label className="text-xs font-semibold text-gray-700">So dien thoai</label>
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
                onClick={() => setEditBranch(null)}
                className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Huy
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  const nextErrors: { email?: string; phone?: string } = {};
                  if (!editEmail.trim()) {
                    nextErrors.email = 'Vui long nhap email.';
                  } else if (!isValidEmail(editEmail)) {
                    nextErrors.email = 'Email chua hop le.';
                  }
                  if (!editPhone.trim()) {
                    nextErrors.phone = 'Vui long nhap so dien thoai.';
                  } else if (!isValidPhone(editPhone)) {
                    nextErrors.phone = 'So dien thoai chua hop le.';
                  }

                  if (Object.keys(nextErrors).length > 0) {
                    setEditErrors(nextErrors);
                    return;
                  }

                  const token = readStorageValue('freso_customer_token');
                  if (!token) {
                    setErrorMessage('Ban can dang nhap de cap nhat co so.');
                    return;
                  }

                  setIsSubmitting(true);
                  setErrorMessage('');
                  setActionMessage('');
                  try {
                    const res = await fetch(
                      `${window.location.origin}/rest/V1/tmdt-registration/branch-managers/${editBranch.customer_id}`,
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
                    const data = Array.isArray(payload) ? null : payload;
                    if (!res.ok || data?.success === false) {
                      throw new Error(data?.message || 'Khong the cap nhat co so.');
                    }
                    setActionMessage('Cap nhat co so thanh cong.');
                    setEditBranch(null);
                    await refreshAfterChange();
                  } catch (err) {
                    setErrorMessage(err instanceof Error ? err.message : 'Khong the cap nhat co so.');
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="rounded-full bg-[#00b14f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#009845] disabled:opacity-60"
              >
                {isSubmitting ? 'Dang luu...' : 'Luu thay doi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
