import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Clock, FileText, MapPin, PackageCheck, Phone, ShoppingBag, User } from 'lucide-react';
import { toCurrencyTextFromNumber, useCart } from '../cart/CartProvider';

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
  unit: string;
  image: string;
  category: string;
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
const branches = ['Chi nhánh Quận 1', 'Chi nhánh Quận 7', 'Chi nhánh Thủ Đức', 'Chi nhánh Bình Thạnh'];

const getCustomerEmail = () =>
  window.localStorage.getItem('freso_customer_email') || window.sessionStorage.getItem('freso_customer_email') || '';
const getCustomerName = () =>
  window.localStorage.getItem('freso_customer_name') || window.sessionStorage.getItem('freso_customer_name') || '';
const getAuthToken = () =>
  window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';

const isValidPhone = (value: string) => /^(\+?84|0)\d{9,10}$/.test(value.replace(/\s/g, ''));
const getRegionFromBranch = (branch: string) => branch.replace(/^Chi nhánh\s+/i, '').trim();

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
  const suppliers = Array.from(new Set(items.map((item) => item.category).filter(Boolean)));
  return {
    items,
    subtotal: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    suppliers,
    supplier: suppliers[0] || ''
  };
};

const mapMagentoCartItems = (items: MagentoCartItem[] = []): CheckoutItem[] => {
  const customLocalRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_custom_products') : null;
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
    
    const originalPrice = matchingProduct ? Number(matchingProduct.price) : Number(product.price_range?.minimum_price?.final_price?.value ?? 0);
    const tiers = matchingProduct?.wholesale_tiers || [];
    const activeTier = tiers
      .filter((t: any) => qty >= t.qty)
      .sort((a: any, b: any) => b.qty - a.qty)[0];

    const discountPercent = activeTier ? activeTier.discount : 0;
    const unitPrice = originalPrice * (1 - discountPercent / 100);
    const category = product.categories?.find((cat) => cat?.name)?.name ?? (matchingProduct?.categoryLabel || '');
    const unit = matchingProduct?.unit || 'kg';
    const galleryImage = (product.media_gallery_entries ?? []).find((entry) => {
      const file = entry.file?.trim() ?? '';
      return file && !file.toLowerCase().includes('placeholder');
    });
    const finalImage =
      (isRealImageUrl(getMagentoMediaImageUrl(galleryImage?.file)) ? getMagentoMediaImageUrl(galleryImage?.file) : '') ||
      (isRealImageUrl(product.small_image?.url) ? product.small_image?.url : '') ||
      (isRealImageUrl(product.thumbnail?.url) ? product.thumbnail?.url : '') ||
      matchingProduct?.image ||
      'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=500&h=500&fit=crop';

    return {
      id: String(item.id),
      sku: product.sku ?? '',
      name: product.name ?? (matchingProduct?.name || 'Sản phẩm'),
      quantity: qty,
      unitPrice,
      unit,
      image: finalImage,
      category
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

export function CheckoutPage() {
  const { cartItems } = useCart();
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<string[]>([]);
  const [supplier, setSupplier] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    branch: branches[0],
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

  // VietQR Payment Modal state
  const [qrOrder, setQrOrder] = useState<{ orderCode: string; totalAmount: number; expiresAt: string } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'expired' | 'cancelled'>('pending');
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
  const shippingFee = 0;
  const shippingDiscount = 0;
  const totalAmount = subtotal + shippingFee - shippingDiscount;

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
      category: item.category
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
    if (field === 'note') return '';
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

    const orderPayload = {
      userId: getCustomerEmail() || 'guest',
      items: checkoutItems.map((item) => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unit: item.unit
      })),
      supplier,
      deliveryDate,
      deliveryTime,
      shippingAddress: `${shippingInfo.branch} - ${shippingInfo.address}`,
      note: shippingInfo.note,
      invoiceInfo
    };
    const purchaseHistoryPayload = {
      customerEmail: getCustomerEmail(),
      orderReference: `TMDT-${Date.now()}`,
      customerRegion: getRegionFromBranch(shippingInfo.branch),
      items: checkoutItems.map((item) => ({
        sku: item.sku,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unit: item.unit,
        image: item.image
      })),
      supplier,
      subtotal,
      totalAmount,
      deliveryDate,
      deliveryTime,
      shippingAddress: `${shippingInfo.branch} - ${shippingInfo.address}`,
      note: shippingInfo.note,
      invoiceInfo
    };

    try {
      setIsSubmitting(true);

      // Step 1: Create order in backend and get orderCode
      const createRes = await fetch('/rest/V1/tmdt-orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {})
        },
        body: JSON.stringify({
          // Flat params matching Magento interface (no nested array)
          customerEmail: getCustomerEmail() || 'guest',
          customerName: getCustomerName(),
          totalAmount,
          itemsJson: JSON.stringify(checkoutItems.map((item) => ({
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unit: item.unit
          }))),
          shippingJson: JSON.stringify({
            branch: shippingInfo.branch,
            address: shippingInfo.address,
            receiver: shippingInfo.receiver,
            phone: shippingInfo.phone,
            note: shippingInfo.note,
            deliveryDate,
            deliveryTime
          })
        })
      });

      let orderCode: string;
      let expiresAt: string;

      if (createRes.ok) {
        const orderData = await createRes.json();
        orderCode = orderData?.orderCode ?? `DH${Date.now().toString(36).toUpperCase().slice(-6)}`;
        expiresAt = orderData?.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000).toISOString();
      } else {
        // Fallback: generate local order code if API fails
        orderCode = `DH${Date.now().toString(36).toUpperCase().slice(-6)}`;
        expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }

      // Step 2: Also save purchase history
      const token = getAuthToken();
      if (token) {
        fetch('/rest/V1/tmdt-search/purchase-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            customerEmail: getCustomerEmail(),
            orderReference: orderCode,
            customerRegion: getRegionFromBranch(shippingInfo.branch),
            items: checkoutItems.map((item) => ({
              sku: item.sku, name: item.name, category: item.category,
              quantity: item.quantity, unitPrice: item.unitPrice, unit: item.unit, image: item.image
            })),
            supplier, subtotal, totalAmount, deliveryDate, deliveryTime,
            shippingAddress: `${shippingInfo.branch} - ${shippingInfo.address}`,
            note: shippingInfo.note, invoiceInfo
          })
        }).catch(() => {/* ignore */});
      }

      const preferredRegion = getRegionFromBranch(shippingInfo.branch);
      if (preferredRegion) {
        window.localStorage.setItem(preferredRegionStorageKey, preferredRegion);
        window.sessionStorage.setItem(preferredRegionStorageKey, preferredRegion);
      }

      // Step 3: Show VietQR modal
      setQrOrder({ orderCode, totalAmount, expiresAt });
      setPaymentStatus('pending');
      setCountdown(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
      startPolling(orderCode, expiresAt);

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
                {checkoutItems.map((item) => {
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
                  const originalPrice = matchingProduct ? Number(matchingProduct.price) : item.unitPrice;
                  const tiers = matchingProduct?.wholesale_tiers || [];
                  const activeTier = tiers
                    .filter((t: any) => item.quantity >= t.qty)
                    .sort((a: any, b: any) => b.qty - a.qty)[0];
                  const discountPercent = activeTier ? activeTier.discount : 0;
                  const hasDiscount = discountPercent > 0;

                  return (
                    <div key={item.id} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                      <img src={item.image} alt={item.name} className="size-14 rounded-xl object-cover" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span>{item.quantity} {item.unit} •</span>
                          {hasDiscount ? (
                            <>
                              <span className="line-through text-gray-400">
                                {toCurrencyTextFromNumber(originalPrice)}
                              </span>
                              <span className="px-1 py-0.2 bg-red-50 text-red-600 rounded text-[9px] font-bold">
                                -{discountPercent}% sỉ
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
                      <div className="text-sm font-semibold text-gray-900">
                        {toCurrencyTextFromNumber(item.quantity * item.unitPrice)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">

                {supplierOptions.length > 1 && (
                  <select
                    value={supplier}
                    onChange={(event) => setSupplier(event.target.value)}
                    className="rounded-full border border-gray-200 px-3 py-1 text-sm"
                  >
                    {supplierOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
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
                    className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${
                      errors.deliveryDate ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
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
                      className={`w-full rounded-xl border bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors ${
                        errors.deliveryTime ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
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
                <div>
                  <label className="text-sm font-medium text-gray-700">Chi nhánh</label>
                  <select
                    value={shippingInfo.branch}
                    onChange={(event) => updateShippingField('branch', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-500"
                  >
                    {branches.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Địa chỉ giao hàng</label>
                  <input
                    value={shippingInfo.address}
                    onChange={(event) => updateShippingField('address', event.target.value)}
                    placeholder="Số nhà, đường, phường/xã"
                    className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${
                      errors.address ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
                    }`}
                  />
                  {errors.shipping_address && <p className="mt-1 text-xs text-red-500">{errors.shipping_address}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Tên người nhận</label>
                  <div className="relative mt-2">
                    <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={shippingInfo.receiver}
                      onChange={(event) => updateShippingField('receiver', event.target.value)}
                      className={`w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none transition-colors ${
                        errors.receiver ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
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
                      className={`w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none transition-colors ${
                        errors.phone ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
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
                    className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${
                      errors.invoice_companyName ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
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
                    className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${
                      errors.invoice_taxCode ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
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
                    className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${
                      errors.invoice_address ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
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
                    className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${
                      errors.invoice_email ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-green-500'
                    }`}
                  />
                  {errors.invoice_email && <p className="mt-1 text-xs text-red-500">{errors.invoice_email}</p>}
                </div>
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-6 lg:h-fit">
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <ShoppingBag className="size-5 text-green-600" />
                Thanh toán
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
                    <span className={`text-lg font-bold tabular-nums ${
                      countdown < 60 ? 'text-red-600' : 'text-amber-700'
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
    </div>
  );
}
