import { useMemo, useState } from 'react';
import { ChevronRight, ShoppingCart, Heart } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { categoryMenu, getCategoryPageLink } from '../data/categories';

type ProductItem = {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: string;
  unit: string;
  image: string;
};

const categoryProducts: ProductItem[] = [
  { id: 'rcq-1', name: 'Rau mùi', category: 'Rau củ quả', subcategory: 'Rau gia vị', price: '18,000', unit: 'Kg', image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=500&h=500&fit=crop' },
  { id: 'rcq-2', name: 'Cải ngọt', category: 'Rau củ quả', subcategory: 'Rau phổ thông', price: '22,000', unit: 'Kg', image: 'https://images.unsplash.com/photo-1615485500834-bc10199bc727?w=500&h=500&fit=crop' },
  { id: 'rcq-3', name: 'Khoai tây', category: 'Rau củ quả', subcategory: 'Củ quả', price: '26,000', unit: 'Kg', image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&h=500&fit=crop' },
  { id: 'rcq-4', name: 'Nấm bào ngư', category: 'Rau củ quả', subcategory: 'Nấm', price: '62,000', unit: 'Kg', image: 'https://images.unsplash.com/photo-1504545102780-26774c1bb073?w=500&h=500&fit=crop' },
  { id: 'rcq-5', name: 'Rau luộc mix', category: 'Rau củ quả', subcategory: 'Rau củ chế biến sẵn', price: '45,000', unit: 'Phần', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&h=500&fit=crop' },
  { id: 'tc-1', name: 'Táo đỏ', category: 'Trái cây', subcategory: 'Trái cây nhập khẩu', price: '79,000', unit: 'Kg', image: 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=500&h=500&fit=crop' },
  { id: 'tc-2', name: 'Chuối già', category: 'Trái cây', subcategory: 'Trái cây phổ thông', price: '28,000', unit: 'Nải', image: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=500&h=500&fit=crop' },
  { id: 'tc-3', name: 'Cam sành', category: 'Trái cây', subcategory: 'Trái cây phổ thông', price: '35,000', unit: 'Kg', image: 'https://images.unsplash.com/photo-1580052614034-c55d20bfee3b?w=500&h=500&fit=crop' },
  { id: 'tpts-1', name: 'Ba chỉ heo', category: 'Thực phẩm tươi sống', subcategory: 'Thịt heo', price: '155,000', unit: 'Kg', image: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=500&h=500&fit=crop' },
  { id: 'tpts-2', name: 'Đùi gà', category: 'Thực phẩm tươi sống', subcategory: 'Thịt gà', price: '98,000', unit: 'Kg', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=500&h=500&fit=crop' },
  { id: 'tpts-3', name: 'Trứng gà ta', category: 'Thực phẩm tươi sống', subcategory: 'Trứng', price: '42,000', unit: 'Vỉ', image: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?w=500&h=500&fit=crop' },
  { id: 'ths-1', name: 'Cá hồi phi lê', category: 'Thuỷ hải sản', subcategory: 'Cá', price: '289,000', unit: 'Kg', image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&h=500&fit=crop' },
  { id: 'ths-2', name: 'Tôm sú', category: 'Thuỷ hải sản', subcategory: 'Tôm', price: '215,000', unit: 'Kg', image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500&h=500&fit=crop' },
  { id: 'ths-3', name: 'Mực ống', category: 'Thuỷ hải sản', subcategory: 'Mực', price: '180,000', unit: 'Kg', image: 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=500&h=500&fit=crop' },
  { id: 'tpdl-1', name: 'Cá viên đông lạnh', category: 'Thực phẩm đông lạnh', subcategory: 'Giò-chả-nem', price: '68,000', unit: 'Gói', image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&h=500&fit=crop' },
  { id: 'tpdl-2', name: 'Xúc xích hun khói', category: 'Thực phẩm đông lạnh', subcategory: 'Xúc xích - lạp xưởng', price: '89,000', unit: 'Gói', image: 'https://images.unsplash.com/photo-1529692236671-f1de46e14919?w=500&h=500&fit=crop' },
  { id: 'tpdl-3', name: 'Thịt bò cắt lát', category: 'Thực phẩm đông lạnh', subcategory: 'Thịt bò-bê', price: '210,000', unit: 'Kg', image: 'https://images.unsplash.com/photo-1603048719539-9ecb4d65f6b1?w=500&h=500&fit=crop' },
  { id: 'tpk-1', name: 'Gạo ST25', category: 'Thực phẩm khô', subcategory: 'Gạo', price: '198,000', unit: 'Bao 5kg', image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&h=500&fit=crop' },
  { id: 'tpk-2', name: 'Bún gạo khô', category: 'Thực phẩm khô', subcategory: 'Bún-miến-phở-nui', price: '34,000', unit: 'Gói', image: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=500&h=500&fit=crop' },
  { id: 'tpk-3', name: 'Hạt điều rang', category: 'Thực phẩm khô', subcategory: 'Hạt khô', price: '125,000', unit: 'Hũ', image: 'https://images.unsplash.com/photo-1601593768799-76fdbf855de5?w=500&h=500&fit=crop' },
  { id: 'tib-1', name: 'Bộ nồi inox', category: 'Tiện ích bếp', subcategory: 'Đồ dùng bếp', price: '990,000', unit: 'Bộ', image: 'https://images.unsplash.com/photo-1584990347449-a1e229ee8b29?w=500&h=500&fit=crop' },
  { id: 'tib-2', name: 'Nước rửa chén', category: 'Tiện ích bếp', subcategory: 'Chất tẩy rửa', price: '38,000', unit: 'Chai', image: 'https://images.unsplash.com/photo-1583947582886-f40ec95dd752?w=500&h=500&fit=crop' },
  { id: 'tib-3', name: 'Bàn chải cọ nồi', category: 'Tiện ích bếp', subcategory: 'Dụng cụ vệ sinh', price: '22,000', unit: 'Cái', image: 'https://images.unsplash.com/photo-1556911220-bda9f7f7597e?w=500&h=500&fit=crop' }
];

type ProductCategoryPageProps = {
  categoryName: string;
  initialSubcategory?: string;
};

export function ProductCategoryPage({ categoryName, initialSubcategory }: ProductCategoryPageProps) {
  const category = useMemo(() => {
    return categoryMenu.find((item) => item.name === categoryName) ?? categoryMenu[0];
  }, [categoryName]);

  const [activeSubcategory, setActiveSubcategory] = useState(initialSubcategory ?? 'Tất cả');
  const [visibleCount, setVisibleCount] = useState(10);

  const filteredProducts = useMemo(() => {
    const list = categoryProducts.filter((product) => product.category === category.name);
    if (activeSubcategory === 'Tất cả') {
      return list;
    }
    return list.filter((product) => product.subcategory === activeSubcategory);
  }, [activeSubcategory, category.name]);

  const productsToShow = filteredProducts.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredProducts.length;

  return (
    <section className="bg-gray-50 min-h-[70vh] py-8">
      <div className="container mx-auto px-4">
        <nav className="mb-4 text-sm text-gray-500 flex items-center gap-2">
          <a href="./index.html" className="hover:text-green-600">Trang chủ</a>
          <ChevronRight className="size-4" />
          <span className="text-gray-700 font-medium">{category.name}</span>
        </nav>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Các loại {category.name}</h1>

          <div className="flex flex-wrap gap-2">
            {['Tất cả', ...category.subcategories].map((subcategory) => {
              const isActive = subcategory === activeSubcategory;
              return (
                <button
                  key={subcategory}
                  type="button"
                  onClick={() => {
                    setActiveSubcategory(subcategory);
                    setVisibleCount(10);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-50 hover:text-green-700'
                  }`}
                >
                  {subcategory}
                </button>
              );
            })}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
            Chưa có sản phẩm cho danh mục con này.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {productsToShow.map((product) => (
                <article
                  key={product.id}
                  className="bg-white rounded-2xl border border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer"
                >
                  <div className="relative aspect-square overflow-hidden bg-gray-50">
                    <ImageWithFallback
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <button
                      type="button"
                      className="absolute top-2 right-2 bg-white rounded-full p-2 hover:bg-red-50 transition-colors shadow-sm"
                      aria-label={`Yêu thích ${product.name}`}
                    >
                      <Heart className="size-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-500 mb-1">{product.subcategory}</p>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-900 group-hover:text-green-600 transition-colors line-clamp-2">
                        {product.name}
                      </h3>
                      <button
                        type="button"
                        className="rounded-full p-1.5 transition-colors bg-transparent text-gray-400 hover:bg-gray-100 hover:text-green-600"
                        aria-label={`Thêm ${product.name} vào giỏ`}
                      >
                        <ShoppingCart className="size-4" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-red-500 font-bold">{product.price}</p>
                      <p className="text-xs text-gray-500">({product.unit}) - Chưa bao gồm VAT</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {canLoadMore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + 10)}
                  className="px-6 py-2.5 rounded-full border border-green-600 text-green-700 font-medium hover:bg-green-50"
                >
                  Xem thêm sản phẩm
                </button>
              </div>
            )}
          </>
        )}

        <div className="mt-8 flex flex-wrap gap-2">
          {categoryMenu.map((group) => (
            <a
              key={group.name}
              href={getCategoryPageLink(group.name)}
              className="text-sm px-3 py-1.5 rounded-full bg-white border border-gray-200 hover:border-green-500 hover:text-green-700"
            >
              {group.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
