import { useEffect, useMemo, useState } from 'react';
import { Heart, Plus, ShoppingCart, Trash2, Package } from 'lucide-react';
import { toCurrencyTextFromNumber, toUnitPriceFromLooseValue, useCart } from '../cart/CartProvider';
import { createWishlistList, getWishlistItems, getWishlistLists, removeWishlistItem } from '../utils/wishlistApi';

const reactHomePath = '/react/index.html';

type WishlistList = {
  id: string;
  name: string;
  itemCount: number;
};

type WishlistItem = {
  id: string;
  sku: string;
  name: string;
  price: number;
  unit: string;
  image: string;
  category: string;
};

const getAuthToken = () =>
  window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';

export function WishlistPage() {
  const { quickAddToCart } = useCart();
  const [lists, setLists] = useState<WishlistList[]>([]);
  const [activeListId, setActiveListId] = useState<string>('');
  const [isDetailView, setIsDetailView] = useState(false);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [itemsByList, setItemsByList] = useState<Record<string, WishlistItem[]>>({});
  const [isLoadingLists, setIsLoadingLists] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const detailListId = params.get('listId') ?? '';
    if (detailListId) {
      setActiveListId(detailListId);
      setIsDetailView(true);
    } else {
      setIsDetailView(false);
    }

    const token = getAuthToken();
    if (!token) {
      window.location.href = `${reactHomePath}?view=login`;
      return;
    }

    const loadLists = async () => {
      try {
        setIsLoadingLists(true);
        const normalized = await getWishlistLists();

        setLists(normalized);
  setActiveListId((prev) => prev || detailListId || normalized[0]?.id || '');
        setItemsByList({});
      } catch (_error) {
        setLists([]);
        showToast('Không thể tải danh sách yêu thích. Vui lòng thử lại.');
      } finally {
        setIsLoadingLists(false);
      }
    };

    loadLists();
  }, []);

  useEffect(() => {
    if (!activeListId) {
      setItems([]);
      setIsLoadingItems(false);
      return;
    }

    const cached = itemsByList[activeListId];
    if (cached) {
      setItems(cached);
      setIsLoadingItems(false);
      return;
    }

    const loadItems = async () => {
      try {
        setIsLoadingItems(true);
        const mapped = await getWishlistItems(activeListId);

        const customLocalRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_custom_products') : null;
        let customLocalProducts: any[] = [];
        if (customLocalRaw) {
          try {
            customLocalProducts = JSON.parse(customLocalRaw);
          } catch (e) {
            // Ignore
          }
        }

        const merged = mapped.map((item) => {
          const localMatch = customLocalProducts.find((p) => p.sku === item.sku);
          if (localMatch) {
            return {
              ...item,
              name: localMatch.name || item.name,
              price: localMatch.price ?? localMatch.priceValue ?? item.price,
              unit: localMatch.unit || item.unit,
              image: localMatch.image || item.image,
              category: localMatch.categoryLabel || item.category
            };
          }
          return item;
        });

        setItems(merged);
        setItemsByList((prev) => ({ ...prev, [activeListId]: merged }));
      } catch (_error) {
        setItems([]);
      } finally {
        setIsLoadingItems(false);
      }
    };

    loadItems();
  }, [activeListId, itemsByList]);

  const activeList = useMemo(() => lists.find((list) => list.id === activeListId), [lists, activeListId]);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(''), 2400);
  };

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) {
      setCreateError('Vui lòng nhập tên danh sách yêu thích mới.');
      return;
    }

    try {
      const newList = await createWishlistList(name);
      setLists((prev) => [newList, ...prev]);
      setActiveListId(newList.id);
      setItemsByList((prev) => ({ ...prev, [newList.id]: [] }));
      setIsCreateOpen(false);
      setNewListName('');
      setCreateError('');
      showToast('Đã tạo danh sách yêu thích');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast(`Không thể tạo danh sách. ${message}`);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeWishlistItem(itemId);

      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setItemsByList((prev) => ({
        ...prev,
        [activeListId]: (prev[activeListId] || []).filter((item) => item.id !== itemId)
      }));
      setLists((prev) =>
        prev.map((list) =>
          list.id === activeListId ? { ...list, itemCount: Math.max(0, list.itemCount - 1) } : list
        )
      );
      showToast('Đã xóa khỏi danh sách yêu thích');
    } catch (_error) {
      showToast('Không thể xóa sản phẩm. Vui lòng thử lại.');
    }
  };

  const handleAddToCart = async (item: WishlistItem) => {
    await quickAddToCart(
      {
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        priceText: toCurrencyTextFromNumber(item.price),
        unit: item.unit,
        unitPrice: toUnitPriceFromLooseValue(item.price),
        image: item.image
      },
      1
    );
  };

  const isEmpty = !isLoadingItems && items.length === 0;

  return (
    <div className="min-h-screen bg-[#f6f8f7] pb-20 text-gray-800">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-3 text-sm text-gray-400">
          <a href={reactHomePath} className="hover:text-green-600 transition-colors">
            Trang chủ
          </a>
          <span className="mx-2">&gt;</span>
          <span>Sản phẩm yêu thích</span>
        </nav>

        <h1 className="mb-6 text-4xl font-bold text-gray-900">Sản phẩm yêu thích</h1>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">Danh sách của tôi</h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-1 rounded-full border border-green-600 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-50"
              >
                <Plus className="size-4" />
                Tạo mới
              </button>
            </div>

            <div className="mt-4 hidden sm:block space-y-2">
              {isLoadingLists ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : (
                lists.map((list) => {
                  const isActive = list.id === activeListId;
                  return (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => setActiveListId(list.id)}
                      className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 ${
                        isActive
                          ? 'border-2 border-[#0f8a49] bg-white shadow-xs'
                          : 'border border-gray-100 bg-white hover:bg-gray-50/60'
                      }`}
                    >
                      <div className={`flex items-center justify-center size-10 rounded-xl shrink-0 transition-colors ${
                        isActive ? 'bg-[#eefcf4] text-[#0f8a49]' : 'bg-gray-100 text-gray-400'
                      }`}>
                        <Package className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${isActive ? 'text-[#0f8a49]' : 'text-gray-900'}`}>
                          {list.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {list.itemCount} sản phẩm
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-4 sm:hidden">
              <label className="text-xs text-gray-500">Danh sách</label>
              <select
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={activeListId}
                onChange={(event) => setActiveListId(event.target.value)}
              >
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name} ({list.itemCount})
                  </option>
                ))}
              </select>
            </div>
          </aside>

          <section className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{activeList?.name ?? 'Danh sách'}</h2>
            </div>

            {isLoadingItems && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-60 rounded-2xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            )}

            {isEmpty && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white rounded-2xl border border-gray-100 shadow-xs">
                {/* SVG Illustration */}
                <svg width="280" height="220" viewBox="0 0 280 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-6 max-w-full">
                  {/* Background soft glow */}
                  <defs>
                    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#f0fdf4" stopOpacity="1" />
                      <stop offset="100%" stopColor="#f0fdf4" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle cx="140" cy="120" r="90" fill="url(#glow)" />
                  <circle cx="70" cy="70" r="16" fill="#eff6ff" />
                  <circle cx="210" cy="150" r="20" fill="#fdf2f8" />
                  <circle cx="220" cy="75" r="10" fill="#fef3c7" />

                  {/* Shopping Basket */}
                  <path d="M100 120V95C100 72.9086 117.909 55 140 55C162.091 55 180 72.9086 180 95V120" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
                  <path d="M110 120V95C110 78.4315 123.431 65 140 65C156.569 65 170 78.4315 170 95V120" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
                  
                  <path d="M80 120H200L185 180H95L80 120Z" fill="white" stroke="#cbd5e1" strokeWidth="3" strokeLinejoin="round" />
                  <path d="M83 125H197L186 170H94L83 125Z" fill="#f8fafc" />

                  {/* Basket stripes */}
                  <line x1="110" y1="130" x2="115" y2="165" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
                  <line x1="140" y1="130" x2="140" y2="165" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
                  <line x1="170" y1="130" x2="165" y2="165" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
                  <line x1="90" y1="148" x2="190" y2="148" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Floating elements */}
                  <path d="M64 68C64 65.7909 65.7909 64 68 64C70.2091 64 72 65.7909 72 68C72 70.5 69.5 73 68 74.5C66.5 73 64 70.5 64 68Z" fill="#ec4899" />
                  <path d="M208 146C208 143.791 209.791 142 212 142C214.209 142 216 143.791 216 146C216 148.5 213.5 151 212 152.5C210.5 151 208 148.5 208 146Z" fill="#3b82f6" />
                  
                  {/* Sparkles */}
                  <path d="M220 75L222 72L225 75L222 78L220 75Z" fill="#fbbf24" />
                  <path d="M70 70L71 67L73 70L71 73L70 70Z" fill="#34d399" />

                  {/* Character leaning */}
                  {/* Legs */}
                  <path d="M175 140L190 185H178L168 148" fill="#1e3a8a" opacity="0.8" />
                  <path d="M162 135L178 185H166L155 142" fill="#1d4ed8" />
                  {/* Body */}
                  <path d="M165 110C165 102 170 95 178 95C186 95 190 102 190 110V140H165V110Z" fill="#ec4899" />
                  {/* Arms */}
                  <path d="M162 118C158 122 155 128 152 132L156 135" stroke="#f472b6" strokeWidth="3" strokeLinecap="round" />
                  <path d="M178 118C182 122 186 128 188 132" stroke="#f472b6" strokeWidth="3" strokeLinecap="round" />
                  {/* Phone */}
                  <rect x="145" y="125" width="8" height="14" rx="2" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
                  <circle cx="149" cy="137" r="0.75" fill="white" />
                  {/* Head */}
                  <circle cx="178" cy="85" r="10" fill="#fed7aa" />
                  <path d="M168 85C168 78 172 75 178 75C184 75 188 78 188 85C188 87 182 86 178 89C174 86 168 87 168 85Z" fill="#1e293b" />
                </svg>

                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  Bạn chưa có sản phẩm yêu thích nào trong danh sách "{activeList?.name ?? ''}"
                </h3>
                <p className="text-sm text-gray-500 max-w-md mb-6 leading-relaxed">
                  Hãy khám phá ngay những sản phẩm mới nhất của Freso và thêm ngay vào danh sách yêu thích nhé!
                </p>
                <button
                  type="button"
                  onClick={() => (window.location.href = reactHomePath)}
                  className="rounded-full bg-[#0f8a49] hover:bg-[#0c703b] px-8 py-3 text-sm font-bold text-white transition-all shadow-md shadow-green-600/10 active:scale-95"
                >
                  Khám phá ngay
                </button>
              </div>
            )}

            {!isLoadingItems && items.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative overflow-hidden rounded-xl bg-gray-50">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-rose-500 shadow-sm hover:bg-rose-50"
                        aria-label={`Xóa ${item.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="mt-3 space-y-1">
                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{item.name}</h3>
                      <p className="text-xs text-gray-500">{item.category}</p>
                      <p className="text-base font-bold text-green-700">{toCurrencyTextFromNumber(item.price)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddToCart(item)}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                    >
                      <ShoppingCart className="size-4" />
                      Thêm vào giỏ hàng
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900">Tạo danh sách yêu thích mới</h3>
            <p className="mt-2 text-sm text-gray-500">Nhập tên danh sách bạn muốn tạo.</p>
            <input
              value={newListName}
              onChange={(event) => {
                setNewListName(event.target.value);
                if (createError) setCreateError('');
              }}
              placeholder="Ví dụ: Rau, Hoa quả"
              className="mt-4 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-500"
            />
            {createError && <p className="mt-2 text-xs text-red-500">{createError}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setNewListName('');
                  setCreateError('');
                }}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateList}
                disabled={!newListName.trim()}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                  newListName.trim() ? 'bg-green-600 hover:bg-green-700' : 'bg-[#C7DCD1]'
                }`}
              >
                Tạo mới
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[130] rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
