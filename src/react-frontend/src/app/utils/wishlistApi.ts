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

export async function createWishlistList(name: string): Promise<WishlistList> {
  const baseUrl = getRestBaseUrl();
  const payload = { name };
  let data: { id: string | number; name: string; itemCount?: number; item_count?: number };

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

  return {
    id: String(data.id),
    name: data.name,
    itemCount: data.itemCount ?? data.item_count ?? 0
  };
}

export async function addWishlistItem(payload: WishlistItemPayload): Promise<void> {
  const baseUrl = getRestBaseUrl();
  await wishlistRequest(`${baseUrl}/tmdt/wishlist/item`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
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

export async function removeWishlistItem(itemId: string): Promise<void> {
  const baseUrl = getRestBaseUrl();
  await wishlistRequest(`${baseUrl}/tmdt/wishlist/item/${itemId}`, {
    method: 'DELETE'
  });
}
