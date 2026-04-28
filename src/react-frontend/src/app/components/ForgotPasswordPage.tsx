import { useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldAlert,
  Store,
} from 'lucide-react';
import { AuthPageFooter } from './auth/AuthPageFooter';
import { AuthPageHeader } from './auth/AuthPageHeader';

type ForgotPasswordFormData = {
  restaurantCode: string;
  email: string;
  otpCode: string;
  newPassword: string;
  confirmPassword: string;
};

const defaultFormData: ForgotPasswordFormData = {
  restaurantCode: '',
  email: '',
  otpCode: '',
  newPassword: '',
  confirmPassword: '',
};

const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function ForgotPasswordPage() {
  const [formData, setFormData] = useState<ForgotPasswordFormData>(defaultFormData);
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const navigateHome = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete('view');
    params.delete('category');
    params.delete('subcategory');

    const query = params.toString();
    const target = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.location.href = target;
  };

  const buildLoginHref = () => {
    const params = new URLSearchParams(window.location.search);
    params.set('view', 'login');
    params.delete('category');
    params.delete('subcategory');
    return `${window.location.pathname}?${params.toString()}`;
  };

  const handleInputChange = <K extends keyof ForgotPasswordFormData>(field: K, value: ForgotPasswordFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (submitError) {
      setSubmitError('');
    }
    if (submitSuccess) {
      setSubmitSuccess('');
    }
  };

  const validate = (): boolean => {
    if (!formData.restaurantCode.trim()) {
      setSubmitError('Vui lòng nhập Mã nhà hàng.');
      return false;
    }

    const normalizedEmail = formData.email.trim();
    if (!normalizedEmail) {
      setSubmitError('Vui lòng nhập Email.');
      return false;
    }

    if (!isValidEmail(normalizedEmail)) {
      setSubmitError('Email chưa đúng định dạng.');
      return false;
    }

    if (step === 'verify') {
      if (!formData.otpCode.trim()) {
        setSubmitError('Vui lòng nhập mã OTP.');
        return false;
      }

      if (!formData.newPassword.trim()) {
        setSubmitError('Vui lòng nhập mật khẩu mới.');
        return false;
      }

      if (formData.newPassword.trim().length < 8) {
        setSubmitError('Mật khẩu mới phải có ít nhất 8 ký tự.');
        return false;
      }

      if (formData.newPassword !== formData.confirmPassword) {
        setSubmitError('Mật khẩu xác nhận không khớp.');
        return false;
      }
    }

    return true;
  };

  const parseResponseMessage = async (response: Response, fallback: string): Promise<string> => {
    const bodyText = await response.text().catch(() => '');

    if (!bodyText.trim()) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(bodyText) as { message?: string };
      return parsed?.message?.trim() || fallback;
    } catch {
      return bodyText.trim() || fallback;
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');

    const endpoint =
      step === 'request'
        ? `${window.location.origin}/rest/V1/tmdt-registration/forgot-password/request-otp`
        : `${window.location.origin}/rest/V1/tmdt-registration/forgot-password/reset`;

    const payload =
      step === 'request'
        ? {
            restaurantCode: formData.restaurantCode.trim(),
            email: formData.email.trim(),
          }
        : {
            restaurantCode: formData.restaurantCode.trim(),
            email: formData.email.trim(),
            otpCode: formData.otpCode.trim(),
            newPassword: formData.newPassword,
            confirmPassword: formData.confirmPassword,
          };

    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payload }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const message = await parseResponseMessage(response, 'Không thể xử lý yêu cầu khôi phục mật khẩu.');
          throw new Error(message);
        }

        if (step === 'request') {
          setSubmitSuccess('Mã OTP đã được gửi về email của bạn. Vui lòng nhập OTP để đặt lại mật khẩu.');
          setStep('verify');
          setFormData((prev) => ({ ...prev, otpCode: '', newPassword: '', confirmPassword: '' }));
          return;
        }

        setSubmitSuccess('Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.');
        setFormData(defaultFormData);
        setStep('request');
      })
      .catch((error: unknown) => {
        setSubmitError(error instanceof Error ? error.message : 'Đã có lỗi xảy ra. Vui lòng thử lại sau.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-[#333]">
      <AuthPageHeader />

      <div className="flex flex-1 flex-col lg:flex-row overflow-visible">
        <aside className="relative lg:w-[42%] bg-gradient-to-br from-[#f0f9f4] via-[#e8f6ed] to-[#d4efdf] p-8 lg:p-16 flex flex-col justify-start overflow-hidden border-r border-gray-50 min-h-[400px] lg:min-h-0">
          <div className="absolute top-[-5%] left-[-5%] size-[500px] bg-white/40 rounded-full blur-[100px]" />

          <div className="relative z-10 w-full max-w-md">
            <button
              type="button"
              onClick={navigateHome}
              className="flex items-center text-gray-400 hover:text-[#00b14f] transition-colors mb-10 group"
            >
              <div className="p-1.5 bg-white rounded-lg mr-3 shadow-sm border border-gray-100 group-hover:bg-green-50">
                <ChevronLeft size={16} />
              </div>
              <span className="text-[14px] font-bold">Quay lại trang chủ</span>
            </button>

            <h1 className="text-[28px] lg:text-[36px] font-extrabold text-[#004d39] leading-[1.2] mb-6 tracking-tight">Quên mật khẩu</h1>
            <p className="text-[#006a4e]/70 text-[15px] lg:text-[17px] mb-12 font-medium leading-relaxed italic">
              {step === 'request'
                ? 'Nhập mã nhà hàng và email để nhận mã OTP đặt lại mật khẩu.'
                : 'Nhập mã OTP đã nhận cùng mật khẩu mới để hoàn tất khôi phục tài khoản.'}
            </p>
          </div>

          <div className="absolute bottom-[-20px] left-0 right-0 h-[400px] pointer-events-none z-0 opacity-40">
            <svg viewBox="0 0 500 300" preserveAspectRatio="xMidYMax slice" className="w-full h-full">
              <path d="M-50,150 C50,50 150,130 250,80 C350,30 450,110 550,70 V300 H-50 Z" fill="#b8d8c8" opacity="0.3" />
              <path d="M-50,300 C100,200 300,250 500,180 V300 H-50 Z" fill="#a9dfbf" opacity="0.6" />
              <path d="M-150,300 C50,150 350,250 650,100 V300 H-150 Z" fill="#2ecc71" opacity="0.4" />
            </svg>
          </div>
        </aside>

        <section className="flex-1 bg-[#fafafa] flex flex-col relative items-center justify-center">
          <div className="w-full max-w-xl px-5 py-12 lg:px-20 lg:py-16">
            <div className="relative pt-4 pb-12">
              <div className="absolute -inset-x-4 -top-2 bottom-4 bg-white/40 border border-gray-100 rounded-[40px] shadow-sm pointer-events-none" />

              <div className="relative z-10 bg-white p-6 lg:p-10 rounded-[32px] shadow-2xl shadow-green-900/[0.04] border border-gray-50">
                <div className="flex justify-between items-center mb-8 gap-3">
                  <h2 className="text-[19px] font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                    <ShieldAlert size={20} className="text-[#00b14f]" />
                    Khôi phục mật khẩu
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-5">
                    <div className="space-y-1 group">
                      <label className="text-[12px] font-bold text-gray-500 ml-1 uppercase tracking-wide">Mã nhà hàng</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Nhập mã nhà hàng"
                          value={formData.restaurantCode}
                          onChange={(event) => handleInputChange('restaurantCode', event.target.value)}
                          className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:border-[#00b14f] focus:ring-4 focus:ring-green-50 outline-none transition-all text-[15px] font-medium placeholder:text-gray-400"
                        />
                        <Store className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      </div>
                    </div>

                    <div className="space-y-1 group">
                      <label className="text-[12px] font-bold text-gray-500 ml-1 uppercase tracking-wide">Email</label>
                      <div className="relative">
                        <input
                          type="email"
                          placeholder="Nhập email của bạn"
                          value={formData.email}
                          onChange={(event) => handleInputChange('email', event.target.value)}
                          className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:border-[#00b14f] focus:ring-4 focus:ring-green-50 outline-none transition-all text-[15px] font-medium placeholder:text-gray-400"
                        />
                        <Mail className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      </div>
                    </div>

                    {step === 'verify' && (
                      <>
                        <div className="space-y-1 group">
                          <label className="text-[12px] font-bold text-gray-500 ml-1 uppercase tracking-wide">Mã OTP</label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Nhập mã OTP gồm 6 chữ số"
                              value={formData.otpCode}
                              onChange={(event) => handleInputChange('otpCode', event.target.value)}
                              className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:border-[#00b14f] focus:ring-4 focus:ring-green-50 outline-none transition-all text-[15px] font-medium placeholder:text-gray-400"
                            />
                            <KeyRound className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                          </div>
                        </div>

                        <div className="space-y-1 group">
                          <label className="text-[12px] font-bold text-gray-500 ml-1 uppercase tracking-wide">Mật khẩu mới</label>
                          <div className="relative">
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              placeholder="Nhập mật khẩu mới"
                              value={formData.newPassword}
                              onChange={(event) => handleInputChange('newPassword', event.target.value)}
                              className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:border-[#00b14f] focus:ring-4 focus:ring-green-50 outline-none transition-all text-[15px] font-medium placeholder:text-gray-400"
                            />
                            <button type="button" onClick={() => setShowNewPassword((prev) => !prev)} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400">
                              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1 group">
                          <label className="text-[12px] font-bold text-gray-500 ml-1 uppercase tracking-wide">Xác nhận mật khẩu mới</label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder="Nhập lại mật khẩu mới"
                              value={formData.confirmPassword}
                              onChange={(event) => handleInputChange('confirmPassword', event.target.value)}
                              className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:border-[#00b14f] focus:ring-4 focus:ring-green-50 outline-none transition-all text-[15px] font-medium placeholder:text-gray-400"
                            />
                            <button type="button" onClick={() => setShowConfirmPassword((prev) => !prev)} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400">
                              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {submitError && <p className="text-[13px] font-bold text-red-500 text-center">{submitError}</p>}
                  {submitSuccess && <p className="text-[13px] font-bold text-green-600 text-center">{submitSuccess}</p>}

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="group w-full py-5 bg-[#00b14f] hover:bg-[#009642] disabled:bg-green-300 text-white font-extrabold rounded-full transition-all shadow-xl shadow-green-200/50 text-[17px] active:scale-[0.98] disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? 'Đang xử lý...' : step === 'request' ? 'Gửi mã OTP' : 'Xác nhận OTP và đặt lại mật khẩu'}
                      {!isSubmitting && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                    </button>
                  </div>
                </form>

                {step === 'verify' && (
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('request');
                        setSubmitError('');
                        setSubmitSuccess('');
                        setFormData((prev) => ({ ...prev, otpCode: '', newPassword: '', confirmPassword: '' }));
                      }}
                      className="inline-flex items-center gap-2 text-[13px] font-bold text-[#006a4e] hover:text-[#00b14f] transition-colors"
                    >
                      <Lock size={15} /> Yêu cầu mã OTP mới
                    </button>
                  </div>
                )}

                <div className="mt-8 text-center border-t border-gray-50 pt-6 flex items-center justify-center">
                  <a href={buildLoginHref()} className="text-[14px] font-extrabold text-gray-500 hover:text-[#006a4e] transition-colors group flex items-center gap-1">
                    Quay lại <span className="text-[#00b14f] underline underline-offset-4 decoration-2">Đăng nhập</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <AuthPageFooter />
    </div>
  );
}
