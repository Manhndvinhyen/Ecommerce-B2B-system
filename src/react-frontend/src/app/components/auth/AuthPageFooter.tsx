import { Facebook, Instagram, Mail, MapPin, Phone, Youtube } from 'lucide-react';

export function AuthPageFooter() {
  return (
    <footer className="w-full bg-white border-t border-gray-100 px-6 py-12 lg:px-12 xl:px-24">
      <div className="max-w-[1440px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
        <div className="space-y-6">
          <div className="flex items-center">
            <span className="text-2xl font-extrabold text-[#00b14f]">Organica</span>
          </div>
          <p className="text-[14px] text-gray-500 leading-relaxed font-medium">Nền tảng giao hàng thực phẩm tươi sống hàng đầu Việt Nam</p>
          <div className="flex items-center gap-4">
            {[Facebook, Instagram, Youtube].map((Icon, index) => (
              <a key={index} href="#" className="size-9 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:text-[#00b14f] hover:bg-green-50 transition-all border border-gray-100 shadow-sm">
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h4 className="text-[15px] font-bold text-gray-900 uppercase tracking-wider">Liên kết nhanh</h4>
          <ul className="space-y-3">
            {['Về chúng tôi', 'Sản phẩm', 'Liên hệ'].map((item) => (
              <li key={item}>
                <a href="#" className="text-[14px] text-gray-500 hover:text-[#00b14f] font-medium transition-colors">
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <h4 className="text-[15px] font-bold text-gray-900 uppercase tracking-wider">Hỗ trợ</h4>
          <ul className="space-y-3">
            {['Câu hỏi thường gặp', 'Chính sách giao hàng', 'Chính sách đổi trả', 'Điều khoản sử dụng'].map((item) => (
              <li key={item}>
                <a href="#" className="text-[14px] text-gray-500 hover:text-[#00b14f] font-medium transition-colors">
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <h4 className="text-[15px] font-bold text-gray-900 uppercase tracking-wider">Liên hệ</h4>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <div className="p-1.5 bg-green-50 rounded-lg text-[#00b14f] shrink-0">
                <MapPin size={16} />
              </div>
              <span className="text-[14px] text-gray-500 leading-tight font-medium">123 Đường ABC, Quận 1, TP. Hồ Chí Minh</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="p-1.5 bg-green-50 rounded-lg text-[#00b14f] shrink-0">
                <Phone size={16} />
              </div>
              <span className="text-[14px] text-gray-500 font-bold">1900 1234</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="p-1.5 bg-green-50 rounded-lg text-[#00b14f] shrink-0">
                <Mail size={16} />
              </div>
              <span className="text-[14px] text-gray-500 font-medium">support@organica.vn</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto mt-12 pt-8 border-t border-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-[13px] text-gray-400 font-medium">© 2026 Organica. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <a href="#" className="text-[13px] text-gray-400 hover:text-[#00b14f] font-medium transition-colors">
            Chính sách bảo mật
          </a>
          <a href="#" className="text-[13px] text-gray-400 hover:text-[#00b14f] font-medium transition-colors">
            Điều khoản dịch vụ
          </a>
        </div>
      </div>
    </footer>
  );
}