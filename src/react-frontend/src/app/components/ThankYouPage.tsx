import { useEffect, useState } from 'react';
import { CheckCircle2, Package, ShoppingBag, Home } from 'lucide-react';

const reactHomePath = '/react/index.html';

export function ThankYouPage() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('orderId') || '';
  const paymentParam = params.get('payment') || '';
  const [orderInfo, setOrderInfo] = useState<{
    orderCode: string;
    totalAmount: number;
    status: string;
    paidAt: string;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState(paymentParam);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/rest/V1/tmdt-orders/status/${encodeURIComponent(orderId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          setOrderInfo({
            orderCode: data.orderCode,
            totalAmount: data.totalAmount,
            status: data.status,
            paidAt: data.paidAt || '',
          });
        }
      })
      .catch(() => {});
  }, [orderId]);

  useEffect(() => {
    if (!orderId || paymentParam) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(`freso_order_payment_${orderId}`) || '{}');
      if (saved?.method) {
        setPaymentMethod(String(saved.method));
      }
    } catch {
      // ignore
    }
  }, [orderId, paymentParam]);

  const formatCurrency = (value: number) =>
    `${new Intl.NumberFormat('vi-VN').format(Math.round(Number.isFinite(value) ? value : 0))}đ`;

  const isCod = paymentMethod === 'cod';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Success Card */}
        <div className="rounded-3xl bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-10 text-white text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-1">{isCod ? 'Đặt hàng thành công!' : 'Thanh toán thành công!'}</h1>
            <p className="text-green-100 text-sm">
              {isCod ? 'Đơn hàng COD của bạn đã được ghi nhận' : 'Đơn hàng của bạn đã được xác nhận'}
            </p>
          </div>

          {/* Order Info */}
          <div className="px-8 py-6 space-y-5">
            {/* Order Code */}
            <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-3">
                <Package className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-gray-800">Thông tin đơn hàng</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Mã đơn hàng</span>
                  <span className="font-bold text-green-700 text-base tracking-wider">
                    {orderInfo?.orderCode || orderId}
                  </span>
                </div>
                {orderInfo?.totalAmount && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Số tiền</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(orderInfo.totalAmount)}</span>
                  </div>
                )}
                {orderInfo?.paidAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Thời gian</span>
                    <span className="text-gray-700">
                      {new Date(orderInfo.paidAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Trạng thái</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    {isCod ? 'Chờ thanh toán khi nhận hàng' : 'Đã thanh toán'}
                  </span>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">Bước tiếp theo</p>
              {[
                { step: '1', text: 'Đơn hàng đang được xác nhận và chuẩn bị hàng' },
                { step: '2', text: 'Bạn sẽ nhận được thông báo khi hàng được giao' },
                { step: '3', text: 'Hóa đơn điện tử sẽ được gửi về email đăng ký' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                    {item.step}
                  </div>
                  <p className="text-sm text-gray-600 pt-0.5">{item.text}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <a
                href={reactHomePath}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 transition"
              >
                <Home className="h-4 w-4" />
                Về trang chủ
              </a>
              <a
                href={`${reactHomePath}?view=cart`}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                <ShoppingBag className="h-4 w-4" />
                Mua thêm
              </a>
            </div>
          </div>
        </div>

        {/* Confetti-like decoration */}
        <p className="mt-6 text-center text-sm text-gray-400">
          Cảm ơn bạn đã tin tưởng mua hàng tại <strong className="text-green-600">Freso B2B</strong> 🌿
        </p>
      </div>
    </div>
  );
}
