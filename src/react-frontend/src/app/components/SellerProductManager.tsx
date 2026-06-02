import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  Image as ImageIcon,
  DollarSign,
  Tag,
  Boxes,
  Check,
  AlertCircle,
  X,
  Upload,
  ArrowRight,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';

// B2B Category List matching the store categories
const B2B_CATEGORIES = [
  'Rau củ quả',
  'Trái cây',
  'Thực phẩm tươi sống',
  'Thuỷ hải sản',
  'Thực phẩm đông lạnh',
  'Thực phẩm khô',
  'Tiện ích bếp'
];

interface Variant {
  name: string;
  priceDelta: number;
  qty: number;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  special_price?: number;
  qty: number;
  categoryLabel: string;
  unit: string;
  image: string;
  variants: Variant[];
  isCustom?: boolean;
}

export function SellerProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [editingSku, setEditingSku] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [specialPrice, setSpecialPrice] = useState('');
  const [categoryLabel, setCategoryLabel] = useState(B2B_CATEGORIES[0]);
  const [unit, setUnit] = useState('kg');
  const [qty, setQty] = useState('100');
  const [image, setImage] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);

  // Variant helper states
  const [newVarName, setNewVarName] = useState('');
  const [newVarPriceDelta, setNewVarPriceDelta] = useState('');
  const [newVarQty, setNewVarQty] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load products database (Magento API + localStorage fallback for Vite HMR sandbox)
  const loadProducts = async () => {
    setIsLoading(true);
    const token = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';
    
    // 1. Load custom local-storage products
    const customLocalRaw = window.localStorage.getItem('freso_custom_products');
    let customLocalProducts: Product[] = [];
    if (customLocalRaw) {
      try {
        customLocalProducts = JSON.parse(customLocalRaw);
      } catch (e) {
        customLocalProducts = [];
      }
    }

    // 2. Fetch from Magento custom B2B Catalog API
    if (token) {
      try {
        const response = await fetch(`${window.location.origin}/rest/V1/tmdt-catalog/products`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        });

        if (response.ok) {
          const apiProducts = await response.json();
          if (Array.isArray(apiProducts)) {
            // Merge API products with local mock products (avoiding duplicates by SKU)
            const apiSkus = new Set(apiProducts.map((p) => p.sku));
            const filteredLocal = customLocalProducts.filter((p) => !apiSkus.has(p.sku));
            
            const merged = [...apiProducts.map((p) => ({
              id: String(p.id),
              sku: p.sku,
              name: p.name,
              price: Number(p.price),
              special_price: p.special_price ? Number(p.special_price) : undefined,
              qty: Number(p.qty),
              categoryLabel: p.categoryLabel || 'Rau củ quả',
              unit: p.unit || 'kg',
              image: p.image || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&h=500&fit=crop',
              variants: p.variants || []
            })), ...filteredLocal];

            setProducts(merged);
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        // Fallback silently to localStorage list in dev sandbox
      }
    }

    // Fallback display
    if (customLocalProducts.length === 0) {
      // Default seed data
      const defaultSeed: Product[] = [
        {
          id: 'SEED-1',
          sku: 'CA-HOI-NORWAY',
          name: 'Cá Hồi Na Uy Cắt Lát Khay 500g',
          price: 185000,
          special_price: 165000,
          qty: 240,
          categoryLabel: 'Thuỷ hải sản',
          unit: 'khay',
          image: 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=500&h=500&fit=crop',
          variants: [
            { name: 'Khay 500g', priceDelta: 0, qty: 100 },
            { name: 'Khay 1kg', priceDelta: 160000, qty: 140 }
          ],
          isCustom: true
        },
        {
          id: 'SEED-2',
          sku: 'CAI-THAO-DALAT',
          name: 'Cải Thảo Sạch Đà Lạt (Bao 30kg)',
          price: 90000,
          qty: 85,
          categoryLabel: 'Rau củ quả',
          unit: 'bao',
          image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&h=500&fit=crop',
          variants: [],
          isCustom: true
        }
      ];
      window.localStorage.setItem('freso_custom_products', JSON.stringify(defaultSeed));
      setProducts(defaultSeed);
    } else {
      setProducts(customLocalProducts);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Save changes to localStorage
  const saveLocalProducts = (updatedList: Product[]) => {
    window.localStorage.setItem('freso_custom_products', JSON.stringify(updatedList));
    setProducts(updatedList);
  };

  // Open create form modal
  const handleOpenCreate = () => {
    setName('');
    setSku('');
    setPrice('');
    setSpecialPrice('');
    setCategoryLabel(B2B_CATEGORIES[0]);
    setUnit('kg');
    setQty('100');
    setImage('');
    setVariants([]);
    setEditingSku(null);
    setFormStep(1);
    setIsModalOpen(true);
  };

  // Open edit form modal
  const handleOpenEdit = (product: Product) => {
    setName(product.name);
    setSku(product.sku);
    setPrice(String(product.price));
    setSpecialPrice(product.special_price ? String(product.special_price) : '');
    setCategoryLabel(product.categoryLabel);
    setUnit(product.unit);
    setQty(String(product.qty));
    setImage(product.image);
    setVariants(product.variants || []);
    setEditingSku(product.sku);
    setFormStep(1);
    setIsModalOpen(true);
  };

  // Handle Delete Product
  const handleDeleteProduct = async (targetSku: string, productName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${productName}" khỏi catalog sỉ?`)) {
      return;
    }

    const token = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';
    let apiSuccess = false;

    if (token) {
      try {
        const res = await fetch(`${window.location.origin}/rest/V1/tmdt-catalog/product/${targetSku}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        });
        if (res.ok) {
          apiSuccess = true;
        }
      } catch (e) {
        // Fallback
      }
    }

    // Local sync fallback
    const filtered = products.filter((p) => p.sku !== targetSku);
    saveLocalProducts(filtered);
    showToast(`Đã xóa sản phẩm "${productName}" thành công!`, 'success');
  };

  // Handle Add Variant
  const handleAddVariant = () => {
    if (!newVarName.trim() || !newVarPriceDelta.trim()) {
      showToast('Vui lòng nhập tên biến thể và giá chênh lệch.', 'error');
      return;
    }
    const delta = parseFloat(newVarPriceDelta);
    const varQty = newVarQty.trim() ? parseInt(newVarQty, 10) : 0;
    
    setVariants([...variants, {
      name: newVarName.trim(),
      priceDelta: isNaN(delta) ? 0 : delta,
      qty: isNaN(varQty) ? 0 : varQty
    }]);

    setNewVarName('');
    setNewVarPriceDelta('');
    setNewVarQty('');
  };

  // Remove Variant
  const handleRemoveVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  // Image Upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Kích thước ảnh không được vượt quá 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !sku.trim() || !price.trim()) {
      showToast('Vui lòng điền đầy đủ Tên, SKU và Giá bán.', 'error');
      return;
    }

    const priceNum = parseFloat(price);
    const specPriceNum = specialPrice.trim() ? parseFloat(specialPrice) : undefined;
    const qtyNum = parseInt(qty, 10);

    if (isNaN(priceNum) || priceNum <= 0) {
      showToast('Giá bán phải là số lớn hơn 0.', 'error');
      return;
    }

    // Default image if blank
    const fallbackImages: Record<string, string> = {
      'Rau củ quả': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&h=500&fit=crop',
      'Trái cây': 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=500&h=500&fit=crop',
      'Thực phẩm tươi sống': 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=500&h=500&fit=crop',
      'Thuỷ hải sản': 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=500&h=500&fit=crop',
      'Thực phẩm đông lạnh': 'https://images.unsplash.com/photo-1481070414801-51fd732d7184?w=500&h=500&fit=crop',
      'Thực phẩm khô': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&h=500&fit=crop',
      'Tiện ích bếp': 'https://images.unsplash.com/photo-1584990347449-a1e229ee8b29?w=500&h=500&fit=crop'
    };

    const finalImage = image.trim() || fallbackImages[categoryLabel] || 'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop';

    const newProductData: Product = {
      id: editingSku ? (products.find((p) => p.sku === editingSku)?.id || String(Date.now())) : String(Date.now()),
      sku: sku.trim(),
      name: name.trim(),
      price: priceNum,
      special_price: specPriceNum,
      qty: isNaN(qtyNum) ? 0 : qtyNum,
      categoryLabel,
      unit,
      image: finalImage,
      variants,
      isCustom: true
    };

    const token = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';
    let apiSuccess = false;

    if (token) {
      try {
        const url = editingSku 
          ? `${window.location.origin}/rest/V1/tmdt-catalog/product/${editingSku}`
          : `${window.location.origin}/rest/V1/tmdt-catalog/product`;

        const res = await fetch(url, {
          method: editingSku ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ productData: newProductData })
        });

        if (res.ok) {
          apiSuccess = true;
        }
      } catch (e) {
        // Fallback
      }
    }

    // Local sync fallback
    let updatedProducts: Product[];
    if (editingSku) {
      updatedProducts = products.map((p) => (p.sku === editingSku ? newProductData : p));
      showToast(`Đã cập nhật sản phẩm "${name}" thành công!`, 'success');
    } else {
      updatedProducts = [newProductData, ...products];
      showToast(`Đã đăng sản phẩm "${name}" thành công lên Freso!`, 'success');
    }

    saveLocalProducts(updatedProducts);
    setIsModalOpen(false);
  };

  // Filtered and searched list
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'all' || p.categoryLabel === categoryFilter;
    return matchesSearch && matchesCat;
  });

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
            {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          </div>
          <span className="text-sm font-bold tracking-tight">{toast.message}</span>
        </div>
      )}

      {/* Header operations */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-50 pb-5">
        <div>
          <h2 className="text-[17px] font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Boxes className="text-green-600" size={20} />
            Quản lý danh mục sản phẩm sỉ
          </h2>
          <p className="text-xs text-slate-400 font-medium">Đăng tải, định giá và cấu hình các mặt hàng bán buôn lên Freso</p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={loadProducts}
            className="p-2 border border-gray-200 hover:bg-gray-50 rounded-xl transition-all text-slate-500 hover:text-slate-800"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex-1 md:flex-initial px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl text-xs font-black hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/10"
          >
            <Plus size={15} />
            <span>Thêm sản phẩm mới</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
          <input
            type="text"
            placeholder="Tìm kiếm sản phẩm theo tên hoặc SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 bg-gray-50/50 focus:bg-white rounded-2xl text-xs font-bold outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="text-slate-400" size={15} />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-gray-200 bg-gray-50/50 px-3 py-2.5 rounded-2xl text-xs font-bold outline-none focus:border-green-600"
          >
            <option value="all">Tất cả ngành hàng</option>
            {B2B_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Product list table */}
      <div className="overflow-x-auto border border-gray-100 rounded-2xl">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-100 text-slate-400 font-extrabold uppercase tracking-wider">
              <th className="px-5 py-4">Sản phẩm</th>
              <th className="px-5 py-4">Mã SKU</th>
              <th className="px-5 py-4">Danh mục</th>
              <th className="px-5 py-4 text-right">Đơn giá bán sỉ</th>
              <th className="px-5 py-4 text-right">Giá Khuyến mãi</th>
              <th className="px-5 py-4 text-center">Tồn kho khả dụng</th>
              <th className="px-5 py-4 text-center">Tác vụ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-slate-700 font-semibold">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400 font-medium">
                  Đang đồng bộ dữ liệu catalog từ Magento DB...
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400 font-medium">
                  Không tìm thấy sản phẩm sỉ nào khớp với bộ lọc.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => {
                const discount = p.special_price ? ((1 - p.special_price / p.price) * 100).toFixed(0) : 0;
                return (
                  <tr key={p.sku} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 flex items-center gap-3">
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-10 h-10 object-cover rounded-xl border border-gray-100 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-black text-slate-800 truncate text-[13px]">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Đơn vị sỉ: {p.unit}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-600">{p.sku}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-0.8 bg-gray-100 text-slate-600 rounded-full text-[10px] font-black uppercase">
                        {p.categoryLabel}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-slate-800 text-[13px]">
                      {p.price.toLocaleString()}đ
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-green-600">
                      {p.special_price ? (
                        <div className="flex flex-col items-end">
                          <span>{p.special_price.toLocaleString()}đ</span>
                          <span className="text-[9px] font-black bg-rose-50 text-rose-600 px-1 py-0.2 rounded mt-0.5">
                            -{discount}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300 font-bold text-[11px]">Không áp dụng</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2.5 py-0.8 rounded-full text-[10px] font-black ${
                        p.qty <= 10 
                          ? 'bg-rose-50 text-rose-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {p.qty} {p.unit}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition-all"
                          title="Chỉnh sửa sản phẩm"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.sku, p.name)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-all"
                          title="Xóa sản phẩm"
                        >
                          <Trash2 size={13} />
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

      {/* Multi-step form modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-[580px] p-6 animate-in zoom-in-95 duration-200 flex flex-col justify-between min-h-[520px]">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-gray-50 pb-4 mb-4">
              <div>
                <h3 className="text-[16px] font-black text-slate-800 tracking-tight">
                  {editingSku ? 'Chỉnh sửa cấu hình sản phẩm sỉ' : 'Đăng tải sản phẩm mới lên website sỉ'}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Bước {formStep} trên 3: {
                    formStep === 1 ? 'Thông tin cơ bản' : formStep === 2 ? 'Định giá & Khuyến mãi' : 'Thuộc tính & Biến thể sỉ'
                  }
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 text-slate-400 hover:text-slate-800 rounded-xl transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Steps Navigation header */}
            <div className="flex items-center justify-center gap-3 mb-6 bg-slate-50 p-2.5 rounded-2xl">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                formStep === 1 ? 'bg-green-600 text-white shadow-sm' : 'bg-green-100 text-green-600'
              }`}>1</span>
              <span className="w-8 h-[1px] bg-slate-200" />
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                formStep === 2 ? 'bg-green-600 text-white shadow-sm' : formStep > 2 ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'
              }`}>2</span>
              <span className="w-8 h-[1px] bg-slate-200" />
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                formStep === 3 ? 'bg-green-600 text-white shadow-sm' : 'bg-slate-200 text-slate-400'
              }`}>3</span>
            </div>

            {/* Form Steps Body */}
            <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col justify-between">
              <div className="flex-1">
                {/* Step 1: Basic Info */}
                {formStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase">Tên sản phẩm sỉ</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Cá Hồi Na Uy Nguyên Con Phi Lê"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:border-emerald-500 bg-slate-50/30 focus:bg-white transition-all"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase">Mã định danh SKU</label>
                        <input
                          type="text"
                          placeholder="Ví dụ: CA-HOI-PHILE"
                          value={sku}
                          onChange={(e) => setSku(e.target.value)}
                          disabled={editingSku !== null}
                          className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:border-emerald-500 bg-slate-50/30 focus:bg-white transition-all disabled:opacity-50"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase">Đơn vị tính sỉ</label>
                        <select
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          className="w-full border border-gray-200 px-3 py-3 rounded-2xl text-xs font-bold outline-none focus:border-emerald-500 bg-slate-50/30"
                        >
                          <option value="kg">Cân nặng (kg)</option>
                          <option value="thùng">Thùng đóng gói</option>
                          <option value="bao">Bao tải lớn</option>
                          <option value="hộp">Hộp carton</option>
                          <option value="khay">Khay đóng sẵn</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase">Ngành hàng B2B</label>
                        <select
                          value={categoryLabel}
                          onChange={(e) => setCategoryLabel(e.target.value)}
                          className="w-full border border-gray-200 px-3 py-3 rounded-2xl text-xs font-bold outline-none focus:border-emerald-500 bg-slate-50/30"
                        >
                          {B2B_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase">Hình ảnh sản phẩm sỉ</label>
                        {image ? (
                          <div className="relative group w-full h-32 rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-slate-50/50 flex items-center justify-center">
                            <img
                              src={image}
                              alt="Product Preview"
                              className="w-full h-full object-contain p-2"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <label
                                htmlFor="product-image-upload"
                                className="px-3.5 py-2 bg-white text-slate-800 rounded-xl text-[11px] font-black hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
                              >
                                Thay đổi ảnh
                              </label>
                              <button
                                type="button"
                                onClick={() => setImage('')}
                                className="px-3.5 py-2 bg-rose-600 text-white rounded-xl text-[11px] font-black hover:bg-rose-700 transition-all shadow-sm"
                              >
                                Xóa ảnh
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label
                            htmlFor="product-image-upload"
                            className="w-full h-32 border-2 border-dashed border-gray-200 hover:border-emerald-500 bg-slate-50/30 hover:bg-emerald-50/10 rounded-2xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all group"
                          >
                            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-emerald-500 border border-gray-100 shadow-sm group-hover:scale-110 transition-transform">
                              <Upload size={16} />
                            </div>
                            <span className="text-[11px] font-black text-slate-500 group-hover:text-emerald-600">
                              Chọn ảnh sản phẩm sỉ hoặc kéo thả tại đây
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold">
                              PNG, JPG, WEBP lên đến 5MB
                            </span>
                          </label>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id="product-image-upload"
                          onChange={handleImageUpload}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Pricing & Inventory */}
                {formStep === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase flex items-center gap-1">
                          <DollarSign size={13} />
                          Đơn giá sỉ gốc
                        </label>
                        <input
                          type="number"
                          placeholder="Ví dụ: 120000"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:border-emerald-500 bg-slate-50/30 focus:bg-white transition-all"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase flex items-center gap-1">
                          <Tag size={13} />
                          Đơn giá khuyến mãi sỉ
                        </label>
                        <input
                          type="number"
                          placeholder="Bỏ trống nếu không ưu đãi"
                          value={specialPrice}
                          onChange={(e) => setSpecialPrice(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:border-emerald-500 bg-slate-50/30 focus:bg-white transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase">Lượng tồn kho nhập ban đầu</label>
                      <input
                        type="number"
                        placeholder="Số lượng kho hàng khả dụng"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:border-emerald-500 bg-slate-50/30 focus:bg-white transition-all"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Step 3: Variants */}
                {formStep === 3 && (
                  <div className="space-y-4">
                    <label className="block text-xs font-black text-slate-500 mb-0.5 uppercase">
                      Biến thể / Quy cách đóng gói phụ
                    </label>
                    <p className="text-[10px] text-slate-400 font-semibold mb-3">
                      Tạo các lựa chọn về kích cỡ, trọng lượng hoặc đóng gói thùng/bao đi kèm mức chênh lệch giá gốc.
                    </p>

                    {/* New Variant Creator */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1 w-full text-left">
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Tên biến thể</label>
                        <input
                          type="text"
                          placeholder="Ví dụ: Thùng gỗ 20kg"
                          value={newVarName}
                          onChange={(e) => setNewVarName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 bg-white rounded-xl text-xs font-bold outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="w-full sm:w-28 text-left">
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Giá chênh lệch (+đ)</label>
                        <input
                          type="number"
                          placeholder="+20000"
                          value={newVarPriceDelta}
                          onChange={(e) => setNewVarPriceDelta(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 bg-white rounded-xl text-xs font-bold outline-none focus:border-emerald-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddVariant}
                        className="px-4 py-2.5 bg-slate-800 text-white text-xs font-black rounded-xl hover:bg-slate-900 transition-all shrink-0 w-full sm:w-auto"
                      >
                        Thêm
                      </button>
                    </div>

                    {/* Variant items log */}
                    <div className="space-y-2 max-h-40 overflow-y-auto pt-2">
                      {variants.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center font-medium italic py-4">
                          Chưa cấu hình biến thể nào. Sản phẩm sẽ được bán theo quy cách chuẩn.
                        </p>
                      ) : (
                        variants.map((v, i) => (
                          <div key={i} className="flex justify-between items-center p-3 bg-slate-50/50 rounded-xl border border-slate-100 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span className="font-black text-slate-700">{v.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-extrabold text-[#00b14f]">
                                {v.priceDelta === 0 ? 'Giá chuẩn' : `+${v.priceDelta.toLocaleString()}đ`}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveVariant(i)}
                                className="text-rose-500 hover:text-rose-700 font-bold"
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Step Navigation Actions footer */}
              <div className="flex justify-between items-center border-t border-gray-50 pt-4 mt-6">
                <div>
                  {formStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setFormStep(formStep - 1)}
                      className="px-5 py-2.5 border border-gray-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all flex items-center gap-1.5"
                    >
                      <ArrowLeft size={13} />
                      <span>Quay lại</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {formStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => setFormStep(formStep + 1)}
                      className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-all flex items-center gap-1.5"
                    >
                      <span>Tiếp theo</span>
                      <ArrowRight size={13} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl text-xs font-black hover:from-emerald-600 hover:to-green-700 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/10"
                    >
                      <Check size={14} />
                      <span>{editingSku ? 'Lưu chỉnh sửa' : 'Đăng sản phẩm sỉ'}</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
