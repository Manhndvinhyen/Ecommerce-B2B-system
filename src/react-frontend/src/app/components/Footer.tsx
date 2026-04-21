import { Facebook, Instagram, Youtube, Mail, Phone, MapPin } from 'lucide-react';

export function Footer() {
  const reactHomePath = '/react/index.html';

  return (
    <footer id="lien-he" className="bg-gray-900 text-gray-300 pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Company Info */}
          <div>
            <div className="text-2xl font-bold text-white mb-4">Freso</div>
            <p className="text-gray-400 mb-4">
              Nền tảng giao hàng thực phẩm tươi sống hàng đầu Việt Nam
            </p>
            <div className="flex gap-3">
              <a href={`${reactHomePath}#lien-he`} className="bg-gray-800 p-2 rounded-full hover:bg-green-600 transition-colors">
                <Facebook className="size-5" />
              </a>
              <a href={`${reactHomePath}#lien-he`} className="bg-gray-800 p-2 rounded-full hover:bg-green-600 transition-colors">
                <Instagram className="size-5" />
              </a>
              <a href={`${reactHomePath}#lien-he`} className="bg-gray-800 p-2 rounded-full hover:bg-green-600 transition-colors">
                <Youtube className="size-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold mb-4">Liên kết nhanh</h3>
            <ul className="space-y-2">
              <li>
                <a href={`${reactHomePath}#ve-chung-toi`} className="hover:text-green-500 transition-colors">
                  Về chúng tôi
                </a>
              </li>
              <li>
                <a href={`${reactHomePath}#san-pham-hien-thi`} className="hover:text-green-500 transition-colors">
                  Sản phẩm
                </a>
              </li>
              <li>
                <a href={`${reactHomePath}#lien-he`} className="hover:text-green-500 transition-colors">
                  Liên hệ
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-bold mb-4">Hỗ trợ</h3>
            <ul className="space-y-2">
              <li>
                <a href={`${reactHomePath}#lien-he`} className="hover:text-green-500 transition-colors">
                  Câu hỏi thường gặp
                </a>
              </li>
              <li>
                <a href="/privacy-policy-cookie-restriction-mode" className="hover:text-green-500 transition-colors">
                  Chính sách giao hàng
                </a>
              </li>
              <li>
                <a href="/privacy-policy-cookie-restriction-mode" className="hover:text-green-500 transition-colors">
                  Chính sách đổi trả
                </a>
              </li>
              <li>
                <a href="/privacy-policy-cookie-restriction-mode" className="hover:text-green-500 transition-colors">
                  Điều khoản sử dụng
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-bold mb-4">Liên hệ</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <MapPin className="size-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm">123 Đường ABC, Quận 1, TP. Hồ Chí Minh</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-5 text-green-500 flex-shrink-0" />
                <span className="text-sm">1900 1234</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-5 text-green-500 flex-shrink-0" />
                <span className="text-sm">support@freso.vn</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">
              © 2026 Freso. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <a href="/privacy-policy-cookie-restriction-mode" className="hover:text-green-500 transition-colors">
                Chính sách bảo mật
              </a>
              <a href="/privacy-policy-cookie-restriction-mode" className="hover:text-green-500 transition-colors">
                Điều khoản dịch vụ
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
