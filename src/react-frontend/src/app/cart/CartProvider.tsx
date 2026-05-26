import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { CheckCircle2, Minus, Plus, X } from 'lucide-react';

export type AddToCartProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  priceText: string;
  unit: string;
  unitPrice: number;
  image: string;
};

export type CartLineItem = {
  id: string;
  cartItemId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  image: string;
  priceText: string;
  quantity: number;
  selected: boolean;
  note: string;
};

type CartContextValue = {
  cartItems: CartLineItem[];
  cartItemCount: number;
  openAddToCartModal: (product: AddToCartProduct, sourceImageElement?: Element | null) => void;
  quickAddToCart: (product: AddToCartProduct, quantity: number, sourceImageElement?: Element | null) => Promise<void>;
  setCartItemQuantity: (itemId: string, quantity: number) => void;
  setCartItemSelected: (itemId: string, selected: boolean) => void;
  setCartItemNote: (itemId: string, note: string) => void;
  removeCartItem: (itemId: string) => void;
  toggleAllCartItems: (selected: boolean) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const formatCurrency = (value: number) => `${new Intl.NumberFormat('vi-VN').format(Math.round(value))}đ`;

const clampQuantity = (value: number) => Math.max(1, Math.floor(value));

function parseNumberFromText(value: string): number {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number.parseInt(digits, 10) : 0;
}

export function CartProvider({ children }: PropsWithChildren) {
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [modalProduct, setModalProduct] = useState<AddToCartProduct | null>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [toastMessage, setToastMessage] = useState('');
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const toastTimerRef = useRef<number | null>(null);
  const modalImageRef = useRef<HTMLImageElement | null>(null);
  const sourceRectRef = useRef<DOMRect | null>(null);

  const cartItemCount = useMemo(() => cartItems.length, [cartItems]);

  const runFlyToCartAnimation = useCallback((imageUrl: string) => {
    document.querySelectorAll('img[alt="flying-product"]').forEach((node) => node.remove());
    const cartTarget = document.getElementById('header-cart-icon');
    const sourceRect = sourceRectRef.current ?? modalImageRef.current?.getBoundingClientRect() ?? null;

    if (!cartTarget || !sourceRect) {
      return Promise.resolve();
    }

    const targetRect = cartTarget.getBoundingClientRect();
    const flyNode = document.createElement('img');
    flyNode.src = imageUrl;
    flyNode.alt = 'flying-product';
    flyNode.style.position = 'fixed';
    flyNode.style.zIndex = '9999';
    flyNode.style.pointerEvents = 'none';
    flyNode.style.borderRadius = '14px';
    flyNode.style.objectFit = 'cover';
    flyNode.style.left = `${sourceRect.left}px`;
    flyNode.style.top = `${sourceRect.top}px`;
    flyNode.style.width = `${sourceRect.width}px`;
    flyNode.style.height = `${sourceRect.height}px`;
    flyNode.style.opacity = '0.95';
    flyNode.style.willChange = 'transform, opacity';

    document.body.appendChild(flyNode);

    window.setTimeout(() => {
      flyNode.remove();
      sourceRectRef.current = null;
    }, 1200);

    const deltaX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
    const deltaY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);
    const scale = Math.max(0.2, targetRect.width / Math.max(sourceRect.width, 1));
    const midX = deltaX * 0.55;
    const midY = deltaY * 0.55 - 90;

    cartTarget.animate(
      [
        { transform: 'scale(1) rotate(0deg)' },
        { transform: 'scale(1.1) rotate(-7deg)' },
        { transform: 'scale(0.96) rotate(7deg)' },
        { transform: 'scale(1) rotate(0deg)' }
      ],
      {
        duration: 260,
        easing: 'ease-in-out'
      }
    );

    const cleanup = (resolve: () => void) => {
      flyNode.remove();
      sourceRectRef.current = null;
      resolve();
    };

    return new Promise<void>((resolve) => {
      let fallbackTimer: number | null = null;

      const finish = () => {
        if (fallbackTimer) {
          window.clearTimeout(fallbackTimer);
        }
        cleanup(resolve);
      };

      fallbackTimer = window.setTimeout(() => {
        cleanup(resolve);
      }, 900);

      if (typeof flyNode.animate !== 'function') {
        return;
      }

      const animation = flyNode.animate(
        [
          { transform: 'translate(0px, 0px) scale(1)', opacity: 0.95 },
          { transform: `translate(${midX}px, ${midY}px) scale(0.72)`, opacity: 0.9, offset: 0.55 },
          { transform: `translate(${deltaX}px, ${deltaY}px) scale(${scale})`, opacity: 0.12 }
        ],
        {
          duration: 650,
          easing: 'cubic-bezier(0.42, 0, 0.2, 1)',
          fill: 'forwards'
        }
      );

      animation.onfinish = finish;
      animation.oncancel = finish;
    });
  }, []);

  const isAuthenticated = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.localStorage.getItem('freso_customer_token') ||
        window.sessionStorage.getItem('freso_customer_token')
    );
  }, []);

  const getAuthToken = useCallback(() => {
    if (typeof window === 'undefined') return '';
    return (
      window.localStorage.getItem('freso_customer_token') ||
      window.sessionStorage.getItem('freso_customer_token') ||
      ''
    );
  }, []);

  const graphqlRequest = useCallback(
    async (query: string, variables?: Record<string, unknown>) => {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Chưa đăng nhập.');
      }

      const response = await fetch('/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => '');
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText} ${responseText}`);
      }

      const json = await response.json();
      if (json?.errors?.length) {
        throw new Error(json.errors[0]?.message ?? 'GraphQL error');
      }

      return json?.data;
    },
    [getAuthToken]
  );

  const getCustomerCartId = useCallback(async () => {
    const token = getAuthToken();
    const cached = window.localStorage.getItem('freso_customer_cart_id');
    const cachedToken = window.localStorage.getItem('freso_customer_cart_token');
    if (cached && token && cachedToken === token) {
      return cached;
    }
    if (cached && (!token || cachedToken !== token)) {
      window.localStorage.removeItem('freso_customer_cart_id');
      window.localStorage.removeItem('freso_customer_cart_token');
    }

    const data = await graphqlRequest(`query CustomerCart { customerCart { id } }`);
    const cartId = data?.customerCart?.id;
    if (!cartId) {
      throw new Error('Không lấy được mã giỏ hàng.');
    }

    window.localStorage.setItem('freso_customer_cart_id', cartId);
    if (token) {
      window.localStorage.setItem('freso_customer_cart_token', token);
    }
    return cartId;
  }, [getAuthToken, graphqlRequest]);

  type MagentoCartItem = {
    id: number | string;
    quantity?: number;
    product?: {
      sku?: string | null;
      name?: string | null;
      categories?: Array<{ name?: string | null }> | null;
      small_image?: { url?: string | null } | null;
      thumbnail?: { url?: string | null } | null;
      price_range?: {
        minimum_price?: {
          final_price?: { value?: number | null } | null;
        } | null;
      } | null;
    } | null;
  };

  const mapMagentoCartItems = useCallback((items: MagentoCartItem[] = []): CartLineItem[] => {
    return items.map((item) => {
      const product = item.product ?? {};
      const unitPrice = Number(product.price_range?.minimum_price?.final_price?.value ?? 0);
      const category = product.categories?.find((cat) => cat?.name)?.name ?? '';

      return {
        id: String(item.id),
        cartItemId: String(item.id),
        sku: product.sku ?? '',
        name: product.name ?? 'Sản phẩm',
        category,
        unit: 'SP',
        unitPrice,
        image: product.small_image?.url || product.thumbnail?.url || '',
        priceText: formatCurrency(unitPrice),
        quantity: clampQuantity(item.quantity ?? 1),
        selected: true,
        note: '',
      };
    });
  }, []);

  const loadCustomerCart = useCallback(async () => {
    if (!isAuthenticated()) {
      setCartItems([]);
      return;
    }

    const data = await graphqlRequest(`
      query CustomerCartItems {
        customerCart {
          id
          items {
            id
            quantity
            product {
              sku
              name
              categories { name }
              small_image { url }
              thumbnail { url }
              price_range { minimum_price { final_price { value } } }
            }
          }
        }
      }
    `);

    const items: MagentoCartItem[] = data?.customerCart?.items ?? [];
    const cartId = data?.customerCart?.id;
    if (cartId) {
      window.localStorage.setItem('freso_customer_cart_id', cartId);
    }
    setCartItems(mapMagentoCartItems(items));
  }, [graphqlRequest, isAuthenticated, mapMagentoCartItems]);

  useEffect(() => {
    loadCustomerCart().catch(() => {
      // ignore initial load errors, toast will be handled on add/update actions
    });
  }, [loadCustomerCart]);

  const addProductToMagentoCart = useCallback(
    async (product: AddToCartProduct, quantity: number) => {
      const targetQuantity = clampQuantity(quantity);
      const normalizedSku = product.sku?.trim() ?? '';
      if (!normalizedSku) {
        throw new Error('Thiếu SKU để thêm vào giỏ hàng.');
      }

      const mutation = `
        mutation AddProductsToCart($cartId: String!, $items: [CartItemInput!]!) {
          addProductsToCart(cartId: $cartId, cartItems: $items) {
            cart {
              id
              items {
                id
                quantity
                product {
                  sku
                  name
                  categories { name }
                  small_image { url }
                  thumbnail { url }
                  price_range { minimum_price { final_price { value } } }
                }
              }
            }
          }
        }
      `;

  const cartItems = [{ sku: normalizedSku, quantity: targetQuantity }];

      try {
        const cartId = await getCustomerCartId();
        const data = await graphqlRequest(mutation, { cartId, items: cartItems });
        return data?.addProductsToCart?.cart?.items ?? [];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const normalized = message.toLowerCase();
        if (normalized.includes('authorization') || normalized.includes('current customer')) {
          window.localStorage.removeItem('freso_customer_cart_id');
          window.localStorage.removeItem('freso_customer_cart_token');
        }
        if (
          normalized.includes('could not find a cart') ||
          normalized.includes("cart isn't active") ||
          normalized.includes('current customer') ||
          normalized.includes('authorization') ||
          normalized.includes('cart')
        ) {
          window.localStorage.removeItem('freso_customer_cart_id');
          window.localStorage.removeItem('freso_customer_cart_token');
          const cartId = await getCustomerCartId();
          const data = await graphqlRequest(mutation, { cartId, items: cartItems });
          return data?.addProductsToCart?.cart?.items ?? [];
        }
        throw error;
      }
    },
    [getCustomerCartId, graphqlRequest]
  );

  const updateMagentoCartItemQuantity = useCallback(
    async (cartItemId: string, quantity: number) => {
      const cartId = await getCustomerCartId();
      const mutation = `
        mutation UpdateCartItems($cartId: String!, $items: [CartItemUpdateInput!]!) {
          updateCartItems(input: { cart_id: $cartId, cart_items: $items }) {
            cart {
              id
              items {
                id
                quantity
                product {
                  sku
                  name
                  categories { name }
                  small_image { url }
                  thumbnail { url }
                  price_range { minimum_price { final_price { value } } }
                }
              }
            }
          }
        }
      `;
      const data = await graphqlRequest(mutation, {
        cartId,
        items: [{ cart_item_id: Number(cartItemId), quantity: clampQuantity(quantity) }]
      });
      return data?.updateCartItems?.cart?.items ?? [];
    },
    [getCustomerCartId, graphqlRequest]
  );

  const removeMagentoCartItem = useCallback(
    async (cartItemId: string) => {
      const cartId = await getCustomerCartId();
      const mutation = `
        mutation RemoveItemFromCart($cartId: String!, $cartItemId: Int!) {
          removeItemFromCart(input: { cart_id: $cartId, cart_item_id: $cartItemId }) {
            cart {
              id
              items {
                id
                quantity
                product {
                  sku
                  name
                  categories { name }
                  small_image { url }
                  thumbnail { url }
                  price_range { minimum_price { final_price { value } } }
                }
              }
            }
          }
        }
      `;
      const data = await graphqlRequest(mutation, {
        cartId,
        cartItemId: Number(cartItemId)
      });
      return data?.removeItemFromCart?.cart?.items ?? [];
    },
    [getCustomerCartId, graphqlRequest]
  );

  const ensureAuthenticated = useCallback(() => {
    if (!isAuthenticated()) {
      setIsLoginPromptOpen(true);
      return false;
    }
    return true;
  }, [isAuthenticated]);

  const handleLoginRedirect = useCallback(() => {
    setIsLoginPromptOpen(false);
    window.location.href = '/react/index.html?view=login';
  }, []);

  const openAddToCartModal = useCallback((product: AddToCartProduct, sourceImageElement?: Element | null) => {
    if (!ensureAuthenticated()) {
      return;
    }
    sourceRectRef.current = sourceImageElement?.getBoundingClientRect() ?? null;
    setModalProduct(product);
    setModalQuantity(1);
  }, [ensureAuthenticated]);

  const closeModal = useCallback(() => {
    setModalProduct(null);
    setModalQuantity(1);
  }, []);

  const addToCart = useCallback((product: AddToCartProduct, quantity: number) => {
    setCartItems((prev) => {
      const targetQuantity = clampQuantity(quantity);
      const existing = prev.find((item) => item.id === product.id);

      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + targetQuantity } : item
        );
      }

      return [
        {
          id: product.id,
          cartItemId: '',
          sku: product.sku,
          name: product.name,
          category: product.category,
          unit: product.unit,
          unitPrice: product.unitPrice,
          image: product.image,
          priceText: product.priceText,
          quantity: targetQuantity,
          selected: true,
          note: '',
        },
        ...prev,
      ];
    });
  }, []);

  const confirmAddToCart = useCallback(async () => {
    if (!ensureAuthenticated()) {
      return;
    }
    if (!modalProduct) {
      return;
    }

    const quantity = clampQuantity(modalQuantity);
    const selectedProduct = modalProduct;

    closeModal();
    try {
      const items = await addProductToMagentoCart(selectedProduct, quantity);
      setCartItems(mapMagentoCartItems(items));
      await runFlyToCartAnimation(selectedProduct.image);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setToastMessage('Không thể thêm sản phẩm vào giỏ hàng. Vui lòng thử lại.');
      if (message.toLowerCase().includes('authorization') || message.toLowerCase().includes('current customer')) {
        setIsLoginPromptOpen(true);
      }
      toastTimerRef.current = window.setTimeout(() => setToastMessage(''), 2400);
      return;
    }

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToastMessage(`Đã thêm vào giỏ hàng`);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage('');
    }, 2400);
  }, [addProductToMagentoCart, closeModal, ensureAuthenticated, mapMagentoCartItems, modalProduct, modalQuantity, runFlyToCartAnimation]);

  const quickAddToCart = useCallback(
    async (product: AddToCartProduct, quantity: number, sourceImageElement?: Element | null) => {
      if (!ensureAuthenticated()) {
        return;
      }
      sourceRectRef.current = sourceImageElement?.getBoundingClientRect() ?? null;
      const targetQuantity = clampQuantity(quantity);

      try {
        const items = await addProductToMagentoCart(product, targetQuantity);
        setCartItems(mapMagentoCartItems(items));
        await runFlyToCartAnimation(product.image);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setToastMessage('Không thể thêm sản phẩm vào giỏ hàng. Vui lòng thử lại.');
        if (message.toLowerCase().includes('authorization') || message.toLowerCase().includes('current customer')) {
          setIsLoginPromptOpen(true);
        }
        toastTimerRef.current = window.setTimeout(() => setToastMessage(''), 2400);
        return;
      }

      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }

      setToastMessage('Đã thêm sản phẩm vào giỏ hàng');
      toastTimerRef.current = window.setTimeout(() => {
        setToastMessage('');
      }, 2400);
    },
    [addProductToMagentoCart, ensureAuthenticated, mapMagentoCartItems, runFlyToCartAnimation]
  );

  const setCartItemQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (!ensureAuthenticated()) {
      return;
    }

    try {
      const items = await updateMagentoCartItemQuantity(itemId, quantity);
      setCartItems(mapMagentoCartItems(items));
    } catch (_error) {
      setToastMessage('Không thể cập nhật số lượng. Vui lòng thử lại.');
      toastTimerRef.current = window.setTimeout(() => setToastMessage(''), 2400);
    }
  }, [ensureAuthenticated, mapMagentoCartItems, updateMagentoCartItemQuantity]);

  const setCartItemSelected = useCallback((itemId: string, selected: boolean) => {
    setCartItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, selected } : item)));
  }, []);

  const setCartItemNote = useCallback((itemId: string, note: string) => {
    setCartItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, note } : item)));
  }, []);

  const removeCartItem = useCallback(async (itemId: string) => {
    if (!ensureAuthenticated()) {
      return;
    }

    try {
      const items = await removeMagentoCartItem(itemId);
      setCartItems(mapMagentoCartItems(items));
    } catch (_error) {
      setToastMessage('Không thể xóa sản phẩm. Vui lòng thử lại.');
      toastTimerRef.current = window.setTimeout(() => setToastMessage(''), 2400);
    }
  }, [ensureAuthenticated, mapMagentoCartItems, removeMagentoCartItem]);

  const toggleAllCartItems = useCallback((selected: boolean) => {
    setCartItems((prev) => prev.map((item) => ({ ...item, selected })));
  }, []);

  const contextValue = useMemo<CartContextValue>(
    () => ({
      cartItems,
      cartItemCount,
      openAddToCartModal,
      quickAddToCart,
      setCartItemQuantity,
      setCartItemSelected,
      setCartItemNote,
      removeCartItem,
      toggleAllCartItems,
    }),
    [
      cartItems,
      cartItemCount,
      openAddToCartModal,
      quickAddToCart,
      removeCartItem,
      setCartItemNote,
      setCartItemQuantity,
      setCartItemSelected,
      toggleAllCartItems,
    ]
  );

  return (
    <CartContext.Provider value={contextValue}>
      {children}

      {isLoginPromptOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-gray-800 shadow-2xl">
            <h3 className="text-lg font-semibold">Yêu cầu đăng nhập</h3>
            <p className="mt-2 text-sm text-gray-600">Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.</p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsLoginPromptOpen(false)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleLoginRedirect}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Đăng nhập
              </button>
            </div>
          </div>
        </div>
      )}

      {modalProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Thêm vào giỏ hàng</h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Đóng popup"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <img
                ref={modalImageRef}
                src={modalProduct.image}
                alt={modalProduct.name}
                className="h-36 w-full rounded-xl object-cover"
              />

              <div className="space-y-2 text-sm">
                <h3 className="text-base font-semibold text-gray-900">{modalProduct.name}</h3>
                <p className="text-gray-500">Danh mục: {modalProduct.category}</p>
                <p className="font-semibold text-red-500">{modalProduct.priceText}</p>
                <p className="text-gray-500">Đơn vị: {modalProduct.unit}</p>

                <div className="pt-2">
                  <p className="mb-2 text-sm font-medium text-gray-700">Số lượng</p>
                  <div className="inline-flex items-center rounded-xl border border-gray-300">
                    <button
                      type="button"
                      onClick={() => setModalQuantity((prev) => Math.max(1, prev - 1))}
                      className="px-3 py-2 text-gray-500 hover:text-green-700"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="min-w-14 border-x border-gray-200 px-2 text-center text-sm font-semibold text-gray-800">
                      {modalQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setModalQuantity((prev) => prev + 1)}
                      className="px-3 py-2 text-gray-500 hover:text-green-700"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmAddToCart}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Thêm vào giỏ hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[110] flex items-center gap-2 rounded-xl bg-gray-900/95 px-4 py-3 text-sm text-white shadow-xl">
          <CheckCircle2 className="size-4 text-green-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }

  return context;
}

export function toCurrencyTextFromNumber(value: number) {
  return formatCurrency(value);
}

export function toCurrencyTextFromLooseValue(value: string | number) {
  if (typeof value === 'number') {
    return formatCurrency(value);
  }

  const parsed = parseNumberFromText(value);
  return parsed > 0 ? formatCurrency(parsed) : value;
}

export function toUnitPriceFromLooseValue(value: string | number) {
  if (typeof value === 'number') {
    return value;
  }

  return parseNumberFromText(value);
}
