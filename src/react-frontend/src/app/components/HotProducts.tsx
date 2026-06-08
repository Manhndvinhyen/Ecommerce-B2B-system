import { useEffect, useMemo, useState } from 'react';
import { Heart, ChevronRight, ShoppingCart } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { toCurrencyTextFromLooseValue, toUnitPriceFromLooseValue, useCart } from '../cart/CartProvider';

const categoryAliasMap: Record<string, string[]> = {
  'Rau củ quả': ['Rau gia vị', 'Rau phổ thông', 'Củ quả', 'Rau củ', 'Rau lá'],
  'Rau gia vị': ['Rau gia vị'],
  'Rau phổ thông': ['Rau phổ thông'],
  'Củ quả': ['Củ quả', 'Rau củ'],
  'Thực phẩm tươi sống': ['Thịt Heo'],
  'Thịt heo': ['Thịt Heo']
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

type GraphQlProductItem = {
  id: number;
  sku: string;
  name: string;
  categories?: Array<{ name?: string | null }>;
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

const fallbackCategoryByQuery = (product: GraphQlProductItem) => {
  const ignored = new Set(['Root Catalog', 'Default Category', 'Products']);
  const category = (product.categories ?? [])
    .map((item) => item.name ?? '')
    .find((name) => name && !ignored.has(name));
  return category || 'Rau củ quả';
};

const getMagentoMediaImageUrl = (file?: string | null) => {
  if (!file || !file.trim()) return '';
  const normalizedFile = file.startsWith('/') ? file : `/${file}`;
  return `${window.location.origin}/media/catalog/product${normalizedFile}`;
};

const fixMagentoUrl = (url?: string | null) => {
  if (!url || !url.trim()) return '';
  if (typeof window === 'undefined') return url;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.includes('/media/catalog/product')) {
      return `${window.location.origin}${parsed.pathname}`;
    }
    return url;
  } catch {
    return url;
  }
};

const pickMagentoProductImage = (product: any, fallback: string) => {
  const galleryImage = (product?.media_gallery_entries ?? []).find((entry: any) => {
    const file = entry.file?.trim() ?? '';
    return file && !file.toLowerCase().includes('placeholder');
  });

  const candidates = [
    getMagentoMediaImageUrl(galleryImage?.file),
    fixMagentoUrl(product?.small_image?.url),
    fixMagentoUrl(product?.thumbnail?.url)
  ];

  return candidates.find((value) => value && !value.toLowerCase().includes('/placeholder/')) || fallback;
};

