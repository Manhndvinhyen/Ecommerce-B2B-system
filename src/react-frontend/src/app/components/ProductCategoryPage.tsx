import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, ShoppingCart, Heart } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { WishlistAddModal, WishlistModalProduct } from './WishlistAddModal';
import { hasWishlistAuth, getWishlistItemsMap, removeWishlistItem, WishlistItem } from '../utils/wishlistApi';
import {
  categoryMenu,
  getCategoryPageLink,
  getSubcategoryNameFromQuery,
  toQuerySlug,
  inferCategoryFromSku,
  InferredCategory
} from '../data/categories';
import { getMockSupplierForProduct, supplierRegions } from '../data/mockSuppliers';
import { searchSynonymGroups } from '../data/searchSynonyms';
import { toCurrencyTextFromLooseValue, toUnitPriceFromLooseValue, toCurrencyTextFromNumber, useCart } from '../cart/CartProvider';
import { applySeo, buildBreadcrumbJsonLd, buildItemListJsonLd, getSiteName } from '../utils/seo';

type ProductItem = {
  id: string | number;
  sku: string;
  name: string;
  price: string;
  priceValue: number;
  image: string;
  categoryLabel: string;
  unit: string;
  supplierName: string;
  supplierRegion: string;
};

type GraphQlProductItem = {
  id: number;
  sku: string;
  name: string;
  categories?: Array<{
    id: number;
    name: string;
    path?: string;
  }>;
  small_image?: { url?: string | null } | null;
  thumbnail?: { url?: string | null } | null;
  media_gallery_entries?: Array<{
    file?: string | null;
    disabled?: boolean | null;
  }>;
  price_range?: {
    minimum_price?: {
      final_price?: {
        value?: number;
      };
    };
  };
};

type GraphQlCategoryNode = {
  id: number;
  name: string;
  children?: GraphQlCategoryNode[];
};

type OptimizedSearchProduct = {
  id: number | string;
  sku: string;
  name: string;
  priceValue?: number;
  image?: string;
};


const dedupeByKey = <T,>(items: T[], keyFn: (item: T) => string) => {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = keyFn(item).trim().toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
};

const pickPreferredProduct = (current: ProductItem, candidate: ProductItem) => {
  const scoreSku = (sku: string) => {
    const normalizedSku = sku.trim();
    if (/^[A-Z]{2,}_\d{3,}/.test(normalizedSku)) {
      return 3;
    }
    if (normalizedSku.startsWith('cat-')) {
      return 1;
    }
    return 2;
  };

  return scoreSku(candidate.sku) > scoreSku(current.sku) ? candidate : current;
};

const dedupeProductsByName = (products: ProductItem[]) => {
  const map = new Map<string, ProductItem>();

  for (const product of products) {
    const key = toQuerySlug(product.name);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, product);
      continue;
    }

    map.set(key, pickPreferredProduct(existing, product));
  }

  return Array.from(map.values());
};


const formatPrice = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'Liên hệ';
  }

  return new Intl.NumberFormat('vi-VN').format(value);
};

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

const resolveSupplierDisplay = (storeName: string | undefined, fallback: { name: string; region: string }) => {
  const parsed = parseSupplierLabel(storeName);
  const shouldUseFallbackSupplier =
    fallback.name === 'Tổng công ty Chăn nuôi CP Việt Nam' &&
    (!parsed.supplierName ||
      parsed.supplierName === 'Tổng kho sỉ Thực phẩm B2B' ||
      parsed.supplierName === 'Tổng công ty Chăn nuôi CP Việt Nam');

  return {
    supplierName: shouldUseFallbackSupplier ? fallback.name : parsed.supplierName || storeName || fallback.name,
    supplierRegion: shouldUseFallbackSupplier ? fallback.region : parsed.supplierRegion || fallback.region
  };
};

const inferUnitByCategory = (categoryName: string) => {
  const normalized = toQuerySlug(categoryName);

  if (normalized.includes('tien-ich-bep')) {
    return 'bộ';
  }

  if (normalized.includes('thuc-pham-kho')) {
    return 'gói';
  }

  return 'kg';
};

const pickCategoryFromGraphQl = (product: GraphQlProductItem) => {
  const ignoredSlugs = new Set(['root-catalog', 'default-category', 'products']);
  return (product.categories ?? [])
    .map((item) => item.name)
    .find((name) => name && !ignoredSlugs.has(toQuerySlug(name)));
};

