import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ShoppingCart,
  PackageSearch,
  Store,
  Sprout,
  Leaf,
  Warehouse,
  Fish,
  Flame,
  Egg,
  Beef,
  Apple
} from 'lucide-react';
import { renderSupplierLogo } from './FeaturedSuppliers';
import { getMockSupplierForProduct } from '../data/mockSuppliers';
import { toCurrencyTextFromNumber, useCart, toCurrencyTextFromLooseValue, toUnitPriceFromLooseValue, parsePrice } from '../cart/CartProvider';
import { inferCategoryFromSku, toQuerySlug, categoryMenu } from '../data/categories';

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
  }>;
  small_image?: { url?: string | null } | null;
  thumbnail?: { url?: string | null } | null;
  price_range?: {
    minimum_price?: {
      final_price?: {
        value?: number;
      };
    };
  };
};

type SupplierDetailPageProps = {
  supplierId: string;
  supplierName: string;
};

// Image fallback maps
const fallbackImageByCategory: Record<string, string> = {
  'Rau củ quả': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&h=500&fit=crop',
  'Trái cây': 'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?w=500&h=500&fit=crop',
  'Thực phẩm tươi sống': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&h=500&fit=crop',
  'Thuỷ hải sản': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&h=500&fit=crop',
  'Thực phẩm đông lạnh': 'https://images.unsplash.com/photo-1518085275467-33d3b764c673?w=500&h=500&fit=crop',
  'Thực phẩm khô': 'https://images.unsplash.com/photo-1511113824147-9759d640248f?w=500&h=500&fit=crop',
  'Tiện ích bếp': 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=500&h=500&fit=crop'
};

const resolveMainCategory = (categoryName: string, sku: string): string => {
  if (!categoryName) {
    const inferred = inferCategoryFromSku(sku);
    return inferred?.category || 'Rau củ quả';
  }
  
  const cleanName = categoryName.trim().toLowerCase();
  
  // 1. Check if it is already a main category
  for (const group of categoryMenu) {
    if (group.name.toLowerCase() === cleanName) {
      return group.name;
    }
  }
  
  // 2. Check if it matches any subcategory
  for (const group of categoryMenu) {
    const matched = group.subcategories.some(
      (sub) => sub.toLowerCase() === cleanName || toQuerySlug(sub) === toQuerySlug(categoryName)
    );
    if (matched) {
      return group.name;
    }
  }
  
  // 3. Fallback to SKU inference
  const inferred = inferCategoryFromSku(sku);
  return inferred?.category || 'Rau củ quả';
};

const inferUnitByCategory = (category: string) => {
  const norm = category.toLowerCase();
  if (norm.includes('tiện ích') || norm.includes('bếp') || norm.includes('nồi') || norm.includes('chảo')) return 'bộ';
  if (norm.includes('hộp') || norm.includes('chai')) return 'chai';
  return 'kg';
};

const formatPrice = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'Liên hệ';
  }
  return new Intl.NumberFormat('vi-VN').format(value);
};

