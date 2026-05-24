export type WishlistList = {
  id: string;
  name: string;
  itemCount: number;
};

export type WishlistItemPayload = {
  listId: string;
  sku: string;
  name: string;
  price: number;
  unit: string;
  image?: string;
  category?: string;
};

export type WishlistItem = {
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

const persistWishlistDebug = (payload: Record<string, unknown>) => {
  try {
    window.localStorage.setItem('freso_wishlist_debug', JSON.stringify({
      ...payload,
      timestamp: new Date().toISOString(),
    }));
  } catch (_error) {
    // ignore storage errors
  }
};

const getRestBaseUrl = () => {
  if (typeof window === 'undefined') {
    return '/rest/V1';
  }

  const segments = window.location.pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (firstSegment && firstSegment !== 'react') {
    return `/rest/${firstSegment}/V1`;
  }

  return '/rest/V1';
};

async function wishlistRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  if (!token) {
    persistWishlistDebug({
      url,
      method: options.method || 'GET',
      tokenPresent: false,
      error: 'missing_token'
    });
    throw new Error('Chưa có token đăng nhập. Vui lòng đăng nhập lại.');
  }

  persistWishlistDebug({
    url,
    method: options.method || 'GET',
    tokenPresent: true,
    tokenLength: token.length,
    tokenPreview: token.slice(0, 8)
  });
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
    persistWishlistDebug({
      url,
      method: options.method || 'GET',
      tokenPresent: true,
      tokenLength: token.length,
      tokenPreview: token.slice(0, 8),
      status: response.status,
      statusText: response.statusText,
      responseText: text.slice(0, 300)
    });
    if (response.status === 401) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
    throw new Error(`${response.status} ${response.statusText} ${text}`);
  }

  const text = await response.text().catch(() => '');
  persistWishlistDebug({
    url,
    method: options.method || 'GET',
    tokenPresent: true,
    tokenLength: token.length,
    tokenPreview: token.slice(0, 8),
    status: response.status,
    statusText: response.statusText,
    responseText: text.slice(0, 300)
  });
  if (!text) {
    return null as T;
  }

  return JSON.parse(text) as T;
}

export function hasWishlistAuth() {
  return Boolean(getAuthToken());
}

export async function getWishlistLists(): Promise<WishlistList[]> {
  const baseUrl = getRestBaseUrl();
  const data = await wishlistRequest<
    Array<{ id: string | number; name: string; itemCount?: number; item_count?: number }>
  >(`${baseUrl}/tmdt/wishlist`);
  return (data ?? []).map((list) => ({
    id: String(list.id),
    name: list.name,
    itemCount: list.itemCount ?? list.item_count ?? 0
  }));
}

export async function getDefaultWishlistList(): Promise<WishlistList | null> {
  const lists = await getWishlistLists();
  return lists[0] ?? null;
}

export async function createWishlistList(name: string): Promise<WishlistList> {
  const baseUrl = getRestBaseUrl();
  const payload = { name };
  let data: { id: string | number; name: string; itemCount?: number; item_count?: number } | null;

  try {
    data = await wishlistRequest<typeof data>(`${baseUrl}/tmdt/wishlist`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fallbackUrl = `${baseUrl}/tmdt/wishlist?name=${encodeURIComponent(name)}`;
    if (message.includes('400') || message.includes('404')) {
      data = await wishlistRequest<typeof data>(fallbackUrl, { method: 'POST' });
    } else {
      throw error;
    }
  }

  if (!data?.id) {
    const lists = await getWishlistLists();
    const normalizedName = name.trim().toLowerCase();
    const matched = lists.find((list) => list.name.trim().toLowerCase() === normalizedName) ?? lists[0];
    if (!matched) {
      throw new Error('Không nhận được dữ liệu danh sách mới từ hệ thống.');
    }
    return matched;
  }

  return {
    id: String(data.id),
    name: data.name,
    itemCount: data.itemCount ?? data.item_count ?? 0
  };
}

export async function addWishlistItem(payload: WishlistItemPayload): Promise<WishlistItem> {
  const baseUrl = getRestBaseUrl();
  const data = await wishlistRequest<{
    id: string | number;
    sku?: string;
    name?: string;
    price?: number;
    unit?: string;
    image?: string;
    category?: string;
  }>(`${baseUrl}/tmdt/wishlist/item`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return {
    id: String(data?.id ?? ''),
    sku: data?.sku ?? payload.sku,
    name: data?.name ?? payload.name,
    price: Number(data?.price ?? payload.price ?? 0),
    unit: data?.unit ?? payload.unit ?? 'SP',
    image: data?.image ?? payload.image ?? '',
    category: data?.category ?? payload.category ?? ''
  };
}

export async function getWishlistItems(listId: string): Promise<WishlistItem[]> {
  const baseUrl = getRestBaseUrl();
  const data = await wishlistRequest<
    Array<{
      id: string | number;
      sku?: string;
      name?: string;
      price?: number;
      unit?: string;
      image?: string;
      category?: string;
    }>
  >(`${baseUrl}/tmdt/wishlist/${listId}`);

  return (data ?? []).map((item) => ({
    id: String(item.id),
    sku: item.sku ?? '',
    name: item.name ?? 'Sản phẩm',
    price: Number(item.price ?? 0),
    unit: item.unit ?? 'SP',
    image: item.image ?? '',
    category: item.category ?? ''
  }));
}

export async function getWishlistItemBySku(listId: string, sku: string): Promise<WishlistItem | null> {
  if (!sku) {
    return null;
  }
  const items = await getWishlistItems(listId);
  return items.find((item) => item.sku === sku) ?? null;
}

export async function getWishlistItemsMap(): Promise<{
  lists: WishlistList[];
  itemsMap: Record<string, { listId: string; itemId: string }>;
}> {
  const lists = await getWishlistLists();
  const itemsMap: Record<string, { listId: string; itemId: string }> = {};

  await Promise.all(
    lists.map(async (list) => {
      const items = await getWishlistItems(list.id);
      items.forEach((item) => {
        if (item.sku && !itemsMap[item.sku]) {
          itemsMap[item.sku] = { listId: list.id, itemId: item.id };
        }
      });
    })
  );

  return { lists, itemsMap };
}

export async function removeWishlistItem(itemId: string): Promise<void> {
  const baseUrl = getRestBaseUrl();
  await wishlistRequest(`${baseUrl}/tmdt/wishlist/item/${itemId}`, {
    method: 'DELETE'
  });
}
