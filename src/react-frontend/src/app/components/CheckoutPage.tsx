import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Calendar, Clock, FileText, MapPin, PackageCheck, Phone, ShoppingBag, User, Wind, Thermometer, AlertTriangle, Truck, Store, Ticket, Percent, CreditCard } from 'lucide-react';
import { formatCartSupplierLabel, toCurrencyTextFromNumber, useCart, parsePrice } from '../cart/CartProvider';
import { inferCategoryFromSku } from '../data/categories';

declare global {
  interface Window {
    google?: any;
    L?: any;
  }
}

// Warehouse coordinates definition for routing from closest location
const warehouses = [
  { name: 'Kho Bắc Giang', lat: 21.2730, lon: 106.1946 },
  { name: 'Kho Bình Dương', lat: 10.9805, lon: 106.6517 }
];

// Distance calculator (Haversine formula in km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Find closest warehouse location dynamically
function findNearestWarehouse(lat: number, lon: number) {
  let nearest = warehouses[0];
  let minDistance = calculateDistance(lat, lon, nearest.lat, nearest.lon);

  for (let i = 1; i < warehouses.length; i++) {
    const dist = calculateDistance(lat, lon, warehouses[i].lat, warehouses[i].lon);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = warehouses[i];
    }
  }

  return { warehouse: nearest, distance: minDistance };
}

// Determine warehouse dynamically based on supplier region and database warehouses list
const getWarehouseForSupplier = (supplierLabel: string, dbList: any[] = []) => {
  const parts = supplierLabel.split('·').map(p => p.trim());
  const supplierRegion = parts[1] || parts[0] || '';
  const normalizedRegion = supplierRegion.toLowerCase();

  let nameKeyword = 'Bình Dương';
  if (normalizedRegion.includes('hà nội') || normalizedRegion.includes('ha noi') || normalizedRegion.includes('bắc giang') || normalizedRegion.includes('bac giang') || normalizedRegion.includes('bắc') || normalizedRegion.includes('bac')) {
    nameKeyword = 'Bắc Giang';
  } else if (normalizedRegion.includes('đà lạt') || normalizedRegion.includes('da lat')) {
    nameKeyword = 'Bắc Giang';
  }

  const found = dbList.find(w => w.name && w.name.includes(nameKeyword));
  if (found) {
    return { name: found.name, lat: found.lat, lon: found.lng || found.lon, lng: found.lng || found.lon };
  }

  // Fallback to static coordinates if API not loaded/fails
  if (nameKeyword === 'Bắc Giang') {
    return { name: 'Kho Bắc Giang', lat: 21.2730, lon: 106.1946, lng: 106.1946 };
  }
  return { name: 'Kho Bình Dương', lat: 10.9805, lon: 106.6517, lng: 106.6517 };
};

// Calculate agricultural item weight based on unit type and quantity
function calculateItemWeight(unit: string, quantity: number): number {
  const normalizedUnit = String(unit || '').toLowerCase().trim();
  if (normalizedUnit === 'kg') return quantity;
  if (normalizedUnit === 'bao') return quantity * 30; // 30kg per bag
  if (normalizedUnit === 'yến' || normalizedUnit === 'yen') return quantity * 10;
  if (normalizedUnit === 'tạ' || normalizedUnit === 'ta') return quantity * 100;
  if (normalizedUnit === 'thùng' || normalizedUnit === 'thung') return quantity * 10;
  if (normalizedUnit === 'khay' || normalizedUnit === 'hộp' || normalizedUnit === 'hop') return quantity * 0.5;
  return quantity * 1.0; // default 1kg
}

interface CarrierRate {
  code: string;
  name: string;
  fee: number;
  eta: string;
}

// Calculate dynamic rates for GHN and GHTK based on distance and weight
function calculateCarrierRates(distance: number, totalWeight: number): CarrierRate[] {
  // Giao Hàng Nhanh (GHN)
  let ghnBase = 22000;
  let ghnOverweight = 3000;
  let ghnDistFactor = 0;
  let ghnEta = '1 ngày';

  if (distance <= 20) {
    ghnBase = 22000;
    ghnOverweight = 3000;
    ghnEta = 'Trong ngày';
  } else if (distance <= 100) {
    ghnBase = 35000;
    ghnOverweight = 5000;
    ghnEta = '1-2 ngày';
  } else {
    ghnBase = 50000;
    ghnOverweight = 10000;
    ghnDistFactor = (distance - 100) * 500;
    ghnEta = '2-3 ngày';
  }

  const ghnExtraWeight = Math.max(0, totalWeight - 2);
  const ghnFee = Math.round((ghnBase + ghnExtraWeight * ghnOverweight + ghnDistFactor) / 1000) * 1000;

  // Giao Hàng Tiết Kiệm (GHTK)
  let ghtkBase = 16500;
  let ghtkOverweight = 2500;
  let ghtkDistFactor = 0;
  let ghtkEta = '1-2 ngày';

  if (distance <= 20) {
    ghtkBase = 16500;
    ghtkOverweight = 2500;
    ghtkEta = '1-2 ngày';
  } else if (distance <= 100) {
    ghtkBase = 28000;
    ghtkOverweight = 4000;
    ghtkEta = '2-3 ngày';
  } else {
    ghtkBase = 42000;
    ghtkOverweight = 8000;
    ghtkDistFactor = (distance - 100) * 400;
    ghtkEta = '3-5 ngày';
  }

  const ghtkExtraWeight = Math.max(0, totalWeight - 2);
  const ghtkFee = Math.round((ghtkBase + ghtkExtraWeight * ghtkOverweight + ghtkDistFactor) / 1000) * 1000;

  return [
    { code: 'ghn', name: 'Giao Hàng Nhanh (GHN)', fee: ghnFee, eta: ghnEta },
    { code: 'ghtk', name: 'Giao Hàng Tiết Kiệm (GHTK)', fee: ghtkFee, eta: ghtkEta }
  ];
}


// Format duration to human readable format (e.g. 1 giờ 52 phút)
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} phút`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs} giờ ${mins} phút` : `${hrs} giờ`;
}

interface WeatherEstimation {
  lat: number;
  lng: number;
  cityName: string;
  temperature: number;
  humidity: number;
  condition: string;
  conditionVi: string;
  conditionEmoji: string;
  windSpeed: number;
  distanceKm: number;
  warehouseName: string;
  baseDurationMinutes: number;
  finalDurationMinutes: number;
  weatherFactor: number;
  surcharge: number;
  temperatureNotice: string;
  windNotice: string;
  weatherNotice: string;
  weightKg: number;
  shippingFee?: number;
  carrierRates: CarrierRate[];
}

// Map WMO Code to exact weather factor and translations
const mapWmoToCondition = (code: number, windSpeed: number) => {
  if (windSpeed > 40) {
    return {
      condition: 'Storm',
      conditionVi: 'Bão / Gió giật',
      emoji: '🌪️',
      factor: 3.0,
      notice: '⚠️ Thời tiết bão nguy hiểm, đơn hàng có thể giao chậm trễ đáng kể.'
    };
  }

  // Clear
  if (code === 0) {
    return {
      condition: 'Clear',
      conditionVi: 'Trời đẹp',
      emoji: '☀️',
      factor: 1.0,
      notice: ''
    };
  }
  // Clouds
  if ([1, 2, 3].includes(code)) {
    return {
      condition: 'Clouds',
      conditionVi: 'Nhiều mây',
      emoji: '⛅',
      factor: 1.0,
      notice: ''
    };
  }
  // Drizzle / Light Rain
  if ([45, 48, 51, 53, 55, 56, 57].includes(code)) {
    return {
      condition: 'Drizzle',
      conditionVi: 'Mưa nhẹ',
      emoji: '🌧️',
      factor: 1.2,
      notice: '⚠️ Có mưa phùn nhẹ, thời gian giao hàng có thể chậm 5-10 phút.'
    };
  }
  // Rain
  if ([61, 80].includes(code)) {
    return {
      condition: 'Rain',
      conditionVi: 'Mưa vừa',
      emoji: '🌧️',
      factor: 1.5,
      notice: '⚠️ Do thời tiết mưa, đơn hàng có thể giao chậm hơn bình thường.'
    };
  }
  // Heavy Rain / Thunderstorm
  if ([63, 65, 81, 82, 95, 96, 99].includes(code)) {
    return {
      condition: 'Heavy Rain',
      conditionVi: 'Mưa lớn / Dông',
      emoji: '⛈️',
      factor: 2.0,
      notice: '⚠️ Mưa lớn dữ dội, thời gian giao hàng có thể kéo dài gấp đôi.'
    };
  }
  // Snow
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return {
      condition: 'Snow',
      conditionVi: 'Tuyết rơi',
      emoji: '❄️',
      factor: 2.0,
      notice: '⚠️ Tuyết rơi dày ảnh hưởng đến giao hàng.'
    };
  }

  return {
    condition: 'Clear',
    conditionVi: 'Trời đẹp',
    emoji: '☀️',
    factor: 1.0,
    notice: ''
  };
};

const reactHomePath = '/react/index.html';
const checkoutPayloadKey = 'freso_checkout_payload';
const checkoutAddressKey = 'freso_checkout_address';
const checkoutInvoiceKey = 'freso_checkout_invoice';
const checkoutDraftKey = 'freso_checkout_draft';
const preferredRegionStorageKey = 'freso_preferred_region';

type CheckoutItem = {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountedUnitPrice?: number;
  unit: string;
  image: string;
  category: string;
  supplierName?: string;
  supplierRegion?: string;
};

type CheckoutPayload = {
  items: CheckoutItem[];
  subtotal: number;
  suppliers: string[];
  supplier: string;
};

type ShippingInfo = {
  branch: string;
  address: string;
  receiver: string;
  phone: string;
  note: string;
};

type InvoiceInfo = {
  companyName: string;
  taxCode: string;
  address: string;
  email: string;
};

const deliveryTimeOptions = ['07:00 - 09:00', '09:00 - 11:30', '13:00 - 15:30', '16:00 - 18:30', '18:30 - 20:30'];
const cartSupplierMapStorageKey = 'freso_cart_supplier_map';

const branchCoordinates: Record<string, { lat: number; lng: number; cityName: string }> = {
  'Chi nhánh Quận 1': { lat: 10.776, lng: 106.700, cityName: 'Quận 1, TP. Hồ Chí Minh' },
  'Chi nhánh Quận 7': { lat: 10.732, lng: 106.721, cityName: 'Quận 7, TP. Hồ Chí Minh' },
  'Chi nhánh Thủ Đức': { lat: 10.849, lng: 106.772, cityName: 'Thủ Đức, TP. Hồ Chí Minh' },
  'Chi nhánh Bình Thạnh': { lat: 10.801, lng: 106.699, cityName: 'Bình Thạnh, TP. Hồ Chí Minh' }
};