export function SupplierDetailPage({ supplierId, supplierName }: SupplierDetailPageProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [supplierInfo, setSupplierInfo] = useState<any>(null);
  const { openAddToCartModal } = useCart();

  // Load Supplier Meta stats
  useEffect(() => {
    const fetchSupplierInfo = async () => {
      try {
        const response = await fetch('/rest/V1/tmdt-catalog/suppliers', {
          method: 'GET',
          cache: 'no-store'
        });
        if (response.ok) {
          const json = await response.json();
          let items: any[] = [];
          if (Array.isArray(json)) {
            if (json[0] === true && Array.isArray(json[1])) {
              items = json[1];
            } else {
              items = json;
            }
          } else if (json && Array.isArray(json.items)) {
            items = json.items;
          }
          const found = items.find((s: any) => String(s.name).trim().toLowerCase() === supplierName.trim().toLowerCase() || String(s.id) === supplierId);
          if (found) {
            setSupplierInfo(found);
          }
        }
      } catch (err) {
        console.error('Error fetching supplier metadata:', err);
      }
    };
    void fetchSupplierInfo();
  }, [supplierId, supplierName]);

  // Load Products (query root category 2 and filter by supplier)
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const query = `
          query {
            products(filter: { category_id: { in: ["2"] } }, pageSize: 150) {
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

        const response = await fetch('/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query })
        });

        if (!response.ok) {
          throw new Error(`Magento GraphQL request failed: ${response.status}`);
        }

        const json = await response.json();
        if (json?.errors?.length) {
          throw new Error(json.errors[0]?.message ?? 'GraphQL error');
        }

        const items: GraphQlProductItem[] = json?.data?.products?.items ?? [];

        // Load custom local products if any
        const customLocalRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_custom_products') : null;
        let customLocalProducts: any[] = [];
        if (customLocalRaw) {
          try {
            customLocalProducts = JSON.parse(customLocalRaw);
          } catch (e) {
            customLocalProducts = [];
          }
        }

        // Map Magento items
        const mappedProducts: ProductItem[] = items.map((item) => {
          const actualCategory = item.categories?.find((cat) => cat?.name && cat.id !== 2 && cat.id !== 1)?.name 
            || item.categories?.find((cat) => cat?.name)?.name;
          const productCategory = resolveMainCategory(actualCategory || '', item.sku);
          const localMatch = customLocalProducts.find(
            (p) => String(p.sku).trim().toLowerCase() === item.sku.trim().toLowerCase()
          );
          const specialPrice = localMatch ? parsePrice(localMatch.special_price ?? localMatch.specialPrice) : 0;
          const normalPrice = localMatch ? parsePrice(localMatch.price ?? localMatch.priceValue) : 0;
          const localPriceValue = (specialPrice && specialPrice > 0) ? specialPrice : normalPrice;
          const priceValue = localMatch ? localPriceValue : Number(item.price_range?.minimum_price?.final_price?.value ?? 0);
          
          const supplier = getMockSupplierForProduct(item.sku, productCategory);
          const storeName = localMatch?.store_name || '';

          // Image selection
          const fallback = fallbackImageByCategory[productCategory] || 'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop';
          const primaryImage = item.small_image?.url || item.thumbnail?.url || '';
          
          return {
            id: item.id,
            sku: item.sku,
            name: localMatch?.name || item.name,
            price: formatPrice(priceValue),
            priceValue,
            unit: inferUnitByCategory(productCategory),
            image: primaryImage || fallback,
            categoryLabel: productCategory,
            supplierName: storeName || supplier.name,
            supplierRegion: supplier.region
          };
        });

        // Map custom local products
        const mappedCustomProducts: ProductItem[] = customLocalProducts.map((p) => {
          const specialPrice = parsePrice(p.special_price ?? p.specialPrice);
          const normalPrice = parsePrice(p.price ?? p.priceValue);
          const priceValue = (specialPrice && specialPrice > 0) ? specialPrice : normalPrice;
          const productCategory = resolveMainCategory(p.categoryLabel || '', p.sku);
          const supplier = getMockSupplierForProduct(p.sku, productCategory);
          return {
            id: p.id || p.sku,
            sku: p.sku,
            name: p.name,
            price: formatPrice(priceValue),
            priceValue,
            unit: p.unit || 'kg',
            image: p.image || fallbackImageByCategory[productCategory] || 'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop',
            categoryLabel: productCategory,
            supplierName: p.store_name || supplier.name,
            supplierRegion: supplier.region
          };
        });

        // Combine and deduplicate
        const allProducts = [...mappedProducts, ...mappedCustomProducts];
        const uniqueProductsMap = new Map<string, ProductItem>();
        for (const prod of allProducts) {
          const key = String(prod.sku).trim().toLowerCase();
          uniqueProductsMap.set(key, prod);
        }

        // Filter products belonging to this supplier
        const supplierProducts = Array.from(uniqueProductsMap.values()).filter((prod) => {
          const normProdSupplier = String(prod.supplierName).trim().toLowerCase();
          const normTargetSupplier = String(supplierName).trim().toLowerCase();
          return normProdSupplier === normTargetSupplier || normProdSupplier.includes(normTargetSupplier) || normTargetSupplier.includes(normProdSupplier);
        });

        setProducts(supplierProducts);
      } catch (err: any) {
        setLoadError(err.message || 'Lỗi khi tải danh sách sản phẩm nhà vườn.');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchProducts();
  }, [supplierName]);

  const handleBackToHome = () => {
    window.location.href = '/react/index.html';
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-16 font-sans">
      <div className="container mx-auto px-4 py-6">
        
        {/* Back Button */}
        <button
          onClick={handleBackToHome}
          className="flex items-center gap-1.5 text-gray-600 hover:text-emerald-600 font-semibold mb-6 transition-all"
        >
          <ChevronLeft className="size-5" />
          Quay lại trang chủ
        </button>

        {/* Supplier Profile Hero Card */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-8 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-50 rounded-full blur-2xl"></div>
          
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
            {/* Logo */}
            <div className="size-24 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-3xl flex items-center justify-center border-2 border-emerald-200 shadow-sm shrink-0">
              {renderSupplierLogo(supplierInfo?.logo, "size-12")}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left space-y-2">
              <div className="flex flex-col md:flex-row items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">{supplierName}</h1>
                
                <div className="flex gap-1.5">
                  {(supplierInfo?.badges || ['ATTP', 'VietGap']).map((badge: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold uppercase rounded-full"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
              
              <p className="text-xs text-gray-500 font-medium">
                Ngành hàng chủ lực: <strong className="text-gray-700">{supplierInfo?.category || 'Nông sản hữu cơ'}</strong> • Khu vực: <strong className="text-gray-700">{supplierInfo?.seller_province || 'Đà Lạt'}</strong>
              </p>
              
              <p className="text-sm text-gray-500 leading-relaxed max-w-2xl">
                Nhà cung cấp uy tín hợp tác cùng Freso B2B. Cam kết nguồn hàng ổn định, chất lượng đồng đều, hóa đơn VAT đầy đủ, hỗ trợ giao xe lạnh tối ưu độ tươi sạch.
              </p>
            </div>

            {/* Stats Badge */}
            <div className="flex gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 text-center shrink-0">
              <div>
                <span className="block text-[10px] text-gray-400 font-bold uppercase">Khách sỉ</span>
                <strong className="text-lg font-black text-slate-800">{supplierInfo?.stats?.customers || 0}</strong>
              </div>
              <div className="w-[1px] bg-gray-200 self-stretch"></div>
              <div>
                <span className="block text-[10px] text-gray-400 font-bold uppercase">Sản phẩm</span>
                <strong className="text-lg font-black text-slate-800">{products.length}</strong>
              </div>
              <div className="w-[1px] bg-gray-200 self-stretch"></div>
              <div>
                <span className="block text-[10px] text-gray-400 font-bold uppercase">Đơn hàng</span>
                <strong className="text-lg font-black text-slate-800">{supplierInfo?.stats?.branches || 0}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Section Title */}
        <h2 className="text-xl font-bold text-gray-900 mb-6 px-1">
          Danh sách sản phẩm của nhà cung cấp ({products.length})
        </h2>

        {/* Products Grid / Status */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 text-sm font-medium">Đang tải sản phẩm sỉ...</p>
          </div>
        ) : loadError ? (
          <div className="bg-red-50 border border-red-100 rounded-3xl p-8 text-center text-red-600">
            <p className="font-semibold">{loadError}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-16 text-center shadow-sm">
            <PackageSearch className="mx-auto size-16 text-gray-300" />
            <h3 className="mt-4 text-md font-bold text-gray-700">Chưa có sản phẩm nào hiển thị</h3>
            <p className="mt-1 text-sm text-gray-500">
              Không tìm thấy sản phẩm nào thuộc sở hữu của nhà vườn này trong hệ thống.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <article
                key={product.id}
                className="group bg-white rounded-3xl overflow-hidden border border-gray-150 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between"
                onClick={() => {
                  window.location.href = `/react/index.html?view=product&sku=${product.sku}`;
                }}
              >
                {/* Image */}
                <div className="relative overflow-hidden bg-gray-100 aspect-square">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    {/* Category and region */}
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                      {product.categoryLabel}
                    </span>

                    {/* Name */}
                    <h3 className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors text-sm line-clamp-2 leading-snug">
                      {product.name}
                    </h3>
                  </div>

                  {/* Price and Cart button */}
                  <div className="flex items-end justify-between pt-2 border-t border-gray-50">
                    <div>
                      <p className="text-red-500 text-base font-extrabold leading-none">
                        {toCurrencyTextFromNumber(product.priceValue)}
                      </p>
                      <p className="text-[10px] text-gray-400 font-semibold mt-1">Đơn vị: {product.unit}</p>
                    </div>

                    <button
                      type="button"
                      className="size-9 bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white rounded-full flex items-center justify-center transition-colors shadow-xs"
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
                      aria-label="Thêm vào giỏ hàng"
                    >
                      <ShoppingCart className="size-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
