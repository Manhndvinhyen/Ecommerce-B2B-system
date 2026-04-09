import { Truck, ShieldCheck, Clock, Leaf } from 'lucide-react';

const features = [
  {
    icon: Truck,
    title: 'Giao hàng nhanh',
    description: 'Giao hàng trong 2 giờ tại nội thành',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  {
    icon: ShieldCheck,
    title: 'Đảm bảo chất lượng',
    description: '100% tươi sống, hoàn tiền nếu không hài lòng',
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  {
    icon: Clock,
    title: 'Mở cửa 24/7',
    description: 'Đặt hàng bất cứ lúc nào, bất cứ nơi đâu',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50'
  },
  {
    icon: Leaf,
    title: 'Organic & An toàn',
    description: 'Sản phẩm hữu cơ, không hóa chất độc hại',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50'
  }
];

export function Features() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-2xl p-6 hover:shadow-lg transition-shadow duration-300"
              >
                <div className={`${feature.bgColor} ${feature.color} size-14 rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className="size-7" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
