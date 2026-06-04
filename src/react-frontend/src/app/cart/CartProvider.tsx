import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { CheckCircle2, Minus, Plus, X } from 'lucide-react';
import { clearStoredAuthSession } from '../utils/authSession';
import { getMockSupplierForProduct } from '../data/mockSuppliers';

export type AddToCartProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  priceText: string;
  unit: string;
  unitPrice: number;
  image: string;
  supplierName?: string;
  supplierRegion?: string;
  supplierLabel?: string;
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
  supplierName?: string;
  supplierRegion?: string;
};

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

const formatCurrency = (value: number) => {
  if (typeof window === 'undefined') {
    return `${new Intl.NumberFormat('vi-VN').format(Math.round(value))}đ`;
  }
  const target = window.localStorage.getItem('freso_selected_currency') || 'VND';
  if (target === 'VND') {
    return `${new Intl.NumberFormat('vi-VN').format(Math.round(value))}đ`;
  }

  const ratesRaw = window.localStorage.getItem('freso_currency_rates');
  let rates: any = null;
  if (ratesRaw) {
    try {
      rates = JSON.parse(ratesRaw);
    } catch {
      rates = null;
    }
  }

  if (rates && rates[target]) {
    const rateInfo = rates[target];
    const rate = rateInfo.sell || rateInfo.transfer || 1;
    const converted = rate > 0 ? value / rate : value;
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: target,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(converted);
    } catch {
      return `${new Intl.NumberFormat('en-US').format(converted)} ${target}`;
    }
  }

  return `${new Intl.NumberFormat('vi-VN').format(Math.round(value))}đ`;
};

const clampQuantity = (value: number) => Math.max(1, Math.floor(value));

const authSessionErrorMarkers = [
  'consumer key has expired',
  'token has expired',
  'invalid token',
  'the current customer',
  'current customer',
  'authorization',
  'unauthorized',
  'khong hop le hoac da het han',
  'không hợp lệ hoặc đã hết hạn',
];

const isAuthSessionError = (message: string) => {
  const normalized = message.toLowerCase();
  return authSessionErrorMarkers.some((marker) => normalized.includes(marker));
};

const fallbackImageByCategory: Record<string, string> = {
  'Rau củ quả': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&h=500&fit=crop',
  'Trái cây': 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=500&h=500&fit=crop',
  'Thực phẩm tươi sống': 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=500&h=500&fit=crop',
  'Thuỷ hải sản': 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=500&h=500&fit=crop',
  'Thực phẩm đông lạnh': 'https://images.unsplash.com/photo-1481070414801-51fd732d7184?w=500&h=500&fit=crop',
  'Thực phẩm khô': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&h=500&fit=crop',
  'Tiện ích bếp': 'https://images.unsplash.com/photo-1584990347449-a1e229ee8b29?w=500&h=500&fit=crop'
};

const clearCustomerAuthSession = () => {
  if (typeof window === 'undefined') {
    return;
  }

  clearStoredAuthSession();
};

let activeCustomerCartIdRequest: Promise<string> | null = null;
let activeCustomerCartItemsRequest: Promise<MagentoCartItem[]> | null = null;
let activeAddToCartRequest: Promise<MagentoCartItem[]> | null = null;
const cartSupplierMapStorageKey = 'freso_cart_supplier_map';

function parseNumberFromText(value: string): number {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number.parseInt(digits, 10) : 0;
}

const parseSupplierLabel = (label?: string) => {
  const parts = String(label || '')
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    supplierName: parts[0] || '',
    supplierRegion: parts.slice(1).join(' · ')
  };
};

const getSupplierForCartProduct = (product: Pick<AddToCartProduct, 'sku' | 'category'> & Partial<AddToCartProduct>) => {
  const fromLabel = parseSupplierLabel(product.supplierLabel);
  const fallback = getMockSupplierForProduct(product.sku, product.category);
  const productSupplierName = product.supplierName || fromLabel.supplierName;
  const productSupplierRegion = product.supplierRegion || fromLabel.supplierRegion;
  const shouldUseFallbackSupplier =
    fallback.name === 'Tổng công ty Chăn nuôi CP Việt Nam' &&
    (!productSupplierName ||
      productSupplierName === 'Tổng kho sỉ Thực phẩm B2B' ||
      productSupplierName === 'Tổng công ty Chăn nuôi CP Việt Nam');

  return {
    supplierName: shouldUseFallbackSupplier ? fallback.name : productSupplierName || fallback.name,
    supplierRegion: shouldUseFallbackSupplier ? fallback.region : productSupplierRegion || fallback.region
  };
};

