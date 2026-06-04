import { ArrowLeft, ReceiptText } from 'lucide-react';
import { OrderTrackingMap } from './OrderTrackingMap';

const reactHomePath = '/react/index.html';

const getQueryValue = (params: URLSearchParams, key: string, fallback: string) => {
  const value = params.get(key);
  return value ? decodeURIComponent(value) : fallback;
};

export function OrderTrackingPage() {
  const params = new URLSearchParams(window.location.search);
  const orderReference = getQueryValue(params, 'orderId', 'DH-DEMO-TRACKING');
  const supplier = getQueryValue(params, 'supplier', 'Tổng công ty Chăn nuôi CP Việt Nam · Miền Tây');
  const customerRegion = getQueryValue(params, 'region', 'Quận 1, TP. Hồ Chí Minh');
  const shippingAddress = getQueryValue(params, 'address', 'Chi nhánh Quận 1, TP. Hồ Chí Minh');
  const status = getQueryValue(params, 'status', 'paid');

  return (
    <div className="min-h-screen bg-[#f6f8f7] py-8 text-slate-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <a
          href={reactHomePath}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700"
        >
          <ArrowLeft className="size-4" />
          Quay lại
        </a>

        <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Theo dõi đơn hàng</p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900">
                <ReceiptText className="size-5 text-emerald-600" />
                {orderReference}
              </h1>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600">
              {supplier}
            </div>
          </div>
        </div>

        <OrderTrackingMap
          order={{
            orderReference,
            status,
            statusLabel: 'Đã xác nhận thanh toán',
            supplier,
            customerRegion,
            shippingAddress,
          }}
        />
      </div>
    </div>
  );
}
