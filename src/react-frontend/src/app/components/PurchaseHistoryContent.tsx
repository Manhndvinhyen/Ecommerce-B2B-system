import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, PackageSearch, ReceiptText } from 'lucide-react';
import { toCurrencyTextFromNumber } from '../cart/CartProvider';

type PurchaseHistoryItem = {
  item_id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  unit_price: number;
  row_total: number;
  image: string;
};

type PurchaseHistoryOrder = {
  history_id: number;
  order_reference: string;
  supplier: string;
  subtotal: number;
  total_amount: number;
  delivery_date: string;
  delivery_time: string;
  shipping_address: string;
  created_at: string;
  items: PurchaseHistoryItem[];
};

const getAuthToken = () =>
  window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';

export function PurchaseHistoryContent() {
  const [orders, setOrders] = useState<PurchaseHistoryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const totalPurchased = useMemo(
    () => orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
    [orders]
  );

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setErrorMessage('Vui lòng đăng nhập để xem lịch sử mua hàng.');
      setIsLoading(false);
      return;
    }

    fetch('/rest/V1/tmdt-search/purchase-history?limit=20', {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })
      .then(async (response) => {
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(text || `HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((json) => {
        setOrders(Array.isArray(json?.items) ? json.items : []);
        setErrorMessage('');
      })
      .catch(() => {
        setErrorMessage('Không tải được lịch sử mua hàng. Vui lòng thử lại sau.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="px-8 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch sử mua hàng</h1>
          <p className="mt-1 text-sm text-gray-500">Theo dõi các sản phẩm đã mua để đặt lại nhanh hơn ở các lần sau.</p>
        </div>
        <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Tổng đã mua</p>
          <p className="text-lg font-bold text-green-800">{toCurrencyTextFromNumber(totalPurchased)}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Đang tải lịch sử mua hàng...
        </div>
      ) : errorMessage ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <PackageSearch className="mx-auto size-10 text-gray-300" />
          <p className="mt-3 text-sm font-semibold text-gray-700">Chưa có lịch sử mua hàng</p>
          <p className="mt-1 text-sm text-gray-500">Các đơn đã thanh toán sẽ xuất hiện tại đây.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => (
            <section key={order.history_id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                    <ReceiptText className="size-4 text-green-600" />
                    {order.order_reference}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3.5" />
                      {order.delivery_date || order.created_at}
                    </span>
                    {order.delivery_time && <span>{order.delivery_time}</span>}
                    {order.supplier && <span>{order.supplier}</span>}
                  </div>
                  {order.shipping_address && <p className="mt-2 text-xs text-gray-500">{order.shipping_address}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Tổng thanh toán</p>
                  <p className="text-base font-bold text-green-700">{toCurrencyTextFromNumber(order.total_amount)}</p>
                </div>
              </div>

              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.item_id} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="size-14 rounded-xl object-cover" />
                    ) : (
                      <div className="flex size-14 items-center justify-center rounded-xl bg-white text-gray-300">
                        <PackageSearch className="size-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {item.sku} · {item.category || 'Chưa phân loại'}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold text-gray-900">
                        {item.quantity} {item.unit || 'SP'}
                      </p>
                      <p className="text-xs text-gray-500">{toCurrencyTextFromNumber(item.row_total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