const readStoredSupplierMap = (): Record<string, { supplierName?: string; supplierRegion?: string }> => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(cartSupplierMapStorageKey) || '{}');
  } catch {
    return {};
  }
};

const storeSupplierForProduct = (product: AddToCartProduct) => {
  if (typeof window === 'undefined') {
    return;
  }

  const sku = (product.sku ?? '').trim().toLowerCase();
  if (!sku) {
    return;
  }

  const supplier = getSupplierForCartProduct(product);
  try {
    window.localStorage.setItem(
      cartSupplierMapStorageKey,
      JSON.stringify({
        ...readStoredSupplierMap(),
        [sku]: supplier
      })
    );
  } catch {
    // ignore storage errors
  }
};

export const formatCartSupplierLabel = (item: Pick<CartLineItem, 'sku' | 'category'> & Partial<CartLineItem>) => {
  const fallback = getMockSupplierForProduct(item.sku, item.category);
  const shouldUseFallbackSupplier =
    fallback.name === 'Tổng công ty Chăn nuôi CP Việt Nam' &&
    (!item.supplierName ||
      item.supplierName === 'Tổng kho sỉ Thực phẩm B2B' ||
      item.supplierName === 'Tổng công ty Chăn nuôi CP Việt Nam');
  const supplierName = shouldUseFallbackSupplier ? fallback.name : item.supplierName || fallback.name;
  const supplierRegion = shouldUseFallbackSupplier ? fallback.region : item.supplierRegion || fallback.region;

  return [supplierName, supplierRegion].filter(Boolean).join(' · ');
};

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
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => '');
        if (response.status === 401 || response.status === 403 || isAuthSessionError(responseText)) {
          clearCustomerAuthSession();
          throw new Error('Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
        }
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText} ${responseText}`);
      }

      const json = await response.json();
      if (json?.errors?.length) {
        const message = json.errors.map((error: { message?: string }) => error?.message ?? '').join(' ');
        if (isAuthSessionError(message)) {
          clearCustomerAuthSession();
          throw new Error('Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
        }
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

    if (!activeCustomerCartIdRequest) {
      activeCustomerCartIdRequest = (async () => {
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
      })().finally(() => {
        activeCustomerCartIdRequest = null;
      });
    }

    return activeCustomerCartIdRequest;
  }, [getAuthToken, graphqlRequest]);

  const mapMagentoCartItems = useCallback((items: MagentoCartItem[] = []): CartLineItem[] => {
    const customLocalRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_custom_products') : null;
    const storedSupplierMap = readStoredSupplierMap();
    let customLocalProducts: any[] = [];
    if (customLocalRaw) {
      try {
        customLocalProducts = JSON.parse(customLocalRaw);
      } catch (e) {
        customLocalProducts = [];
      }
    }

    return items.map((item) => {
      const product = item.product ?? {};
      const qty = clampQuantity(item.quantity ?? 1);
      const productSku = (product.sku ?? '').trim().toLowerCase();
      const matchingProduct = customLocalProducts.find(
        (p) => (p.sku ?? '').trim().toLowerCase() === productSku
      );

      const originalPrice = matchingProduct
        ? Number(matchingProduct.price)
        : Number(product.price_range?.minimum_price?.final_price?.value ?? 0);
      const tiers = matchingProduct?.wholesale_tiers || [];
      const activeTier = tiers
        .filter((t: any) => qty >= t.qty)
        .sort((a: any, b: any) => b.qty - a.qty)[0];

      const discountPercent = activeTier ? activeTier.discount : 0;
      const unitPrice = originalPrice * (1 - discountPercent / 100);
      const category =
        product.categories?.find((cat) => cat?.name)?.name ??
        (matchingProduct?.categoryLabel || '');
      const unit = matchingProduct?.unit || 'kg';
      const supplier = getSupplierForCartProduct({
        sku: product.sku ?? matchingProduct?.sku ?? '',
        category,
        supplierName: storedSupplierMap[productSku]?.supplierName,
        supplierRegion: storedSupplierMap[productSku]?.supplierRegion,
        supplierLabel: matchingProduct?.store_name
      });

      // Prioritise seller-uploaded image; only use Magento image if it's not a placeholder
      const rawImage = product.small_image?.url || product.thumbnail?.url || '';
      const fallbackImage = fallbackImageByCategory[category] || 'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop';
      const finalImage =
        matchingProduct?.image ||
        (!rawImage || rawImage.toLowerCase().includes('placeholder')
          ? fallbackImage
          : rawImage);

      return {
        id: String(item.id),
        cartItemId: String(item.id),
        sku: product.sku ?? '',
        name: product.name ?? (matchingProduct?.name || 'Sản phẩm'),
        category,
        unit,
        unitPrice,
        image: finalImage,
        priceText: formatCurrency(unitPrice),
        quantity: qty,
        selected: true,
        note: '',
        supplierName: supplier.supplierName,
        supplierRegion: supplier.supplierRegion,
      };
    });
  }, []);

  const mergeMagentoAndLocalCart = useCallback((mappedMagento: CartLineItem[]): CartLineItem[] => {
    const customLocalRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_custom_products') : null;
    let customLocalProducts: any[] = [];
    if (customLocalRaw) {
      try {
        customLocalProducts = JSON.parse(customLocalRaw);
      } catch {
        customLocalProducts = [];
      }
    }

    const localCartRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_local_cart_items') : null;
    let localCartItems: CartLineItem[] = [];
    if (localCartRaw) {
      try {
        localCartItems = JSON.parse(localCartRaw);
      } catch {
        localCartItems = [];
      }
    }

    const enrichedLocalItems = localCartItems.map((item) => {
      const localSku = (item.sku ?? '').trim().toLowerCase();
      const match = customLocalProducts.find(
        (p) => (p.sku ?? '').trim().toLowerCase() === localSku
      );
      return {
        ...item,
        image: match?.image || item.image,
        unitPrice: match ? Number(match.price) : item.unitPrice,
        unit: match?.unit || item.unit,
        ...getSupplierForCartProduct({
          sku: item.sku,
          category: item.category,
          supplierName: item.supplierName,
          supplierRegion: item.supplierRegion,
          supplierLabel: match?.store_name
        }),
      };
    });

    const magentoSkus = new Set(mappedMagento.map((i) => (i.sku ?? '').trim().toLowerCase()));
    const localOnly = enrichedLocalItems.filter(
      (i) => !magentoSkus.has((i.sku ?? '').trim().toLowerCase())
    );

    return [...mappedMagento, ...localOnly];
  }, []);

  const loadCustomerCart = useCallback(async () => {
    if (!isAuthenticated()) {
      setCartItems([]);
      return;
    }

    if (!activeCustomerCartItemsRequest) {
      activeCustomerCartItemsRequest = (async () => {
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

        return items;
      })().finally(() => {
        activeCustomerCartItemsRequest = null;
      });
    }

    const magentoItems = await activeCustomerCartItemsRequest;
    const mappedMagento = mapMagentoCartItems(magentoItems);

    setCartItems(mergeMagentoAndLocalCart(mappedMagento));
  }, [graphqlRequest, isAuthenticated, mapMagentoCartItems, mergeMagentoAndLocalCart]);


  useEffect(() => {
    loadCustomerCart().catch(() => {
      // ignore initial load errors, toast will be handled on add/update actions
    });
  }, [loadCustomerCart]);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const response = await fetch('/rest/V1/tmdt-catalog/rates');
        const rawData = await response.json();
        const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        if (data && data.success && data.rates) {
          window.localStorage.setItem('freso_currency_rates', JSON.stringify(data.rates));
          window.dispatchEvent(new CustomEvent('freso:rates-loaded'));
        }
      } catch (err) {
        console.error('Failed to fetch currency rates:', err);
      }
    };

    fetchRates();
  }, []);

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
      const performAddToCart = async () => {
        const cartId = await getCustomerCartId();
        const data = await graphqlRequest(mutation, { cartId, items: cartItems });
        return data?.addProductsToCart?.cart?.items ?? [];
      };

      try {
        if (!activeAddToCartRequest) {
          activeAddToCartRequest = performAddToCart().finally(() => {
            activeAddToCartRequest = null;
          });
        }

        return await activeAddToCartRequest;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const normalized = message.toLowerCase();
        if (isAuthSessionError(message)) {
          clearCustomerAuthSession();
          throw error;
        }
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
          activeAddToCartRequest = performAddToCart().finally(() => {
            activeAddToCartRequest = null;
          });
          return await activeAddToCartRequest;
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
    storeSupplierForProduct(product);
    setCartItems((prev) => {
      const targetQuantity = clampQuantity(quantity);
      const productSku = (product.sku ?? '').trim().toLowerCase();
      const existing = prev.find((item) => (item.sku ?? '').trim().toLowerCase() === productSku);

      let next: CartLineItem[];
      if (existing) {
        const supplier = getSupplierForCartProduct(product);
        next = prev.map((item) =>
          (item.sku ?? '').trim().toLowerCase() === productSku
            ? {
                ...item,
                quantity: item.quantity + targetQuantity,
                supplierName: item.supplierName || supplier.supplierName,
                supplierRegion: item.supplierRegion || supplier.supplierRegion,
              }
            : item
        );
      } else {
        const supplier = getSupplierForCartProduct(product);
        const newItem: CartLineItem = {
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
          supplierName: supplier.supplierName,
          supplierRegion: supplier.supplierRegion,
        };
        next = [newItem, ...prev];
      }

      // Persist local (seller) cart items so they survive page refresh
      const localItems = next.filter((i) => !i.cartItemId);
      try {
        window.localStorage.setItem('freso_local_cart_items', JSON.stringify(localItems));
      } catch {
        // ignore storage errors
      }

      return next;
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
    storeSupplierForProduct(selectedProduct);

    closeModal();
    try {
      const items = await addProductToMagentoCart(selectedProduct, quantity);
      if (items && items.length > 0) {
        // Magento returned real cart items – use them
        const mapped = mapMagentoCartItems(items);
        setCartItems(mergeMagentoAndLocalCart(mapped));
      } else {
        // Magento returned empty (custom/local product not in Magento catalog)
        // Fall back to adding directly into local cart state
        addToCart(selectedProduct, quantity);
      }
      await runFlyToCartAnimation(selectedProduct.image);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Even on Magento error, still add to local cart for custom seller products
      addToCart(selectedProduct, quantity);
      await runFlyToCartAnimation(selectedProduct.image);
      if (isAuthSessionError(message)) {
        setIsLoginPromptOpen(true);
      }
    }

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToastMessage(`Đã thêm vào giỏ hàng`);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage('');
    }, 2400);
  }, [addProductToMagentoCart, addToCart, closeModal, ensureAuthenticated, mapMagentoCartItems, mergeMagentoAndLocalCart, modalProduct, modalQuantity, runFlyToCartAnimation]);

  const quickAddToCart = useCallback(
    async (product: AddToCartProduct, quantity: number, sourceImageElement?: Element | null) => {
      if (!ensureAuthenticated()) {
        return;
      }
      sourceRectRef.current = sourceImageElement?.getBoundingClientRect() ?? null;
      const targetQuantity = clampQuantity(quantity);
      storeSupplierForProduct(product);

      try {
        const items = await addProductToMagentoCart(product, targetQuantity);
        if (items && items.length > 0) {
          // Magento returned real cart items – use them
          const mapped = mapMagentoCartItems(items);
          setCartItems(mergeMagentoAndLocalCart(mapped));
        } else {
          // Custom/local seller product not in Magento catalog – add to local cart state
          addToCart(product, targetQuantity);
        }
        await runFlyToCartAnimation(product.image);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Even on Magento error, still add to local cart for custom seller products
        addToCart(product, targetQuantity);
        await runFlyToCartAnimation(product.image);
        if (isAuthSessionError(message)) {
          setIsLoginPromptOpen(true);
        }
      }

      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }

      setToastMessage('Đã thêm sản phẩm vào giỏ hàng');
      toastTimerRef.current = window.setTimeout(() => {
        setToastMessage('');
      }, 2400);
    },
    [addProductToMagentoCart, addToCart, ensureAuthenticated, mapMagentoCartItems, mergeMagentoAndLocalCart, runFlyToCartAnimation]
  );

  const setCartItemQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (!ensureAuthenticated()) {
      return;
    }

    const targetItem = cartItems.find((i) => i.id === itemId);
    if (!targetItem) {
      return;
    }

    const targetQuantity = clampQuantity(quantity);

    if (!targetItem.cartItemId) {
      // Local-only item: update quantity in state and localStorage
      setCartItems((prev) => {
        const next = prev.map((item) =>
          item.id === itemId ? { ...item, quantity: targetQuantity } : item
        );
        const localItems = next.filter((i) => !i.cartItemId);
        try {
          window.localStorage.setItem('freso_local_cart_items', JSON.stringify(localItems));
        } catch {
          // ignore
        }
        return next;
      });
      return;
    }

    try {
      const items = await updateMagentoCartItemQuantity(itemId, targetQuantity);
      const mapped = mapMagentoCartItems(items);
      setCartItems(mergeMagentoAndLocalCart(mapped));
    } catch (_error) {
      setToastMessage('Không thể cập nhật số lượng. Vui lòng thử lại.');
      toastTimerRef.current = window.setTimeout(() => setToastMessage(''), 2400);
    }
  }, [cartItems, ensureAuthenticated, mapMagentoCartItems, mergeMagentoAndLocalCart, updateMagentoCartItemQuantity]);

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

    const targetItem = cartItems.find((i) => i.id === itemId);
    if (!targetItem) {
      return;
    }

    // Always remove from localStorage local items (by SKU or ID) to prevent syncing issues
    const targetSku = (targetItem.sku ?? '').trim().toLowerCase();
    const localCartRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_local_cart_items') : null;
    if (localCartRaw) {
      try {
        const localCartItems: CartLineItem[] = JSON.parse(localCartRaw);
        const updatedLocalItems = localCartItems.filter(
          (i) =>
            (i.sku ?? '').trim().toLowerCase() !== targetSku &&
            i.id !== itemId &&
            i.id !== targetItem.id
        );
        window.localStorage.setItem('freso_local_cart_items', JSON.stringify(updatedLocalItems));
      } catch {
        // ignore
      }
    }

    if (!targetItem.cartItemId) {
      // Local-only item: remove from state
      setCartItems((prev) => prev.filter((i) => i.id !== itemId));
      return;
    }

    try {
      const items = await removeMagentoCartItem(itemId);
      const mappedMagento = mapMagentoCartItems(items);
      setCartItems(mergeMagentoAndLocalCart(mappedMagento));
    } catch (_error) {
      setToastMessage('Không thể xóa sản phẩm. Vui lòng thử lại.');
      toastTimerRef.current = window.setTimeout(() => setToastMessage(''), 2400);
    }
  }, [cartItems, ensureAuthenticated, mapMagentoCartItems, mergeMagentoAndLocalCart, removeMagentoCartItem]);


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

  if (typeof value === 'string') {
    if (value.includes('-')) {
      const parts = value.split('-').map((p) => p.trim());
      const convertedParts = parts.map((part) => {
        const val = parseNumberFromText(part);
        return val > 0 ? formatCurrency(val) : part;
      });
      return convertedParts.join(' - ');
    } else {
      const parsed = parseNumberFromText(value);
      return parsed > 0 ? formatCurrency(parsed) : value;
    }
  }

  return value;
}

export function toUnitPriceFromLooseValue(value: string | number) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.includes('-')) {
    const firstPart = value.split('-')[0].trim();
    return parseNumberFromText(firstPart);
  }

  return parseNumberFromText(value);
}
