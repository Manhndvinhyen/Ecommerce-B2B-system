import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, ShoppingCart, Heart } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { WishlistAddModal, WishlistModalProduct } from './WishlistAddModal';
import {
  categoryMenu,
  getCategoryPageLink,
  getSubcategoryNameFromQuery,
  toQuerySlug
} from '../data/categories';
import { toCurrencyTextFromLooseValue, toUnitPriceFromLooseValue, useCart } from '../cart/CartProvider';

type ProductItem = {
  id: string | number;
  sku: string;
  name: string;
  price: string;
  image: string;
  categoryLabel: string;
  unit: string;
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

type InferredCategory = {
  category: string;
  subcategory?: string;
};

const pickSubcategoryFromText = (
  haystack: string,
  rules: Array<{ keywords: string[]; label: string }>,
  fallback?: string
) => {
  const matched = rules.find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)));
  return matched?.label ?? fallback;
};

const inferCategoryFromSku = (sku: string): InferredCategory | null => {
  const normalized = toQuerySlug(sku);

  // New professional SKU scheme: <CATEGORY_INITIALS>_<NNN>
  // Examples: RCQ_001 (Rau củ quả), TC_001 (Trái cây), TPTS_001 (Thực phẩm tươi sống)
  const normalizedUpper = String(sku || '').toUpperCase();

  if (/^RCQ_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Rau củ quả', subcategory: 'Rau phổ thông' };
  }
  if (/^TC_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Trái cây', subcategory: 'Trái cây phổ thông' };
  }
  if (/^TPTS_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Thực phẩm tươi sống', subcategory: 'Giò-chả-nem' };
  }
  if (/^THS_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Thuỷ hải sản', subcategory: 'Hải sản chế biến' };
  }
  if (/^TPDL_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Thực phẩm đông lạnh', subcategory: 'Giò-chả-nem' };
  }
  if (/^TPK_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Thực phẩm khô', subcategory: 'Thực phẩm khô khác' };
  }
  if (/^TIB_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Tiện ích bếp', subcategory: 'Sản phẩm khác' };
  }

  if (normalized.startsWith('rau-cu-qua-')) {
    return {
      category: 'Rau củ quả',
      subcategory: pickSubcategoryFromText(
        normalized,
        [
          { keywords: ['chilli', 'red-bell-pepper'], label: 'Rau gia vị' },
          { keywords: ['carrot', 'potato'], label: 'Củ quả' }
        ],
        'Rau phổ thông'
      )
    };
  }

  if (normalized.startsWith('cat-tc-')) {
    return {
      category: 'Trái cây',
      subcategory: normalized.includes('tao') ? 'Trái cây nhập khẩu' : 'Trái cây phổ thông'
    };
  }

  if (normalized.startsWith('cat-tpts-')) {
    return {
      category: 'Thực phẩm tươi sống',
      subcategory: pickSubcategoryFromText(normalized, [
        { keywords: ['heo'], label: 'Thịt heo' },
        { keywords: ['bo', 'be'], label: 'Thịt bò-bê' },
        { keywords: ['trau', 'nghe'], label: 'Thịt trâu-nghé' },
        { keywords: ['de'], label: 'Thịt dê' },
        { keywords: ['ga'], label: 'Thịt gà' },
        { keywords: ['vit', 'ngong'], label: 'Thịt vịt-gan-ngỗng' },
        { keywords: ['chim'], label: 'Thịt chim' },
        { keywords: ['ech'], label: 'Thịt ếch' },
        { keywords: ['trung'], label: 'Trứng' }
      ], 'Giò-chả-nem')
    };
  }

  if (normalized.startsWith('cat-ths-')) {
    return {
      category: 'Thuỷ hải sản',
      subcategory: pickSubcategoryFromText(normalized, [
        { keywords: ['ca'], label: 'Cá' },
        { keywords: ['tom'], label: 'Tôm' },
        { keywords: ['cua'], label: 'Cua' },
        { keywords: ['muc'], label: 'Mực' },
        { keywords: ['ngao', 'oc'], label: 'Ngao ốc' }
      ], 'Hải sản chế biến')
    };
  }

  if (normalized.startsWith('cat-tpdl-')) {
    return {
      category: 'Thực phẩm đông lạnh',
      subcategory: pickSubcategoryFromText(normalized, [
        { keywords: ['heo'], label: 'Thịt heo' },
        { keywords: ['bo', 'be'], label: 'Thịt bò-bê' },
        { keywords: ['trau', 'nghe'], label: 'Thịt trâu-nghé' },
        { keywords: ['de'], label: 'Thịt dê' },
        { keywords: ['ga'], label: 'Thịt gà' },
        { keywords: ['vit', 'ngong'], label: 'Thịt vịt-gan-ngỗng' },
        { keywords: ['chim'], label: 'Thịt chim' },
        { keywords: ['ech'], label: 'Thịt ếch' },
        { keywords: ['trung'], label: 'Trứng' },
        { keywords: ['xuc-xich', 'lap-xuong'], label: 'Xúc xích - lạp xưởng' }
      ], 'Giò-chả-nem')
    };
  }

  if (normalized.startsWith('cat-tpk-')) {
    return {
      category: 'Thực phẩm khô',
      subcategory: pickSubcategoryFromText(normalized, [
        { keywords: ['gia-vi'], label: 'Gia vị' },
        { keywords: ['gao'], label: 'Gạo' },
        { keywords: ['bot'], label: 'Bột' },
        { keywords: ['bun', 'mien', 'pho', 'nui'], label: 'Bún-miến-phở-nui' },
        { keywords: ['hat'], label: 'Hạt khô' },
        { keywords: ['do-uong'], label: 'Đồ uống' },
        { keywords: ['kem', 'bo', 'pho-mai'], label: 'Kem-bơ-phô mai' },
        { keywords: ['mut', 'siro'], label: 'Mứt siro' },
        { keywords: ['tra', 'ca-phe'], label: 'Trà - cà phê đóng gói' }
      ], 'Thực phẩm khô khác')
    };
  }

  if (normalized.startsWith('cat-tib-')) {
    return {
      category: 'Tiện ích bếp',
      subcategory: pickSubcategoryFromText(normalized, [
        { keywords: ['dung-cu-an-uong'], label: 'Dụng cụ ăn uống' },
        { keywords: ['do-dung-bep', 'noi'], label: 'Đồ dùng bếp' },
        { keywords: ['chat-tay-rua', 'rua-chen'], label: 'Chất tẩy rửa' },
        { keywords: ['dung-cu-ve-sinh', 'ban-chai', 'co-noi'], label: 'Dụng cụ vệ sinh' }
      ], 'Sản phẩm khác')
    };
  }

  return null;
};

