import { useMemo, useState } from 'react';
import { FileText, Heart, Minus, Plus, Search, Send, ShoppingBag, Store } from 'lucide-react';
import { formatCartSupplierLabel, toCurrencyTextFromNumber, useCart, parsePrice } from '../cart/CartProvider';

export function ShoppingCartPage() {
  const {
    cartItems,
    removeCartItem,
    setCartItemNote,
    setCartItemQuantity,
    setCartItemSelected,
    toggleAllCartItems,
  } = useCart();
  const [searchTerm, setSearchTerm] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [rfqForm, setRfqForm] = useState({
    productName: '',
    category: '',
    quantity: '',
    unit: 'kg',
    deliveryRegion: '',
    neededBy: '',
    targetPrice: '',
    imageUrl: '',
    description: '',
  });
  const [isRfqSubmitting, setIsRfqSubmitting] = useState(false);
  const [rfqMessage, setRfqMessage] = useState('');
  const isEmbeddedInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch (error) {
      return true;
    }
  })();
  const baseOrigin = window.location.origin;
  const reactHomeUrl = `${baseOrigin}/react/index.html`;
  const checkoutPayloadKey = 'freso_checkout_payload';

  const safeNavigate = (url: string) => {
    if (isEmbeddedInIframe && window.top) {
      try {
        window.top.location.href = url;
        return;
      } catch (error) {
        // Fall back to current frame navigation when cross-origin protection blocks top access.
      }
    }

    window.location.href = url;
  };

  const handleGoHome = () => {
    safeNavigate(reactHomeUrl);
  };

  const handleGoToWishlist = () => {
    safeNavigate(`${reactHomeUrl}?view=wishlist`);
  };

  const handleCheckout = () => {
    if (selectedCount === 0) return;
    const suppliers = Array.from(
      new Set(
        selectedItems.map((item) => formatCartSupplierLabel(item)).filter(Boolean)
      )
    );

    const payload = {
      items: selectedItems.map((item) => ({
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
      })),
      subtotal: selectedTotal,
      suppliers,
      supplier: suppliers[0] || ''
    };

    const serializedPayload = JSON.stringify(payload);
    window.sessionStorage.setItem(checkoutPayloadKey, serializedPayload);
    window.localStorage.setItem(checkoutPayloadKey, serializedPayload);
    const checkoutUrl = `${reactHomeUrl}?view=checkout`;
    safeNavigate(checkoutUrl);
  };

  const prefillRfqFromSelectedItems = () => {
    if (selectedItems.length === 0) return;
    const first = selectedItems[0];
    setRfqForm((prev) => ({
      ...prev,
      productName: selectedItems.length === 1 ? first.name : `${selectedItems.length} mat hang thuc pham`,
      category: first.category || prev.category,
      quantity: selectedItems.reduce((sum, item) => sum + item.quantity, 0).toString(),
      unit: first.unit || prev.unit,
      targetPrice: first.unitPrice ? String(Math.round(first.unitPrice)) : prev.targetPrice,
      imageUrl: first.image || prev.imageUrl,
      description:
        selectedItems.length === 1
          ? `Can bao gia cho ${first.name}, so luong ${first.quantity} ${first.unit || ''}.`
          : `Can bao gia cho cac mat hang: ${selectedItems.map((item) => `${item.name} x ${item.quantity}`).join(', ')}.`,
    }));
  };

  const submitRfqRequest = async () => {
    const token = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';
    if (!token) {
      setRfqMessage('Ban can dang nhap de gui yeu cau bao gia.');
      return;
    }
    if (!rfqForm.productName.trim() || !rfqForm.quantity.trim()) {
      setRfqMessage('Vui long nhap ten san pham va so luong can mua.');
      return;
    }

    setIsRfqSubmitting(true);
    setRfqMessage('');
    try {
      const response = await fetch(`${window.location.origin}/rest/V1/tmdt-rfq/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productName: rfqForm.productName,
          quantity: Number(rfqForm.quantity),
          unit: rfqForm.unit,
          desiredPrice: rfqForm.targetPrice ? Number(rfqForm.targetPrice) : 0,
          shippingAddress: rfqForm.deliveryRegion || 'Chưa xác định',
          deliveryDate: rfqForm.neededBy || new Date(Date.now() + 3*24*60*60*1000).toISOString().split('T')[0],
          expiryDate: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0]
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Khong the gui yeu cau bao gia.');
      }
      setRfqMessage(data.message || 'Da gui yeu cau bao gia thanh cong.');
      setRfqForm({
        productName: '',
        category: '',
        quantity: '',
        unit: 'kg',
        deliveryRegion: '',
        neededBy: '',
        targetPrice: '',
        imageUrl: '',
        description: '',
      });
    } catch (error) {
      setRfqMessage(error instanceof Error ? error.message : 'Khong the gui yeu cau bao gia.');
    } finally {
      setIsRfqSubmitting(false);
    }
  };

  const handleTopLevelNavigation = (event: React.MouseEvent<HTMLElement>) => {
    if (!isEmbeddedInIframe) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
    if (!anchor) {
      return;
    }

    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || anchor.target === '_blank') {
      return;
    }

    event.preventDefault();

    const nextUrl = anchor.href || href;
    safeNavigate(nextUrl);
  };

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return cartItems.filter((item) => {
      const passSelectedFilter = !showSelectedOnly || item.selected;
      const passSearch =
        normalizedSearch.length === 0 || item.name.toLowerCase().includes(normalizedSearch);

      return passSelectedFilter && passSearch;
    });
  }, [cartItems, searchTerm, showSelectedOnly]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof filteredItems> = {};
    filteredItems.forEach((item) => {
      const shopName = formatCartSupplierLabel(item);
      if (!groups[shopName]) {
        groups[shopName] = [];
      }
      groups[shopName].push(item);
    });
    return Object.entries(groups).map(([shopName, items]) => ({
      shopName,
      items,
      subtotal: items.reduce((sum, item) => sum + (item.selected ? item.quantity * item.unitPrice : 0), 0)
    }));
  }, [filteredItems]);

  const toggleShopItems = (shopName: string, selected: boolean) => {
    const shopGroup = groupedItems.find((g) => g.shopName === shopName);
    if (!shopGroup) return;
    shopGroup.items.forEach((item) => {
      setCartItemSelected(item.id, selected);
    });
  };

  const selectedItems = cartItems.filter((item) => item.selected);
  const selectedCount = selectedItems.length;
  const selectedQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const selectedTotal = selectedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return (
  <div className="min-h-screen bg-[#f6f8f7] pb-36 text-gray-800" onClickCapture={handleTopLevelNavigation}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-3 text-sm text-gray-400">
          <a href="/react/index.html" className="hover:text-green-600 transition-colors">Trang chủ</a>
          <span className="mx-2">&gt;</span>
          <span>Giỏ hàng</span>
        </nav>

        <h1 className="mb-6 text-4xl font-bold text-gray-900">Giỏ hàng</h1>

        <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-700">Thêm nhanh sản phẩm mới vào giỏ hàng</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGoHome}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-colors"
            >
              <span className="text-lg leading-none">+</span>
              Thêm sản phẩm mới
            </button>
            <button
              type="button"
              onClick={handleGoToWishlist}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              <Heart className="size-4" />
              Thêm sản phẩm từ danh sách yêu thích
            </button>
          </div>
        </section>

        <section className="mb-5 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
                <FileText className="size-5 text-emerald-600" />
                Yeu cau bao gia
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Dang nhu cau mua hang de nhieu nha ban hang gui bao gia, hinh anh va chat luong de ban so sanh.
              </p>
            </div>
            <button
              type="button"
              onClick={prefillRfqFromSelectedItems}
              disabled={selectedCount === 0}
              className="rounded-xl border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Lay tu san pham da chon
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <input
              value={rfqForm.productName}
              onChange={(event) => setRfqForm((prev) => ({ ...prev, productName: event.target.value }))}
              placeholder="Ten san pham can mua"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 md:col-span-2"
            />
            <input
              value={rfqForm.category}
              onChange={(event) => setRfqForm((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="Danh muc"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <input
              value={rfqForm.deliveryRegion}
              onChange={(event) => setRfqForm((prev) => ({ ...prev, deliveryRegion: event.target.value }))}
              placeholder="Khu vuc giao hang"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <input
              type="number"
              min="0"
              value={rfqForm.quantity}
              onChange={(event) => setRfqForm((prev) => ({ ...prev, quantity: event.target.value }))}
              placeholder="So luong"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <input
              value={rfqForm.unit}
              onChange={(event) => setRfqForm((prev) => ({ ...prev, unit: event.target.value }))}
              placeholder="Don vi"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <input
              type="date"
              value={rfqForm.neededBy}
              onChange={(event) => setRfqForm((prev) => ({ ...prev, neededBy: event.target.value }))}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <input
              type="number"
              min="0"
              value={rfqForm.targetPrice}
              onChange={(event) => setRfqForm((prev) => ({ ...prev, targetPrice: event.target.value }))}
              placeholder="Gia ky vong / don vi"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <input
              type="url"
              value={rfqForm.imageUrl}
              onChange={(event) => setRfqForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
              placeholder="Anh tham khao (URL)"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 md:col-span-2"
            />
            <textarea
              rows={3}
              value={rfqForm.description}
              onChange={(event) => setRfqForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Mo ta yeu cau: quy cach, chat luong, dong goi, dieu kien giao nhan..."
              className="resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 md:col-span-2"
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className={`text-sm font-semibold ${rfqMessage.includes('Da gui') ? 'text-emerald-700' : 'text-rose-600'}`}>
              {rfqMessage}
            </p>
            <button
              type="button"
              onClick={submitRfqRequest}
              disabled={isRfqSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:bg-emerald-300"
            >
              <Send className="size-4" />
              {isRfqSubmitting ? 'Dang gui...' : 'Gui yeu cau bao gia'}
            </button>
          </div>
        </section>

        <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <label className="inline-flex items-center gap-3 text-sm font-medium text-gray-700">
              <button
                type="button"
                role="switch"
                aria-checked={showSelectedOnly}
                onClick={() => setShowSelectedOnly((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showSelectedOnly ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    showSelectedOnly ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              Chỉ hiển thị sản phẩm đã chọn
            </label>

            <div className="relative w-full md:w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm kiếm sản phẩm trong giỏ hàng"
                className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-700 outline-none transition-colors focus:border-green-500"
              />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          {groupedItems.map((group) => {
            const isAllGroupSelected = group.items.every((item) => item.selected);
            const isSomeGroupSelected = group.items.some((item) => item.selected);

            return (
              <div key={group.shopName} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                {/* Shop Header */}
                <div className="bg-gradient-to-r from-gray-50/80 to-white px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isAllGroupSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = isSomeGroupSelected && !isAllGroupSelected;
                        }
                      }}
                      onChange={(event) => toggleShopItems(group.shopName, event.target.checked)}
                      className="size-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                    />
                    <div className="flex items-center gap-2 font-bold text-gray-850">
                      <Store className="size-4 text-green-650" />
                      <span>{group.shopName}</span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                    {group.items.length} sản phẩm
                  </span>
                </div>

                {/* Shop Items List */}
                <div className="divide-y divide-gray-100">
                  {group.items.map((item) => {
                    const lineTotal = item.quantity * item.unitPrice;

                    // Check if the product has wholesale tiers in local catalog
                    const customLocalRaw = typeof window !== 'undefined' ? window.localStorage.getItem('freso_custom_products') : null;
                    let customLocalProducts: any[] = [];
                    if (customLocalRaw) {
                      try {
                        customLocalProducts = JSON.parse(customLocalRaw);
                      } catch (e) {
                        customLocalProducts = [];
                      }
                    }
                    const sku = (item.sku ?? '').trim().toLowerCase();
                    const matchingProduct = customLocalProducts.find(p => (p.sku ?? '').trim().toLowerCase() === sku);
                    const specialPrice = matchingProduct ? parsePrice(matchingProduct.special_price ?? matchingProduct.specialPrice) : 0;
                    const normalPrice = matchingProduct ? parsePrice(matchingProduct.price ?? matchingProduct.priceValue) : 0;
                    const originalPrice = (specialPrice && specialPrice > 0) ? specialPrice : (normalPrice && normalPrice > 0 ? normalPrice : item.unitPrice);
                    const tiers = matchingProduct?.wholesale_tiers || [];
                    const activeTier = tiers
                      .filter((t: any) => item.quantity >= t.qty)
                      .sort((a: any, b: any) => b.qty - a.qty)[0];
                    const discountPercent = activeTier ? activeTier.discount : 0;
                    const hasDiscount = discountPercent > 0;

                    return (
                      <article key={item.id} className="p-5 hover:bg-gray-50/20 transition-colors">
                        <div className="grid gap-4 lg:grid-cols-[auto_1fr_auto_auto_auto] lg:items-center">
                          <div className="pt-1">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(event) => setCartItemSelected(item.id, event.target.checked)}
                              className="size-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                            />
                          </div>

                          <div className="flex items-start gap-4">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="size-20 rounded-xl object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">{item.name}</h3>
                              <p className="mt-1 text-sm text-gray-400">Danh mục: {item.category}</p>
                              <p className="mt-1 text-sm text-gray-400">Đơn vị tính: {item.unit}</p>
                              <div className="mt-2 text-sm font-medium text-gray-700">
                                Đơn giá:{' '}
                                {hasDiscount ? (
                                  <div className="inline-flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <span className="line-through text-gray-400">
                                      {toCurrencyTextFromNumber(originalPrice)}
                                    </span>
                                    <span className="px-1.5 py-0.2 bg-red-100 text-red-600 rounded text-[10px] font-bold">
                                      -{discountPercent}% sỉ
                                    </span>
                                    <span className="text-green-700 font-bold">
                                      {toCurrencyTextFromNumber(item.unitPrice)}
                                    </span>
                                  </div>
                                ) : (
                                  <span>{toCurrencyTextFromNumber(item.unitPrice)}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="inline-flex items-center rounded-xl border border-gray-300 bg-white">
                            <button
                              type="button"
                              onClick={() =>
                                setCartItemQuantity(item.id, item.quantity - 1)
                              }
                              className="px-3 py-2 text-gray-500 hover:text-green-700"
                            >
                              <Minus className="size-4" />
                            </button>
                            <span className="min-w-14 border-x border-gray-200 px-2 text-center text-sm font-semibold text-gray-800">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setCartItemQuantity(item.id, item.quantity + 1)
                              }
                              className="px-3 py-2 text-gray-500 hover:text-green-700"
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>

                          <div className="text-left lg:text-right">
                            <p className="text-xs uppercase tracking-wide text-gray-400">Thành tiền</p>
                            <p className="text-lg font-bold text-gray-900">{toCurrencyTextFromNumber(lineTotal)}</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeCartItem(item.id)}
                            className="justify-self-start rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-500 hover:bg-rose-100"
                          >
                            Xóa
                          </button>
                        </div>

                        <div className="mt-4 lg:ml-8">
                          <input
                            value={item.note}
                            onChange={(event) => setCartItemNote(item.id, event.target.value)}
                            placeholder="Nhập ghi chú"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-green-500 bg-white"
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Shop Footer / Subtotal */}
                <div className="bg-gray-50/40 px-5 py-3.5 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">
                    Tạm tính của shop ({group.items.filter((i) => i.selected).length} sản phẩm):
                  </span>
                  <span className="text-lg font-bold text-green-700">{toCurrencyTextFromNumber(group.subtotal)}</span>
                </div>
              </div>
            );
          })}

          {groupedItems.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
              <ShoppingBag className="mx-auto mb-3 size-10 text-gray-300" />
              <p className="text-gray-500">Giỏ hàng đang trống. Chưa có dữ liệu sản phẩm được thêm.</p>
            </div>
          )}
        </section>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <label className="inline-flex items-center gap-3 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              className="size-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              checked={cartItems.length > 0 && selectedCount === cartItems.length}
              onChange={(event) => toggleAllCartItems(event.target.checked)}
            />
            Chọn tất cả ({cartItems.length})
          </label>

          <div className="text-right">
            <p className="text-sm text-gray-500">Tổng cộng ({selectedQuantity} {selectedItems[0]?.unit ?? 'SP'})</p>
            <p className="text-2xl font-bold text-gray-900">{toCurrencyTextFromNumber(selectedTotal)}</p>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            className="rounded-xl bg-[#9ceac4] px-8 py-3 text-base font-semibold text-green-900 transition-colors hover:bg-[#81e1b4] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedCount === 0}
          >
            Mua hàng
          </button>
        </div>
      </footer>
    </div>
  );
}
