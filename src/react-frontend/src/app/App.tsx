import { useEffect } from 'react';
import { Header } from './components/Header';
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
import { WishlistPage } from './components/WishlistPage';
import { CheckoutPage } from './components/CheckoutPage';
import { getCategoryNameFromQuery, getSubcategoryNameFromQuery } from './data/categories';
import { CartProvider } from './cart/CartProvider';
import { applySeo, buildCanonicalPath, getSiteName } from './utils/seo';

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

  useEffect(() => {
    console.info('[FresoSearch][App] route detected', {
      view,
      q: params.get('q'),
      category: params.get('category'),
      subcategory: params.get('subcategory'),
      pathname: window.location.pathname,
      search: window.location.search
    });
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

    if (isCartView || isLoginView || isRegisterView || isForgotPasswordView || isWishlistView || isCheckoutView || isDashboardView) {
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
    isDashboardView
  ]);

  if (isDashboardView) {
    return <UserDashboardPage />;
  }

  if (isRegisterView) {
    return <RegisterPage />;
  }

  if (isCartView) {
    return <ShoppingCartPage />;
  }

  if (isLoginView) {
    return <LoginPage />;
  }

  if (isForgotPasswordView) {
    return <ForgotPasswordPage />;
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

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        {isCategoryView || isSearchView ? (
          <ProductCategoryPage categoryName={category} initialSubcategory={subcategory} />
        ) : (
          <>
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
