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

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <ProductsPage />
        <Features />
        <FeaturedSuppliers />
        <HotProducts />
        <Categories />
        <HowItWorks />
        <Testimonials />
        <SellerCTA />
      </main>
      <Footer />
      <ChatbotWidget />
    </div>
  );
}