export function HotProducts() {
  const { openAddToCartModal } = useCart();
  const productsPerPage = 5;
  const [page, setPage] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const syncCategoryFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setSelectedCategory(params.get('category') ?? '');
    };

    syncCategoryFromUrl();
    window.addEventListener('popstate', syncCategoryFromUrl);
    return () => window.removeEventListener('popstate', syncCategoryFromUrl);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadProducts = async () => {
      setIsLoading(true);

      try {
        const response = await fetch('/graphql', {
          method: 'POST',
          signal: controller.signal,
          cache: 'no-store',
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: `
              query HotProductsHome($pageSize: Int!) {
                products(filter: { category_id: { in: ["2"] } }, pageSize: $pageSize) {
                  items {
                    id
                    sku
                    name
                    categories { name }
                    small_image { url }
                    thumbnail { url }
                    media_gallery_entries { file disabled }
                    price_range {
                      minimum_price {
                        final_price { value }
                      }
                    }
                  }
                }
              }
            `,
            variables: {
              pageSize: 20
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

        const customLocalRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_custom_products') : null;
        let customLocalProducts: Array<{ sku?: string; image?: string; categoryLabel?: string; name?: string; price?: number; priceValue?: number; unit?: string; store_name?: string }> = [];
        if (customLocalRaw) {
          try {
            customLocalProducts = JSON.parse(customLocalRaw);
          } catch {
            customLocalProducts = [];
          }
        }

        const localBySku = new Map(
          customLocalProducts
            .filter((item) => item?.sku)
            .map((item) => [String(item.sku).trim().toLowerCase(), item] as const)
        );

        const mapped = (json?.data?.products?.items ?? []).map((item: GraphQlProductItem) => {
          const category = fallbackCategoryByQuery(item);
          const localMatch = localBySku.get(item.sku.trim().toLowerCase());
          const localImage = localMatch?.image ?? '';
          const resolvedImage =
            (localImage && !String(localImage).toLowerCase().includes('placeholder') ? localImage : '') ||
            pickMagentoProductImage(
              item,
              category === 'Trái cây'
                ? 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&h=400&fit=crop'
                : category === 'Thuỷ hải sản'
                  ? 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=400&h=400&fit=crop'
                  : 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=400&fit=crop'
            ) ||
            localImage ||
            (category === 'Trái cây'
              ? 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&h=400&fit=crop'
              : category === 'Thuỷ hải sản'
                ? 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=400&h=400&fit=crop'
                : 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=400&fit=crop');

          return {
            sku: item.sku,
            name: localMatch?.name || item.name,
            category,
            price: Number(localMatch?.price ?? localMatch?.priceValue ?? item.price_range?.minimum_price?.final_price?.value ?? 0),
            unit: localMatch?.unit || (category === 'Tiện ích bếp' ? 'bộ' : 'kg'),
            image: resolvedImage,
            hot: true
          };
        });

        setProducts(mapped);
      } catch (err) {
        console.error('[HotProducts] Failed to load hot products:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();

    return () => controller.abort();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) {
      return products;
    }

    const aliases = categoryAliasMap[selectedCategory] ?? [selectedCategory];
    const normalizedAliases = aliases.map(normalize);

    return products.filter((product) => {
      const normalizedProductCategory = normalize(product.category);
      return normalizedAliases.some((alias) => normalizedProductCategory.includes(alias));
    });
  }, [products, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage));
  const visibleProducts = useMemo(() => {
    const start = page * productsPerPage;
    return filteredProducts.slice(start, start + productsPerPage);
  }, [filteredProducts, page]);

  useEffect(() => {
    setPage(0);
  }, [selectedCategory]);

  const handleNext = () => {
    setPage((prev) => (prev + 1) % totalPages);
  };

  return (
    <section id="san-pham-hien-thi" className="py-8 bg-white scroll-mt-28">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            Sản phẩm HOT
            <span className="text-yellow-500">⚡</span>
          </h2>
          {selectedCategory && (
            <span className="hidden md:inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              Danh mục: {selectedCategory}
            </span>
          )}
          <button
            onClick={handleNext}
            disabled={filteredProducts.length <= productsPerPage}
            className="bg-white border border-gray-200 rounded-full p-2 text-green-600 hover:text-green-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Xem thêm sản phẩm HOT"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {selectedCategory && filteredProducts.length === 0 && !isLoading && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Chưa có sản phẩm nào thuộc danh mục “{selectedCategory}”. Hãy chọn danh mục khác.
          </div>
        )}

        {/* Products Grid / Skeletons */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse flex flex-col gap-3 h-[300px]"
              >
                <div className="aspect-square bg-gray-100 rounded-xl flex-1"></div>
                <div className="h-4 bg-gray-100 rounded-md w-1/3"></div>
                <div className="h-5 bg-gray-100 rounded-md w-3/4"></div>
                <div className="h-4 bg-gray-100 rounded-md w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Không có sản phẩm nổi bật nào.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {visibleProducts.map((product, index) => {
              const productKey = `${product.name}-${product.category}`;

              return (
                <div
                  key={`${product.name}-${index}`}
                  className="bg-white rounded-2xl border border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const targetUrl = `/react/index.html?view=product&sku=${encodeURIComponent(product.sku)}`;
                    window.location.href = targetUrl;
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      const targetUrl = `/react/index.html?view=product&sku=${encodeURIComponent(product.sku)}`;
                      window.location.href = targetUrl;
                    }
                  }}
                >
                  {/* Product Image */}
                  <div className="relative aspect-square overflow-hidden bg-gray-50">
                    <ImageWithFallback
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />

                    {/* Hot Badge */}
                    {product.hot && (
                      <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-lg text-xs font-bold">
                        HOT
                      </div>
                    )}

                    {/* Favorite Button */}
                    <button
                      className="absolute top-2 right-2 bg-white rounded-full p-2 hover:bg-red-50 transition-colors shadow-sm"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Heart className="size-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>

                  {/* Product Info */}
                  <div className="p-3">
                    <p className="text-xs text-gray-500 mb-1">{product.category}</p>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-900 group-hover:text-green-600 transition-colors line-clamp-2">
                        {product.name}
                      </h3>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          const sourceImage = event.currentTarget.closest('div')?.querySelector('img');
                          openAddToCartModal({
                            id: productKey,
                            sku: product.sku,
                            name: product.name,
                            category: product.category,
                            priceText: toCurrencyTextFromLooseValue(product.price),
                            unit: product.unit,
                            unitPrice: toUnitPriceFromLooseValue(product.price),
                            image: product.image,
                          }, sourceImage ?? undefined);
                        }}
                        className="rounded-full p-1.5 transition-colors bg-transparent text-gray-400 hover:bg-gray-100 hover:text-green-600 shrink-0"
                        aria-label={`Thêm nhanh ${product.name} vào giỏ hàng`}
                      >
                        <ShoppingCart className="size-4" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-red-500 font-bold">{toCurrencyTextFromLooseValue(product.price)}</p>
                      <p className="text-xs text-gray-500">({product.unit}) - Chưa bao gồm VAT</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
