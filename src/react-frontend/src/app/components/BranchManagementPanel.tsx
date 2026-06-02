import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Plus, RefreshCw } from 'lucide-react';
import { CreateBranchManager } from './CreateBranchManager';
import { EmployeeList, type BranchLocationItem } from './EmployeeList';

const readStorageValue = (key: string) =>
  window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || '';

type ApiResponse = {
  success?: boolean;
  items?: BranchLocationItem[];
  message?: string;
};

type ApiArrayResponse = [boolean, BranchLocationItem[]?];

type BranchPerformanceItem = {
  customer_id: number;
  branch_name: string;
  order_count: number;
  revenue: number;
  average_order_value: number;
  canceled_order_count: number;
};

type BranchPerformanceResponse = {
  success?: boolean;
  summary?: {
    branch_count?: number;
    order_count?: number;
    revenue?: number;
    average_order_value?: number;
    canceled_order_count?: number;
  };
  items?: BranchPerformanceItem[];
  message?: string;
};

type BranchManagementPanelProps = {
  canManageBranches: boolean;
};

const isActiveStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  return !normalized || normalized === 'approved' || normalized === 'active';
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0));

export const BranchManagementPanel = ({ canManageBranches }: BranchManagementPanelProps) => {
  const [activeView, setActiveView] = useState<'list' | 'create'>('list');
  const [branches, setBranches] = useState<BranchLocationItem[]>([]);
  const [performanceItems, setPerformanceItems] = useState<BranchPerformanceItem[]>([]);
  const [performanceSummary, setPerformanceSummary] = useState<BranchPerformanceResponse['summary'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const loadBranches = useCallback(async () => {
    if (!canManageBranches) return;

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
      setBranches(itemsFromArray.length ? itemsFromArray : itemsFromObject);

      const performanceRes = await fetch(`${window.location.origin}/rest/V1/tmdt-registration/branch-performance`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const performance = (await performanceRes.json().catch(() => ({}))) as BranchPerformanceResponse;
      if (performanceRes.ok && performance.success !== false) {
        setPerformanceItems(Array.isArray(performance.items) ? performance.items : []);
        setPerformanceSummary(performance.summary ?? null);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Khong the tai danh sach co so.');
    } finally {
      setIsLoading(false);
    }
  }, [canManageBranches]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches, refreshKey]);

  const stats = useMemo(() => {
    const active = branches.filter((branch) => isActiveStatus(branch.status)).length;
    const inactive = branches.length - active;
    const orderCount = Number(performanceSummary?.order_count ?? 0);
    const revenue = Number(performanceSummary?.revenue ?? 0);
    const averageOrderValue = Number(performanceSummary?.average_order_value ?? 0);
    return {
      total: branches.length,
      active,
      inactive,
      activePercent: branches.length ? Math.round((active / branches.length) * 100) : 0,
      orderCount,
      revenue,
      averageOrderValue,
    };
  }, [branches, performanceSummary]);

  const chartRows = useMemo(() => {
    const revenueRows = performanceItems
      .filter((item) => Number(item.revenue) > 0 || Number(item.order_count) > 0)
      .sort((a, b) => Number(b.revenue) - Number(a.revenue))
      .slice(0, 5)
      .map((item, index) => ({
        label: item.branch_name || `Co so ${item.customer_id}`,
        value: Number(item.revenue),
        helper: `${Number(item.order_count)} don`,
        color: index === 0 ? 'bg-emerald-500' : index === 1 ? 'bg-sky-500' : 'bg-amber-500',
      }));

    if (revenueRows.length > 0) {
      return revenueRows;
    }

    return [
      { label: 'Dang hoat dong', value: stats.active, helper: 'tai khoan', color: 'bg-emerald-500' },
      { label: 'Can theo doi', value: stats.inactive, helper: 'tai khoan', color: 'bg-amber-500' },
    ];
  }, [performanceItems, stats.active, stats.inactive]);

  const chartTotal = useMemo(() => {
    const revenueTotal = chartRows.reduce((sum, row) => sum + Number(row.value), 0);
    return revenueTotal || stats.total;
  }, [chartRows, stats.total]);

  if (!canManageBranches) {
    return null;
  }

  return (
    <section className="mt-8 border-t border-gray-100 pt-7">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-[#00b14f]" />
            <h2 className="text-[18px] font-bold text-gray-900 tracking-tight">Quan ly co so</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Tao tai khoan cho chi nhanh, theo doi trang thai hoat dong va tong quan kinh doanh theo co so.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className="size-3.5" />
            Lam moi
          </button>
          <button
            type="button"
            onClick={() => setActiveView('create')}
            className="inline-flex items-center gap-2 rounded-full bg-[#00b14f] px-4 py-2 text-xs font-bold text-white hover:bg-[#009845]"
          >
            <Plus className="size-3.5" />
            Tao co so
          </button>
        </div>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-5">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500">Tong co so</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs font-semibold text-emerald-700">Dang hoat dong</p>
          <p className="mt-2 text-2xl font-bold text-emerald-800">{stats.active}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500">Ty le hoat dong</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{stats.activePercent}%</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500">Tong don hang</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{stats.orderCount}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500">Doanh thu</p>
          <p className="mt-2 text-lg font-bold text-gray-900">{formatCurrency(stats.revenue)}</p>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Tinh trang kinh doanh co so</h3>
            <p className="text-xs text-gray-500">
              {performanceItems.length > 0
                ? `Doanh thu theo co so, AOV trung binh ${formatCurrency(stats.averageOrderValue)}.`
                : 'Chua co don hang cho co so, tam hien thi theo trang thai tai khoan.'}
            </p>
          </div>
          {isLoading && <span className="text-xs font-semibold text-gray-400">Dang tai...</span>}
        </div>
        <div className="space-y-3">
          {chartRows.map((row) => {
            const width = chartTotal ? Math.max(8, Math.round((Number(row.value) / chartTotal) * 100)) : 0;
            return (
              <div key={row.label}>
                <div className="mb-1 flex justify-between text-xs font-semibold text-gray-600">
                  <span>{row.label}</span>
                  <span>
                    {performanceItems.length > 0 ? formatCurrency(Number(row.value)) : row.value} {row.helper}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full rounded-full ${row.color}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        {errorMessage && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        )}
      </div>

      <div className="mb-4 inline-flex rounded-full border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => setActiveView('list')}
          className={`rounded-full px-4 py-2 text-xs font-bold ${
            activeView === 'list' ? 'bg-white text-[#00b14f] shadow-sm' : 'text-gray-500'
          }`}
        >
          Danh sach co so
        </button>
        <button
          type="button"
          onClick={() => setActiveView('create')}
          className={`rounded-full px-4 py-2 text-xs font-bold ${
            activeView === 'create' ? 'bg-white text-[#00b14f] shadow-sm' : 'text-gray-500'
          }`}
        >
          Tao moi co so
        </button>
      </div>

      {activeView === 'list' ? (
        <EmployeeList isSuperAdmin={canManageBranches} compact onChanged={() => setRefreshKey((value) => value + 1)} />
      ) : (
        <CreateBranchManager
          isSuperAdmin={canManageBranches}
          compact
          onCreated={() => {
            setActiveView('list');
            setRefreshKey((value) => value + 1);
          }}
        />
      )}
    </section>
  );
};