const formatPrice = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'Liên hệ';
  }

  return new Intl.NumberFormat('vi-VN').format(value);
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

const relatedSearchGroups: Array<{ triggers: string[]; terms: string[] }> = [
  {
    triggers: ['thit-heo', 'heo', 'lon'],
    terms: ['thịt heo', 'heo', 'ba chỉ', 'ba chỉ heo', 'nạc vai', 'nạc mông', 'sườn heo', 'chân giò']
  },
  {
    triggers: ['thit-bo', 'bo-be', 'bo'],
    terms: ['thịt bò', 'bò', 'bò bê', 'thịt bò cắt lát', 'nạm bò', 'bắp bò']
  },
  {
    triggers: ['thit-ga', 'ga'],
    terms: ['thịt gà', 'gà', 'đùi gà', 'ức gà', 'cánh gà', 'trứng gà']
  },
  {
    triggers: ['hai-san', 'thuy-hai-san', 'ca', 'tom', 'muc'],
    terms: ['hải sản', 'cá', 'tôm', 'mực', 'cá hồi', 'tôm sú', 'mực ống']
  },
  {
    triggers: ['trai-cay', 'hoa-qua'],
    terms: ['trái cây', 'hoa quả', 'táo', 'chuối', 'cam']
  },
  {
    triggers: ['rau-cu-qua', 'rau', 'cu-qua'],
    terms: ['rau củ quả', 'rau', 'củ quả', 'cà chua', 'cà rốt', 'carrot', 'tomato', 'khoai tây']
  },
  {
    triggers: ['gao', 'thuc-pham-kho', 'do-kho'],
    terms: ['gạo', 'thực phẩm khô', 'bún gạo', 'hạt điều']
  }
];

