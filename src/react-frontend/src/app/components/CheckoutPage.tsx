import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, FileText, MapPin, PackageCheck, Phone, ShoppingBag, User } from 'lucide-react';
import { toCurrencyTextFromNumber, useCart } from '../cart/CartProvider';

const reactHomePath = '/react/index.html';
const checkoutPayloadKey = 'freso_checkout_payload';
const checkoutAddressKey = 'freso_checkout_address';
const checkoutInvoiceKey = 'freso_checkout_invoice';
const checkoutDraftKey = 'freso_checkout_draft';

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

const readCheckoutPayload = (): CheckoutPayload | null => {
  const raw = window.sessionStorage.getItem(checkoutPayloadKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CheckoutPayload;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
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

  const subtotal = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [checkoutItems]
  );
  const shippingFee = 0;
  const shippingDiscount = 0;
  const totalAmount = subtotal + shippingFee - shippingDiscount;

  useEffect(() => {
    const storedPayload = readCheckoutPayload();
    if (storedPayload) {
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

    if (selected.length > 0) {
      const suppliers = Array.from(new Set(selected.map((item) => item.category).filter(Boolean)));
      setCheckoutItems(selected);
      setSupplierOptions(suppliers);
      setSupplier(suppliers[0] || '');
    }
    setIsReady(true);
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

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {})
        },
        body: JSON.stringify(orderPayload)
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP ${response.status}`);
      }

      showToast('Đặt hàng thành công! Đang chờ xác nhận thanh toán.');
      window.sessionStorage.removeItem(checkoutPayloadKey);
      window.location.href = reactHomePath;
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
                {checkoutItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                    <img src={item.image} alt={item.name} className="size-14 rounded-xl object-cover" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} {item.unit} • {toCurrencyTextFromNumber(item.unitPrice)}
                      </p>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">
                      {toCurrencyTextFromNumber(item.quantity * item.unitPrice)}
                    </div>
                  </div>
                ))}
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
                {isSubmitting ? 'Đang xử lý...' : 'Thanh toán ngay'}
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
    </div>
  );
}
