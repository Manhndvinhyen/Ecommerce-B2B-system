import { useEffect } from 'react';
import { Header } from './components/Header';
import { WeatherWidget } from './components/WeatherWidget';
import { ProductsPage } from './components/ProductsPage';
import { FeaturedSuppliers } from './components/FeaturedSuppliers';
import { Features } from './components/Features';
import { HotProducts } from './components/HotProducts';
import { Categories } from './components/Categories';
import { HowItWorks } from './components/HowItWorks';
import { Testimonials } from './components/Testimonials';
import { SellerCTA } from './components/SellerCTA';
import { Footer } from './components/Footer';
import { ChatbotWidget } from './components/ChatbotWidget';
import { ProductCategoryPage } from './components/ProductCategoryPage';
import { RegisterPage } from './components/RegisterPage';
import { ShoppingCartPage } from './components/ShoppingCartPage';
import { LoginPage } from './components/LoginPage';
import { ForgotPasswordPage } from './components/ForgotPasswordPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { UserDashboardPage } from './components/UserDashboardPage';
import { SellerDashboardPage } from './components/SellerDashboardPage';
import { WishlistPage } from './components/WishlistPage';
import { CheckoutPage } from './components/CheckoutPage';
import { NewsPage } from './components/NewsPage';
import { ThankYouPage } from './components/ThankYouPage';
import { OrderTrackingPage } from './components/OrderTrackingPage';
import { SupplierDetailPage } from './components/SupplierDetailPage';
import { getCategoryNameFromQuery, getSubcategoryNameFromQuery } from './data/categories';
import { CartProvider } from './cart/CartProvider';
import { applySeo, buildCanonicalPath, getSiteName } from './utils/seo';
import { initializeAuthSession, touchAuthSession } from './utils/authSession';

