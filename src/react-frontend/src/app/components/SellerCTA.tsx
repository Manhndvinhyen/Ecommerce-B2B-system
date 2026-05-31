import { MapPin, Store, CheckCircle2 } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

export function SellerCTA() {
  return (
    <section className="relative py-20 overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1635386053054-606e1a2a1ff7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920"
          alt="Fresh green farm field"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-green-100/80 via-emerald-100/70 to-teal-100/80"></div>
      </div>

      {/* Decorative Mountains SVG - Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 1440 400" preserveAspectRatio="none">
          {/* Far Mountains */}
          <path
            d="M0 200 L200 150 L400 180 L600 140 L800 170 L1000 130 L1200 160 L1440 120 L1440 400 L0 400 Z"
            fill="rgba(134, 239, 172, 0.15)"
          />
          {/* Mid Mountains */}
          <path
            d="M0 250 L300 200 L600 230 L900 190 L1200 220 L1440 180 L1440 400 L0 400 Z"
            fill="rgba(74, 222, 128, 0.2)"
          />
        </svg>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-12">
          {/* Left Side - Illustration */}
          <div className="flex-1 relative">
            <div className="relative w-full max-w-lg mx-auto">
              {/* Mobile Phone Illustration */}
              <div className="relative z-20 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                <div className="bg-white rounded-[2.5rem] shadow-2xl p-3 border-8 border-gray-900 w-64 mx-auto">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-[1.8rem] p-6 aspect-[9/16]">
                    {/* Phone Screen Content */}
                    <div className="flex flex-col items-center justify-center h-full">
                      <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                        <Store className="size-10 text-white" />
                      </div>
                      <div className="w-full space-y-2">
                        <div className="h-2 bg-green-200 rounded w-3/4 mx-auto"></div>
                        <div className="h-2 bg-green-100 rounded w-1/2 mx-auto"></div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Phone Notch */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-gray-900 rounded-full z-30"></div>
              </div>

              {/* Store Illustration */}
              <div className="absolute -left-12 top-1/2 -translate-y-1/2 z-10 transform -rotate-6 hover:rotate-0 transition-transform duration-500">
                <div className="bg-white rounded-2xl shadow-xl p-4 w-32">
                  <div className="bg-gradient-to-br from-red-400 to-orange-400 h-16 rounded-t-lg relative">
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-lg shadow-md border-2 border-gray-100 flex items-center justify-center">
                      <Store className="size-6 text-green-600" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-1">
                    <div className="h-2 bg-gray-200 rounded"></div>
                    <div className="h-2 bg-gray-100 rounded w-2/3"></div>
                  </div>
                </div>
              </div>

              {/* Location Pins */}
              <MapPin className="absolute -top-8 left-20 size-8 text-red-500 drop-shadow-lg animate-bounce z-30" fill="currentColor" />
              <MapPin
                className="absolute top-12 -right-8 size-10 text-red-500 drop-shadow-lg animate-bounce z-30"
                fill="currentColor"
                style={{ animationDelay: '0.2s' }}
              />
              <MapPin
                className="absolute -bottom-4 left-12 size-7 text-red-500 drop-shadow-lg animate-bounce z-30"
                fill="currentColor"
                style={{ animationDelay: '0.4s' }}
              />
            </div>
          </div>

          {/* Right Side - Content */}
          <div className="flex-1">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-green-100">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Bạn là nhà cung cấp?</h2>
              <p className="text-xl text-gray-700 mb-6">
                Mở rộng kinh doanh cùng <span className="text-green-600 font-bold">FRESO</span> ngay!
              </p>

              {/* Benefits List */}
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Kết nối thành viên mạng</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Dịch vụ bán hàng</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Quản lý đơn hàng dễ dàng</span>
                </li>
              </ul>

              {/* CTA Button */}
              <a href="/react/index.html?view=register&seller=1" className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2">
                <Store className="size-5" />
                Đăng ký bán hàng ngay
              </a>

              {/* Small Info Text */}
              <p className="text-center text-sm text-gray-500 mt-4">Miễn phí đăng ký • Hỗ trợ 24/7</p>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 left-0 w-full h-32 z-0">
        <svg className="w-full h-full" viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path d="M0 60 Q360 0 720 60 T1440 60 L1440 120 L0 120 Z" fill="rgba(255, 255, 255, 0.3)" />
        </svg>
      </div>
    </section>
  );
}
