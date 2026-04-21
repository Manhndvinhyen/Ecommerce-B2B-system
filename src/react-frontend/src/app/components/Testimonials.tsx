import { Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Nguyễn Thị Lan',
    role: 'Khách hàng thân thiết',
    content: 'Thực phẩm luôn tươi ngon, giao hàng đúng giờ. Tôi rất hài lòng với chất lượng dịch vụ và sẽ tiếp tục ủng hộ Freso.',
    rating: 5,
    avatar: 'https://i.pravatar.cc/150?img=1'
  },
  {
    name: 'Trần Văn Minh',
    role: 'Chủ nhà hàng',
    content: 'Nguồn cung cấp thực phẩm ổn định cho nhà hàng của tôi. Chất lượng luôn đảm bảo, giá cả hợp lý và phục vụ chuyên nghiệp.',
    rating: 5,
    avatar: 'https://i.pravatar.cc/150?img=12'
  },
  {
    name: 'Lê Thị Hoa',
    role: 'Nội trợ',
    content: 'Tiện lợi và tiết kiệm thời gian cho gia đình tôi. Rau củ quả tươi như ở chợ, không cần phải ra ngoài mua sắm nữa.',
    rating: 5,
    avatar: 'https://i.pravatar.cc/150?img=5'
  }
];

export function Testimonials() {
  return (
    <section id="ve-chung-toi" className="py-16 bg-gradient-to-br from-green-50 to-emerald-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Khách hàng nói gì về chúng tôi
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Hàng ngàn khách hàng hài lòng đã tin tưởng và lựa chọn Freso
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="size-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed">
                "{testimonial.content}"
              </p>
              <div className="flex items-center gap-3">
                <img
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  className="size-12 rounded-full object-cover"
                />
                <div>
                  <div className="font-bold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-600">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