function AppContent() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const category = getCategoryNameFromQuery(params.get('category'));
  const subcategory = getSubcategoryNameFromQuery(category, params.get('subcategory'));
  const isCategoryView = view === 'category';
  const isSearchView = view === 'search';
  const isRegisterView = view === 'register';
  const isCartView = view === 'cart';
  const isLoginView = view === 'login';
  const isForgotPasswordView = view === 'forgot-password';
  const isProductView = view === 'product';
  const isWishlistView = view === 'wishlist';
  const isCheckoutView =
    view === 'checkout' ||
    window.location.pathname.endsWith('/react/checkout') ||
    window.location.pathname.endsWith('/checkout');
  const isDashboardView = view === 'dashboard';
  const isSellerDashboardView = view === 'seller-dashboard';
  const isNewsView = view === 'news';
  const isThankYouView = view === 'thank-you';
  const isOrderTrackingView = view === 'order-tracking';
  const isSupplierDetailView = view === 'supplier-detail';
  const supplierId = params.get('supplierId') || '';
  const supplierName = params.get('supplierName') || '';

  useEffect(() => {
    initializeAuthSession();

    const markActive = () => touchAuthSession();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markActive();
      }
    };

    window.addEventListener('focus', markActive);
    window.addEventListener('click', markActive);
    window.addEventListener('keydown', markActive);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', markActive);
      window.removeEventListener('click', markActive);
      window.removeEventListener('keydown', markActive);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isSellerDashboardView) {
      root.classList.add('seller-theme');
      root.classList.remove('customer-theme');
    } else {
      root.classList.add('customer-theme');
      root.classList.remove('seller-theme');
    }
  }, [isSellerDashboardView]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.info('[FresoSearch][App] route detected', {
        view,
        q: params.get('q'),
        category: params.get('category'),
        subcategory: params.get('subcategory'),
        pathname: window.location.pathname,
        search: window.location.search
      });
    }
  }, [view, category, subcategory]);

  useEffect(() => {
    const siteName = getSiteName();
    const canonicalPath = buildCanonicalPath(params);

    if (isCategoryView) {
      applySeo({
        title: `${category} B2B | ${siteName}`,
        description: `Tìm nguồn ${category.toLowerCase()} cho doanh nghiệp, nhà hàng và cửa hàng thực phẩm với dữ liệu sản phẩm cập nhật từ Magento.`,
        canonicalPath
      });
      return;
    }

    if (isSearchView) {
      const query = params.get('q')?.trim() ?? '';
      applySeo({
        title: query ? `Tìm kiếm ${query} | ${siteName}` : `Tìm kiếm sản phẩm | ${siteName}`,
        description: query
          ? `Kết quả tìm kiếm sản phẩm "${query}" trên ${siteName}.`
          : `Tìm kiếm sản phẩm thực phẩm B2B trên ${siteName}.`,
        canonicalPath,
        robots: 'noindex, follow'
      });
      return;
    }

    if (isProductView) {
      applySeo({
        title: `Chi tiết sản phẩm | ${siteName}`,
        description: `Xem thông tin sản phẩm, giá và mô tả chi tiết trên ${siteName}.`,
        canonicalPath
      });
      return;
    }

    if (isNewsView) {
      applySeo({
        title: `Tin tức nông sản B2B | ${siteName}`,
        description: `Cập nhật tin tức thị trường nông sản, nông nghiệp, xuất khẩu, giá cả thị trường hàng hóa và logistics mới nhất từ VnExpress.`,
        canonicalPath
      });
      return;
    }

    if (isSupplierDetailView) {
      applySeo({
        title: `${supplierName} | ${siteName}`,
        description: `Xem các sản phẩm nông sản sạch từ nhà cung cấp ${supplierName} trên ${siteName}.`,
        canonicalPath
      });
      return;
    }

    if (isCartView || isLoginView || isRegisterView || isForgotPasswordView || isWishlistView || isCheckoutView || isDashboardView || isSellerDashboardView || isOrderTrackingView) {
      applySeo({
        title: `${siteName} | Tài khoản và mua hàng`,
        description: `Khu vực tài khoản, giỏ hàng và thanh toán của ${siteName}.`,
        canonicalPath,
        robots: 'noindex, nofollow'
      });
      return;
    }

    applySeo({
      title: `${siteName} - Nền tảng thực phẩm B2B Việt Nam`,
      description: `${siteName} kết nối doanh nghiệp với nguồn thực phẩm tươi sống, rau củ, hải sản, đồ khô và tiện ích bếp tại Việt Nam.`,
      canonicalPath: '/react/'
    });
  }, [
    view,
    category,
    subcategory,
    isCategoryView,
    isSearchView,
    isRegisterView,
    isCartView,
    isLoginView,
    isForgotPasswordView,
    isProductView,
    isWishlistView,
    isCheckoutView,
    isDashboardView,
    isSellerDashboardView,
    isNewsView,
    isOrderTrackingView,
    isSupplierDetailView
  ]);

  if (isDashboardView) {
    return <UserDashboardPage />;
  }

  if (isSellerDashboardView) {
    return <SellerDashboardPage />;
  }

  if (isRegisterView) {
    return (
      <>
        <RegisterPage />
        <ChatbotWidget />
      </>
    );
  }

  if (isCartView) {
    return (
      <>
        <ShoppingCartPage />
        <ChatbotWidget />
      </>
    );
  }

  if (isLoginView) {
    return (
      <>
        <LoginPage />
        <ChatbotWidget />
      </>
    );
  }

  if (isForgotPasswordView) {
    return (
      <>
        <ForgotPasswordPage />
        <ChatbotWidget />
      </>
    );
  }

  if (isProductView) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main>
          <ProductDetailPage />
        </main>
        <Footer />
        <ChatbotWidget />
      </div>
    );
  }
  if (isWishlistView) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main>
          <WishlistPage />
        </main>
        <Footer />
        <ChatbotWidget />
      </div>
    );
  }


  if (isNewsView) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main>
          <NewsPage />
        </main>
        <Footer />
        <ChatbotWidget />
      </div>
    );
  }

  if (isCheckoutView) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main>
          <CheckoutPage />
        </main>
        <Footer />
        <ChatbotWidget />
      </div>
    );
  }

  if (isThankYouView) {
    return <ThankYouPage />;
  }

  if (isOrderTrackingView) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main>
          <OrderTrackingPage />
        </main>
        <Footer />
        <ChatbotWidget />
      </div>
    );
  }

  if (isSupplierDetailView) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main>
          <SupplierDetailPage supplierId={supplierId} supplierName={supplierName} />
        </main>
        <Footer />
        <ChatbotWidget />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        {isCategoryView || isSearchView ? (
          <ProductCategoryPage categoryName={category} initialSubcategory={subcategory} />
        ) : (
          <>
            <WeatherWidget />
            <ProductsPage />
            <Features />
            <FeaturedSuppliers />
            <HotProducts />
            <Categories />
            <HowItWorks />
            <Testimonials />
            <SellerCTA />
          </>
        )}
      </main>
      <Footer />
      <ChatbotWidget />
    </div>
  );
}

export default function App() {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
}