const findClosestBranch = (lat: number, lng: number): string => {
  let closestBranch = 'Chi nhánh Quận 1';
  let minDistance = Infinity;

  Object.entries(branchCoordinates).forEach(([branchName, coords]) => {
    const dist = calculateDistance(lat, lng, coords.lat, coords.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestBranch = branchName;
    }
  });

  return closestBranch;
};

const getCustomerEmail = () =>
  window.localStorage.getItem('freso_customer_email') || window.sessionStorage.getItem('freso_customer_email') || '';
const getCustomerName = () =>
  window.localStorage.getItem('freso_customer_name') || window.sessionStorage.getItem('freso_customer_name') || '';
const getAuthToken = () =>
  window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';

const isValidPhone = (value: string) => /^(\+?84|0)\d{9,10}$/.test(value.replace(/\s/g, ''));
const getRegionFromBranch = (branch: string) => {
  if (!branch) return '';
  return branch.replace(/^Chi nhánh\s+/i, '').trim();
};

const getMagentoMediaImageUrl = (file?: string | null) => {
  if (!file || !file.trim()) return '';
  const normalizedFile = file.startsWith('/') ? file : `/${file}`;
  return `${window.location.origin}/media/catalog/product${normalizedFile}`;
};

const isRealImageUrl = (value?: string | null) => {
  if (!value) return false;
  return !value.toLowerCase().includes('/placeholder/');
};

type MagentoCartItem = {
  id: number | string;
  quantity?: number;
  prices?: {
    price?: {
      value?: number | null;
    } | null;
  } | null;
  product?: {
    sku?: string | null;
    name?: string | null;
    categories?: Array<{ name?: string | null }> | null;
    small_image?: { url?: string | null } | null;
    thumbnail?: { url?: string | null } | null;
    media_gallery_entries?: Array<{
      file?: string | null;
      disabled?: boolean | null;
    }> | null;
    price_range?: {
      minimum_price?: {
        final_price?: { value?: number | null } | null;
      } | null;
    } | null;
  } | null;
};

const readCheckoutPayload = (): CheckoutPayload | null => {
  const raw = window.sessionStorage.getItem(checkoutPayloadKey) || window.localStorage.getItem(checkoutPayloadKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CheckoutPayload;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
};

const buildCheckoutPayload = (items: CheckoutItem[]): CheckoutPayload => {
  const suppliers = Array.from(new Set(items.map((item) => formatCartSupplierLabel(item) || item.category).filter(Boolean)));
  return {
    items,
    subtotal: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    suppliers,
    supplier: suppliers[0] || ''
  };
};

const parseSupplierLabel = (label?: string) => {
  const parts = String(label || '')
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    supplierName: parts[0] || undefined,
    supplierRegion: parts.slice(1).join(' · ') || undefined
  };
};

const readStoredSupplierMap = (): Record<string, { supplierName?: string; supplierRegion?: string }> => {
  try {
    return JSON.parse(window.localStorage.getItem(cartSupplierMapStorageKey) || '{}');
  } catch {
    return {};
  }
};

const mapMagentoCartItems = (items: MagentoCartItem[] = []): CheckoutItem[] => {
  const customLocalRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_custom_products') : null;
  const storedSupplierMap = readStoredSupplierMap();
  let customLocalProducts: any[] = [];
  if (customLocalRaw) {
    try {
      customLocalProducts = JSON.parse(customLocalRaw);
    } catch {
      customLocalProducts = [];
    }
  }

  return items.map((item) => {
    const product = item.product ?? {};
    const qty = Math.max(1, Math.floor(item.quantity ?? 1));
    const sku = (product.sku ?? '').trim().toLowerCase();
    const matchingProduct = customLocalProducts.find(p => (p.sku ?? '').trim().toLowerCase() === sku);

    const specialPrice = matchingProduct ? parsePrice(matchingProduct.special_price ?? matchingProduct.specialPrice) : 0;
    const normalPrice = matchingProduct ? parsePrice(matchingProduct.price ?? matchingProduct.priceValue) : 0;
    const rawPrice = (specialPrice && specialPrice > 0) ? specialPrice : normalPrice;
    const originalPrice = matchingProduct
      ? rawPrice
      : Number(item.prices?.price?.value ?? product.price_range?.minimum_price?.final_price?.value ?? 0);
    const tiers = matchingProduct?.wholesale_tiers || [];
    const activeTier = tiers
      .filter((t: any) => qty >= t.qty)
      .sort((a: any, b: any) => b.qty - a.qty)[0];

    const discountPercent = activeTier ? activeTier.discount : 0;
    const unitPrice = originalPrice * (1 - discountPercent / 100);
    const category = product.categories?.find((cat) => cat?.name)?.name ?? matchingProduct?.categoryLabel ?? (inferCategoryFromSku(product.sku ?? '')?.category || 'Rau củ quả');
    const unit = matchingProduct?.unit || 'kg';
    const supplier = parseSupplierLabel(matchingProduct?.store_name);
    const storedSupplier = storedSupplierMap[sku] || {};

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

    const rawImage = fixMagentoUrl(product.small_image?.url) || fixMagentoUrl(product.thumbnail?.url) || '';
    const isPlaceholder = rawImage.toLowerCase().includes('placeholder');
    const fallbackImage = matchingProduct?.image || 'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop';

    const galleryImage = (product.media_gallery_entries ?? []).find((entry: any) => {
      const file = entry.file?.trim() ?? '';
      return file && !file.toLowerCase().includes('placeholder');
    });

    const finalImage =
      (isRealImageUrl(getMagentoMediaImageUrl(galleryImage?.file)) ? getMagentoMediaImageUrl(galleryImage?.file) : '') ||
      (isRealImageUrl(fixMagentoUrl(product.small_image?.url)) ? fixMagentoUrl(product.small_image?.url) : '') ||
      (isRealImageUrl(fixMagentoUrl(product.thumbnail?.url)) ? fixMagentoUrl(product.thumbnail?.url) : '') ||
      matchingProduct?.image ||
      (!rawImage || isPlaceholder ? fallbackImage : rawImage);

    return {
      id: String(item.id),
      sku: product.sku ?? '',
      name: product.name ?? (matchingProduct?.name || 'Sản phẩm'),
      quantity: qty,
      unitPrice,
      unit,
      image: finalImage,
      category,
      supplierName: storedSupplier.supplierName || supplier.supplierName,
      supplierRegion: storedSupplier.supplierRegion || supplier.supplierRegion
    };
  });
};

const fetchCustomerCartPayload = async (): Promise<CheckoutPayload | null> => {
  const token = getAuthToken();
  if (!token) {
    return null;
  }

  const response = await fetch('/graphql', {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      query: `
        query CheckoutCustomerCart {
          customerCart {
            items {
              id
              quantity
              prices {
                price {
                  value
                }
              }
              product {
                sku
                name
                categories { name }
                small_image { url }
                thumbnail { url }
                media_gallery_entries { file disabled }
                price_range { minimum_price { final_price { value } } }
              }
            }
          }
        }
      `
    })
  });

  if (!response.ok) {
    return null;
  }

  const json = await response.json().catch(() => null);
  if (json?.errors?.length) {
    return null;
  }

  const items = mapMagentoCartItems(json?.data?.customerCart?.items ?? []);
  return items.length > 0 ? buildCheckoutPayload(items) : null;
};

const loadSavedShipping = (): ShippingInfo | null => {
  const raw = window.localStorage.getItem(checkoutAddressKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ShippingInfo;
  } catch {
    return null;
  }
};

const loadSavedInvoice = (): InvoiceInfo | null => {
  const raw = window.localStorage.getItem(checkoutInvoiceKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as InvoiceInfo;
  } catch {
    return null;
  }
};

// Distribute cash discount proportionally across item unit prices
function distributeCashDiscount(items: CheckoutItem[], discountAmount: number): CheckoutItem[] {
  if (discountAmount <= 0) {
    return items.map((item) => ({ ...item, discountedUnitPrice: item.unitPrice }));
  }
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  if (total === 0) {
    return items.map((item) => ({ ...item, discountedUnitPrice: item.unitPrice }));
  }

  let remainingDiscount = discountAmount;
  return items.map((item, index) => {
    if (index === items.length - 1) {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = remainingDiscount;
      const targetSubtotal = Math.max(0, itemSubtotal - itemDiscount);
      const discountedUnitPrice = Math.round(targetSubtotal / item.quantity);
      return { ...item, discountedUnitPrice };
    } else {
      const ratio = (item.quantity * item.unitPrice) / total;
      const itemDiscount = Math.round(discountAmount * ratio);
      remainingDiscount -= itemDiscount;
      const targetSubtotal = Math.max(0, (item.quantity * item.unitPrice) - itemDiscount);
      const discountedUnitPrice = Math.round(targetSubtotal / item.quantity);
      return { ...item, discountedUnitPrice };
    }
  });
}

