import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Heart, X } from 'lucide-react';
import {
  addWishlistItem,
  createWishlistList,
  getWishlistLists,
  hasWishlistAuth,
  WishlistItem,
  WishlistList
} from '../utils/wishlistApi';

export type WishlistModalProduct = {
  sku: string;
  name: string;
  priceText: string;
  priceValue: number;
  unit: string;
  image: string;
  category: string;
};

type WishlistAddModalProps = {
  isOpen: boolean;
  product: WishlistModalProduct | null;
  onClose: () => void;
  onAdded?: (item: WishlistItem, listId: string) => void;
  loginRedirectUrl?: string;
};

export function WishlistAddModal({
  isOpen,
  product,
  onClose,
  onAdded,
  loginRedirectUrl = '/react/index.html?view=login'
}: WishlistAddModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [lists, setLists] = useState<WishlistList[]>([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [newListName, setNewListName] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      requestAnimationFrame(() => setIsVisible(true));
    } else if (isMounted) {
      setIsVisible(false);
      const timer = window.setTimeout(() => setIsMounted(false), 200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isOpen, isMounted]);

  useEffect(() => {
    if (!isOpen || !product) return;

    if (!hasWishlistAuth()) {
      window.location.href = loginRedirectUrl;
      return;
    }

    setIsLoading(true);
    getWishlistLists()
      .then((data) => {
        setLists(data);
        setSelectedListId('');
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, product, loginRedirectUrl]);

  const formattedPrice = useMemo(() => product?.priceText ?? '', [product?.priceText]);

  const handleClose = () => {
    setIsVisible(false);
    window.setTimeout(onClose, 200);
  };

  const handleSelectList = async (listId: string) => {
    if (!product) return;
    if (!product.sku) return;

    setSelectedListId(listId);
    const item = await addWishlistItem({
      listId,
      sku: product.sku,
      name: product.name,
      price: product.priceValue,
      unit: product.unit,
      image: product.image,
      category: product.category
    });
    onAdded?.(item, listId);
    handleClose();
  };

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) {
      setError(true);
      setErrorMessage('Vui lòng nhập tên danh sách yêu thích mới');
      return;
    }
    try {
      setIsLoading(true);
      const list = await createWishlistList(name);
      setLists((prev) => [list, ...prev]);
      setNewListName('');
      setError(false);
      setErrorMessage('');
      await handleSelectList(list.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tạo danh sách.';
      setError(true);
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted || !product) return null;

  return (
    <div
      className={`fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4 transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl transition-transform duration-200 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-xl font-bold text-gray-900">Thêm vào sản phẩm yêu thích</h3>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
          <img src={product.image} alt={product.name} className="h-16 w-16 rounded-xl object-cover" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{product.name}</p>
            <p className="text-sm text-green-700 font-semibold">{formattedPrice}</p>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="text-base font-semibold text-gray-900">Chọn danh sách</h4>
          <div className="mt-3 space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (
              lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => handleSelectList(list.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                    list.id === selectedListId
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-600">
                      <Heart className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{list.name}</p>
                      <p className="text-xs text-gray-500">{list.itemCount} sản phẩm</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="mt-6">
          <h4 className="text-base font-semibold text-gray-900">Tạo danh sách mới</h4>
          <div className="mt-3">
            <input
              value={newListName}
              onChange={(event) => {
                setNewListName(event.target.value);
                if (error) setError(false);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder="Vui lòng nhập tên danh sách yêu thích mới"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors ${
                error ? 'border-red-500' : 'border-gray-200 focus:border-green-500'
              }`}
            />
            {error && (
              <div className="mt-2 flex items-center gap-2 text-xs text-red-500">
                <AlertTriangle className="size-4" />
                {errorMessage || 'Vui lòng nhập tên danh sách yêu thích mới'}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleCreateList}
            disabled={!newListName.trim()}
            className={`mt-4 w-full rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
              newListName.trim()
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-[#C7DCD1] text-white'
            }`}
          >
            Tạo mới
          </button>
        </div>
      </div>
    </div>
  );
}
