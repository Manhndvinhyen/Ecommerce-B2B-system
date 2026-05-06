import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Heart, ShoppingCart } from 'lucide-react';
import { WishlistAddModal, WishlistModalProduct } from './WishlistAddModal';
import { useCart, toCurrencyTextFromNumber, toUnitPriceFromLooseValue } from '../cart/CartProvider';
import { toQuerySlug } from '../data/categories';

type MagentoProduct = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  origin: string;
  note: string;
  price: number;
  category: string;
  image: string;
  description: {
    features: string;
    benefits: string;
    storage: string;
    expiry: string;
  };
};

const fallbackProduct: MagentoProduct = {
  id: 'RC_0034',
  name: 'Cà chua ta',
  sku: 'RC_0034',
  unit: 'Kg',
  origin: 'Việt Nam',
  note: 'Có thể dùng chế biến salad, nước ép và món xào.',
  price: 38000,
  category: 'Rau củ quả',
  image: '/media/catalog/product/t/o/tomato_1.jpg',
  description: {
    features: 'Cà chua ta tươi, vỏ mỏng, thịt chắc, có vị chua ngọt tự nhiên.',
    benefits: 'Giàu vitamin A, C giúp tăng cường đề kháng và tốt cho da.',
    storage: 'Bảo quản nơi khô thoáng, tránh ánh nắng trực tiếp hoặc để trong ngăn mát.',
    expiry: 'Sử dụng tốt nhất trong 3-5 ngày kể từ khi nhận hàng.'
  }
};

const getQueryParam = (params: URLSearchParams, key: string) => {
  const value = params.get(key);
  return value ? decodeURIComponent(value) : '';
};

const stripHtml = (value?: string | null) => {
  if (!value) return '';
  return value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
};

type ProductDescriptionSections = MagentoProduct['description'];

