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

function AppContent() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const isWishlistView = view === 'wishlist';
  const category = getCategoryNameFromQuery(params.get('category'));
  const subcategory = getSubcategoryNameFromQuery(category, params.get('subcategory'));
  const isCategoryView = view === 'category';
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
        {isCategoryView ? (
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
