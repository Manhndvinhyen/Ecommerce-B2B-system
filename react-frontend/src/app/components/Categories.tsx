import { ImageWithFallback } from './figma/ImageWithFallback';

const categories = [
  {
    title: 'Rau củ quả',
    image: 'https://images.unsplash.com/photo-1659027793188-94f711fdb7ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHZlZ2V0YWJsZXMlMjBkZWxpdmVyeXxlbnwxfHx8fDE3NzQ5Njc5MzB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    count: '120+ sản phẩm'
  },
  {
    title: 'Trái cây',
    image: 'https://images.unsplash.com/photo-1621295112702-f6e5ff69b8a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcmdhbmljJTIwZnJ1aXRzJTIwbWFya2V0fGVufDF8fHx8MTc3NDk2NzkzMXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    count: '80+ sản phẩm'
  },
  {
    title: 'Thịt & hải sản',
    image: 'https://images.unsplash.com/photo-1642517245891-74906b8d8873?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMG1lYXQlMjBzZWFmb29kfGVufDF8fHx8MTc3NDk2NzkzMXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    count: '60+ sản phẩm'
  },
  {
    title: 'Sữa & phô mai',
    image: 'https://images.unsplash.com/photo-1771255217872-99fe6c876e45?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYWlyeSUyMG1pbGslMjBjaGVlc2UlMjBwcm9kdWN0c3xlbnwxfHx8fDE3NzQ4NTcxNzl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    count: '45+ sản phẩm'
  },
  {
    title: 'Trứng & gia cầm',
    image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    count: '50+ sản phẩm'
  },
  {
    title: 'Đồ khô',
    image: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    count: '90+ sản phẩm'
  },
  {
    title: 'Gia vị',
    image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
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
