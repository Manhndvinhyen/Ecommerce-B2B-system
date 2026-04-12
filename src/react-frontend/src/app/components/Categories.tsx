import { ImageWithFallback } from './figma/ImageWithFallback';

const categories = [
  {
    title: 'Rau củ quả',
    image: 'https://images.unsplash.com/photo-1579113800032-c38bd7635818?q=80&w=1080&auto=format&fit=crop&ixlib=rb-4.1.0&v=2',
    count: '120+ sản phẩm'
  },
  {
    title: 'Trái cây',
    image: 'https://images.unsplash.com/photo-1609780447631-05b93e5a88ea?q=80&w=1080&auto=format&fit=crop&ixlib=rb-4.1.0&v=2',
    count: '80+ sản phẩm'
  },
  {
    title: 'Thực phẩm tươi sống',
    image: 'https://images.unsplash.com/photo-1625643269470-5d3e7b69fa34?q=80&w=1080&auto=format&fit=crop&ixlib=rb-4.1.0&v=2',
    count: '60+ sản phẩm'
  },
  {
    title: 'Thuỷ hải sản',
    image: 'https://images.unsplash.com/photo-1651323018466-b36b7df1d2b1?q=80&w=1080&auto=format&fit=crop&ixlib=rb-4.1.0&v=2',
    count: '45+ sản phẩm'
  },
  {
    title: 'Thực phẩm đông lạnh',
    image: 'https://images.unsplash.com/photo-1645235247777-b0eac398d346?q=80&w=1080&auto=format&fit=crop&ixlib=rb-4.1.0&v=2',
    count: '50+ sản phẩm'
  },
  {
    title: 'Thực phẩm khô',
    image: 'https://images.unsplash.com/photo-1705475388190-775066fd69a5?q=80&w=1080&auto=format&fit=crop&ixlib=rb-4.1.0&v=2',
    count: '90+ sản phẩm'
  },
  {
    title: 'Tiện ích bếp',
    image: 'https://images.unsplash.com/photo-1736874548545-628e19dc9fab?q=80&w=1080&auto=format&fit=crop&ixlib=rb-4.1.0&v=2',
    count: '70+ sản phẩm'
  }
];

export function Categories() {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Danh mục sản phẩm
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Khám phá đa dạng các loại thực phẩm tươi sống được chọn lọc kỹ càng
          </p>
        </div>

        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.slice(0, 3).map((category, index) => (
              <div
                key={`${category.title}-${index}`}
                className="group relative overflow-hidden rounded-2xl cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300"
              >
                <div className="aspect-[4/5] relative">
                  <ImageWithFallback
                    src={category.image}
                    alt={category.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="text-xl font-bold mb-1">{category.title}</h3>
                  <p className="text-sm text-gray-200">{category.count}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.slice(3, 7).map((category, index) => (
              <div
                key={`${category.title}-${index}`}
                className="group relative overflow-hidden rounded-2xl cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300"
              >
                <div className="aspect-[4/5] relative">
                  <ImageWithFallback
                    src={category.image}
                    alt={category.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="text-xl font-bold mb-1">{category.title}</h3>
                  <p className="text-sm text-gray-200">{category.count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
