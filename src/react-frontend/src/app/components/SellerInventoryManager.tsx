import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  History,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  FileText,
  X,
  Check,
  Search,
  Boxes
} from 'lucide-react';

interface Product {
  sku: string;
  name: string;
  qty: number;
  unit: string;
  categoryLabel: string;
  image: string;
}

interface InventoryLog {
  log_id: string;
  sku: string;
  action_type: 'inbound' | 'outbound' | 'system_adjust';
  qty_change: number;
  qty_after: number;
  note: string;
  created_at: string;
}

export function SellerInventoryManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'stock' | 'logs'>('stock');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Adjustment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [actionType, setActionType] = useState<'inbound' | 'outbound' | 'system_adjust'>('inbound');
  const [qtyChange, setQtyChange] = useState('');
  const [note, setNote] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Sync databases from localStorage + Magento REST API fallbacks
  const syncData = async () => {
    setIsLoading(true);
    const token = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';

    // 1. Sync Products (catalog sỉ)
    const customLocalRaw = window.localStorage.getItem('freso_custom_products');
    let customLocalProducts: Product[] = [];
    if (customLocalRaw) {
      try {
        customLocalProducts = JSON.parse(customLocalRaw);
      } catch (e) {
        customLocalProducts = [];
      }
    }

    // 2. Sync Logs
    const localLogsRaw = window.localStorage.getItem('freso_inventory_logs');
    let localLogs: InventoryLog[] = [];
    if (localLogsRaw) {
      try {
        localLogs = JSON.parse(localLogsRaw);
      } catch (e) {
        localLogs = [];
      }
    }

    if (token) {
      try {
        // Fetch products list
        const pResponse = await fetch(`${window.location.origin}/rest/V1/tmdt-catalog/products`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        });

        // Fetch logs
        const lResponse = await fetch(`${window.location.origin}/rest/V1/tmdt-catalog/inventory/logs`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        });

        if (pResponse.ok && lResponse.ok) {
          const apiProducts = await pResponse.json();
          const apiLogs = await lResponse.json();

          if (Array.isArray(apiProducts) && Array.isArray(apiLogs)) {
            const apiSkus = new Set(apiProducts.map((p) => p.sku));
            const filteredLocal = customLocalProducts.filter((p) => !apiSkus.has(p.sku));

            const merged = [
              ...apiProducts.map((p) => {
                const localMatch = customLocalProducts.find((lp) => lp.sku === p.sku);
                return {
                  sku: p.sku,
                  name: p.name,
                  qty: Number(p.qty),
                  unit: p.unit || localMatch?.unit || 'kg',
                  categoryLabel: localMatch?.categoryLabel || 'Rau củ quả',
                  image: localMatch?.image || p.image || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&h=500&fit=crop'
                };
              }),
              ...filteredLocal.map((p) => ({
                sku: p.sku,
                name: p.name,
                qty: Number(p.qty),
                unit: p.unit || 'kg',
                categoryLabel: p.categoryLabel || 'Rau củ quả',
                image: p.image || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&h=500&fit=crop'
              }))
            ];

            setProducts(merged);

            setLogs(apiLogs.map((l) => ({
              log_id: String(l.log_id),
              sku: l.sku,
              action_type: l.action_type,
              qty_change: Number(l.qty_change),
              qty_after: Number(l.qty_after),
              note: l.note || '',
              created_at: l.created_at
            })));
            
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        // API fallback
      }
    }

    // Local Storage Mock fallback
    if (customLocalProducts.length === 0) {
      // Default seeds
      customLocalProducts = [
        {
          sku: 'CA-HOI-NORWAY',
          name: 'Cá Hồi Na Uy Cắt Lát Khay 500g',
          qty: 240,
          unit: 'khay',
          categoryLabel: 'Thuỷ hải sản',
          image: 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=500&h=500&fit=crop'
        },
        {
          sku: 'CAI-THAO-DALAT',
          name: 'Cải Thảo Sạch Đà Lạt (Bao 30kg)',
          qty: 8, // Low Stock Trigger seed
          unit: 'bao',
          categoryLabel: 'Rau củ quả',
          image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&h=500&fit=crop'
        }
      ];
      window.localStorage.setItem('freso_custom_products', JSON.stringify(customLocalProducts));
    }

    if (localLogs.length === 0) {
      localLogs = [
        {
          log_id: 'LOG-1',
          sku: 'CA-HOI-NORWAY',
          action_type: 'inbound',
          qty_change: 150,
          qty_after: 240,
          note: 'Nhập kho hàng sỉ từ cảng Cát Bà Hải Phòng',
          created_at: '2026-06-01 10:45:00'
        },
        {
          log_id: 'LOG-2',
          sku: 'CAI-THAO-DALAT',
          action_type: 'outbound',
          qty_change: -30,
          qty_after: 8,
          note: 'Xuất hàng giao sỉ cho Lotte Mart',
          created_at: '2026-06-01 09:12:00'
        }
      ];
      window.localStorage.setItem('freso_inventory_logs', JSON.stringify(localLogs));
    }

    setProducts(customLocalProducts);
    setLogs(localLogs);
    setIsLoading(false);
  };

  useEffect(() => {
    syncData();
  }, []);

  // Open Stock adjustment Modal
  const handleOpenAdjust = (prod: Product, type: 'inbound' | 'outbound') => {
    setSelectedProduct(prod);
    setActionType(type);
    setQtyChange('');
    setNote('');
    setIsModalOpen(true);
  };

  // Submit Stock Adjustment
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduct || !qtyChange.trim()) {
      showToast('Vui lòng nhập số lượng điều chỉnh.', 'error');
      return;
    }

    const valueNum = parseInt(qtyChange, 10);
    if (isNaN(valueNum) || valueNum <= 0) {
      showToast('Số lượng phải là số lớn hơn 0.', 'error');
      return;
    }

    // Calculate dynamic changes
    const finalChange = actionType === 'outbound' ? -valueNum : valueNum;
    const finalQty = selectedProduct.qty + finalChange;

    if (finalQty < 0) {
      showToast('Không đủ lượng tồn kho khả dụng để thực hiện xuất!', 'error');
      return;
    }

    const token = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';
    let apiSuccess = false;

    const adjustmentData = {
      sku: selectedProduct.sku,
      qty_change: finalChange,
      action_type: actionType,
      note: note.trim() || (actionType === 'inbound' ? 'Nhập bổ sung kho sỉ' : 'Xuất kho sỉ giao hàng')
    };

    if (token) {
      try {
        const res = await fetch(`${window.location.origin}/rest/V1/tmdt-catalog/inventory/adjust`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ adjustmentData })
        });
        if (res.ok) {
          apiSuccess = true;
        }
      } catch (e) {
        // Fallback
      }
    }

    // Local Sync Fallback
    const updatedProducts = products.map((p) => 
      p.sku === selectedProduct.sku ? { ...p, qty: finalQty } : p
    );
    window.localStorage.setItem('freso_custom_products', JSON.stringify(updatedProducts));
    setProducts(updatedProducts);

    // Save adjustment log
    const newLog: InventoryLog = {
      log_id: `LOG-${Date.now()}`,
      sku: selectedProduct.sku,
      action_type: actionType,
      qty_change: finalChange,
      qty_after: finalQty,
      note: adjustmentData.note,
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    const updatedLogs = [newLog, ...logs];
    window.localStorage.setItem('freso_inventory_logs', JSON.stringify(updatedLogs));
    setLogs(updatedLogs);

    showToast(
      actionType === 'inbound'
        ? `Đã nhập thêm +${valueNum} ${selectedProduct.unit} thành công!`
        : `Đã xuất kho -${valueNum} ${selectedProduct.unit} thành công!`,
      'success'
    );
    setIsModalOpen(false);
  };

  // Products filtered and searched
  const filteredProducts = products.filter((p) => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute analytics
  const totalStockItems = products.length;
  const lowStockItems = products.filter((p) => p.qty <= 10).length;
  const inStockItems = totalStockItems - lowStockItems;

  return (
    <div className="flex-1 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border transition-all duration-300 transform scale-100 ${
          toast.type === 'success'
            ? 'bg-[#E9F8EF] text-[#00b14f] border-[#CDEEDB]'
            : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          <div className="shrink-0">
            {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <span className="text-sm font-bold tracking-tight">{toast.message}</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-50 pb-5">
        <div>
          <h2 className="text-[17px] font-black text-slate-800 tracking-tight flex items-center gap-2">
            <History className="text-emerald-500" size={20} />
            Quản lý kho hàng sỉ (B2B Inventory)
          </h2>
          <p className="text-xs text-slate-400 font-medium">Theo dõi số lượng tồn kho sỉ, cập nhật nhập/xuất kho và đối soát lịch sử biến động</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'stock' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes size={14} />
            <span>Tồn kho hiện tại</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History size={14} />
            <span>Nhật ký kho sỉ</span>
          </button>
        </div>
      </div>

      {/* Analytics Mini Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-700 border border-gray-100 shadow-sm shrink-0">
            <Boxes size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng mặt hàng</p>
            <h4 className="text-base font-black text-slate-800">{totalStockItems} mặt hàng</h4>
          </div>
        </div>

        <div className="bg-[#E9F8EF]/40 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm shrink-0">
            <Check size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Lượng tồn kho an toàn</p>
            <h4 className="text-base font-black text-emerald-700">{inStockItems} sản phẩm sỉ</h4>
          </div>
        </div>

        <div className="bg-rose-50/40 border border-rose-100 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-rose-600 border border-rose-100 shadow-sm shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cảnh báo sắp hết hàng</p>
            <h4 className="text-base font-black text-rose-700">{lowStockItems} mặt hàng</h4>
          </div>
        </div>
      </div>

      {activeTab === 'stock' && (
        <>
          {/* Filters & Search */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                type="text"
                placeholder="Tìm sản phẩm theo tên hoặc SKU cần cập nhật kho..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 bg-gray-50/50 focus:bg-white rounded-2xl text-xs font-bold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
            <button
              onClick={syncData}
              className="p-2.5 border border-gray-200 hover:bg-gray-50 rounded-2xl text-slate-500 hover:text-slate-800 transition-all"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Stock inventory level list grid */}
          <div className="overflow-x-auto border border-gray-100 rounded-2xl">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100 text-slate-400 font-extrabold uppercase tracking-wider">
                  <th className="px-5 py-4">Sản phẩm sỉ</th>
                  <th className="px-5 py-4">Mã SKU</th>
                  <th className="px-5 py-4">Ngành hàng</th>
                  <th className="px-5 py-4 text-center">Tồn kho khả dụng</th>
                  <th className="px-5 py-4 text-center">Trạng thái cảnh báo</th>
                  <th className="px-5 py-4 text-center">Cập nhật kho nhanh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-slate-700 font-semibold">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-medium">
                      Không tìm thấy mặt hàng nào trong kho.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const isLow = p.qty <= 10;
                    return (
                      <tr key={p.sku} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5 flex items-center gap-3">
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-10 h-10 object-cover rounded-xl border border-gray-100 shrink-0"
                          />
                          <p className="font-black text-slate-800 truncate text-[13px]">{p.name}</p>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-600">{p.sku}</td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-0.8 bg-gray-100 text-slate-600 rounded-full text-[10px] font-black uppercase">
                            {p.categoryLabel}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center font-black text-slate-800 text-[13px]">
                          {p.qty} {p.unit}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.8 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black">
                              <AlertTriangle size={12} />
                              Hết hàng sỉ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.8 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black">
                              <Check size={12} />
                              Tồn kho tốt
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenAdjust(p, 'inbound')}
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 hover:border-emerald-200 rounded-xl font-black text-[10px] transition-all flex items-center gap-1"
                            >
                              <PlusCircle size={12} />
                              <span>Nhập kho</span>
                            </button>
                            <button
                              onClick={() => handleOpenAdjust(p, 'outbound')}
                              className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 hover:border-rose-200 rounded-xl font-black text-[10px] transition-all flex items-center gap-1"
                            >
                              <MinusCircle size={12} />
                              <span>Xuất kho</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
            <span className="text-xs text-slate-500 font-bold flex items-center gap-1.5">
              <FileText size={14} className="text-emerald-500" />
              Tổng cộng {logs.length} giao dịch thay đổi tồn kho được ghi nhận
            </span>
            <button
              onClick={syncData}
              className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-slate-500 hover:text-slate-800 transition-all"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Logs table */}
          <div className="overflow-x-auto border border-gray-100 rounded-2xl">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100 text-slate-400 font-extrabold uppercase tracking-wider">
                  <th className="px-5 py-4">Mã SKU</th>
                  <th className="px-5 py-4">Thời gian ghi nhận</th>
                  <th className="px-5 py-4">Loại tác vụ</th>
                  <th className="px-5 py-4 text-center">Số lượng điều chỉnh</th>
                  <th className="px-5 py-4 text-center">Lượng tồn sau thay đổi</th>
                  <th className="px-5 py-4">Lý do điều chỉnh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-slate-700 font-semibold">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-medium">
                      Chưa ghi nhận hoạt động nhập/xuất kho nào.
                    </td>
                  </tr>
                ) : (
                  logs.map((l, idx) => {
                    const isPlus = l.qty_change > 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-black text-slate-800">{l.sku}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-400">{l.created_at}</td>
                        <td className="px-5 py-3.5">
                          {l.action_type === 'inbound' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.8 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase">
                              <ArrowUpRight size={12} />
                              Nhập kho
                            </span>
                          )}
                          {l.action_type === 'outbound' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.8 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase">
                              <ArrowDownRight size={12} />
                              Xuất kho
                            </span>
                          )}
                          {l.action_type === 'system_adjust' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.8 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase">
                              <RefreshCw size={12} />
                              Điều chỉnh hệ thống
                            </span>
                          )}
                        </td>
                        <td className={`px-5 py-3.5 text-center font-black text-[13px] ${
                          isPlus ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {isPlus ? `+${l.qty_change}` : l.qty_change}
                        </td>
                        <td className="px-5 py-3.5 text-center font-black text-slate-800">
                          {l.qty_after}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 font-medium leading-relaxed max-w-xs truncate" title={l.note}>
                          {l.note}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjustment Dialog Modal */}
      {isModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-[450px] p-6 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-gray-50 pb-4 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                  {actionType === 'inbound' ? (
                    <PlusCircle size={18} className="text-emerald-500" />
                  ) : (
                    <MinusCircle size={18} className="text-rose-500" />
                  )}
                  {actionType === 'inbound' ? 'Cập nhật Nhập kho hàng sỉ' : 'Cập nhật Xuất kho hàng sỉ'}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  SKU: {selectedProduct.sku}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 text-slate-400 hover:text-slate-800 rounded-xl transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-semibold text-slate-500 mb-4 flex justify-between items-center">
                <span>Số lượng tồn kho hiện tại:</span>
                <strong className="text-slate-800 text-[13px]">{selectedProduct.qty} {selectedProduct.unit}</strong>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase">
                  Số lượng {actionType === 'inbound' ? 'nhập thêm' : 'yêu cầu xuất'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder={`Nhập lượng ${selectedProduct.unit}...`}
                    value={qtyChange}
                    onChange={(e) => setQtyChange(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:border-emerald-500 bg-slate-50/30 focus:bg-white transition-all"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase">
                    {selectedProduct.unit}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase">Lý do thay đổi tồn kho</label>
                <textarea
                  placeholder="Ví dụ: Nhập bổ sung đợt hàng mới, Xuất kho giao sỉ chuỗi khách sạn..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:border-emerald-500 bg-slate-50/30 focus:bg-white transition-all resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-gray-50 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-gray-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1.5 ${
                    actionType === 'inbound'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/10'
                  }`}
                >
                  <Check size={14} />
                  <span>Xác nhận cập nhật</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