const buildExpandedSearchTerms = (query: string) => {
  const normalizedQuery = toQuerySlug(query);
  const terms = [query];

  searchSynonymGroups.forEach((group) => {
    if (group.triggers.some((trigger) => normalizedQuery.includes(trigger))) {
      terms.push(...group.terms);
    }
  });

  normalizedQuery
    .split('-')
    .filter((part) => part.length >= 3)
    .forEach((part) => terms.push(part));

  const seen = new Set<string>();
  return terms
    .map((term) => term.trim())
    .filter(Boolean)
    .filter((term) => {
      const key = toQuerySlug(term);
      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 10);
};

const scoreProductForSearch = (product: ProductItem, query: string, expandedTerms: string[]) => {
  const normalizedQuery = toQuerySlug(query);
  const haystack = toQuerySlug(`${product.name} ${product.categoryLabel} ${product.sku}`);
  let score = 0;

  if (haystack.includes(normalizedQuery)) {
    score += 120;
  }

  expandedTerms.forEach((term, index) => {
    const normalizedTerm = toQuerySlug(term);
    if (normalizedTerm.length < 3) {
      return;
    }

    if (haystack.includes(normalizedTerm)) {
      score += Math.max(12, 80 - index * 4);
      return;
    }

    const termParts = normalizedTerm.split('-').filter((part) => part.length >= 3);
    const matchedParts = termParts.filter((part) => haystack.includes(part)).length;
    if (matchedParts > 0 && matchedParts === termParts.length) {
      score += Math.max(8, 36 - index * 2);
    }
  });

  return score;
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

const getMagentoMediaImageUrl = (file?: string | null) => {
  if (!file || !file.trim()) return '';
  const normalizedFile = file.startsWith('/') ? file : `/${file}`;
  return `${window.location.origin}/media/catalog/product${normalizedFile}`;
};

const pickMagentoProductImage = (product: GraphQlProductItem, fallbackImage: string) => {
  const galleryImage = (product.media_gallery_entries ?? []).find((entry) => {
    const file = entry.file?.trim() ?? '';
    return file && !file.toLowerCase().includes('placeholder');
  });

  const galleryUrl = getMagentoMediaImageUrl(galleryImage?.file);
  const primaryUrl = product.small_image?.url ?? '';
  const thumbnailUrl = product.thumbnail?.url ?? '';

  return [galleryUrl, primaryUrl, thumbnailUrl].find((value) => {
    if (!value) return false;
    const lower = value.toLowerCase();
    return !lower.includes('/placeholder/');
  }) || '';
};

type ProductCategoryPageProps = {
  categoryName: string;
  initialSubcategory?: string;
};

let cachedCategoryLookup: Record<string, number> | null = null;
const PRODUCT_CACHE_TTL_MS = 15_000;
const PRODUCT_AUTO_REFRESH_MS = 30_000;
const productsResponseCache = new Map<string, { items: ProductItem[]; fetchedAt: number }>();
const preferredRegionStorageKey = 'freso_preferred_region';

const graphqlRequest = async (
  query: string,
  variables?: Record<string, unknown>,
  signal?: AbortSignal
): Promise<Response> => {
  return fetch('/graphql', {
    method: 'POST',
    signal,
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
};

const optimizedProductSearchRequest = async (
  query: string,
  signal?: AbortSignal
): Promise<OptimizedSearchProduct[]> => {
  const params = new URLSearchParams({
    query,
    limit: '100'
  });
  const response = await fetch(`/rest/V1/tmdt-search/products?${params.toString()}`, {
    method: 'GET',
    signal,
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Optimized product search failed: ${response.status}`);
  }

  const json = await response.json();
  if (Array.isArray(json)) {
    return json as OptimizedSearchProduct[];
  }
  if (typeof json === 'string') {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const getStoredPreferredRegion = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(preferredRegionStorageKey) || window.sessionStorage.getItem(preferredRegionStorageKey) || '';
};

export function ProductCategoryPage({ categoryName, initialSubcategory }: ProductCategoryPageProps) {
  const { openAddToCartModal } = useCart();
  const category = useMemo(() => {
    return categoryMenu.find((item) => item.name === categoryName) ?? categoryMenu[0];
  }, [categoryName]);

  const [activeSubcategory, setActiveSubcategory] = useState(initialSubcategory ?? 'Tất cả');
  const [visibleCount, setVisibleCount] = useState(10);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [categoryIdLookup, setCategoryIdLookup] = useState<Record<string, number>>({});
  const [refreshTick, setRefreshTick] = useState(0);
  const latestRequestRef = useRef(0);
  const [wishlistItemsMap, setWishlistItemsMap] = useState<Record<string, { itemId: string; listId: string }>>({});
  const [wishlistProduct, setWishlistProduct] = useState<WishlistModalProduct | null>(null);
  const [sortMode, setSortMode] = useState<'recommended' | 'price-asc' | 'price-desc'>('recommended');
  const [regionFilter, setRegionFilter] = useState('all');
  const [preferredRegion] = useState(getStoredPreferredRegion);
  const searchQuery = useMemo(() => {
    return new URLSearchParams(window.location.search).get('q')?.trim() ?? '';
  }, []);
  const isSearchMode = searchQuery.length > 0;
  const categoryLookupDependency = useMemo(() => {
    if (isSearchMode) {
      return 'search-mode';
    }

    return Object.entries(categoryIdLookup)
      .map(([key, value]) => `${key}:${value}`)
      .sort()
      .join('|');
  }, [categoryIdLookup, isSearchMode]);

  const getCategoryDisplayLabel = (product: GraphQlProductItem) => {
    const inferred = inferCategoryFromSku(product.sku);
    const rawNames = (product.categories ?? []).map((item) => item.name).filter(Boolean);
    if (!rawNames.length) {
      return inferred?.subcategory ?? inferred?.category ?? (activeSubcategory === 'Tất cả' ? category.name : activeSubcategory);
    }

    const ignoredSlugs = new Set([
      'root-catalog',
      'default-category',
      'products',
      toQuerySlug(category.name)
    ]);

    const preferred = rawNames.find((name) => !ignoredSlugs.has(toQuerySlug(name)));
    if (preferred) {
      return preferred;
    }

    if (inferred?.subcategory) {
      return inferred.subcategory;
    }

    if (inferred?.category) {
      return inferred.category;
    }

    return rawNames[rawNames.length - 1] ?? (activeSubcategory === 'Tất cả' ? category.name : activeSubcategory);
  };

  useEffect(() => {
    const loadWishlist = async () => {
      if (!hasWishlistAuth()) {
        return;
      }

      const { itemsMap } = await getWishlistItemsMap();
      setWishlistItemsMap(itemsMap);
    };

    loadWishlist();
  }, []);

  const toggleWishlistItem = async (product: ProductItem) => {
    if (!hasWishlistAuth()) {
      window.location.href = '/react/index.html?view=login';
      return;
    }

    const existing = wishlistItemsMap[product.sku];
    if (existing) {
      await removeWishlistItem(existing.itemId);
      setWishlistItemsMap((prev: Record<string, { itemId: string; listId: string }>) => {
        const next = { ...prev };
        delete next[product.sku];
        return next;
      });
      return;
    }

    setWishlistProduct({
      sku: product.sku,
      name: product.name,
      priceText: toCurrencyTextFromLooseValue(product.price),
      priceValue: toUnitPriceFromLooseValue(product.price),
      unit: product.unit,
      image: product.image,
      category: product.categoryLabel
    });
  };

  useEffect(() => {
    setActiveSubcategory(initialSubcategory ?? 'Tất cả');
    setVisibleCount(10);
  }, [initialSubcategory, categoryName]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const currentCategorySlug = params.get('category');
      if (currentCategorySlug && currentCategorySlug !== toQuerySlug(categoryName)) {
        return;
      }

      const nextSubcategory = getSubcategoryNameFromQuery(categoryName, params.get('subcategory'));
      setActiveSubcategory(nextSubcategory ?? 'Tất cả');
      setVisibleCount(10);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [categoryName]);
  const applySubcategoryFilter = (subcategory: string) => {
    setActiveSubcategory(subcategory);
    setVisibleCount(10);

    const params = new URLSearchParams(window.location.search);
    params.set('view', 'category');
    params.set('category', toQuerySlug(category.name));

    if (subcategory === 'Tất cả') {
      params.delete('subcategory');
    } else {
      params.set('subcategory', toQuerySlug(subcategory));
    }
    params.delete('q');

    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.pushState({}, '', nextUrl);
  };

  useEffect(() => {
    const fetchCategoryLookup = async () => {
      if (cachedCategoryLookup && Object.keys(cachedCategoryLookup).length > 0) {
        setCategoryIdLookup(cachedCategoryLookup);
        return;
      }

      try {
        const response = await graphqlRequest(`
              query CategoryTree {
                categoryList(filters: { ids: { in: ["2"] } }) {
                  id
                  name
                  children {
                    id
                    name
                    children {
                      id
                      name
                      children {
                        id
                        name
                      }
                    }
                  }
                }
              }
            `);

        if (!response.ok) {
          throw new Error(`Category lookup failed: ${response.status}`);
        }

        const json = await response.json();
        const roots: GraphQlCategoryNode[] = json?.data?.categoryList ?? [];

        const lookup: Record<string, number> = {};
        const walk = (node: GraphQlCategoryNode) => {
          lookup[toQuerySlug(node.name)] = node.id;
          (node.children ?? []).forEach(walk);
        };

        roots.forEach(walk);
        cachedCategoryLookup = lookup;
        setCategoryIdLookup(lookup);
      } catch (error) {
        console.error(error);
      }
    };

    fetchCategoryLookup();
  }, []);

  useEffect(() => {
    if (isSearchMode) {
      return;
    }

    const triggerRefresh = () => {
      setRefreshTick((tick) => tick + 1);
    };

    const intervalId = window.setInterval(triggerRefresh, PRODUCT_AUTO_REFRESH_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerRefresh();
      }
    };

    window.addEventListener('focus', triggerRefresh);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', triggerRefresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isSearchMode]);

  useEffect(() => {
    const requestId = ++latestRequestRef.current;
    const controller = new AbortController();

    const fetchProducts = async () => {
      if (isSearchMode) {
        const cacheKey = `search|${toQuerySlug(searchQuery)}`;
        const cachedProducts = productsResponseCache.get(cacheKey);
        const isCacheFresh =
          cachedProducts && Date.now() - cachedProducts.fetchedAt < PRODUCT_CACHE_TTL_MS;

        if (cachedProducts && isCacheFresh) {
          console.info('[FresoSearch][ProductCategoryPage] using cached search results', {
            searchQuery,
            count: cachedProducts.items.length
          });
          setProducts(cachedProducts.items);
          setLoadError('');
          setIsLoading(false);
          return;
        }

        console.info('[FresoSearch][ProductCategoryPage] starting search request', {
          searchQuery,
          requestId
        });
        setIsLoading(true);
        setLoadError('');
        const expandedSearchTerms = buildExpandedSearchTerms(searchQuery);

        try {
          const items = dedupeByKey(
            await optimizedProductSearchRequest(searchQuery, controller.signal),
            (item) => item.sku || String(item.id)
          );
          console.info('[FresoSearch][ProductCategoryPage] raw products received', {
            searchQuery,
            expandedSearchTerms,
            count: items.length,
            skus: items.map((item) => item.sku)
          });
          // Load local custom products
          const customLocalRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_custom_products') : null;
          let customLocalProducts: any[] = [];
          if (customLocalRaw) {
            try {
              customLocalProducts = JSON.parse(customLocalRaw);
            } catch (e) {
              customLocalProducts = [];
            }
          }

          const mappedGraphQlProducts = items.map((item) => {
            const inferred = inferCategoryFromSku(item.sku);
            const productCategory = inferred?.category ?? category.name;
            const priceValue = Number(item.priceValue ?? 0);
            const supplier = getMockSupplierForProduct(item.sku, productCategory);
            const localMatch = customLocalProducts.find(
              (p) => String(p.sku).trim().toLowerCase() === item.sku.trim().toLowerCase()
            );
            const fallbackImage =
              fallbackImageByCategory[productCategory] ??
              fallbackImageByCategory[category.name] ??
              'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop';
            const localImage = localMatch?.image && !String(localMatch.image).toLowerCase().includes('placeholder')
              ? localMatch.image
              : '';

            return {
              id: item.id,
              sku: item.sku,
              name: localMatch?.name || item.name,
              price: formatPrice(priceValue),
              priceValue,
              unit: inferUnitByCategory(productCategory),
              image: localImage || item.image || fallbackImage,
              categoryLabel: inferred?.subcategory ?? productCategory,
              supplierName: supplier.name,
              supplierRegion: supplier.region
            };
          });

          const mappedCustomProducts: ProductItem[] = customLocalProducts.map((p) => {
            const priceValue = p.special_price ?? p.price;
            const supplier = getMockSupplierForProduct(p.sku, p.categoryLabel);
            const storeSupplier = resolveSupplierDisplay(p.store_name, supplier);
            return {
              id: p.id || p.sku,
              sku: p.sku,
              name: p.name,
              price: formatPrice(priceValue),
              priceValue,
              unit: p.unit || 'kg',
              image: p.image || fallbackImageByCategory[p.categoryLabel] || 'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop',
              categoryLabel: p.categoryLabel,
              supplierName: storeSupplier.supplierName || p.store_name || supplier.name,
              supplierRegion: storeSupplier.supplierRegion || supplier.region
            };
          });

          // Combine and deduplicate by SKU (local storage products take priority if same SKU)
          const allProducts = [...mappedCustomProducts];
          const localSkus = new Set(mappedCustomProducts.map((p) => p.sku));
          mappedGraphQlProducts.forEach((p) => {
            if (!localSkus.has(p.sku)) {
              allProducts.push(p);
            }
          });

          const mappedProducts = allProducts
            .map((product) => ({
              product,
              searchScore: scoreProductForSearch(product, searchQuery, expandedSearchTerms)
            }))
            .filter((item) => item.searchScore > 0)
            .sort((a, b) => b.searchScore - a.searchScore)
            .map((item) => item.product);

          if (latestRequestRef.current !== requestId) {
            console.info('[FresoSearch][ProductCategoryPage] skipped stale search response', {
              searchQuery,
              requestId,
              latestRequestId: latestRequestRef.current
            });
            return;
          }

          productsResponseCache.set(cacheKey, {
            items: mappedProducts,
            fetchedAt: Date.now()
          });
          setProducts(mappedProducts);
          console.info('[FresoSearch][ProductCategoryPage] search products rendered', {
            searchQuery,
            count: mappedProducts.length
          });
        } catch (error) {
          if (controller.signal.aborted || latestRequestRef.current !== requestId) {
            console.info('[FresoSearch][ProductCategoryPage] search request aborted or stale', {
              searchQuery,
              requestId
            });
            return;
          }

          setProducts([]);
          setLoadError('Không tải được dữ liệu tìm kiếm từ database.');
          console.error('[FresoSearch][ProductCategoryPage] search request failed', error);
        } finally {
          if (latestRequestRef.current === requestId) {
            setIsLoading(false);
            console.info('[FresoSearch][ProductCategoryPage] search request finished', {
              searchQuery,
              requestId
            });
          }
        }

        return;
      }

      const parentCategoryId = categoryIdLookup[toQuerySlug(category.name)];
      const subcategoryIds = category.subcategories
        .map((subcategory) => categoryIdLookup[toQuerySlug(subcategory)])
        .filter((id): id is number => Boolean(id));

      const categoryIds =
        activeSubcategory === 'Tất cả'
          ? [...subcategoryIds, parentCategoryId].filter((id): id is number => Boolean(id))
          : [categoryIdLookup[toQuerySlug(activeSubcategory)]].filter((id): id is number => Boolean(id));

      const isUsingSkuFallback = categoryIds.length === 0;

      const requestCategoryIds = (isUsingSkuFallback ? [2] : categoryIds)
        .map((id) => String(id))
        .sort();
      const cacheKey = `${toQuerySlug(category.name)}|${toQuerySlug(activeSubcategory)}|${requestCategoryIds.join(',')}|${isUsingSkuFallback ? 'fallback' : 'strict'}`;

      const cachedProducts = productsResponseCache.get(cacheKey);
      const isCacheFresh =
        cachedProducts && Date.now() - cachedProducts.fetchedAt < PRODUCT_CACHE_TTL_MS;

      if (cachedProducts && isCacheFresh) {
        setProducts(cachedProducts.items);
        setLoadError('');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError('');

      const query = `
        query ProductsByCategory($categoryIds: [String!]!) {
          products(filter: { category_id: { in: $categoryIds } }, pageSize: 100) {
            items {
              id
              sku
              name
              categories {
                id
                name
              }
                small_image {
                  url
                }
                thumbnail {
                  url
                }
                media_gallery_entries {
                  file
                  disabled
                }
                price_range {
                minimum_price {
                  final_price {
                    value
                  }
                }
              }
            }
          }
        }
      `;

      try {
        const response = await graphqlRequest(
          query,
          {
            categoryIds: requestCategoryIds
          },
          controller.signal
        );

        if (!response.ok) {
          throw new Error(`GraphQL request failed: ${response.status}`);
        }

        const json = await response.json();
        if (json?.errors?.length) {
          throw new Error(json.errors[0]?.message ?? 'GraphQL error');
        }

        const items: GraphQlProductItem[] = json?.data?.products?.items ?? [];
        const uniqueItems = dedupeByKey(items, (item) => item.sku || String(item.id));

        // Load local custom products
        const customLocalRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_custom_products') : null;
        let customLocalProducts: any[] = [];
        if (customLocalRaw) {
          try {
            customLocalProducts = JSON.parse(customLocalRaw);
          } catch (e) {
            customLocalProducts = [];
          }
        }

        const filteredCustomProducts = customLocalProducts.filter((p) => {
          // Check if parent category matches
          const parentCategoryMatched = p.categoryLabel === category.name;
          if (!parentCategoryMatched) {
            return false;
          }

          // Check if subcategory matches
          if (activeSubcategory !== 'Tất cả') {
            const inferred = inferCategoryFromSku(p.sku);
            const subcat = inferred?.subcategory ?? (category.subcategories[0] || 'Tất cả');
            return subcat === activeSubcategory || p.categoryLabel === activeSubcategory;
          }

          return true;
        });

        const mappedGraphQlProducts = dedupeByKey(
          uniqueItems
            .map((item) => {
              const fallbackImage =
                fallbackImageByCategory[category.name] ??
                'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop';

              const inferred = inferCategoryFromSku(item.sku);
              const productCategory = inferred?.category ?? category.name;
              const priceValue = Number(item.price_range?.minimum_price?.final_price?.value ?? 0);
              const supplier = getMockSupplierForProduct(item.sku, productCategory);
              const localMatch = filteredCustomProducts.find(
                (p) => String(p.sku).trim().toLowerCase() === item.sku.trim().toLowerCase()
              );
              const localImage = localMatch?.image && !String(localMatch.image).toLowerCase().includes('placeholder')
                ? localMatch.image
                : '';

              if (isUsingSkuFallback) {
                const categoryMatched = inferred?.category === category.name;
                const subcategoryMatched =
                  activeSubcategory === 'Tất cả' || inferred?.subcategory === activeSubcategory;

                if (!categoryMatched || !subcategoryMatched) {
                  return null;
                }
              }

              return {
                id: item.id,
                sku: item.sku,
                name: localMatch?.name || item.name,
                price: formatPrice(priceValue),
                priceValue,
                unit: inferUnitByCategory(productCategory),
                image: localImage || pickMagentoProductImage(item, fallbackImage) || fallbackImage,
                categoryLabel: getCategoryDisplayLabel(item),
                supplierName: supplier.name,
                supplierRegion: supplier.region
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null),
          (product) => product.sku || `${product.name}|${product.price}|${product.categoryLabel}`
        );

        const mappedCustomProducts: ProductItem[] = filteredCustomProducts.map((p) => {
          const priceValue = p.special_price ?? p.price;
          const supplier = getMockSupplierForProduct(p.sku, p.categoryLabel);
          const storeSupplier = resolveSupplierDisplay(p.store_name, supplier);
          const inferred = inferCategoryFromSku(p.sku);
          const subcat = inferred?.subcategory ?? p.categoryLabel;
          return {
            id: p.id || p.sku,
            sku: p.sku,
            name: p.name,
            price: formatPrice(priceValue),
            priceValue,
            unit: p.unit || 'kg',
            image: p.image || fallbackImageByCategory[p.categoryLabel] || 'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop',
            categoryLabel: subcat,
            supplierName: storeSupplier.supplierName || p.store_name || supplier.name,
            supplierRegion: storeSupplier.supplierRegion || supplier.region
          };
        });

        // Combine and deduplicate by SKU (local storage products take priority)
        const allProducts = [...mappedCustomProducts];
        const localSkus = new Set(mappedCustomProducts.map((p) => p.sku));
        mappedGraphQlProducts.forEach((p) => {
          if (!localSkus.has(p.sku)) {
            allProducts.push(p);
          }
        });

        const mappedProducts = dedupeProductsByName(allProducts);

        if (latestRequestRef.current !== requestId) {
          return;
        }

        productsResponseCache.set(cacheKey, {
          items: mappedProducts,
          fetchedAt: Date.now()
        });
        setProducts(mappedProducts);
      } catch (error) {
        if (controller.signal.aborted || latestRequestRef.current !== requestId) {
          return;
        }

        setProducts([]);
        setLoadError('Không tải được dữ liệu sản phẩm từ database.');
        console.error(error);
      } finally {
        if (latestRequestRef.current === requestId) {
          setIsLoading(false);
        }
      }
    };

    fetchProducts();

    return () => {
      controller.abort();
    };
  }, [category.name, category.subcategories, activeSubcategory, categoryLookupDependency, refreshTick, isSearchMode, searchQuery]);

  const filteredProducts = useMemo(() => {
    const scopedProducts =
      regionFilter === 'all' ? products : products.filter((product) => product.supplierRegion === regionFilter);
    const regionBoost = (product: ProductItem) =>
      preferredRegion && product.supplierRegion === preferredRegion ? 1 : 0;
    const sortedProducts = [...scopedProducts].sort((left, right) => {
      if (sortMode === 'price-asc') {
        return left.priceValue - right.priceValue;
      }
      if (sortMode === 'price-desc') {
        return right.priceValue - left.priceValue;
      }

      const boostDiff = regionBoost(right) - regionBoost(left);
      if (boostDiff !== 0) {
        return boostDiff;
      }

      return left.name.localeCompare(right.name, 'vi');
    });

    return sortedProducts;
  }, [preferredRegion, products, regionFilter, sortMode]);
  const productsToShow = filteredProducts.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredProducts.length;
  const canonicalPath = useMemo(() => {
    if (isSearchMode) {
      const params = new URLSearchParams({
        view: 'search',
        q: searchQuery
      });
      return `/react/index.html?${params.toString()}`;
    }

    return getCategoryPageLink(
      category.name,
      activeSubcategory !== 'Táº¥t cáº£' ? activeSubcategory : undefined
    );
  }, [activeSubcategory, category.name, isSearchMode, searchQuery]);
  const breadcrumbItems = [
    {
      label: 'Trang chủ',
      href: '/'
    },
    {
      label: category.name,
      href: getCategoryPageLink(category.name)
    },
    ...(activeSubcategory !== 'Tất cả'
      ? [
          {
            label: activeSubcategory,
            href: undefined
          }
        ]
      : [])
  ];
  const productsToShowSeoKey = productsToShow.map((product) => `${product.sku}:${product.name}`).join('|');

  useEffect(() => {
    const siteName = getSiteName();
    const pageLabel = activeSubcategory !== 'Táº¥t cáº£' ? activeSubcategory : category.name;
    const title = isSearchMode
      ? `Tìm kiếm ${searchQuery} | ${siteName}`
      : `${pageLabel} B2B | ${siteName}`;
    const description = isSearchMode
      ? `Kết quả tìm kiếm "${searchQuery}" với danh sách sản phẩm thực phẩm B2B đang có trên ${siteName}.`
      : `Tìm nguồn ${pageLabel.toLowerCase()} cho doanh nghiệp, nhà hàng và cửa hàng thực phẩm trên ${siteName}.`;
    const itemList = buildItemListJsonLd(
      title,
      productsToShow.slice(0, 20).map((product, index) => ({
        name: product.name,
        image: product.image,
        position: index + 1,
        path: `/react/index.html?view=product&sku=${encodeURIComponent(product.sku)}`
      }))
    );
    const breadcrumb = buildBreadcrumbJsonLd(
      breadcrumbItems.map((item) => ({
        name: item.label,
        path: item.href ?? canonicalPath
      }))
    );

    applySeo({
      title,
      description,
      canonicalPath,
      robots: isSearchMode ? 'noindex, follow' : 'index, follow',
      structuredData: {
        '@context': 'https://schema.org',
        '@graph': [breadcrumb, itemList]
      }
    });
  }, [
    activeSubcategory,
    breadcrumbItems,
    canonicalPath,
    category.name,
    isSearchMode,
    productsToShowSeoKey,
    searchQuery
  ]);

  return (
    <>
    <section className="bg-gray-50 min-h-[70vh] py-8">
      <div className="container mx-auto px-4">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
          {breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1;

            return (
              <div key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
                {item.href && !isLast ? (
                  <a href={item.href} className="hover:text-green-600 transition-colors">
                    {item.label}
                  </a>
                ) : (
                  <span className={isLast ? 'text-gray-600' : 'text-gray-400'}>{item.label}</span>
                )}

                {!isLast && <ChevronRight className="size-4 text-gray-300" />}
              </div>
            );
          })}
        </nav>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            {isSearchMode ? `Kết quả tìm kiếm cho "${searchQuery}"` : `Các loại ${category.name}`}
          </h1>

          <div className="flex flex-wrap gap-2">
            {['Tất cả', ...category.subcategories].map((subcategory) => {
              const isActive = subcategory === activeSubcategory;
              return (
                <button
                  key={subcategory}
                  type="button"
                  onClick={() => {
                    if (!isSearchMode) {
                      applySubcategoryFilter(subcategory);
                    }
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-50 hover:text-green-700'
                  }`}
                >
                  {subcategory}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="text-sm font-medium text-gray-700">
              Khu vực nhà cung cấp
              <select
                value={regionFilter}
                onChange={(event) => {
                  setRegionFilter(event.target.value);
                  setVisibleCount(10);
                }}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-500"
              >
                <option value="all">Tất cả khu vực</option>
                {supplierRegions.map((region) => (
                  <option key={region} value={region}>
                    {region}{preferredRegion === region ? ' - khu vực của bạn' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-700">
              Sắp xếp
              <select
                value={sortMode}
                onChange={(event) => {
                  setSortMode(event.target.value as typeof sortMode);
                  setVisibleCount(10);
                }}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-500"
              >
                <option value="recommended">Phù hợp nhất{preferredRegion ? ` - ưu tiên ${preferredRegion}` : ''}</option>
                <option value="price-asc">Giá thấp đến cao</option>
                <option value="price-desc">Giá cao đến thấp</option>
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setRegionFilter('all');
                  setSortMode('recommended');
                  setVisibleCount(10);
                }}
                className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:border-green-500 hover:text-green-700 md:w-auto"
              >
                Đặt lại
              </button>
            </div>
          </div>
          {preferredRegion && (
            <p className="mt-3 text-xs text-gray-500">
              Đã ghi nhớ khu vực mua gần nhất: <span className="font-semibold text-green-700">{preferredRegion}</span>.
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800 text-sm">
            Đang tải dữ liệu sản phẩm...
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
            {loadError}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
            {isSearchMode ? 'Không tìm thấy sản phẩm phù hợp.' : 'Chưa có sản phẩm trong danh mục này.'}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {productsToShow.map((product) => (
                <article
                  key={product.id}
                  className="bg-white rounded-2xl border border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const targetUrl = `/react/index.html?view=product&id=${encodeURIComponent(String(product.id))}&sku=${encodeURIComponent(product.sku)}`;
                    window.location.href = targetUrl;
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      const targetUrl = `/react/index.html?view=product&id=${encodeURIComponent(String(product.id))}&sku=${encodeURIComponent(product.sku)}`;
                      window.location.href = targetUrl;
                    }
                  }}
                >
                  <div className="relative aspect-square overflow-hidden bg-gray-50">
                    <ImageWithFallback
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleWishlistItem(product);
                      }}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === 'Enter' || event.key === ' ') {
                          toggleWishlistItem(product);
                        }
                      }}
                      className="absolute top-2 right-2 bg-white rounded-full p-2 hover:bg-red-50 transition-colors shadow-sm"
                      aria-label={`Yêu thích ${product.name}`}
                    >
                      <Heart
                        className={`size-4 ${wishlistItemsMap[product.sku] ? 'fill-rose-400 text-rose-500' : 'text-gray-400 hover:text-red-500'}`}
                      />
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-500 mb-1">{product.categoryLabel}</p>
                    <p className="mb-2 text-[11px] font-medium text-green-700">
                      {product.supplierName} · {product.supplierRegion}
                    </p>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-900 group-hover:text-green-600 transition-colors line-clamp-2">
                        {product.name}
                      </h3>
                      <button
                        type="button"
                        className="rounded-full p-1.5 transition-colors bg-transparent text-gray-400 hover:bg-gray-100 hover:text-green-600"
                        onClick={(event) => {
                          event.stopPropagation();
                          const sourceImage = event.currentTarget.closest('article')?.querySelector('img');
                          openAddToCartModal({
                            id: String(product.id),
                            sku: product.sku,
                            name: product.name,
                            category: product.categoryLabel,
                            priceText: toCurrencyTextFromLooseValue(product.price),
                            unit: product.unit,
                            unitPrice: toUnitPriceFromLooseValue(product.price),
                            image: product.image,
                            supplierName: product.supplierName,
                            supplierRegion: product.supplierRegion,
                          }, sourceImage);
                        }}
                        aria-label={`Thêm ${product.name} vào giỏ`}
                      >
                        <ShoppingCart className="size-4" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-red-500 font-bold">{toCurrencyTextFromNumber(product.priceValue)}</p>
                      <p className="text-xs text-gray-500">({product.unit})</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {canLoadMore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + 10)}
                  className="px-6 py-2.5 rounded-full border border-green-600 text-green-700 font-medium hover:bg-green-50"
                >
                  Xem thêm sản phẩm
                </button>
              </div>
            )}
          </>
        )}

        <div className="mt-8 flex flex-wrap gap-2">
          {categoryMenu.map((group) => (
            <a
              key={group.name}
              href={getCategoryPageLink(group.name)}
              className="text-sm px-3 py-1.5 rounded-full bg-white border border-gray-200 hover:border-green-500 hover:text-green-700"
            >
              {group.name}
            </a>
          ))}
        </div>
      </div>
    </section>

    <WishlistAddModal
      isOpen={Boolean(wishlistProduct)}
      product={wishlistProduct}
      onClose={() => setWishlistProduct(null)}
      onAdded={(item: WishlistItem, listId: string) => {
        if (!item.sku) return;
        setWishlistItemsMap((prev) => ({
          ...prev,
          [item.sku]: { itemId: item.id, listId }
        }));
      }}
    />

    </>
  );
}
