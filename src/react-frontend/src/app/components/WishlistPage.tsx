import { useEffect, useMemo, useState } from 'react';
import { Heart, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { toCurrencyTextFromNumber, toUnitPriceFromLooseValue, useCart } from '../cart/CartProvider';
import { getWishlistItems, getWishlistLists, removeWishlistItem } from '../utils/wishlistApi';

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

type WishlistListResponse = {
  id: string | number;
  name: string;
  item_count?: number;
  itemCount?: number;
};

type WishlistItemResponse = {
  id: string | number;
  list_id?: string | number;
  sku?: string;
  name?: string;
  price?: number;
  unit?: string;
  image?: string;
  category?: string;
};

async function wishlistRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText} ${text}`);
  }

  return response.json() as Promise<T>;
}

export function WishlistPage() {
  const { quickAddToCart } = useCart();
  const [lists, setLists] = useState<WishlistList[]>([]);
  const [activeListId, setActiveListId] = useState<string>('');
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [itemsByList, setItemsByList] = useState<Record<string, WishlistItem[]>>({});
  const [isLoadingLists, setIsLoadingLists] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newListName, setNewListName] = useState('');

  useEffect(() => {
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
        setActiveListId((prev) => prev || normalized[0]?.id || '');
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
        setItems(mapped);
        setItemsByList((prev) => ({ ...prev, [activeListId]: mapped }));
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
    if (!name) return;

    try {
      const data = await wishlistRequest<WishlistListResponse>('/rest/V1/tmdt/wishlist', {
        method: 'POST',
        body: JSON.stringify({ name })
      });
      const newList = {
        id: String(data.id),
        name: data.name,
        itemCount: data.itemCount ?? data.item_count ?? 0
      };
      setLists((prev) => [newList, ...prev]);
      setActiveListId(newList.id);
      setItemsByList((prev) => ({ ...prev, [newList.id]: [] }));
      setIsCreateOpen(false);
      setNewListName('');
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
                lists.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => setActiveListId(list.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors ${
                      list.id === activeListId
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50/70'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Heart className="size-4" />
                      {list.name}
                    </span>
                    <span className="text-xs text-gray-500">{list.itemCount}</span>
                  </button>
                ))
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
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">{activeList?.name ?? 'Danh sách'}</h2>
            </div>

            {isLoadingItems && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-60 rounded-2xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            )}

            {isEmpty && (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-50 text-green-600">
                  <Heart className="size-8" />
                </div>
                <p className="text-base font-semibold text-gray-700">
                  Bạn chưa có sản phẩm yêu thích nào trong danh sách '{activeList?.name ?? ''}'
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  Hãy khám phá ngay những sản phẩm mới nhất và thêm vào danh sách yêu thích nhé!
                </p>
                <button
                  type="button"
                  onClick={() => (window.location.href = reactHomePath)}
                  className="mt-5 rounded-full bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700"
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
              onChange={(event) => setNewListName(event.target.value)}
              placeholder="Ví dụ: Rau, Hoa quả"
              className="mt-4 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-500"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setNewListName('');
                }}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateList}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
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
