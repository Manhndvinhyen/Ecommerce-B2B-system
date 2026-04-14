import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ShoppingCart, Heart } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import {
  categoryMenu,
  getCategoryId,
  getCategoryPageLink,
  getSubcategoryId,
  getSubcategoryNameFromQuery,
  toQuerySlug
} from '../data/categories';

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
  small_image?: { url?: string | null } | null;
  price_range?: {
    minimum_price?: {
      final_price?: {
        value?: number;
      };
    };
  };
};

const formatPrice = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'Liên hệ';
  }

  return new Intl.NumberFormat('vi-VN').format(value);
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

export function ProductCategoryPage({ categoryName, initialSubcategory }: ProductCategoryPageProps) {
  const category = useMemo(() => {
    return categoryMenu.find((item) => item.name === categoryName) ?? categoryMenu[0];
  }, [categoryName]);

  const [activeSubcategory, setActiveSubcategory] = useState(initialSubcategory ?? 'Tất cả');
  const [visibleCount, setVisibleCount] = useState(10);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

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

    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.pushState({}, '', nextUrl);
  };

  useEffect(() => {
    const fetchProducts = async () => {
      const parentCategoryId = getCategoryId(category.name);
      const subcategoryIds = category.subcategories
        .map((subcategory) => getSubcategoryId(category.name, subcategory))
        .filter((id): id is number => Boolean(id));

      const categoryIds =
        activeSubcategory === 'Tất cả'
          ? [parentCategoryId, ...subcategoryIds].filter((id): id is number => Boolean(id))
          : [getSubcategoryId(category.name, activeSubcategory)].filter((id): id is number => Boolean(id));

      if (!categoryIds.length) {
        setProducts([]);
        setLoadError('Không tìm thấy cấu hình danh mục phù hợp.');
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
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            variables: {
              categoryIds: categoryIds.map((id) => String(id))
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

        setProducts(
          items.map((item) => {
            const imageUrl = item.small_image?.url ?? '';
            const isPlaceholderImage = imageUrl.includes('/placeholder/');
            const fallbackImage =
              fallbackImageByCategory[category.name] ??
              'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop';

            return {
              id: item.id,
              sku: item.sku,
              name: item.name,
              price: formatPrice(item.price_range?.minimum_price?.final_price?.value),
              unit: 'SP',
              image: !imageUrl || isPlaceholderImage ? fallbackImage : imageUrl,
              categoryLabel: activeSubcategory === 'Tất cả' ? category.name : activeSubcategory
            };
          })
        );
      } catch (error) {
        setProducts([]);
        setLoadError('Không tải được dữ liệu sản phẩm từ database.');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [category.name, activeSubcategory]);

  const productsToShow = products.slice(0, visibleCount);
  const canLoadMore = visibleCount < products.length;
  const breadcrumbItems = [
    {
      label: 'Trang chủ',
      href: './index.html'
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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Các loại {category.name}</h1>

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
            Chưa có sản phẩm trong danh mục này.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {productsToShow.map((product) => (
                <article
                  key={product.id}
                  className="bg-white rounded-2xl border border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer"
                >
                  <div className="relative aspect-square overflow-hidden bg-gray-50">
                    <ImageWithFallback
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <button
                      type="button"
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
                        aria-label={`Thêm ${product.name} vào giỏ`}
                      >
                        <ShoppingCart className="size-4" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-red-500 font-bold">{product.price} đ</p>
                      <p className="text-xs text-gray-500">({product.unit}) - Dữ liệu từ database</p>
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
  );
}
