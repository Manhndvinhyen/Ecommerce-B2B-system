import { useEffect, useMemo, useState } from 'react';
import { Heart, ChevronRight, ShoppingCart } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { toCurrencyTextFromLooseValue, toUnitPriceFromLooseValue, useCart } from '../cart/CartProvider';

const hotProducts = [
  {
    sku: '',
    name: 'Cà chua',
    category: 'Củ quả',
    price: '12,000 - 64,800',
    unit: 'Kg',
    image: 'https://images.unsplash.com/photo-1546470427-e26264be0b0d?w=400&h=400&fit=crop',
    hot: true
  },
  {
    sku: '',
    name: 'Thịt heo',
    category: 'Thịt Heo',
    price: '140,000 - 180,000',
    unit: 'Kg',
    image: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400&h=400&fit=crop',
    hot: true
  },
  {
    sku: '',
    name: 'Tía tô',
    category: 'Rau gia vị',
    price: '25,000 - 83,200',
    unit: 'Kg',
    image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&h=400&fit=crop',
    hot: true
  },
  {
    sku: '',
    name: 'Bắp cải trắng',
    category: 'Rau phổ thông',
    price: '8,000 - 38,670',
    unit: 'Kg',
    image: 'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=400&h=400&fit=crop',
    hot: true
  },
  {
    sku: '',
    name: 'Dưa chuột',
    category: 'Củ quả',
    price: '15,000 - 60,740',
    unit: 'Kg',
    image: 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=400&h=400&fit=crop',
    hot: true
  },
  {
    sku: '',
    name: 'Khoai tây',
    category: 'Củ quả',
    price: '18,000 - 44,000',
    unit: 'Kg',
    image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&h=400&fit=crop',
    hot: true
  },
  {
    sku: '',
    name: 'Cà rốt',
    category: 'Rau củ',
    price: '20,000 - 55,000',
    unit: 'Kg',
    image: 'https://images.unsplash.com/photo-1447175008436-1701707564c7?w=400&h=400&fit=crop',
    hot: true
  },
  {
    sku: '',
    name: 'Xà lách',
    category: 'Rau lá',
    price: '22,000 - 68,000',
    unit: 'Kg',
    image: 'https://images.unsplash.com/photo-1622205313162-be1d5712a43d?w=400&h=400&fit=crop',
    hot: true
  },
  {
    sku: '',
    name: 'Ớt chuông',
    category: 'Rau củ',
    price: '40,000 - 120,000',
    unit: 'Kg',
    image: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400&h=400&fit=crop',
    hot: true
  },
  {
    sku: '',
    name: 'Hành lá',
    category: 'Rau gia vị',
    price: '28,000 - 76,000',
    unit: 'Kg',
    image: 'https://images.unsplash.com/photo-1615477550927-6ec4b0187e9f?w=400&h=400&fit=crop',
    hot: true
  }
];

const categoryAliasMap: Record<string, string[]> = {
  'Rau củ quả': ['Rau gia vị', 'Rau phổ thông', 'Củ quả', 'Rau củ', 'Rau lá'],
  'Rau gia vị': ['Rau gia vị'],
  'Rau phổ thông': ['Rau phổ thông'],
  'Củ quả': ['Củ quả', 'Rau củ'],
  'Thực phẩm tươi sống': ['Thịt Heo'],
  'Thịt heo': ['Thịt Heo']
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function HotProducts() {
  const { openAddToCartModal } = useCart();
  const productsPerPage = 5;
  const [page, setPage] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    const syncCategoryFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setSelectedCategory(params.get('category') ?? '');
    };

    syncCategoryFromUrl();
    window.addEventListener('popstate', syncCategoryFromUrl);
    return () => window.removeEventListener('popstate', syncCategoryFromUrl);
  }, []);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) {
      return hotProducts;
    }

    const aliases = categoryAliasMap[selectedCategory] ?? [selectedCategory];
    const normalizedAliases = aliases.map(normalize);

    return hotProducts.filter((product) => {
      const normalizedProductCategory = normalize(product.category);
      return normalizedAliases.some((alias) => normalizedProductCategory.includes(alias));
    });
  }, [selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage));
  const visibleProducts = useMemo(() => {
    const start = page * productsPerPage;
    return filteredProducts.slice(start, start + productsPerPage);
  }, [filteredProducts, page]);

  useEffect(() => {
    setPage(0);
  }, [selectedCategory]);

  const handleNext = () => {
    setPage((prev) => (prev + 1) % totalPages);
  };


  return (
    <section id="san-pham-hien-thi" className="py-8 bg-white scroll-mt-28">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            Sản phẩm HOT
            <span className="text-yellow-500">⚡</span>
          </h2>
          {selectedCategory && (
            <span className="hidden md:inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              Danh mục: {selectedCategory}
            </span>
          )}
          <button
            onClick={handleNext}
            disabled={filteredProducts.length <= productsPerPage}
            className="bg-white border border-gray-200 rounded-full p-2 text-green-600 hover:text-green-700 hover:bg-gray-50 transition-colors"
            aria-label="Xem thêm sản phẩm HOT"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {selectedCategory && filteredProducts.length === 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Chưa có sản phẩm mẫu thuộc danh mục “{selectedCategory}”. Hãy chọn danh mục khác.
          </div>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {visibleProducts.map((product, index) => {
            const productKey = `${product.name}-${product.category}`;

            return (
              <div
                key={`${product.name}-${index}`}
                className="bg-white rounded-2xl border border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => {
                  const targetUrl = `/react/index.html?view=product&name=${encodeURIComponent(product.name)}`;
                  window.location.href = targetUrl;
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    const targetUrl = `/react/index.html?view=product&name=${encodeURIComponent(product.name)}`;
                    window.location.href = targetUrl;
                  }
                }}
              >
                {/* Product Image */}
                <div className="relative aspect-square overflow-hidden bg-gray-50">
                  <ImageWithFallback
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />

                  {/* Hot Badge */}
                  {product.hot && (
                    <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-lg text-xs font-bold">
                      HOT
                    </div>
                  )}

                  {/* Favorite Button */}
                  <button
                    className="absolute top-2 right-2 bg-white rounded-full p-2 hover:bg-red-50 transition-colors shadow-sm"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <Heart className="size-4 text-gray-400 hover:text-red-500" />
                  </button>
                </div>

                {/* Product Info */}
                <div className="p-3">
                  <p className="text-xs text-gray-500 mb-1">{product.category}</p>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-900 group-hover:text-green-600 transition-colors">
                      {product.name}
                    </h3>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        const sourceImage = event.currentTarget.closest('article')?.querySelector('img');
                        openAddToCartModal({
                          id: productKey,
                          sku: product.sku,
                          name: product.name,
                          category: product.category,
                          priceText: toCurrencyTextFromLooseValue(product.price),
                          unit: product.unit,
                          unitPrice: toUnitPriceFromLooseValue(product.price),
                          image: product.image,
                        }, sourceImage);
                      }}
                      className="rounded-full p-1.5 transition-colors bg-transparent text-gray-400 hover:bg-gray-100 hover:text-green-600"
                      aria-label={`Thêm nhanh ${product.name} vào giỏ hàng`}
                    >
                      <ShoppingCart className="size-4" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-red-500 font-bold">{product.price}</p>
                    <p className="text-xs text-gray-500">({product.unit}) - Chưa bao gồm VAT</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