export function CheckoutPage() {
  const { cartItems } = useCart();
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<string[]>([]);
  const [supplier, setSupplier] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    branch: '',
    address: '',
    receiver: getCustomerName(),
    phone: '',
    note: ''
  });
  const [invoiceInfo, setInvoiceInfo] = useState<InvoiceInfo>({
    companyName: '',
    taxCode: '',
    address: '',
    email: getCustomerEmail()
  });
  const [invoiceEditable, setInvoiceEditable] = useState(true);
  const [saveAddress, setSaveAddress] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState<boolean>(false);

  // Voucher states
  const [availableVouchers, setAvailableVouchers] = useState<any[]>([
    {
      id: 4,
      title: 'Voucher Khách Hàng Mới',
      description: 'Giảm 100.000đ cho đơn hàng sỉ đầu tiên từ 1.000.000đ.',
      type: 'voucher',
      discount_code: 'FRESO100',
      discount_value: 100000,
      min_order_amount: 1000000
    },
    {
      id: 5,
      title: 'Miễn Phí Vận Chuyển Sỉ',
      description: 'Freeship tối đa 200.000đ cho đơn hàng sỉ từ 3.000.000đ.',
      type: 'voucher',
      discount_code: 'FREESHIP200',
      discount_value: 200000,
      min_order_amount: 3000000
    }
  ]);
  const [appliedVoucher, setAppliedVoucher] = useState<any | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [claimedCodes, setClaimedCodes] = useState<string[]>([]);

  // Load promotions/vouchers from backend
  useEffect(() => {
    const fetchVouchers = async () => {
      try {
        const res = await fetch('/rest/V1/tmdt-catalog/promotions');
        if (res.ok) {
          const json = await res.json();
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
          const vouchers = items.filter((p: any) => p.type === 'voucher');
          if (vouchers.length > 0) {
            setAvailableVouchers(vouchers);
          }
        }
      } catch (err) {
        console.error('Failed to fetch promotions for vouchers:', err);
      }
    };
    fetchVouchers();
  }, []);

  // Load claimed codes from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('freso_claimed_vouchers') || '[]';
      setClaimedCodes(JSON.parse(raw) as string[]);
    } catch {
      setClaimedCodes([]);
    }
  }, []);

  const claimedVouchersList = useMemo(() => {
    return availableVouchers.filter((v) => claimedCodes.includes(v.discount_code));
  }, [availableVouchers, claimedCodes]);

  // Subscription / Recurring Order states
  const [isRecurring, setIsRecurring] = useState(false);
  const [recFrequency, setRecFrequency] = useState<'weekly' | 'monthly'>('weekly');
  const [recWeekdays, setRecWeekdays] = useState<number[]>([1, 4]); // Mon & Thu
  const [recMonthDay, setRecMonthDay] = useState<number>(1);

  // Weather and ETA estimation states
  const [estimations, setEstimations] = useState<Record<string, WeatherEstimation>>({});
  const [dbWarehouses, setDbWarehouses] = useState<any[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/rest/V1/tmdt-orders/warehouses')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDbWarehouses(data);
        }
      })
      .catch((err) => console.error('Failed to load DB warehouses:', err));
  }, []);

  const estimation = useMemo(() => {
    return Object.values(estimations)[0] || null;
  }, [estimations]);

  const [estLoading, setEstLoading] = useState<boolean>(false);


  // SOTA Leaflet Map states and refs
  const [leafletLoaded, setLeafletLoaded] = useState<boolean>(false);
  const [mapGpsLoading, setMapGpsLoading] = useState<boolean>(false);
  const [initialCoordinates, setInitialCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number; cityName?: string } | null>(null);
  const isMapActionRef = useRef<boolean>(false);
  const [mapSearchQuery, setMapSearchQuery] = useState<string>('');

  useEffect(() => {
    if (coordinates) {
      const closest = findClosestBranch(coordinates.lat, coordinates.lng);
      setShippingInfo((prev) => {
        if (prev.branch !== closest) {
          return { ...prev, branch: closest };
        }
        return prev;
      });
    }
  }, [coordinates]);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  // VietQR Payment Modal state
  const [qrOrder, setQrOrder] = useState<{ orderCode: string; totalAmount: number; expiresAt: string } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'expired' | 'cancelled'>('pending');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'direct_payment'>('bank_transfer');
  const [countdown, setCountdown] = useState(15 * 60); // 15 minutes in seconds
  const pollingRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { window.clearInterval(pollingRef.current); pollingRef.current = null; }
    if (countdownRef.current) { window.clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const startPolling = useCallback((orderCode: string, expiresAt: string) => {
    const expireMs = new Date(expiresAt).getTime();

    // Countdown ticker
    countdownRef.current = window.setInterval(() => {
      const remaining = Math.max(0, Math.floor((expireMs - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        stopPolling();
        setPaymentStatus('expired');
      }
    }, 1000);

    // Status polling every 5s
    pollingRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/rest/V1/tmdt-orders/status/${encodeURIComponent(orderCode)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.status === 'paid' || data?.status === 'processing') {
          stopPolling();
          setPaymentStatus('paid');
          // Clear local cart
          window.sessionStorage.removeItem(checkoutPayloadKey);
          window.localStorage.removeItem(checkoutPayloadKey);
          window.localStorage.removeItem('freso_local_cart_items');
          window.setTimeout(() => {
            window.location.href = `${reactHomePath}?view=thank-you&orderId=${orderCode}`;
          }, 1500);
        } else if (data?.status === 'expired' || data?.status === 'cancelled') {
          stopPolling();
          setPaymentStatus(data.status);
        }
      } catch {
        // Ignore polling errors
      }
    }, 5000);
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  const subtotal = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [checkoutItems]
  );

  const checkoutGroups = useMemo(() => {
    const groups: Record<string, CheckoutItem[]> = {};
    checkoutItems.forEach((item) => {
      const supplierLabel = formatCartSupplierLabel(item);
      if (!groups[supplierLabel]) {
        groups[supplierLabel] = [];
      }
      groups[supplierLabel].push(item);
    });
    return Object.entries(groups).map(([supplierLabel, items]) => {
      const groupSubtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      return {
        supplierLabel,
        items,
        subtotal: groupSubtotal
      };
    });
  }, [checkoutItems]);

  const shippingFee = useMemo(() => {
    return Object.entries(estimations).reduce((sum, [label, est]) => {
      const carrierCode = selectedCarriers[label] || 'ghtk';
      const rate = est.carrierRates?.find(r => r.code === carrierCode);
      return sum + (rate ? rate.fee : (est.shippingFee || 0));
    }, 0);
  }, [estimations, selectedCarriers]);

  const weatherSurcharge = useMemo(() => {
    return Object.values(estimations).reduce((sum, est) => sum + (est.surcharge || 0), 0);
  }, [estimations]);

  // Reset voucher if subtotal doesn't meet the min_order_amount condition
  useEffect(() => {
    if (appliedVoucher && subtotal < (appliedVoucher.min_order_amount || 0)) {
      setAppliedVoucher(null);
      setVoucherError(`Đơn hàng chưa đạt giá trị tối thiểu ${toCurrencyTextFromNumber(appliedVoucher.min_order_amount)}`);
    }
  }, [subtotal, appliedVoucher]);

  const voucherDiscount = useMemo(() => {
    if (!appliedVoucher || appliedVoucher.type !== 'voucher') return 0;
    const isShipping = (appliedVoucher.discount_code || '').toLowerCase().includes('ship');
    if (isShipping) return 0;
    if (subtotal < (appliedVoucher.min_order_amount || 0)) return 0;
    return Math.min(subtotal, Number(appliedVoucher.discount_value || 0));
  }, [appliedVoucher, subtotal]);

  const shippingDiscount = useMemo(() => {
    if (!appliedVoucher || appliedVoucher.type !== 'voucher') return 0;
    const isShipping = (appliedVoucher.discount_code || '').toLowerCase().includes('ship');
    if (!isShipping) return 0;
    if (subtotal < (appliedVoucher.min_order_amount || 0)) return 0;
    return Math.min(shippingFee, Number(appliedVoucher.discount_value || 0));
  }, [appliedVoucher, subtotal, shippingFee]);

  const totalAmount = useMemo(() => {
    return subtotal - voucherDiscount + shippingFee - shippingDiscount + weatherSurcharge;
  }, [subtotal, voucherDiscount, shippingFee, shippingDiscount, weatherSurcharge]);


  const requestGpsLocation = useCallback((defaultCoords: { lat: number; lng: number }) => {
    if (!navigator.geolocation) {
      setInitialCoordinates(defaultCoords);
      setCoordinates(defaultCoords);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        isMapActionRef.current = true;
        setInitialCoordinates(coords);
        setCoordinates(coords);

        // Reverse geocode to update address field immediately on load!
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}&accept-language=vi`,
            { headers: { 'User-Agent': 'FresoWeatherEstimation/1.0' } }
          );
          if (res.ok) {
            const data = await res.json();
            if (data.display_name) {
              const parts = data.display_name.split(',');
              const cleanAddr = parts.slice(0, 4).map((p: string) => p.trim()).join(', ');
              setShippingInfo((prev) => ({ ...prev, address: cleanAddr }));
              setMapSearchQuery(cleanAddr);
            }
          }
        } catch (err) {
          console.error('Initial GPS reverse geocode error:', err);
        }
      },
      (error) => {
        console.warn('Geolocation denied or failed on load, falling back to default branch:', error);
        setInitialCoordinates(defaultCoords);
        setCoordinates(defaultCoords);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, []);

  const handleAllowLocation = () => {
    window.localStorage.setItem('freso_location_choice', 'allowed');
    setShowLocationPrompt(false);
    const savedShipping = loadSavedShipping();
    const activeBranch = savedShipping?.branch || '';
    const defaultCoords = branchCoordinates[activeBranch] || { lat: 10.776, lng: 106.700 };
    void requestGpsLocation(defaultCoords);
  };

  const handleDenyLocation = () => {
    window.localStorage.setItem('freso_location_choice', 'denied');
    setShowLocationPrompt(false);
    const savedShipping = loadSavedShipping();
    const activeBranch = savedShipping?.branch || '';
    const defaultCoords = branchCoordinates[activeBranch] || { lat: 10.776, lng: 106.700 };
    setInitialCoordinates(defaultCoords);
    setCoordinates(defaultCoords);
  };

  // Get initial location on mount, asking the user first
  useEffect(() => {
    const savedShipping = loadSavedShipping();
    const activeBranch = savedShipping?.branch || '';
    const defaultCoords = branchCoordinates[activeBranch] || { lat: 10.776, lng: 106.700 };

    const choice = window.localStorage.getItem('freso_location_choice');
    if (choice === 'allowed') {
      void requestGpsLocation(defaultCoords);
    } else if (choice === 'denied') {
      setInitialCoordinates(defaultCoords);
      setCoordinates(defaultCoords);
    } else {
      setShowLocationPrompt(true);
    }
  }, [requestGpsLocation]);

  useEffect(() => {
    let isCancelled = false;

    const loadCheckoutItems = async () => {
      const storedPayload = readCheckoutPayload();
      if (storedPayload) {
        if (isCancelled) return;
        setCheckoutItems(storedPayload.items);
        setSupplierOptions(storedPayload.suppliers);
        setSupplier(storedPayload.supplier || storedPayload.suppliers[0] || '');
        setIsReady(true);
        return;
      }

      const selected = cartItems.filter((item) => item.selected).map((item) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unit: item.unit,
        image: item.image,
        category: item.category,
        supplierName: item.supplierName,
        supplierRegion: item.supplierRegion
      }));

      const fallbackPayload = selected.length > 0 ? buildCheckoutPayload(selected) : await fetchCustomerCartPayload();
      if (isCancelled) return;

      if (fallbackPayload) {
        const serializedPayload = JSON.stringify(fallbackPayload);
        window.sessionStorage.setItem(checkoutPayloadKey, serializedPayload);
        window.localStorage.setItem(checkoutPayloadKey, serializedPayload);
        setCheckoutItems(fallbackPayload.items);
        setSupplierOptions(fallbackPayload.suppliers);
        setSupplier(fallbackPayload.supplier || fallbackPayload.suppliers[0] || '');
      }
      setIsReady(true);
    };

    loadCheckoutItems();

    return () => {
      isCancelled = true;
    };
  }, [cartItems]);

  useEffect(() => {
    const savedShipping = loadSavedShipping();
    if (savedShipping) {
      setShippingInfo((prev) => ({ ...prev, ...savedShipping }));
    }

    const savedInvoice = loadSavedInvoice();
    if (savedInvoice) {
      setInvoiceInfo((prev) => ({ ...prev, ...savedInvoice }));
      setInvoiceEditable(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && checkoutItems.length === 0) {
      window.location.href = `${reactHomePath}?view=cart`;
    }
  }, [checkoutItems, isReady]);

  // Debounced effect for shipping address and branch selection changes
  useEffect(() => {
    const cleanAddress = shippingInfo.address.trim();
    if (cleanAddress.length < 5) {
      setEstimations({});
      return;
    }

    const timer = setTimeout(() => {
      calculateWeatherAndEta(cleanAddress, shippingInfo.branch);
    }, 1200);

    return () => clearTimeout(timer);
  }, [shippingInfo.address, shippingInfo.branch]);


  const calculateWeatherAndEta = async (address: string, branch: string) => {
    setEstLoading(true);
    try {
      const branchCoords = (branch && branchCoordinates[branch]) || { lat: 10.776, lng: 106.700, cityName: 'TP. Hồ Chí Minh' };
      let lat = branchCoords.lat;
      let lng = branchCoords.lng;
      let cityName = branchCoords.cityName;

      if (isMapActionRef.current && coordinates) {
        lat = coordinates.lat;
        lng = coordinates.lng;
        cityName = coordinates.cityName || address.split(',')[0] || branchCoords.cityName;
        isMapActionRef.current = false; // Reset map action flag
      } else {
        // Step 1: Try to geocode the raw typed address as-is (e.g. if the user typed an out-of-city Hanoi address)
        let resolved = false;
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
            { headers: { 'User-Agent': 'FresoWeatherEstimation/1.0' } }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData && geoData.length > 0) {
              lat = parseFloat(geoData[0].lat);
              lng = parseFloat(geoData[0].lon);
              cityName = geoData[0].display_name.split(',')[0] || 'Vị trí nhận hàng';
              resolved = true;
              setCoordinates({ lat, lng, cityName });
            }
          }
        } catch (geoErr) {
          console.warn('Geocoding raw address failed', geoErr);
        }

        // Step 2: Fallback to branch-scoped search in HCMC if raw geocoding yielded no results
        if (!resolved) {
          try {
            const cleanBranch = branch.replace(/^Chi nhánh\s+/i, '');
            const queryAddress = `${address}, ${cleanBranch}, Hồ Chí Minh, Việt Nam`.trim();
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryAddress)}&format=json&limit=1`,
              { headers: { 'User-Agent': 'FresoWeatherEstimation/1.0' } }
            );
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              if (geoData && geoData.length > 0) {
                lat = parseFloat(geoData[0].lat);
                lng = parseFloat(geoData[0].lon);
                cityName = geoData[0].display_name.split(',')[0] || 'Vị trí nhận hàng';
                setCoordinates({ lat, lng, cityName });
              }
            }
          } catch (fallbackErr) {
            console.warn('Geocoding with fallback scope failed', fallbackErr);
          }
        }
      }

      // Fetch Weather Data from Open-Meteo
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,rain,precipitation&t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (!weatherRes.ok) {
        throw new Error('Không thể tải dữ liệu thời tiết.');
      }
      const weatherData = await weatherRes.json();
      const temperature = Math.round(weatherData.current.temperature_2m);
      const humidity = Math.round(weatherData.current.relative_humidity_2m);
      let weatherCode = weatherData.current.weather_code;
      const windSpeed = Math.round(weatherData.current.wind_speed_10m);
      const rain = weatherData.current.rain || 0;
      const precipitation = weatherData.current.precipitation || 0;

      // Correct false-positive rain/thunderstorm predictions
      if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(weatherCode)) {
        if (precipitation === 0 && rain === 0) {
          if (temperature >= 33) {
            weatherCode = 1; // Mainly clear
          } else {
            weatherCode = 3; // Overcast
          }
        }
      }

      // Map WMO Code and wind speed to factor and labels
      const weatherDetails = mapWmoToCondition(weatherCode, windSpeed);

      // Temperature rules
      let surcharge = 0;
      let temperatureNotice = '';
      if (temperature > 38) {
        surcharge = 10000;
        temperatureNotice = '⚠️ Nắng nóng gay gắt. Một số mặt hàng dễ hư hỏng có thể bị hạn chế giao xa. Sản phẩm sẽ được ưu tiên vận chuyển bằng xe lạnh.';
      } else if (temperature > 35) {
        surcharge = 10000;
        temperatureNotice = '⚠️ Nhiệt độ cao. Sản phẩm sẽ được ưu tiên vận chuyển bằng xe lạnh.';
      }

      // Gió mạnh
      let windNotice = '';
      if (windSpeed > 40) {
        windNotice = '⚠️ Gió mạnh. Thời gian giao hàng có thể kéo dài.';
      }

      const nextEstimations: Record<string, WeatherEstimation> = {};
      const uniqueSupplierLabels = Array.from(new Set(checkoutItems.map(item => formatCartSupplierLabel(item))));

      uniqueSupplierLabels.forEach((supplierLabel) => {
        const warehouse = getWarehouseForSupplier(supplierLabel, dbWarehouses);
        const distance = calculateDistance(lat, lng, warehouse.lat, warehouse.lng || warehouse.lon);
        const baseDurationMinutes = Math.round(distance * 1.5) + 12;
        const finalDurationMinutes = Math.round(baseDurationMinutes * weatherDetails.factor);

        // Sum weights of all products in this shop
        const shopItems = checkoutItems.filter(item => formatCartSupplierLabel(item) === supplierLabel);
        const shopWeight = shopItems.reduce((sum, item) => sum + calculateItemWeight(item.unit, item.quantity), 0);

        // Get carrier rates
        const carrierRates = calculateCarrierRates(distance, shopWeight);

        // Keep fallback shippingFee logic for legacy code compatibility
        const shopShippingFee = Math.max(15000, Math.round(distance * 2000 / 1000) * 1000);

        nextEstimations[supplierLabel] = {
          lat,
          lng,
          cityName,
          temperature,
          humidity,
          condition: weatherDetails.condition,
          conditionVi: weatherDetails.conditionVi,
          conditionEmoji: weatherDetails.emoji,
          windSpeed,
          distanceKm: distance,
          warehouseName: warehouse.name,
          baseDurationMinutes,
          finalDurationMinutes,
          weatherFactor: weatherDetails.factor,
          surcharge,
          shippingFee: shopShippingFee,
          temperatureNotice,
          windNotice,
          weatherNotice: weatherDetails.notice,
          weightKg: shopWeight,
          carrierRates
        };
      });

      setEstimations(nextEstimations);

    } catch (err) {
      console.error('Weather estimation error:', err);
    } finally {
      setEstLoading(false);
    }
  };

  // Dynamically load Leaflet assets on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.L) {
      setLeafletLoaded(true);
      return;
    }

    const existingCss = document.getElementById('leaflet-css');
    if (!existingCss) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.id = 'leaflet-css';
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById('leaflet-js');
    if (existingScript) {
      existingScript.addEventListener('load', () => setLeafletLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.id = 'leaflet-js';
    script.async = true;
    script.onload = () => {
      setLeafletLoaded(true);
    };
    script.onerror = () => {
      console.error('Failed to load Leaflet script');
    };
    document.body.appendChild(script);
  }, []);

  // Initialize Map when Leaflet is loaded, container is ready, and initial coordinates are resolved
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapRef.current || !isReady || !initialCoordinates) return;

    const startLat = initialCoordinates.lat;
    const startLng = initialCoordinates.lng;

    // Initialize map centered at start location
    const map = window.L.map(mapContainerRef.current, {
      center: [startLat, startLng],
      zoom: 14,
      zoomControl: false
    });

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    window.L.control.zoom({ position: 'bottomright' }).addTo(map);

    const myCustomIcon = window.L.divIcon({
      html: `<div style="
        width: 16px;
        height: 16px;
        background-color: #0d3b66;
        border: 3px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 6px rgba(0,0,0,0.45);
      "></div>`,
      className: 'custom-circle-marker',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    const marker = window.L.marker([startLat, startLng], {
      draggable: true,
      icon: myCustomIcon
    }).addTo(map);

    const circle = window.L.circle([startLat, startLng], {
      radius: 120,
      color: '#0d3b66',
      fillColor: '#3b82f6',
      fillOpacity: 0.12,
      weight: 1.5
    }).addTo(map);

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    const handleLocationSelect = async (lat: number, lng: number) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=vi`,
          { headers: { 'User-Agent': 'FresoWeatherEstimation/1.0' } }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.display_name) {
            const parts = data.display_name.split(',');
            const cleanAddr = parts.slice(0, 4).map((p: string) => p.trim()).join(', ');
            isMapActionRef.current = true;
            setCoordinates({ lat, lng, cityName: parts[0]?.trim() || 'Vị trí nhận hàng' });
            setShippingInfo((prev) => ({ ...prev, address: cleanAddr }));
            setMapSearchQuery(cleanAddr);
          }
        }
      } catch (err) {
        console.error('Reverse geocoding error:', err);
      }
    };

    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      circle.setLatLng([lat, lng]);
      map.panTo([lat, lng]);
      isMapActionRef.current = true;
      setCoordinates({ lat, lng });
      handleLocationSelect(lat, lng);
    });

    marker.on('drag', (e: any) => {
      const latlng = e.target.getLatLng();
      circle.setLatLng(latlng);
    });

    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      map.panTo([lat, lng]);
      isMapActionRef.current = true;
      setCoordinates({ lat, lng });
      handleLocationSelect(lat, lng);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
  }, [leafletLoaded, isReady, initialCoordinates]);

  // Synchronize map center and marker when estimation changes (text address geocoded)
  useEffect(() => {
    if (!mapRef.current || !estimation || !leafletLoaded) return;
    const { lat, lng } = estimation;

    const center = mapRef.current.getCenter();
    const diffLat = Math.abs(center.lat - lat);
    const diffLng = Math.abs(center.lng - lng);
    // Pan only if coordinates have moved significantly to avoid fight with dragging marker
    if (diffLat > 0.001 || diffLng > 0.001) {
      mapRef.current.setView([lat, lng], 14);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      }
      if (circleRef.current) {
        circleRef.current.setLatLng([lat, lng]);
      }
    }
  }, [estimation?.lat, estimation?.lng, leafletLoaded]);

  const handleMapSearch = async () => {
    if (!mapSearchQuery.trim()) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(mapSearchQuery)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'FresoWeatherEstimation/1.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);

          if (mapRef.current) {
            mapRef.current.setView([lat, lng], 15);
          }
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          }
          if (circleRef.current) {
            circleRef.current.setLatLng([lat, lng]);
          }

          const cleanAddr = data[0].display_name.split(',').slice(0, 4).map((p: string) => p.trim()).join(', ');
          isMapActionRef.current = true;
          setCoordinates({ lat, lng, cityName: cleanAddr.split(',')[0] });
          setShippingInfo((prev) => ({ ...prev, address: cleanAddr }));
          setMapSearchQuery(cleanAddr);
        } else {
          alert('Không tìm thấy địa chỉ này trên bản đồ.');
        }
      }
    } catch (err) {
      console.error('Map search error:', err);
    }
  };

  const handleGpsMapLocate = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }

    setMapGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([lat, lng], 15);
          markerRef.current.setLatLng([lat, lng]);
          if (circleRef.current) {
            circleRef.current.setLatLng([lat, lng]);
          }
        }

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=vi`,
            { headers: { 'User-Agent': 'FresoWeatherEstimation/1.0' } }
          );
          if (res.ok) {
            const data = await res.json();
            if (data.display_name) {
              const parts = data.display_name.split(',');
              const cleanAddr = parts.slice(0, 4).map((p: string) => p.trim()).join(', ');
              isMapActionRef.current = true;
              setCoordinates({ lat, lng, cityName: parts[0]?.trim() || 'Vị trí hiện tại' });
              setShippingInfo((prev) => ({ ...prev, address: cleanAddr }));
              setMapSearchQuery(cleanAddr);
            }
          }
        } catch (err) {
          console.error('GPS reverse geocode error:', err);
        } finally {
          setMapGpsLoading(false);
        }
      },
      (err) => {
        console.warn('GPS location retrieval failed', err);
        alert('Không thể truy cập vị trí thiết bị. Vui lòng cấp quyền trong cài đặt trình duyệt.');
        setMapGpsLoading(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(''), 2400);
  };

  const updateShippingField = (field: keyof ShippingInfo, value: string) => {
    setShippingInfo((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [`shipping_${field}`]: validateField(field, value) }));
  };

  const updateInvoiceField = (field: keyof InvoiceInfo, value: string) => {
    setInvoiceInfo((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [`invoice_${field}`]: validateInvoiceField(field, value) }));
  };

  const validateField = (field: keyof ShippingInfo, value: string) => {
    if (field === 'note' || field === 'branch') return '';
    if (!value.trim()) return 'Vui lòng nhập thông tin này.';
    if (field === 'phone' && !isValidPhone(value)) return 'Số điện thoại chưa hợp lệ.';
    return '';
  };

  const validateInvoiceField = (field: keyof InvoiceInfo, value: string) => {
    if (!invoiceEditable) return '';
    if (!value.trim()) return 'Vui lòng nhập thông tin này.';
    if (field === 'email' && !/.+@.+\..+/.test(value.trim())) return 'Email chưa hợp lệ.';
    return '';
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!deliveryDate) nextErrors.deliveryDate = 'Vui lòng chọn ngày giao hàng.';
    if (!deliveryTime) nextErrors.deliveryTime = 'Vui lòng chọn khung giờ giao.';

    (Object.keys(shippingInfo) as Array<keyof ShippingInfo>).forEach((key) => {
      const message = validateField(key, shippingInfo[key]);
      if (message) nextErrors[`shipping_${key}`] = message;
    });

    if (invoiceEditable) {
      (Object.keys(invoiceInfo) as Array<keyof InvoiceInfo>).forEach((key) => {
        const message = validateInvoiceField(key, invoiceInfo[key]);
        if (message) nextErrors[`invoice_${key}`] = message;
      });
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSaveDraft = () => {
    const draft = {
      deliveryDate,
      deliveryTime,
      shippingInfo,
      invoiceInfo,
      supplier,
      items: checkoutItems
    };
    window.localStorage.setItem(checkoutDraftKey, JSON.stringify(draft));
    showToast('Đã lưu đơn chờ thanh toán.');
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      showToast('Vui lòng kiểm tra lại thông tin trước khi thanh toán.');
      return;
    }

    if (saveAddress) {
      window.localStorage.setItem(checkoutAddressKey, JSON.stringify(shippingInfo));
    }

    if (invoiceEditable) {
      window.localStorage.setItem(checkoutInvoiceKey, JSON.stringify(invoiceInfo));
    }

    const discountedItems = distributeCashDiscount(checkoutItems, voucherDiscount);

    const orderPayload = {
      userId: getCustomerEmail() || 'guest',
      items: discountedItems.map((item) => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.discountedUnitPrice ?? item.unitPrice,
        unit: item.unit
      })),
      supplier,
      deliveryDate,
      deliveryTime,
      shippingAddress: shippingInfo.branch ? `${shippingInfo.branch} - ${shippingInfo.address}` : shippingInfo.address,
      note: shippingInfo.note,
      invoiceInfo
    };
    const purchaseHistoryPayload = {
      customerEmail: getCustomerEmail(),
      orderReference: `TMDT-${Date.now()}`,
      customerRegion: getRegionFromBranch(shippingInfo.branch),
      items: discountedItems.map((item) => ({
        sku: item.sku,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.discountedUnitPrice ?? item.unitPrice,
        unit: item.unit,
        image: item.image
      })),
      supplier,
      subtotal: subtotal - voucherDiscount,
      totalAmount,
      deliveryDate,
      deliveryTime,
      shippingAddress: shippingInfo.branch ? `${shippingInfo.branch} - ${shippingInfo.address}` : shippingInfo.address,
      note: shippingInfo.note,
      invoiceInfo
    };

    try {
      setIsSubmitting(true);

      const suppliersShippingMap: Record<string, any> = {};
      Object.entries(estimations).forEach(([supplierLabel, est]) => {
        const carrierCode = selectedCarriers[supplierLabel] || 'ghtk';
        const rate = est.carrierRates?.find(r => r.code === carrierCode) || est.carrierRates?.[0];

        suppliersShippingMap[supplierLabel] = {
          warehouse: est.warehouseName,
          distance: est.distanceKm,
          shippingFee: rate ? rate.fee : est.shippingFee,
          surcharge: est.surcharge,
          eta: rate ? rate.eta : formatDuration(est.finalDurationMinutes),
          carrier: rate ? rate.name : 'Giao Hàng Tiết Kiệm (GHTK)',
          weight: est.weightKg
        };
      });

      // Apply shipping discount to suppliersShippingMap
      if (shippingDiscount > 0) {
        let remainingShippingDiscount = shippingDiscount;
        const suppliersList = Object.keys(suppliersShippingMap);
        suppliersList.forEach((supplierLabel, index) => {
          const currentFee = suppliersShippingMap[supplierLabel].shippingFee || 0;
          if (index === suppliersList.length - 1) {
            suppliersShippingMap[supplierLabel].shippingFee = Math.max(0, currentFee - remainingShippingDiscount);
          } else {
            const deduct = Math.min(currentFee, remainingShippingDiscount);
            suppliersShippingMap[supplierLabel].shippingFee = currentFee - deduct;
            remainingShippingDiscount -= deduct;
          }
        });
      }

      // Step 1: Create order in backend and get orderCode
      const createRes = await fetch('/rest/V1/tmdt-orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {})
        },
        body: JSON.stringify({
          customerEmail: getCustomerEmail() || 'guest',
          customerName: getCustomerName(),
          totalAmount,
          itemsJson: JSON.stringify(discountedItems.map((item) => ({
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.discountedUnitPrice ?? item.unitPrice,
            unit: item.unit,
            supplierName: item.supplierName,
            supplierRegion: item.supplierRegion
          }))),
          shippingJson: JSON.stringify({
            branch: shippingInfo.branch,
            address: shippingInfo.address,
            receiver: shippingInfo.receiver,
            phone: shippingInfo.phone,
            note: shippingInfo.note,
            deliveryDate,
            deliveryTime,
            suppliers: suppliersShippingMap
          }),
          paymentMethod
        })
      });

      let orderCode: string;
      let expiresAt: string;
      let childOrdersList: any[] = [];

      if (createRes.ok) {
        const orderData = await createRes.json();
        // Consume applied voucher from localStorage
        if (appliedVoucher) {
          try {
            const raw = window.localStorage.getItem('freso_claimed_vouchers') || '[]';
            const claimed: string[] = JSON.parse(raw);
            const updated = claimed.filter((code) => code !== appliedVoucher.discount_code);
            window.localStorage.setItem('freso_claimed_vouchers', JSON.stringify(updated));
            window.dispatchEvent(new Event('storage'));
          } catch (err) {
            console.error('Failed to consume voucher:', err);
          }
        }
        orderCode = orderData?.orderCode ?? `DH${Date.now().toString(36).toUpperCase().slice(-6)}`;
        expiresAt = orderData?.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000).toISOString();
        childOrdersList = orderData?.childOrders ?? [];
      } else {
        // Fallback: generate local order code if API fails
        orderCode = `DH${Date.now().toString(36).toUpperCase().slice(-6)}`;
        expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        childOrdersList = [
          {
            orderCode,
            supplier: supplier || 'Tổng kho sỉ Thực phẩm B2B · Hà Nội',
            subtotal: subtotal - voucherDiscount,
            totalAmount,
            items: discountedItems
          }
        ];
      }

      // Step 2: Also save purchase history for each child order
      const token = getAuthToken();
      if (token && childOrdersList && childOrdersList.length > 0) {
        for (const child of childOrdersList) {
          const childSupplierLabel = child.supplier;

          await fetch('/rest/V1/tmdt-search/purchase-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              customerEmail: getCustomerEmail(),
              orderReference: child.orderCode,
              customerRegion: getRegionFromBranch(shippingInfo.branch),
              items: child.items.map((item: any) => {
                const match = discountedItems.find(i => i.sku === item.sku);
                return {
                  sku: item.sku,
                  name: item.name,
                  category: match?.category || 'Rau củ quả',
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  unit: item.unit || 'kg',
                  image: match?.image || ''
                };
              }),
              supplier: childSupplierLabel,
              subtotal: child.subtotal,
              totalAmount: child.totalAmount,
              deliveryDate,
              deliveryTime,
              shippingAddress: shippingInfo.branch ? `${shippingInfo.branch} - ${shippingInfo.address}` : shippingInfo.address,
              note: shippingInfo.note,
              invoiceInfo
            })
          }).catch(() => {/* ignore */ });
        }
      }


      const preferredRegion = getRegionFromBranch(shippingInfo.branch);
      if (preferredRegion) {
        window.localStorage.setItem(preferredRegionStorageKey, preferredRegion);
        window.sessionStorage.setItem(preferredRegionStorageKey, preferredRegion);
      }

      // Save recurring subscription if checked
      if (isRecurring) {
        try {
          await fetch('/rest/V1/tmdt-recurring/subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {})
            },
            body: JSON.stringify({
              customerEmail: getCustomerEmail() || 'guest',
              customerName: getCustomerName(),
              frequency: recFrequency,
              weekdays: recFrequency === 'weekly' ? recWeekdays.join(',') : null,
              monthDay: recFrequency === 'monthly' ? recMonthDay : null,
              deliveryTime: deliveryTime || '07:00 - 09:00',
              itemsJson: JSON.stringify(discountedItems.map((item) => ({
                sku: item.sku,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.discountedUnitPrice ?? item.unitPrice,
                unit: item.unit
              }))),
              shippingJson: JSON.stringify({
                branch: shippingInfo.branch,
                address: shippingInfo.address,
                receiver: shippingInfo.receiver,
                phone: shippingInfo.phone,
                note: shippingInfo.note
              })
            })
          });
        } catch (subErr) {
          console.error('Failed to create recurring subscription', subErr);
        }
      }

      // Step 3: Show VietQR modal or redirect directly if COD
      if (paymentMethod === 'direct_payment') {
        window.location.href = `${reactHomePath}?view=thank-you&orderId=${orderCode}`;
      } else {
        setQrOrder({ orderCode, totalAmount, expiresAt });
        setPaymentStatus('pending');
        setCountdown(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
        startPolling(orderCode, expiresAt);
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tạo đơn hàng.';
      showToast(`Thanh toán thất bại. ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8f7] pb-20 text-gray-800">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-3 text-sm text-gray-400">
          <a href={reactHomePath} className="hover:text-green-600 transition-colors">
            Trang chủ
          </a>
          <span className="mx-2">&gt;</span>
          <a href={`${reactHomePath}?view=cart`} className="hover:text-green-600 transition-colors">
            Giỏ hàng
          </a>
          <span className="mx-2">&gt;</span>
          <span>Xác nhận và thanh toán</span>
        </nav>

        <h1 className="mb-6 text-4xl font-bold text-gray-900">Xác nhận và thanh toán</h1>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
                <PackageCheck className="size-5 text-green-600" />
                Tóm tắt đơn hàng
              </div>
              <div className="space-y-4">
                {checkoutGroups.map((group) => {
                  const shopEst = estimations[group.supplierLabel];
                  return (
                    <div key={group.supplierLabel} className="mb-6 rounded-xl border border-gray-100 bg-gray-50/20 p-4">
                      {/* Shop Header */}
                      <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-2">
                        <div className="flex items-center gap-2 font-bold text-gray-850">
                          <Store className="size-4 text-green-650" />
                          <span>{group.supplierLabel}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-405 bg-gray-100 px-2 rounded-full">
                          {group.items.length} sản phẩm
                        </span>
                      </div>

                      {/* Items List */}
                      <div className="space-y-3">
                        {group.items.map((item) => {
                          const customLocalRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_custom_products') : null;
                          let customLocalProducts: any[] = [];
                          if (customLocalRaw) {
                            try {
                              customLocalProducts = JSON.parse(customLocalRaw);
                            } catch {
                              customLocalProducts = [];
                            }
                          }
                          const sku = (item.sku ?? '').trim().toLowerCase();
                          const matchingProduct = customLocalProducts.find(p => (p.sku ?? '').trim().toLowerCase() === sku);
                          const specialPrice = matchingProduct ? parsePrice(matchingProduct.special_price ?? matchingProduct.specialPrice) : 0;
                          const normalPrice = matchingProduct ? parsePrice(matchingProduct.price ?? matchingProduct.priceValue) : 0;
                          const originalPrice = matchingProduct
                            ? ((specialPrice && specialPrice > 0) ? specialPrice : normalPrice)
                            : item.unitPrice;
                          const tiers = matchingProduct?.wholesale_tiers || [];
                          const activeTier = tiers
                            .filter((t: any) => item.quantity >= t.qty)
                            .sort((a: any, b: any) => b.qty - a.qty)[0];
                          const discountPercent = activeTier ? activeTier.discount : 0;
                          const hasDiscount = discountPercent > 0;

                          return (
                            <div key={item.id} className="flex items-center gap-3 rounded-lg bg-white p-3 border border-gray-100/50">
                              <img src={item.image} alt={item.name} className="size-12 rounded-lg object-cover" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                                <div className="text-xs text-gray-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                                  <span>{item.quantity} {item.unit} •</span>
                                  {hasDiscount ? (
                                    <>
                                      <span className="line-through text-gray-400">
                                        {toCurrencyTextFromNumber(originalPrice)}
                                      </span>
                                      <span className="text-green-700 font-bold">
                                        {toCurrencyTextFromNumber(item.unitPrice)}
                                      </span>
                                    </>
                                  ) : (
                                    <span>{toCurrencyTextFromNumber(item.unitPrice)}</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                                {toCurrencyTextFromNumber(item.quantity * item.unitPrice)}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  );
                })}
              </div>
            </section>


            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
                <Calendar className="size-5 text-green-600" />
                Thời gian giao hàng
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Ngày giao</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(event) => {
                      setDeliveryDate(event.target.value);
                      setErrors((prev) => ({ ...prev, deliveryDate: event.target.value ? '' : 'Vui lòng chọn ngày giao.' }));
                    }}
                    className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${errors.deliveryDate ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
                      }`}
                  />
                  {errors.deliveryDate && <p className="mt-1 text-xs text-red-500">{errors.deliveryDate}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Khung giờ giao</label>
                  <div className="relative mt-2">
                    <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                    <select
                      value={deliveryTime}
                      onChange={(event) => {
                        setDeliveryTime(event.target.value);
                        setErrors((prev) => ({ ...prev, deliveryTime: event.target.value ? '' : 'Vui lòng chọn khung giờ giao.' }));
                      }}
                      className={`w-full rounded-xl border bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors ${errors.deliveryTime ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
                        }`}
                    >
                      <option value="">Chọn khung giờ giao</option>
                      {deliveryTimeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.deliveryTime && <p className="mt-1 text-xs text-red-500">{errors.deliveryTime}</p>}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
                <MapPin className="size-5 text-green-600" />
                Thông tin nhận hàng
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Địa chỉ giao hàng</label>
                  <input
                    value={shippingInfo.address}
                    onChange={(event) => updateShippingField('address', event.target.value)}
                    placeholder="Số nhà, đường, phường/xã"
                    className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${errors.shipping_address ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
                      }`}
                  />
                  {errors.shipping_address && <p className="mt-1 text-xs text-red-500">{errors.shipping_address}</p>}
                </div>

                {/* SOTA Map Viewport and location selector */}
                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                      <MapPin className="size-4 text-green-600 animate-bounce" />
                      Bản đồ định vị địa điểm nhận hàng
                    </span>
                    <button
                      type="button"
                      onClick={handleGpsMapLocate}
                      disabled={mapGpsLoading}
                      className="px-3.5 py-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-bold rounded-full hover:bg-green-100 transition-all flex items-center gap-1 disabled:opacity-50 shadow-xs"
                    >
                      <MapPin className="size-3" />
                      {mapGpsLoading ? 'Đang định vị...' : 'Sử dụng vị trí hiện tại'}
                    </button>
                  </div>
                  <div className="relative w-full h-[260px] rounded-2xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow group">
                    <div ref={mapContainerRef} className="w-full h-full z-10" />

                    {/* Floating Search Bar */}
                    <div className="absolute top-3 left-3 right-3 z-20 flex items-center bg-white rounded-full shadow-md border border-gray-150 px-3 py-1.5 gap-2 max-w-md">
                      <MapPin className="size-4 text-gray-400 shrink-0 ml-1" />
                      <input
                        type="text"
                        value={mapSearchQuery}
                        onChange={(e) => setMapSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleMapSearch();
                          }
                        }}
                        placeholder="Nhập địa chỉ cụ thể hoặc click chọn trên bản đồ..."
                        className="flex-1 bg-transparent text-xs outline-none text-gray-800 placeholder-gray-400"
                      />
                      <button
                        type="button"
                        onClick={handleMapSearch}
                        className="px-4 py-1.5 bg-[#0d3b66] text-white text-xs font-bold rounded-full hover:bg-[#154675] transition-colors shrink-0"
                      >
                        Tìm kiếm
                      </button>
                    </div>

                    {/* Floating Overlay Instruction */}
                    <div className="absolute bottom-3.5 left-3.5 z-20 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-full shadow-xs border border-gray-150 text-[10px] sm:text-xs font-bold text-gray-700 flex items-center gap-1.5 pointer-events-none select-none">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      Nhấp bản đồ hoặc kéo thả ghim để chọn vị trí giao
                    </div>
                  </div>
                </div>

                {/* Weather & ETA estimation display */}
                {estLoading && (
                  <div className="md:col-span-2 py-4 px-5 bg-gray-50 border border-gray-100 rounded-2xl animate-pulse text-xs text-gray-500 flex items-center gap-2.5">
                    <Clock className="size-4 animate-spin text-green-600" />
                    Đang tính toán khoảng cách và thời tiết khu vực giao hàng...
                  </div>
                )}

                {(!estLoading && estimation) && (
                  <div className="md:col-span-2 p-5 bg-gradient-to-br from-green-50/50 to-emerald-50/40 border border-green-100 rounded-2xl space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2 font-semibold text-gray-900">
                        <MapPin className="size-4 text-green-600" />
                        📍 Vị trí nhận: <span className="text-green-700">{estimation.cityName}</span>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-semibold text-gray-600 bg-white px-3 py-1.5 rounded-full shadow-xs border border-green-100/50">
                        <span className="flex items-center gap-1">
                          {estimation.conditionEmoji} {estimation.conditionVi}
                        </span>
                        <span className="h-3 w-px bg-gray-200" />
                        <span>
                          <Thermometer className="size-3.5 inline mr-0.5 text-orange-500" /> {estimation.temperature}°C
                        </span>
                        <span className="h-3 w-px bg-gray-200" />
                        <span>
                          💧 Độ ẩm {estimation.humidity}%
                        </span>
                        <span className="h-3 w-px bg-gray-200" />
                        <span>
                          <Wind className="size-3.5 inline mr-0.5 text-sky-500" /> {estimation.windSpeed} km/h
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-green-200/50 pt-3 space-y-3">
                      <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Thông tin lộ trình vận chuyển theo từng Shop:</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {Object.entries(estimations).map(([supplierLabel, est]) => (
                          <div key={supplierLabel} className="bg-white border border-green-100 p-3.5 rounded-xl shadow-xs space-y-2">
                            <div className="font-extrabold text-[13px] text-green-800 border-b border-gray-50 pb-1.5 flex items-center gap-1.5">
                              <Store className="size-3.5 text-green-600 shrink-0" />
                              {supplierLabel}
                            </div>
                            <div className="space-y-2 text-xs text-gray-750">
                              <div className="flex justify-between border-b border-gray-50 pb-1">
                                <span className="text-gray-500">Trọng lượng đơn:</span>
                                <span className="font-bold text-slate-800">{est.weightKg.toFixed(1)} kg</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Vận chuyển từ:</span>
                                <span className="font-bold text-gray-900">{est.warehouseName} ({est.distanceKm} km)</span>
                              </div>

                              {/* Shipping carrier selector */}
                              <div className="space-y-1.5 mt-2">
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Chọn đơn vị vận chuyển:</div>
                                <div className="grid gap-1.5">
                                  {est.carrierRates?.map((rate) => {
                                    const selectedCarrier = selectedCarriers[supplierLabel] || 'ghtk';
                                    const isCurrent = selectedCarrier === rate.code;
                                    return (
                                      <button
                                        key={rate.code}
                                        type="button"
                                        onClick={() => setSelectedCarriers(prev => ({ ...prev, [supplierLabel]: rate.code }))}
                                        className={`flex items-center justify-between p-2 rounded-xl border text-left transition-all ${isCurrent
                                          ? 'border-green-600 bg-green-50/50 shadow-xs'
                                          : 'border-gray-150 hover:bg-gray-50/30'
                                          }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="radio"
                                            name={`carrier-${supplierLabel}`}
                                            checked={isCurrent}
                                            onChange={() => setSelectedCarriers(prev => ({ ...prev, [supplierLabel]: rate.code }))}
                                            className="accent-green-600 size-3"
                                          />
                                          <div>
                                            <p className="text-xs font-bold text-gray-950">{rate.name}</p>
                                            <p className="text-[10px] text-gray-500 font-semibold">Nhận dự kiến: {rate.eta}</p>
                                          </div>
                                        </div>
                                        <span className="text-xs font-extrabold text-green-700">{toCurrencyTextFromNumber(rate.fee)}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {est.surcharge > 0 && (
                                <div className="flex justify-between text-orange-650 font-semibold border-t border-dashed border-gray-100 pt-1.5">
                                  <span>Phụ phí xe lạnh thời tiết:</span>
                                  <span>{toCurrencyTextFromNumber(est.surcharge)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Notices and Alerts */}
                    {(estimation.weatherNotice || estimation.temperatureNotice || estimation.windNotice) && (
                      <div className="border-t border-green-100/50 pt-3 space-y-2 text-xs font-semibold text-rose-800">
                        {estimation.weatherNotice && (
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="size-3.5 shrink-0 text-rose-600 mt-0.5" />
                            <span>{estimation.weatherNotice}</span>
                          </div>
                        )}
                        {estimation.temperatureNotice && (
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="size-3.5 shrink-0 text-amber-600 mt-0.5" />
                            <span>{estimation.temperatureNotice}</span>
                          </div>
                        )}
                        {estimation.windNotice && (
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="size-3.5 shrink-0 text-sky-600 mt-0.5" />
                            <span>{estimation.windNotice}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-700">Tên người nhận</label>
                  <div className="relative mt-2">
                    <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={shippingInfo.receiver}
                      onChange={(event) => updateShippingField('receiver', event.target.value)}
                      className={`w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none transition-colors ${errors.shipping_receiver ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
                        }`}
                    />
                  </div>
                  {errors.shipping_receiver && <p className="mt-1 text-xs text-red-500">{errors.shipping_receiver}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Số điện thoại</label>
                  <div className="relative mt-2">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={shippingInfo.phone}
                      onChange={(event) => updateShippingField('phone', event.target.value)}
                      placeholder="VD: 090x xxx xxx"
                      className={`w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none transition-colors ${errors.shipping_phone ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
                        }`}
                    />
                  </div>
                  {errors.shipping_phone && <p className="mt-1 text-xs text-red-500">{errors.shipping_phone}</p>}
                </div>
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-700">Ghi chú (tuỳ chọn)</label>
                <textarea
                  value={shippingInfo.note}
                  onChange={(event) => updateShippingField('note', event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>
              <label className="mt-4 inline-flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={saveAddress}
                  onChange={(event) => setSaveAddress(event.target.checked)}
                  className="size-4 rounded border-gray-300 text-green-600"
                />
                Lưu địa chỉ giao hàng thường dùng
              </label>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                  <FileText className="size-5 text-green-600" />
                  Thông tin xuất hóa đơn
                </div>
                <button
                  type="button"
                  onClick={() => setInvoiceEditable((prev) => !prev)}
                  className="rounded-full border border-green-600 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-50"
                >
                  {invoiceEditable ? 'Khoá thông tin' : 'Thay đổi thông tin xuất hóa đơn'}
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Tên công ty</label>
                  <input
                    value={invoiceInfo.companyName}
                    onChange={(event) => updateInvoiceField('companyName', event.target.value)}
                    disabled={!invoiceEditable}
                    className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${errors.invoice_companyName ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
                      }`}
                  />
                  {errors.invoice_companyName && (
                    <p className="mt-1 text-xs text-red-500">{errors.invoice_companyName}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Mã số thuế</label>
                  <input
                    value={invoiceInfo.taxCode}
                    onChange={(event) => updateInvoiceField('taxCode', event.target.value)}
                    disabled={!invoiceEditable}
                    className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${errors.invoice_taxCode ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
                      }`}
                  />
                  {errors.invoice_taxCode && <p className="mt-1 text-xs text-red-500">{errors.invoice_taxCode}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Địa chỉ</label>
                  <input
                    value={invoiceInfo.address}
                    onChange={(event) => updateInvoiceField('address', event.target.value)}
                    disabled={!invoiceEditable}
                    className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${errors.invoice_address ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
                      }`}
                  />
                  {errors.invoice_address && <p className="mt-1 text-xs text-red-500">{errors.invoice_address}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Email nhận hóa đơn</label>
                  <input
                    value={invoiceInfo.email}
                    onChange={(event) => updateInvoiceField('email', event.target.value)}
                    disabled={!invoiceEditable}
                    className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${errors.invoice_email ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
                      }`}
                  />
                  {errors.invoice_email && <p className="mt-1 text-xs text-red-500">{errors.invoice_email}</p>}
                </div>
              </div>
            </section>

            {/* Payment Method Selection */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <CreditCard className="size-5 text-green-600" />
                Phương thức thanh toán
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* VietQR Option */}
                <div
                  onClick={() => setPaymentMethod('bank_transfer')}
                  className={`relative cursor-pointer rounded-2xl border-2 p-4 transition-all hover:shadow-md flex items-start gap-3.5 ${
                    paymentMethod === 'bank_transfer'
                      ? 'border-green-600 bg-green-50/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-50 border border-green-100 text-green-600 shrink-0">
                    <Percent className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">Chuyển khoản VietQR</p>
                    <p className="text-[11px] text-gray-500 font-medium mt-1 leading-relaxed">
                      Quét mã VietQR chuyển khoản nhanh 24/7. Hỗ trợ tất cả ngân hàng Việt Nam.
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center justify-center mt-1">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      paymentMethod === 'bank_transfer' ? 'border-green-600 bg-green-600' : 'border-gray-300'
                    }`}>
                      {paymentMethod === 'bank_transfer' && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>

                {/* COD Option */}
                <div
                  onClick={() => setPaymentMethod('direct_payment')}
                  className={`relative cursor-pointer rounded-2xl border-2 p-4 transition-all hover:shadow-md flex items-start gap-3.5 ${
                    paymentMethod === 'direct_payment'
                      ? 'border-green-600 bg-green-50/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 shrink-0">
                    <User className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">Thanh toán trực tiếp khi nhận hàng</p>
                    <p className="text-[11px] text-gray-500 font-medium mt-1 leading-relaxed">
                      Thanh toán bằng tiền mặt hoặc chuyển khoản trực tiếp cho nhân viên khi nhận đủ hàng sỉ.
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center justify-center mt-1">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      paymentMethod === 'direct_payment' ? 'border-green-600 bg-green-600' : 'border-gray-300'
                    }`}>
                      {paymentMethod === 'direct_payment' && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4: Đăng ký mua định kỳ / Đặt hàng tự động */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
                  <Calendar className="size-5 text-green-600" />
                  Đăng ký mua định kỳ (Subscription)
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              {isRecurring ? (
                <div className="space-y-4 pt-2 text-sm transition-all duration-300">
                  <p className="text-xs text-green-700 bg-green-50 p-3.5 rounded-2xl border border-green-100 font-semibold leading-relaxed">
                    💡 Hệ thống sẽ tự động lên đơn hàng mới cho các sản phẩm này (ở trạng thái Chờ thanh toán) vào các ngày hẹn dưới đây. Bạn chỉ cần vào Dashboard thanh toán bằng QR là xong.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tần suất lên đơn</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setRecFrequency('weekly')}
                          className={`flex-1 py-2 px-4 rounded-xl border text-xs font-bold transition-all ${recFrequency === 'weekly'
                            ? 'bg-green-600 border-transparent text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                          Hàng tuần
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecFrequency('monthly')}
                          className={`flex-1 py-2 px-4 rounded-xl border text-xs font-bold transition-all ${recFrequency === 'monthly'
                            ? 'bg-green-600 border-transparent text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                          Hàng tháng
                        </button>
                      </div>
                    </div>

                    {recFrequency === 'weekly' ? (
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Chọn thứ trong tuần</label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { value: 1, label: 'T2' },
                            { value: 2, label: 'T3' },
                            { value: 3, label: 'T4' },
                            { value: 4, label: 'T5' },
                            { value: 5, label: 'T6' },
                            { value: 6, label: 'T7' },
                            { value: 0, label: 'CN' }
                          ].map((day) => {
                            const isSelected = recWeekdays.includes(day.value);
                            return (
                              <button
                                type="button"
                                key={day.value}
                                onClick={() => {
                                  if (isSelected) {
                                    if (recWeekdays.length > 1) {
                                      setRecWeekdays(recWeekdays.filter((d) => d !== day.value));
                                    }
                                  } else {
                                    setRecWeekdays([...recWeekdays, day.value]);
                                  }
                                }}
                                className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xs font-bold transition-all ${isSelected
                                  ? 'bg-green-100 border-green-300 text-green-700'
                                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                  }`}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Chọn ngày trong tháng</label>
                        <select
                          value={recMonthDay}
                          onChange={(e) => setRecMonthDay(parseInt(e.target.value, 10))}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500 bg-white"
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>
                              Ngày {d} hàng tháng
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 pt-1">
                  Bật tùy chọn này để lưu các sản phẩm hiện có thành lịch đặt hàng tự động định kỳ cho tương lai.
                </p>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-6 lg:h-fit">
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <ShoppingBag className="size-5 text-green-600" />
                Thanh toán
              </div>

              {/* Voucher sỉ selector */}
              <div className="border-b border-gray-100 pb-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Ticket className="size-4 text-green-600" />
                  Voucher của bạn
                </label>
                {claimedVouchersList.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 p-3 bg-gray-50/50 text-center">
                    <p className="text-xs text-gray-400 mb-1.5">Bạn chưa có voucher nào được lưu.</p>
                    <a
                      href={reactHomePath}
                      className="text-xs font-bold text-green-600 hover:text-green-700 inline-flex items-center gap-1"
                    >
                      Về trang chủ nhận voucher &rarr;
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={appliedVoucher ? appliedVoucher.discount_code : ''}
                      onChange={(e) => {
                        const code = e.target.value;
                        if (!code) {
                          setAppliedVoucher(null);
                          setVoucherError(null);
                          return;
                        }
                        const selected = claimedVouchersList.find((v) => v.discount_code === code);
                        if (selected) {
                          if (subtotal < (selected.min_order_amount || 0)) {
                            setVoucherError(`Đơn hàng chưa đạt giá trị tối thiểu ${toCurrencyTextFromNumber(selected.min_order_amount)}`);
                            setAppliedVoucher(null);
                          } else {
                            setAppliedVoucher(selected);
                            setVoucherError(null);
                          }
                        }
                      }}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500 bg-white"
                    >
                      <option value="">-- Chọn voucher sỉ --</option>
                      {claimedVouchersList.map((v) => {
                        const isUnderMin = subtotal < (v.min_order_amount || 0);
                        return (
                          <option key={v.discount_code} value={v.discount_code} disabled={isUnderMin}>
                            {v.discount_code} - Giảm {toCurrencyTextFromNumber(v.discount_value)} {isUnderMin ? '(Chưa đủ điều kiện)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    {voucherError && (
                      <p className="text-xs text-red-500 font-medium">{voucherError}</p>
                    )}
                    {appliedVoucher && !voucherError && (
                      <div className="rounded-xl border border-green-100 bg-green-50/50 p-2.5 flex items-center justify-between text-xs text-green-800">
                        <div className="pr-2">
                          <p className="font-bold">{appliedVoucher.title}</p>
                          <p className="text-gray-500">{appliedVoucher.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAppliedVoucher(null);
                            setVoucherError(null);
                          }}
                          className="text-xs font-bold text-red-500 hover:text-red-700 bg-white border border-red-100 rounded-lg px-2 py-1 transition shrink-0"
                        >
                          Gỡ mã
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Tổng tiền hàng</span>
                  <span className="font-semibold text-gray-900">{toCurrencyTextFromNumber(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Phí vận chuyển</span>
                  <span>{toCurrencyTextFromNumber(shippingFee)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Giảm giá vận chuyển</span>
                  <span>- {toCurrencyTextFromNumber(shippingDiscount)}</span>
                </div>
                {voucherDiscount > 0 && (
                  <div className="flex items-center justify-between text-green-700 font-semibold bg-green-50/60 px-3 py-2 rounded-xl border border-green-100">
                    <span className="flex items-center gap-1.5 text-xs">
                      <Percent className="size-4 text-green-600" />
                      Voucher sỉ ({appliedVoucher?.discount_code})
                    </span>
                    <span className="text-xs">- {toCurrencyTextFromNumber(voucherDiscount)}</span>
                  </div>
                )}
                {weatherSurcharge > 0 && (
                  <div className="flex items-center justify-between text-amber-700 font-semibold bg-amber-50/60 px-3 py-2 rounded-xl border border-amber-100">
                    <span className="flex items-center gap-1.5 text-xs">
                      <Thermometer className="size-4 text-amber-600" />
                      Phụ phí xe lạnh (Nắng nóng &gt;35°C)
                    </span>
                    <span className="text-xs">+ {toCurrencyTextFromNumber(weatherSurcharge)}</span>
                  </div>
                )}
                <div className="border-t border-dashed border-gray-200 pt-3 text-base font-semibold text-gray-900">
                  <div className="flex items-center justify-between">
                    <span>Tổng thanh toán</span>
                    <span>{toCurrencyTextFromNumber(totalAmount)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveDraft}
                className="w-full rounded-full border border-green-600 px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-50"
              >
                Lưu đơn chờ thanh toán
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full rounded-full bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Đang tạo đơn hàng...' : 'Đặt hàng & Thanh toán'}
              </button>
              <p className="text-xs text-gray-400">* Giá sẽ được hệ thống xác nhận lại trước khi tạo đơn chính thức.</p>
            </div>
          </aside>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* VietQR Payment Modal */}
      {qrOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium opacity-80">Mã đơn hàng</p>
                  <p className="text-2xl font-bold tracking-wider">{qrOrder.orderCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium opacity-80">Tổng thanh toán</p>
                  <p className="text-xl font-bold">{toCurrencyTextFromNumber(qrOrder.totalAmount)}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              {paymentStatus === 'pending' && (
                <>
                  {/* Countdown */}
                  <div className="mb-4 flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-2">
                    <span className="text-sm text-amber-700 font-medium">⏱ Giữ hàng còn lại</span>
                    <span className={`text-lg font-bold tabular-nums ${countdown < 60 ? 'text-red-600' : 'text-amber-700'
                      }`}>
                      {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
                    </span>
                  </div>

                  {/* QR Code */}
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-gray-500 text-center">Quét mã QR bằng app ngân hàng để thanh toán</p>
                    <div className="rounded-2xl border-4 border-green-100 p-2 shadow-inner">
                      <img
                        src={`https://img.vietqr.io/image/BIDV-96247VUONGTHUYLINH-compact2.png?amount=${Math.round(qrOrder.totalAmount)}&addInfo=THANHTOAN${qrOrder.orderCode}&accountName=VUONG%20THUY%20LINH`}
                        alt="VietQR Payment"
                        className="w-56 h-56 object-contain rounded-xl"
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=224x224&data=THANHTOAN${qrOrder.orderCode}%20${Math.round(qrOrder.totalAmount)}VND`; }}
                      />
                    </div>
                    <div className="w-full rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">Nội dung chuyển khoản</p>
                      <p className="text-base font-bold text-green-700 tracking-wider">THANHTOAN {qrOrder.orderCode}</p>
                    </div>
                    <p className="text-xs text-gray-400 text-center">Hệ thống tự động xác nhận sau khi nhận được tiền</p>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await fetch(`/rest/V1/tmdt-orders/status/${encodeURIComponent(qrOrder.orderCode)}`);
                        const data = await res.json().catch(() => null);
                        if (data?.status === 'paid' || data?.status === 'processing') {
                          stopPolling();
                          setPaymentStatus('paid');
                          window.setTimeout(() => {
                            window.sessionStorage.removeItem(checkoutPayloadKey);
                            window.localStorage.removeItem(checkoutPayloadKey);
                            window.localStorage.removeItem('freso_local_cart_items');
                            window.location.href = `${reactHomePath}?view=thank-you&orderId=${qrOrder.orderCode}`;
                          }, 1200);
                        } else {
                          showToast('Chưa nhận được thanh toán. Vui lòng đợi thêm.');
                        }
                      }}
                      className="flex-1 rounded-full bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition"
                    >
                      Đã chuyển khoản
                    </button>
                    <button
                      type="button"
                      onClick={() => { stopPolling(); setQrOrder(null); }}
                      className="flex-1 rounded-full border border-gray-300 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                    >
                      Hủy
                    </button>
                  </div>
                </>
              )}

              {paymentStatus === 'paid' && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-xl font-bold text-gray-900">Thanh toán thành công! 🎉</p>
                  <p className="text-sm text-gray-500 text-center">Đơn hàng <strong>{qrOrder.orderCode}</strong> đã được xác nhận. Đang chuyển trang...</p>
                </div>
              )}

              {(paymentStatus === 'expired' || paymentStatus === 'cancelled') && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-lg font-bold text-gray-900">Đơn hàng đã hết hạn</p>
                  <p className="text-sm text-gray-500 text-center">Hàng đã được trả về kho. Vui lòng đặt lại đơn hàng.</p>
                  <button
                    type="button"
                    onClick={() => { stopPolling(); setQrOrder(null); }}
                    className="rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition"
                  >
                    Đặt lại đơn hàng
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Location Permission Prompt Modal */}
      {showLocationPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl overflow-hidden border border-gray-100 text-center">
            <div className="mx-auto my-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 animate-pulse">
              <MapPin className="size-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Sử dụng vị trí của bạn?</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              Freso cần vị trí của bạn để tự động tìm chi nhánh gần nhất, định vị địa chỉ giao hàng và tính toán thời tiết chính xác cho lộ trình bảo quản lạnh.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleAllowLocation}
                className="w-full rounded-full bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 shadow-sm transition-all"
              >
                Đồng ý chia sẻ vị trí
              </button>
              <button
                type="button"
                onClick={handleDenyLocation}
                className="w-full rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
              >
                Bỏ qua, dùng vị trí mặc định
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