const buildExpandedSearchTerms = (query: string) => {
  const normalizedQuery = toQuerySlug(query);
  const terms = [query];

  relatedSearchGroups.forEach((group) => {
    if (group.triggers.some((trigger) => normalizedQuery.includes(trigger))) {
      terms.push(...group.terms);
    }
  });

  normalizedQuery
    .split('-')
    .filter((part) => part.length >= 2)
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

const fallbackImageByCategory: Record<string, string> = {
  'Rau củ quả': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&h=500&fit=crop',
  'Trái cây': 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=500&h=500&fit=crop',
  'Thực phẩm tươi sống': 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=500&h=500&fit=crop',
  'Thuỷ hải sản': 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=500&h=500&fit=crop',
  'Thực phẩm đông lạnh': 'https://images.unsplash.com/photo-1481070414801-51fd732d7184?w=500&h=500&fit=crop',
  'Thực phẩm khô': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&h=500&fit=crop',
  'Tiện ích bếp': 'https://images.unsplash.com/photo-1584990347449-a1e229ee8b29?w=500&h=500&fit=crop'
};

type ProductCategoryPageProps = {
  categoryName: string;
  initialSubcategory?: string;
};

let cachedCategoryLookup: Record<string, number> | null = null;
const PRODUCT_CACHE_TTL_MS = 15_000;
const PRODUCT_AUTO_REFRESH_MS = 30_000;
const productsResponseCache = new Map<string, { items: ProductItem[]; fetchedAt: number }>();

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
  const [wishlistProduct, setWishlistProduct] = useState<WishlistModalProduct | null>(null);
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

    return inferred?.category ?? rawNames[rawNames.length - 1] ?? (activeSubcategory === 'Tất cả' ? category.name : activeSubcategory);
  };

  const openWishlistModal = (product: ProductItem) => {
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
        const response = await fetch('/graphql', {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: `
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
            `
          })
        });

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

        const query = `
          query SearchProducts($search: String!) {
            products(search: $search, pageSize: 100) {
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
          const response = await fetch('/graphql', {
            method: 'POST',
            signal: controller.signal,
            cache: 'no-store',
            credentials: 'omit',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            body: JSON.stringify({
              query,
              variables: {
                search: searchQuery
              }
            })
          });

          console.info('[FresoSearch][ProductCategoryPage] GraphQL response received', {
            searchQuery,
            requestId,
            status: response.status,
            ok: response.ok
          });

          if (!response.ok) {
            throw new Error(`GraphQL request failed: ${response.status}`);
          }

          const json = await response.json();
          if (json?.errors?.length) {
            console.error('[FresoSearch][ProductCategoryPage] GraphQL returned errors', json.errors);
            throw new Error(json.errors[0]?.message ?? 'GraphQL error');
          }

          const items: GraphQlProductItem[] = json?.data?.products?.items ?? [];
          console.info('[FresoSearch][ProductCategoryPage] raw products received', {
            searchQuery,
            count: items.length,
            skus: items.map((item) => item.sku)
          });
          const mappedProducts = items.map((item) => {
            const imageUrl = item.small_image?.url ?? '';
            const isPlaceholderImage = imageUrl.includes('/placeholder/');
            const inferred = inferCategoryFromSku(item.sku);
            const productCategory = inferred?.category ?? pickCategoryFromGraphQl(item) ?? category.name;
            const fallbackImage =
              fallbackImageByCategory[productCategory] ??
              fallbackImageByCategory[category.name] ??
              'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop';

            return {
              id: item.id,
              sku: item.sku,
              name: item.name,
              price: formatPrice(item.price_range?.minimum_price?.final_price?.value),
              unit: inferUnitByCategory(productCategory),
              image: !imageUrl || isPlaceholderImage ? fallbackImage : imageUrl,
              categoryLabel: inferred?.subcategory ?? pickCategoryFromGraphQl(item) ?? productCategory
            };
          });

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
        const response = await fetch('/graphql', {
          method: 'POST',
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            variables: {
              categoryIds: requestCategoryIds
            }
          })
        });

        if (!response.ok) {
          throw new Error(`GraphQL request failed: ${response.status}`);
        }

        const json = await response.json();
        if (json?.errors?.length) {
          throw new Error(json.errors[0]?.message ?? 'GraphQL error');
        }

        const items: GraphQlProductItem[] = json?.data?.products?.items ?? [];

        const mappedProducts = items
          .map((item) => {
            const imageUrl = item.small_image?.url ?? '';
            const isPlaceholderImage = imageUrl.includes('/placeholder/');
            const fallbackImage =
              fallbackImageByCategory[category.name] ??
              'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop';

            const inferred = inferCategoryFromSku(item.sku);

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
              name: item.name,
              price: formatPrice(item.price_range?.minimum_price?.final_price?.value),
              unit: inferUnitByCategory(inferred?.category ?? category.name),
              image: !imageUrl || isPlaceholderImage ? fallbackImage : imageUrl,
              categoryLabel: getCategoryDisplayLabel(item)
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

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

  const productsToShow = products.slice(0, visibleCount);
  const canLoadMore = visibleCount < products.length;
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
                  onClick={() => applySubcategoryFilter(subcategory)}
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
                        openWishlistModal(product);
                      }}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === 'Enter' || event.key === ' ') {
                          openWishlistModal(product);
                        }
                      }}
                      className="absolute top-2 right-2 bg-white rounded-full p-2 hover:bg-red-50 transition-colors shadow-sm"
                      aria-label={`Yêu thích ${product.name}`}
                    >
                      <Heart className="size-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-500 mb-1">{product.categoryLabel}</p>
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
                          }, sourceImage);
                        }}
                        aria-label={`Thêm ${product.name} vào giỏ`}
                      >
                        <ShoppingCart className="size-4" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-red-500 font-bold">{product.price} đ</p>
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
    />
    </>
  );
}
