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
import { getCategoryNameFromQuery, getSubcategoryNameFromQuery } from './data/categories';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const category = getCategoryNameFromQuery(params.get('category'));
  const subcategory = getSubcategoryNameFromQuery(category, params.get('subcategory'));
  const isCategoryView = view === 'category';

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