const normalizeHeadingKey = (value: string) =>
  stripHtml(value)
    .toLowerCase()
    .replace(/[:：]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const parseDescriptionSections = (html?: string | null): Partial<ProductDescriptionSections> => {
  if (!html) return {};

  // Our seed data uses <p><strong>Heading:</strong> content</p> blocks.
  // We'll parse by paragraphs and detect these Vietnamese headings:
  // - Đặc điểm
  // - Công dụng
  // - Cách bảo quản
  // - Thời hạn sử dụng
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const paragraphs = Array.from(tmp.querySelectorAll('p'));

  const result: Partial<ProductDescriptionSections> = {};

  for (const p of paragraphs) {
    const strong = p.querySelector('strong');
    if (!strong) continue;

    const heading = normalizeHeadingKey(strong.textContent ?? '');
    // Clone paragraph to strip out the heading node while keeping the rest as text.
    const clone = p.cloneNode(true) as HTMLParagraphElement;
    const cloneStrong = clone.querySelector('strong');
    if (cloneStrong) cloneStrong.remove();
    const content = stripHtml(clone.innerHTML);
    if (!content) continue;

    if (heading === 'đặc điểm' || heading === 'dac diem') {
      result.features = content;
    } else if (heading === 'công dụng' || heading === 'cong dung') {
      result.benefits = content;
    } else if (heading === 'cách bảo quản' || heading === 'cach bao quan') {
      result.storage = content;
    } else if (heading === 'thời hạn sử dụng' || heading === 'thoi han su dung') {
      result.expiry = content;
    }
  }

  return result;
};

const pickCategoryName = (categories?: Array<{ name?: string | null }>) => {
  const ignored = new Set(['Default Category', 'Root Catalog', 'Products']);
  const match = (categories ?? []).find((cat) => cat?.name && !ignored.has(cat.name));
  return match?.name ?? fallbackProduct.category;
};

export function ProductDetailPage() {
  const { quickAddToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [product, setProduct] = useState<MagentoProduct | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [wishlistProduct, setWishlistProduct] = useState<WishlistModalProduct | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const querySku = getQueryParam(params, 'sku');
  const queryId = getQueryParam(params, 'id');
  const queryName = getQueryParam(params, 'name');
  const hasQuery = Boolean(querySku || queryId || queryName);
  const canQueryMagento = Boolean(querySku || queryName);

  const isLoggedIn = Boolean(
    window.localStorage.getItem('freso_customer_token') ||
      window.sessionStorage.getItem('freso_customer_token')
  );

  const stopHold = () => {
    if (holdTimerRef.current) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopHold();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchProduct = async () => {
      if (!hasQuery) {
        setProduct(null);
        setIsLoading(false);
        setLoadError('');
        return;
      }

      if (!canQueryMagento) {
        setProduct(null);
        setIsLoading(false);
        setLoadError('Thiếu SKU hoặc tên sản phẩm để tải dữ liệu.');
        return;
      }

      setIsLoading(true);
      setLoadError('');
      setProduct(null);

        const query = querySku
          ? `
        query ProductDetail($sku: String!) {
          products(filter: { sku: { eq: $sku } }, pageSize: 1) {
            items {
              id
              sku
              name
              description { html }
              short_description { html }
              categories { name }
              small_image { url }
              price_range {
                minimum_price {
                  final_price { value }
                }
              }
              country_of_manufacture
            }
          }
        }
        `
          : `
        query ProductDetail($name: String!) {
          products(filter: { name: { match: $name } }, pageSize: 1) {
            items {
              id
              sku
              name
              description { html }
              short_description { html }
              categories { name }
              small_image { url }
              price_range {
                minimum_price {
                  final_price { value }
                }
              }
              country_of_manufacture
            }
          }
        }
        `;

      try {
        const graphqlUrl = `${window.location.origin}/graphql`;
        const response = await fetch(graphqlUrl, {
          method: 'POST',
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            variables: querySku ? { sku: querySku } : { name: queryName || '' }
          })
        });

        if (!response.ok) {
          const responseText = await response.text().catch(() => '');
          throw new Error(`GraphQL request failed: ${response.status} ${response.statusText} ${responseText}`);
        }

        const json = await response.json();
        if (json?.errors?.length) {
          throw new Error(json.errors[0]?.message ?? 'GraphQL error');
        }

        const item = json?.data?.products?.items?.[0];
        if (!item) {
          throw new Error('Không tìm thấy sản phẩm.');
        }

  const price = Number(item.price_range?.minimum_price?.final_price?.value ?? fallbackProduct.price);
  const imageUrl = item.small_image?.url || fallbackProduct.image;
  const descriptionHtml = item.description?.html;
  const descriptionText = stripHtml(descriptionHtml);
  const shortDescriptionText = stripHtml(item.short_description?.html);
  const parsed = parseDescriptionSections(descriptionHtml);
  const combinedDescription = descriptionText || shortDescriptionText || fallbackProduct.description.features;

        setProduct({
          id: String(item.id ?? fallbackProduct.id),
          name: item.name ?? fallbackProduct.name,
          sku: item.sku ?? fallbackProduct.sku,
          unit: fallbackProduct.unit,
          origin: item.country_of_manufacture || fallbackProduct.origin,
          note: shortDescriptionText || fallbackProduct.note,
          price,
          category: pickCategoryName(item.categories),
          image: imageUrl,
          description: {
            ...fallbackProduct.description,
            features: parsed.features || combinedDescription,
            benefits: parsed.benefits || shortDescriptionText || fallbackProduct.description.benefits,
            storage: parsed.storage || fallbackProduct.description.storage,
            expiry: parsed.expiry || fallbackProduct.description.expiry
          }
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setLoadError('Không tải được dữ liệu sản phẩm từ Magento. Vui lòng thử lại.');
        console.error('[ProductDetailPage] fetchProduct failed', {
          error,
          querySku,
          queryName,
          location: window.location.href
        });
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchProduct();

    return () => controller.abort();
  }, [canQueryMagento, hasQuery, queryId, queryName, querySku]);

  const updateQuantity = (delta: number) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  const startHold = (delta: number) => {
    updateQuantity(delta);
    stopHold();
    holdTimerRef.current = window.setInterval(() => updateQuantity(delta), 120);
  };

  const handleAddToCart = async () => {
    if (!product) {
      return;
    }
    // Add straight to cart (no modal).
    // Quantity should be added to cart, but cart badge should count distinct items.
    const sourceElement = imageRef.current ?? document.getElementById('pdp-product-image');
    await quickAddToCart(
      {
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        priceText: toCurrencyTextFromNumber(product.price),
        unit: product.unit,
        unitPrice: toUnitPriceFromLooseValue(product.price),
        image: product.image
      },
      quantity,
      sourceElement
    );
  };

  const openWishlistModal = () => {
    if (!product) return;
    setWishlistProduct({
      sku: product.sku,
      name: product.name,
      priceText: toCurrencyTextFromNumber(product.price),
      priceValue: product.price,
      unit: product.unit,
      image: product.image,
      category: product.category
    });
    setIsFavorite(true);
  };

  return (
    <div className="bg-[#f6f8f7] pb-20 text-gray-800">
  <div className="container mx-auto px-4 pb-12 pt-8">
        {!hasQuery ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
            Thiếu thông tin sản phẩm để hiển thị.
          </div>
        ) : isLoading ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800 text-sm">
            Đang tải dữ liệu sản phẩm...
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
            {loadError}
          </div>
        ) : !product ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-700 text-sm">
            Không có dữ liệu sản phẩm.
          </div>
        ) : (
          <>
        {/* Breadcrumb */}
  <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-gray-400">
          <a href="/react/index.html" className="hover:text-green-600 transition-colors">
            Trang chủ
          </a>
          <ChevronRight className="size-3" />
          <a
            href={`/react/index.html?view=category&category=${toQuerySlug(product.category)}`}
            className="hover:text-green-600 transition-colors"
          >
            {product.category}
          </a>
          <ChevronRight className="size-3" />
          <span className="text-gray-500">{product.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          {/* Product Image Section */}
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="group relative overflow-hidden rounded-2xl bg-gray-50">
              <img
                id="pdp-product-image"
                ref={imageRef}
                src={product.image}
                alt={product.name}
                className="h-[420px] w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <p className="mt-4 text-sm text-gray-500">* Hình ảnh mang tính minh hoạ</p>
          </div>

          {/* Product Information Section */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
                <p className="mt-2 text-sm text-gray-500">Sản phẩm tươi sạch dành cho doanh nghiệp B2B</p>
              </div>
              <button
                type="button"
                onClick={openWishlistModal}
                className={`group relative flex h-10 w-10 items-center justify-center rounded-full border transition-all ${
                  isFavorite
                    ? 'border-rose-200 bg-rose-50 text-rose-500'
                    : 'border-gray-200 bg-white text-gray-400 hover:text-rose-500'
                }`}
                title="Thêm vào danh sách yêu thích"
                aria-label="Thêm vào danh sách yêu thích"
              >
                <Heart className={`size-5 ${isFavorite ? 'fill-rose-400' : ''}`} />
              </button>
            </div>

            <dl className="mt-6 grid gap-3 text-sm">
              <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                <dt className="text-gray-500">Mã SKU</dt>
                <dd className="font-semibold text-gray-800">{product.sku}</dd>
              </div>
              <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                <dt className="text-gray-500">Đơn vị tính</dt>
                <dd className="font-semibold text-gray-800">{product.unit}</dd>
              </div>
              <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                <dt className="text-gray-500">Xuất xứ</dt>
                <dd className="font-semibold text-gray-800">{product.origin}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-gray-500">Ghi chú</dt>
                <dd className="flex-1 text-right font-semibold text-gray-800">{product.note || 'Không có ghi chú'}</dd>
              </div>
            </dl>

            <div className="mt-6 rounded-2xl bg-green-50/60 p-4">
              <div className="flex items-end gap-3">
                <span className="text-3xl font-bold text-green-700">
                  {toCurrencyTextFromNumber(product.price)}
                </span>
                <span className="text-sm text-gray-500">/{product.unit}</span>
              </div>
              {!isLoggedIn && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  <span>Vui lòng đăng nhập/đăng ký để đặt hàng ngay</span>
                  <a
                    href="/react/index.html?view=login"
                    className="rounded-full border border-green-600 px-4 py-1.5 text-sm font-semibold text-green-600 hover:bg-green-600 hover:text-white transition-colors"
                  >
                    Đăng nhập
                  </a>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center rounded-full border border-gray-300 bg-white">
                <button
                  type="button"
                  onMouseDown={() => startHold(-1)}
                  onMouseUp={stopHold}
                  onMouseLeave={stopHold}
                  onTouchStart={() => startHold(-1)}
                  onTouchEnd={stopHold}
                  className="px-4 py-2 text-gray-500 hover:text-green-700"
                  aria-label="Giảm số lượng"
                >
                  -
                </button>
                <span className="min-w-12 text-center text-base font-semibold text-gray-800">{quantity}</span>
                <button
                  type="button"
                  onMouseDown={() => startHold(1)}
                  onMouseUp={stopHold}
                  onMouseLeave={stopHold}
                  onTouchStart={() => startHold(1)}
                  onTouchEnd={stopHold}
                  className="px-4 py-2 text-gray-500 hover:text-green-700"
                  aria-label="Tăng số lượng"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <ShoppingCart className="size-5" />
                Thêm vào giỏ hàng
              </button>
            </div>
          </div>
        </div>

        {/* Product Description Section */}
        <section className="mt-10 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">Mô tả sản phẩm</h2>
          <div className="mt-4 space-y-4 text-sm text-gray-600">
            <div>
              <h3 className="font-semibold text-gray-800">Đặc điểm</h3>
              <p>{product.description.features}</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Công dụng</h3>
              <p>{product.description.benefits}</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Cách bảo quản</h3>
              <p>{product.description.storage}</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Thời hạn sử dụng</h3>
              <p>{product.description.expiry}</p>
            </div>
          </div>
        </section>

          </>
        )}
      </div>
    </div>
    <WishlistAddModal
      isOpen={Boolean(wishlistProduct)}
      product={wishlistProduct}
      onClose={() => setWishlistProduct(null)}
    />
  );
}
