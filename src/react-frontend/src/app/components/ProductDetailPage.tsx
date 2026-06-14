import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Heart, ShoppingCart } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { WishlistAddModal, WishlistModalProduct } from './WishlistAddModal';
import { useCart, toCurrencyTextFromNumber, toUnitPriceFromLooseValue, parsePrice } from '../cart/CartProvider';
import { toQuerySlug } from '../data/categories';
import { applySeo, buildBreadcrumbJsonLd, buildProductJsonLd, getSiteName } from '../utils/seo';
import { getMockSupplierForProduct } from '../data/mockSuppliers';

type WholesaleTier = {
  qty: number;
  discount: number;
};

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
  wholesale_tiers?: WholesaleTier[];
  store_name?: string;
};

const pickBestImageUrl = (...candidates: Array<string | null | undefined>) => {
  const chosen = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return chosen ?? '';
};

type GraphQlMediaEntry = {
  file?: string | null;
  disabled?: boolean | null;
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

const getBestMagentoProductImage = (
  product: {
    small_image?: { url?: string | null } | null;
    thumbnail?: { url?: string | null } | null;
    media_gallery_entries?: GraphQlMediaEntry[];
  },
  fallback: string
) => {
  const galleryImage = (product.media_gallery_entries ?? []).find((entry) => {
    const file = entry.file?.trim() ?? '';
    return file && !file.toLowerCase().includes('placeholder');
  });

  const candidates = [
    getMagentoMediaImageUrl(galleryImage?.file),
    fixMagentoUrl(product.small_image?.url),
    fixMagentoUrl(product.thumbnail?.url)
  ];

  return candidates.find((value) => value && !value.toLowerCase().includes('/placeholder/')) || '';
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

const normalizeLookupValue = (value?: string | number | null) => String(value ?? '').trim().toLowerCase();

const productMatchesLookup = (
  candidate: any,
  querySku: string,
  queryId: string,
  queryName: string
) => {
  const normalizedSku = normalizeLookupValue(querySku);
  const normalizedId = normalizeLookupValue(queryId);
  const normalizedName = normalizeLookupValue(queryName);

  return (
    (normalizedSku && normalizeLookupValue(candidate?.sku) === normalizedSku) ||
    (normalizedId && normalizeLookupValue(candidate?.id) === normalizedId) ||
    (normalizedName && normalizeLookupValue(candidate?.name) === normalizedName)
  );
};

const mapFallbackProductToDetail = (fallbackCandidate: any): MagentoProduct => {
  const fallbackImage = 'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop';
  const localImage =
    getBestMagentoProductImage(fallbackCandidate, fallbackImage) ||
    pickBestImageUrl(fallbackCandidate?.image, fallbackCandidate?.thumbnail?.url) ||
    fallbackImage;

  const category = fallbackCandidate?.categoryLabel || fallbackCandidate?.category || 'Sản phẩm sỉ';
  const supplier = getMockSupplierForProduct(fallbackCandidate?.sku, category);

  return {
    id: String(fallbackCandidate?.id || fallbackCandidate?.sku),
    name: fallbackCandidate?.name || fallbackProduct.name,
    sku: fallbackCandidate?.sku || fallbackProduct.sku,
    unit: fallbackCandidate?.unit || fallbackProduct.unit,
    origin: fallbackCandidate?.origin || fallbackProduct.origin,
    note: fallbackCandidate?.note || fallbackCandidate?.short_description?.html || fallbackProduct.note,
    price: (fallbackCandidate?.special_price || fallbackCandidate?.specialPrice || fallbackCandidate?.price || fallbackCandidate?.priceValue)
      ? parsePrice(fallbackCandidate?.special_price || fallbackCandidate?.specialPrice || fallbackCandidate?.price || fallbackCandidate?.priceValue)
      : fallbackProduct.price,
    category,
    image: localImage,
    description: {
      features: fallbackCandidate?.description?.features || 'Sản phẩm nông sản/thực phẩm sỉ chất lượng cao cung cấp trực tiếp bởi nhà vườn/nhà phân phối uy tín.',
      benefits: fallbackCandidate?.description?.benefits || 'Cung cấp nguồn hàng sỉ ổn định cho nhà hàng, cửa hàng kinh doanh ăn uống với giá cả cạnh tranh nhất.',
      storage: fallbackCandidate?.description?.storage || fallbackProduct.description.storage,
      expiry: fallbackCandidate?.description?.expiry || fallbackProduct.description.expiry
    },
    wholesale_tiers: fallbackCandidate?.wholesale_tiers || [],
    store_name: fallbackCandidate?.store_name || `${supplier.name} · ${supplier.region}`
  };
};

const findLocalProductFallback = (querySku: string, queryId: string, queryName: string) => {
  const customLocalRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_custom_products') : null;
  if (!customLocalRaw) {
    return null;
  }

  try {
    const customLocalProducts = JSON.parse(customLocalRaw);
    if (!Array.isArray(customLocalProducts)) {
      return null;
    }

    return customLocalProducts.find((product: any) => productMatchesLookup(product, querySku, queryId, queryName)) ?? null;
  } catch (error) {
    console.error('Error parsing local custom products in fallback', error);
    return null;
  }
};

const fetchSellerProductFallback = async (
  querySku: string,
  queryId: string,
  queryName: string,
  signal: AbortSignal
) => {
  const token =
    window.localStorage.getItem('freso_customer_token') ||
    window.sessionStorage.getItem('freso_customer_token') ||
    '';

  if (!token) {
    return null;
  }

  const response = await fetch(`${window.location.origin}/rest/V1/tmdt-catalog/products`, {
    method: 'GET',
    signal,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    return null;
  }

  const products = await response.json();
  if (!Array.isArray(products)) {
    return null;
  }

  return products.find((product: any) => productMatchesLookup(product, querySku, queryId, queryName)) ?? null;
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
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [wishlistProduct, setWishlistProduct] = useState<WishlistModalProduct | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const activeTier = useMemo(() => {
    if (!product || !product.wholesale_tiers) return null;
    return product.wholesale_tiers
      .filter((t) => quantity >= t.qty)
      .sort((a, b) => b.qty - a.qty)[0] || null;
  }, [product, quantity]);

  const discountPercent = activeTier ? activeTier.discount : 0;
  const currentUnitPrice = product ? product.price * (1 - discountPercent / 100) : 0;
  const subtotalPrice = product ? currentUnitPrice * quantity : 0;

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
              thumbnail { url }
              media_gallery_entries { file disabled }
              price_range {
                minimum_price {
                  final_price { value }
                }
              }
              price_tiers {
                quantity
                discount { percent_off }
                final_price { value }
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
              thumbnail { url }
              media_gallery_entries { file disabled }
              price_range {
                minimum_price {
                  final_price { value }
                }
              }
              price_tiers {
                quantity
                discount { percent_off }
                final_price { value }
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
          credentials: 'omit',
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
  const imageUrl = getBestMagentoProductImage(item, fallbackProduct.image);
  const descriptionHtml = item.description?.html;
  const descriptionText = stripHtml(descriptionHtml);
  const shortDescriptionText = stripHtml(item.short_description?.html);
  const parsed = parseDescriptionSections(descriptionHtml);
  const combinedDescription = descriptionText || shortDescriptionText || fallbackProduct.description.features;

        // Check if there is a local custom configuration for this SKU
        let localCustomFields: any = {};
        const customLocalRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_custom_products') : null;
        if (customLocalRaw) {
          try {
            const customLocalProducts = JSON.parse(customLocalRaw);
            const localProd = customLocalProducts.find((p: any) => p.sku === item.sku);
            if (localProd) {
              localCustomFields = localProd;
            }
          } catch (e) {
            // Ignore
          }
        }

        const resolvedImage = imageUrl || pickBestImageUrl(localCustomFields.image) || fallbackProduct.image;

        if (resolvedImage && resolvedImage !== localCustomFields.image && customLocalRaw) {
          try {
            const customLocalProducts = JSON.parse(customLocalRaw);
            const nextCustomLocalProducts = Array.isArray(customLocalProducts)
              ? customLocalProducts.map((p: any) =>
                  p?.sku === item.sku ? { ...p, image: resolvedImage } : p
                )
              : customLocalProducts;
            window.localStorage.setItem('freso_custom_products', JSON.stringify(nextCustomLocalProducts));
          } catch {
            // Ignore cache healing errors.
          }
        }

        setProduct({
          id: String(item.id ?? fallbackProduct.id),
          name: item.name ?? fallbackProduct.name,
          sku: item.sku ?? fallbackProduct.sku,
          unit: localCustomFields.unit || fallbackProduct.unit,
          origin: localCustomFields.origin || item.country_of_manufacture || fallbackProduct.origin,
          note: localCustomFields.note || shortDescriptionText || fallbackProduct.note,
          price: (localCustomFields.price || localCustomFields.priceValue) ? parsePrice(localCustomFields.price || localCustomFields.priceValue) : price,
          category: pickCategoryName(item.categories),
          image: resolvedImage,
          description: {
            features: localCustomFields.description?.features || parsed.features || combinedDescription,
            benefits: localCustomFields.description?.benefits || parsed.benefits || shortDescriptionText || fallbackProduct.description.benefits,
            storage: localCustomFields.description?.storage || parsed.storage || fallbackProduct.description.storage,
            expiry: localCustomFields.description?.expiry || parsed.expiry || fallbackProduct.description.expiry
          },
          wholesale_tiers: localCustomFields.wholesale_tiers || item.wholesale_tiers || (item.price_tiers ? item.price_tiers.map((t: any) => ({
            qty: t.quantity,
            discount: t.discount?.percent_off || Math.round((1 - (t.final_price?.value / price)) * 100)
          })) : []),
          store_name: localCustomFields.store_name || (() => {
            const supplier = getMockSupplierForProduct(item.sku, pickCategoryName(item.categories));
            return `${supplier.name} · ${supplier.region}`;
          })()
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const localProduct = findLocalProductFallback(querySku, queryId, queryName);
        if (localProduct) {
          setProduct(mapFallbackProductToDetail(localProduct));
          return;
        }

        try {
          const sellerProduct = await fetchSellerProductFallback(querySku, queryId, queryName, controller.signal);
          if (sellerProduct) {
            setProduct(mapFallbackProductToDetail(sellerProduct));
            return;
          }
        } catch (fallbackError) {
          if (controller.signal.aborted) {
            return;
          }
          console.error('[ProductDetailPage] seller product fallback failed', fallbackError);
        }

        // Check if the product sku/name exists in the custom local products (localStorage)
        const customLocalRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_custom_products') : null;
        if (customLocalRaw) {
          try {
            const customLocalProducts = JSON.parse(customLocalRaw);
            const localProd = customLocalProducts.find((p: any) =>
              (querySku && p.sku === querySku) || (queryName && p.name === queryName)
            );
            if (localProd) {
              const localImage =
                getBestMagentoProductImage(localProd, 'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop') ||
                pickBestImageUrl(localProd.image, localProd.thumbnail?.url) ||
                'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop';
              setProduct({
                id: String(localProd.id || localProd.sku),
                name: localProd.name,
                sku: localProd.sku,
                unit: localProd.unit || 'kg',
                origin: localProd.origin || 'Việt Nam',
                note: localProd.note || 'Sản phẩm sỉ B2B',
                price: (localProd.price || localProd.priceValue) ? parsePrice(localProd.price || localProd.priceValue) : 0,
                category: localProd.categoryLabel || 'Sản phẩm sỉ',
                image: localImage,
                description: {
                  features: localProd.description?.features || 'Sản phẩm nông sản/thực phẩm sỉ chất lượng cao cung cấp trực tiếp bởi nhà vườn/nhà phân phối uy tín.',
                  benefits: localProd.description?.benefits || 'Cung cấp nguồn hàng sỉ ổn định cho nhà hàng, cửa hàng kinh doanh ăn uống với giá cả cạnh tranh nhất.',
                  storage: localProd.description?.storage || 'Bảo quản ở điều kiện nhiệt độ phòng hoặc ngăn mát tủ lạnh tùy thuộc vào chủng loại sản phẩm.',
                  expiry: localProd.description?.expiry || 'Sử dụng tốt nhất trong vòng 3 - 7 ngày kể từ ngày giao hàng.'
                },
                wholesale_tiers: localProd.wholesale_tiers || [],
                store_name: localProd.store_name || (() => {
                  const supplier = getMockSupplierForProduct(localProd.sku, localProd.categoryLabel || 'Sản phẩm sỉ');
                  return `${supplier.name} · ${supplier.region}`;
                })()
              });
              return;
            }
          } catch (e) {
            console.error('Error parsing local custom products in fallback', e);
          }
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

  const updateQuantityFromInput = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    setQuantity(Number.isFinite(parsed) ? Math.max(1, parsed) : 1);
  };

  useEffect(() => {
    if (!product) {
      return;
    }

    const canonicalPath = `/react/index.html?view=product&sku=${encodeURIComponent(product.sku)}`;
    const description = product.note || product.description.features || `${product.name} trên ${getSiteName()}.`;
    const productJsonLd = buildProductJsonLd({
      name: product.name,
      sku: product.sku,
      image: product.image,
      description,
      price: product.price,
      category: product.category,
      canonicalPath
    });
    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
      { name: 'Trang chủ', path: '/react/' },
      { name: product.category, path: `/react/index.html?view=category&category=${toQuerySlug(product.category)}` },
      { name: product.name, path: canonicalPath }
    ]);

    applySeo({
      title: `${product.name} | ${getSiteName()}`,
      description,
      canonicalPath,
      image: product.image,
      structuredData: {
        '@context': 'https://schema.org',
        '@graph': [breadcrumbJsonLd, productJsonLd]
      }
    });
  }, [product]);

  const handleAddToCart = async () => {
    if (!product || isAddingToCart) {
      return;
    }
    // Add straight to cart (no modal).
    // Quantity should be added to cart, but cart badge should count distinct items.
    const sourceElement = imageRef.current ?? document.getElementById('pdp-product-image');
    setIsAddingToCart(true);
    try {
      await quickAddToCart(
        {
          id: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          priceText: toCurrencyTextFromNumber(currentUnitPrice),
          unit: product.unit,
          unitPrice: currentUnitPrice,
          image: product.image,
          supplierLabel: product.store_name
        },
        quantity,
        sourceElement
      );
    } finally {
      setIsAddingToCart(false);
    }
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
    <>
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
                <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="group relative overflow-hidden rounded-2xl bg-gray-50">
                    <ImageWithFallback
                      id="pdp-product-image"
                      ref={imageRef}
                      src={product.image}
                      alt={product.name}
                      className="h-[420px] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-4 text-sm text-gray-500">* Hình ảnh mang tính minh hoạ</p>
                </div>

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
                    {product.store_name && (
                      <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                        <dt className="text-gray-500">Nhà cung cấp</dt>
                        <dd className="font-extrabold text-green-700">{product.store_name}</dd>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-gray-500">Ghi chú</dt>
                      <dd className="flex-1 text-right font-semibold text-gray-800">
                        {product.note || 'Không có ghi chú'}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-6 rounded-2xl bg-green-50/60 p-4">
                    <div className="flex flex-col gap-1">
                      {discountPercent > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm line-through text-gray-400">
                            {toCurrencyTextFromNumber(product.price)}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-3">
                        <span className="text-3xl font-bold text-green-700">
                          {toCurrencyTextFromNumber(currentUnitPrice)}
                        </span>
                        {discountPercent > 0 ? (
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-xs font-bold">
                            -{discountPercent}% sỉ
                          </span>
                        ) : null}
                        <span className="text-sm text-gray-500">/{product.unit}</span>
                      </div>
                      {quantity > 1 ? (
                        <div className="text-xs text-gray-500 font-semibold mt-1">
                          Thành tiền tạm tính: <span className="text-green-700 font-bold">{toCurrencyTextFromNumber(subtotalPrice)}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Wholesale Pricing Table */}
                  {product.wholesale_tiers && product.wholesale_tiers.length > 0 ? (
                    <div className="mt-4 p-4 border border-slate-100 bg-slate-50/50 rounded-2xl">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                        Bảng chiết khấu sỉ theo số lượng
                      </h4>
                      <div className="space-y-1.5">
                        {product.wholesale_tiers.map((t, idx) => {
                          const tierPrice = product.price * (1 - t.discount / 100);
                          const isActive = quantity >= t.qty && (!product.wholesale_tiers![idx+1] || quantity < product.wholesale_tiers![idx+1].qty);
                          return (
                            <div key={idx} className={`flex justify-between items-center px-3 py-2 rounded-xl text-xs ${
                              isActive ? 'bg-green-100 text-green-800 font-bold border border-green-200' : 'bg-white text-slate-600 border border-slate-100'
                            }`}>
                              <span>Mua từ <strong className={isActive ? 'text-green-800' : 'text-slate-800'}>{t.qty}</strong> {product.unit}</span>
                              <div className="flex items-center gap-2">
                                <span className={isActive ? 'text-green-700 font-black' : 'text-slate-500'}>
                                  {toCurrencyTextFromNumber(tierPrice)}/{product.unit}
                                </span>
                                <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-600 rounded font-bold text-[10px]">
                                  -{t.discount}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <div className="inline-flex items-center rounded-full border border-gray-300 bg-white">
                      <button
                        type="button"
                        onClick={() => updateQuantity(-1)}
                        className="px-4 py-2 text-gray-500 hover:text-green-700"
                        aria-label="Giảm số lượng"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={quantity}
                        onChange={(event) => updateQuantityFromInput(event.target.value)}
                        onBlur={(event) => updateQuantityFromInput(event.target.value)}
                        className="h-10 w-16 border-x border-gray-200 text-center text-base font-semibold text-gray-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        aria-label="Số lượng"
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(1)}
                        className="px-4 py-2 text-gray-500 hover:text-green-700"
                        aria-label="Tăng số lượng"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddToCart}
                      disabled={isAddingToCart}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <ShoppingCart className="size-5" />
                      {isAddingToCart ? 'Đang thêm...' : 'Thêm vào giỏ hàng'}
                    </button>
                  </div>
                </div>
              </div>

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
    </>
  );
}
