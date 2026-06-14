import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Eye,
  EyeOff,
  ShieldCheck,
  Trash2,
  Upload,
  UserCircle,
} from 'lucide-react';
import { AuthPageFooter } from './auth/AuthPageFooter';
import { AuthPageHeader } from './auth/AuthPageHeader';
import { persistAuthSession } from '../utils/authSession';
import { parseRegistrationProfilePayload } from '../utils/registrationProfile';

type FormDataState = {
  taxCode: string;
  businessName: string;
  registrationType: string;
  province: string;
  district: string;
  ward: string;
  detailAddress: string;
  unitNickname: string;
  loginCode: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
};

type ValidationErrors = Partial<Record<keyof FormDataState | 'files', string>>;

const emptyFormData: FormDataState = {
  taxCode: '',
  businessName: '',
  registrationType: '',
  province: '',
  district: '',
  ward: '',
  detailAddress: '',
  unitNickname: '',
  loginCode: '',
  fullName: '',
  phoneNumber: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreeToTerms: false,
};

const MAX_LICENSE_FILE_SIZE = 5 * 1024 * 1024;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Không thể đọc file đã chọn.'));
    reader.readAsDataURL(file);
  });

export function RegisterPage() {
  const params = new URLSearchParams(window.location.search);
  const isSeller = params.get('seller') === '1';
  const isLoggedIn = Boolean(
    window.localStorage.getItem('freso_customer_token') ||
      window.sessionStorage.getItem('freso_customer_token')
  );

  const [currentStep, setCurrentStep] = useState(isSeller ? 1 : 2);
  const [hasDraft, setHasDraft] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState<FormDataState>(emptyFormData);
  const [files, setFiles] = useState<File[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSellerProfile, setIsCheckingSellerProfile] = useState(isLoggedIn && isSeller);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!isLoggedIn || !isSeller) {
      setIsCheckingSellerProfile(false);
      return;
    }

    let cancelled = false;
    const token = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';
    if (!token) {
      console.warn('[FresoSellerRegister] Logged-in seller upgrade route opened without a customer token.');
      setIsCheckingSellerProfile(false);
      return;
    }

    const syncSellerProfile = async () => {
      try {
        console.info('[FresoSellerRegister] Checking existing seller profile before showing upgrade form.');
        const response = await fetch(`${window.location.origin}/rest/V1/tmdt-registration/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-store',
          },
        });

        if (!response.ok) {
          console.warn('[FresoSellerRegister] Profile check failed, keeping seller registration form visible.', {
            status: response.status,
          });
          return;
        }

        const payload = await response.json().catch(() => null);
        const profile = parseRegistrationProfilePayload(payload);
        const parseFlag = (value: unknown) => value === true || value === 1 || value === '1';
        const role = String(profile.role ?? '').trim().toLowerCase();
        const status = String(profile.status ?? '').trim().toLowerCase();
        const isOwner = parseFlag(profile.is_owner ?? profile.isOwner);
        const isSuperAdmin = parseFlag(profile.is_super_admin ?? profile.isSuperAdmin);
        const sellerAccess = parseFlag(profile.seller_access ?? profile.sellerAccess);
        const approvedSeller = role === 'seller' && status === 'approved';
        const approvedBranch = role === 'branch' && (status === 'approved' || status === 'active');
        console.info('[FresoSellerRegister] Existing profile check result.', {
          role,
          status,
          sellerAccess,
          isOwner,
          isSuperAdmin,
          approvedSeller,
          approvedBranch,
          raw: profile,
        });

        if (sellerAccess || approvedSeller || approvedBranch) {
          const canManageBranches = approvedSeller && (isOwner || isSuperAdmin);
          const effectiveRole = role || (window.localStorage.getItem('freso_role') || window.sessionStorage.getItem('freso_role') || '').trim().toLowerCase();
          window.localStorage.setItem('freso_role', effectiveRole);
          window.sessionStorage.setItem('freso_role', effectiveRole);
          window.localStorage.setItem('freso_status', status);
          window.sessionStorage.setItem('freso_status', status);
          window.localStorage.setItem('freso_seller_access', '1');
          window.sessionStorage.setItem('freso_seller_access', '1');
          window.localStorage.setItem('freso_is_owner', canManageBranches ? '1' : '0');
          window.sessionStorage.setItem('freso_is_owner', canManageBranches ? '1' : '0');
          window.localStorage.setItem('freso_is_super_admin', isSuperAdmin ? '1' : '0');
          window.sessionStorage.setItem('freso_is_super_admin', isSuperAdmin ? '1' : '0');
          window.dispatchEvent(new CustomEvent('freso:profile-updated'));
          console.info('[FresoSellerRegister] Approved seller/branch detected, redirecting to seller dashboard.');
          window.location.replace('/react/index.html?view=seller-dashboard');
        }
      } catch (error) {
        console.error('[FresoSellerRegister] Unexpected profile check error.', error);
      } finally {
        if (!cancelled) {
          setIsCheckingSellerProfile(false);
        }
      }
    };

    void syncSellerProfile();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, isSeller]);

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

  const handleInputChange = <K extends keyof FormDataState>(field: K, value: FormDataState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasDraft(true);
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep1 = () => {
    const errors: ValidationErrors = {};
    if (!formData.taxCode.trim()) {
      errors.taxCode = 'Vui lòng nhập Mã số thuế';
    }
    if (!formData.businessName.trim()) {
      errors.businessName = 'Vui lòng nhập Tên doanh nghiệp';
    }
    if (!formData.registrationType) {
      errors.registrationType = 'Vui lòng chọn đối tượng đăng ký';
    }
    if (!formData.province) {
      errors.province = 'Vui lòng chọn Tỉnh/Thành';
    }
    if (!formData.ward) {
      errors.ward = 'Vui lòng chọn Phường/Xã';
    }
    if (files.length === 0) {
      errors.files = 'Vui lòng tải lên giấy phép kinh doanh';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const errors: ValidationErrors = {};
    if (!formData.unitNickname.trim()) {
      errors.unitNickname = 'Vui lòng nhập Tên gợi nhớ đơn vị';
    }
    if (!formData.loginCode.trim()) {
      errors.loginCode = 'Vui lòng nhập Mã đăng nhập';
    }
    if (!formData.fullName.trim()) {
      errors.fullName = 'Vui lòng nhập Họ và tên';
    }
    if (!formData.phoneNumber.trim()) {
      errors.phoneNumber = 'Vui lòng nhập Số điện thoại';
    }
    if (!formData.email.trim()) {
      errors.email = 'Vui lòng nhập Email';
    }
    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
    if (!strongPassword.test(formData.password)) {
      errors.password = 'Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt';
    }
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }
    if (!formData.agreeToTerms) {
      errors.agreeToTerms = 'Bạn cần đồng ý với điều khoản sử dụng';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStep1Submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateStep1()) {
      return;
    }

    if (isLoggedIn && isSeller) {
      setIsSubmitting(true);
      setSubmitError('');
      try {
        const token = window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';
        
        let filesPayload: any[] = [];
        if (files.length > 0) {
          const tooLarge = files.find((file) => file.size > MAX_LICENSE_FILE_SIZE);
          if (tooLarge) {
            setValidationErrors((prev) => ({ ...prev, files: 'File vượt quá dung lượng tối đa 5MB' }));
            setIsSubmitting(false);
            return;
          }

          filesPayload = await Promise.all(
            files.map(async (file) => ({
              name: file.name,
              type: file.type,
              size: file.size,
              content: await readFileAsDataUrl(file),
            })),
          );
        }

        const payload = {
          taxCode: formData.taxCode,
          businessName: formData.businessName,
          registrationType: formData.registrationType,
          province: formData.province,
          ward: formData.ward,
          detailAddress: formData.detailAddress,
          role: 'seller',
          files: filesPayload
        };

        const response = await fetch(`${window.location.origin}/rest/V1/tmdt-registration/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ payload }),
        });

        const bodyText = await response.text().catch(() => '');
        let data: { success?: boolean; message?: string } | null = null;
        if (bodyText.trim()) {
          try {
            data = JSON.parse(bodyText);
          } catch {
            data = null;
          }
        }

        if (!response.ok) {
          const errorMessage = data?.message?.trim() || bodyText.trim() || 'Không thể nâng cấp lên tài khoản người bán.';
          throw new Error(errorMessage);
        }

        if (data?.success === false) {
          throw new Error(data?.message || 'Không thể nâng cấp lên tài khoản người bán.');
        }

        window.localStorage.setItem('freso_role', 'customer');
        window.sessionStorage.setItem('freso_role', 'customer');
        window.localStorage.setItem('freso_is_owner', '0');
        window.sessionStorage.setItem('freso_is_owner', '0');
        window.localStorage.setItem('freso_is_super_admin', '0');
        window.sessionStorage.setItem('freso_is_super_admin', '0');
        window.dispatchEvent(new CustomEvent('freso:profile-updated'));
        
        setIsSubmitted(true);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Đã xảy ra lỗi khi nâng cấp người bán.';
        setSubmitError(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCurrentStep(2);
    }
  };

  const mapSubmitErrorToField = (message: string) => {
    const normalized = message.toLowerCase();

    if (normalized.includes('mã đăng nhập đã tồn tại')) {
      setValidationErrors((prev) => ({ ...prev, loginCode: 'Mã đăng nhập đã tồn tại, vui lòng chọn mã khác.' }));
      return;
    }

    if (normalized.includes('email') && (normalized.includes('already exists') || normalized.includes('đã tồn tại'))) {
      setValidationErrors((prev) => ({ ...prev, email: 'Email đã tồn tại, vui lòng dùng email khác.' }));
    }
  };

  const handleFinalSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateStep2()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      let filesPayload: any[] = [];
      if (isSeller) {
        if (files.length === 0) {
          setValidationErrors((prev) => ({ ...prev, files: 'Vui lòng tải lên giấy phép kinh doanh' }));
          return;
        }

        const tooLarge = files.find((file) => file.size > MAX_LICENSE_FILE_SIZE);
        if (tooLarge) {
          setValidationErrors((prev) => ({ ...prev, files: 'File vượt quá dung lượng tối đa 5MB' }));
          return;
        }

        filesPayload = await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
            content: await readFileAsDataUrl(file),
          })),
        );
      }

      const payload = {
        ...formData,
        isSeller,
        files: filesPayload,
      };

      const response = await fetch(`${window.location.origin}/rest/V1/tmdt-registration/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payload }),
      });

      const bodyText = await response.text().catch(() => '');
      let data: { success?: boolean; message?: string; token?: string; email?: string; full_name?: string; branch_name?: string } | null = null;

      if (bodyText.trim()) {
        try {
          data = JSON.parse(bodyText);
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        const errorMessage = data?.message?.trim() || bodyText.trim() || 'Không thể lưu đăng ký vào Magento.';
        throw new Error(errorMessage);
      }

      if (data?.success === false) {
        throw new Error(data?.message || 'Không thể lưu đăng ký vào Magento.');
      }

      if (data && 'token' in data && data.token) {
        const token = data.token;
        const email = data.email || formData.email;
        const fullName = data.full_name || formData.fullName;
        const branchName = data.branch_name || formData.unitNickname;

        persistAuthSession(window.localStorage, window.sessionStorage, {
          customerToken: token,
          loginToken: token,
          email,
          fullName,
          branchName,
        });
        window.localStorage.setItem('freso_role', isSeller ? 'seller' : 'customer');
        window.sessionStorage.setItem('freso_role', isSeller ? 'seller' : 'customer');

        window.localStorage.setItem('freso_is_owner', '0');
        window.sessionStorage.setItem('freso_is_owner', '0');
        window.localStorage.setItem('freso_is_super_admin', '0');
        window.sessionStorage.setItem('freso_is_super_admin', '0');

        // Call session endpoint to login to Magento session
        await fetch(`${window.location.origin}/tmdt/registration/session`, {
          method: 'POST',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        }).catch(() => null);

        // Redirect to customer dashboard. Seller accounts need admin approval before seller dashboard access.
        window.location.href = '/react/index.html?view=dashboard';
        return;
      }

      setIsSubmitted(true);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Đã xảy ra lỗi khi gửi đăng ký.';
      mapSubmitErrorToField(errorMessage);
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearForm = () => {
    setFormData(emptyFormData);
    setFiles([]);
    setCurrentStep(isSeller ? 1 : 2);
    setHasDraft(false);
    setValidationErrors({});
    setSubmitError('');
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="size-24 bg-green-100 text-[#00b14f] rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-200/20">
            <CheckCircle2 size={48} />
          </div>
          <h1 className="text-3xl font-extrabold text-[#004d39]">
            {isLoggedIn && isSeller ? 'Nâng cấp thành công!' : 'Đăng ký thành công!'}
          </h1>
          <p className="text-gray-600 leading-relaxed font-medium">
            {isLoggedIn && isSeller ? (
              'Hồ sơ kinh doanh của bạn đã được gửi thành công. Bạn có thể dùng tài khoản mua hàng như bình thường và chờ admin duyệt trước khi vào kênh người bán.'
            ) : (
              <>
                Cảm ơn doanh nghiệp <span className="font-bold text-[#00b14f]">{formData.businessName}</span> đã tin tưởng Organica.
                Chúng tôi sẽ sớm liên hệ để xác thực thông tin.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              if (isLoggedIn && isSeller) {
                window.location.href = '/react/index.html?view=dashboard';
              } else {
                navigateHome();
              }
            }}
            className="w-full py-4 bg-[#00b14f] text-white font-bold rounded-2xl hover:bg-[#009642] transition-all shadow-lg shadow-green-200/50"
          >
            {isLoggedIn && isSeller ? 'Về tài khoản của tôi' : 'Quay lại trang chủ'}
          </button>
        </div>
      </div>
    );
  }

  if (isCheckingSellerProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto mb-5 size-12 animate-spin rounded-full border-4 border-green-100 border-t-[#00b14f]" />
          <h1 className="mb-2 text-2xl font-extrabold text-[#004d39]">Dang kiem tra quyen nguoi ban</h1>
          <p className="text-sm font-medium text-gray-600">
            He thong dang doc ho so kinh doanh cua tai khoan nay. Vui long doi trong giay lat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-[#333]">
      <AuthPageHeader />

      <div className="flex flex-1 flex-col lg:flex-row overflow-visible">
        <aside className="relative lg:w-[42%] bg-gradient-to-br from-[#f0f9f4] via-[#e8f6ed] to-[#d4efdf] p-8 lg:p-16 flex flex-col justify-start overflow-hidden border-r border-gray-50 min-h-[400px] lg:min-h-0">
          <div className="absolute top-[-5%] left-[-5%] size-[500px] bg-white/40 rounded-full blur-[100px]" />

          <div className="relative z-10 w-full max-w-md">
            <button
              type="button"
              onClick={() => (currentStep === 2 && isSeller ? setCurrentStep(1) : navigateHome())}
              className="flex items-center text-gray-400 hover:text-[#00b14f] transition-colors mb-10 group"
            >
              <div className="p-1.5 bg-white rounded-lg mr-3 shadow-sm border border-gray-100 group-hover:bg-green-50">
                <ChevronLeft size={16} />
              </div>
              <span className="text-[14px] font-bold">{currentStep === 2 && isSeller ? 'Quay lại Bước 1' : 'Quay lại trang chủ'}</span>
            </button>

            <h1 className="text-[28px] lg:text-[32px] font-extrabold text-[#004d39] leading-[1.2] mb-6 tracking-tight">
              {isLoggedIn && isSeller
                ? 'Nâng cấp lên tài khoản Người bán'
                : currentStep === 1
                  ? 'Đăng ký tài khoản mua hàng cho doanh nghiệp'
                  : 'Tạo tài khoản đăng nhập Organica'}
            </h1>
            <p className="text-[#006a4e]/70 text-[15px] lg:text-[16px] mb-12 font-medium leading-relaxed italic">
              {isLoggedIn && isSeller
                ? 'Nâng cấp cửa hàng của bạn để bắt đầu phân phối nông sản tươi sạch trên sàn Organica.'
                : currentStep === 1
                  ? 'Nông sản tươi sạch từ thảo nguyên mướt xanh, kết nối trực tiếp đến đơn vị của bạn.'
                  : 'Hãy thiết lập thông tin bảo mật để bắt đầu quản lý nguồn cung nông sản sạch của bạn.'}
            </p>

            {isLoggedIn && isSeller ? (
              <div className="space-y-10 lg:space-y-12 relative ml-1">
                <div className="flex items-start gap-6 relative">
                  <div className="size-8 rounded-full flex items-center justify-center text-sm font-bold z-10 bg-[#00b14f] text-white shadow-lg shadow-green-200/30 scale-110">
                    1
                  </div>
                  <div className="pt-1">
                    <p className="text-[15px] font-bold text-[#006a4e]">
                      Thông tin kinh doanh
                    </p>
                  </div>
                </div>
              </div>
            ) : isSeller ? (
              <div className="space-y-10 lg:space-y-12 relative ml-1">
                <div className="absolute left-[15px] top-4 bottom-4 w-[1.5px] bg-[#b8e6cc]" />

                <div className="flex items-start gap-6 relative">
                  <div
                    className={`size-8 rounded-full flex items-center justify-center text-sm font-bold z-10 transition-all duration-500 ${
                      currentStep >= 1 ? 'bg-[#00b14f] text-white shadow-lg shadow-green-200/30 scale-110' : 'bg-white border border-[#b8e6cc] text-[#b8e6cc]'
                    }`}
                  >
                    {currentStep > 1 ? <CheckCircle2 size={18} /> : '1'}
                  </div>
                  <div className="pt-1">
                    <p className={`text-[15px] font-bold transition-colors duration-300 ${currentStep === 1 ? 'text-[#006a4e]' : 'text-[#006a4e] opacity-60'}`}>
                      Thông tin kinh doanh
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-6 relative">
                  <div
                    className={`size-8 rounded-full flex items-center justify-center text-sm font-bold z-10 transition-all duration-500 ${
                      currentStep >= 2 ? 'bg-[#00b14f] text-white shadow-lg shadow-green-200/30 scale-110' : 'bg-white border border-[#b8e6cc] text-[#b8e6cc]'
                    }`}
                  >
                    2
                  </div>
                  <div className="pt-1">
                    <p className={`text-[15px] font-bold transition-colors duration-300 ${currentStep === 2 ? 'text-[#006a4e]' : 'text-gray-400'}`}>
                      Tạo tài khoản đăng nhập
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-10 lg:space-y-12 relative ml-1">
                <div className="flex items-start gap-6 relative">
                  <div className="size-8 rounded-full flex items-center justify-center text-sm font-bold z-10 bg-[#00b14f] text-white shadow-lg shadow-green-200/30 scale-110">
                    1
                  </div>
                  <div className="pt-1">
                    <p className="text-[15px] font-bold text-[#006a4e]">
                      Tạo tài khoản đăng nhập
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="absolute bottom-[-20px] left-0 right-0 h-[300px] pointer-events-none z-0 opacity-40">
            <svg viewBox="0 0 500 300" preserveAspectRatio="xMidYMax slice" className="w-full h-full">
              <path d="M-50,150 C50,50 150,130 250,80 C350,30 450,110 550,70 V300 H-50 Z" fill="#b8d8c8" opacity="0.3" />
              <path d="M-50,300 C100,200 300,250 500,180 V300 H-50 Z" fill="#a9dfbf" opacity="0.6" />
              <path d="M-150,300 C50,150 350,250 650,100 V300 H-150 Z" fill="#2ecc71" opacity="0.4" />
            </svg>
          </div>
        </aside>

        <section className="flex-1 bg-[#fafafa] flex flex-col relative">
          <div className="px-5 py-12 lg:px-20 lg:py-16">
            <div className="max-w-xl mx-auto relative pt-4 pb-12">
              <div className="absolute -inset-x-4 -top-2 bottom-4 bg-white/40 border border-gray-100 rounded-[40px] shadow-sm pointer-events-none" />

              <div className="relative z-10 bg-white p-6 lg:p-10 rounded-[32px] shadow-2xl shadow-green-900/[0.04] border border-gray-50">
                <div className="flex justify-between items-center mb-8 gap-3">
                  <h2 className="text-[19px] font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                    {currentStep === 1 ? <Building2 size={20} className="text-[#00b14f]" /> : <UserCircle size={20} className="text-[#00b14f]" />}
                    {currentStep === 1 ? 'Thông tin kinh doanh' : 'Tài khoản đăng nhập'}
                  </h2>
                  {hasDraft && (
                    <button
                      type="button"
                      onClick={clearForm}
                      className="flex items-center gap-1.5 text-red-500 hover:text-red-600 text-[13px] font-bold transition-all"
                    >
                      <Trash2 size={15} /> <span className="hidden sm:inline">Xóa bản nháp</span>
                    </button>
                  )}
                </div>

                {currentStep === 1 ? (
                  <form onSubmit={handleStep1Submit} className="space-y-6">
                    <div className="space-y-6">
                      <h3 className="text-[15px] font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wide">
                        <span className="w-1.5 h-5 bg-[#00b14f] rounded-full" />
                        Thông tin cơ sở kinh doanh <span className="text-red-500 ml-1">(*)</span>
                      </h3>

                      <div className="bg-[#fffcf5] border border-[#ffecce] p-4 rounded-2xl flex items-center gap-4 shadow-sm">
                        <div className="bg-orange-100/50 p-2 rounded-xl text-orange-600">
                          <ShieldCheck size={20} />
                        </div>
                        <p className="text-[13px] text-[#8c6d1f] font-bold leading-snug">
                          Vui lòng nhập đúng mã số thuế để xác minh thông tin cơ sở kinh doanh
                        </p>
                      </div>

                      <div className="space-y-4">
                        <input
                          type="text"
                          placeholder="Mã số thuế cơ sở kinh doanh của bạn"
                          value={formData.taxCode}
                          onChange={(event) => handleInputChange('taxCode', event.target.value)}
                          className={`w-full px-5 py-4 bg-gray-50 border rounded-2xl focus:bg-white transition-all text-[15px] font-medium outline-none ${
                            validationErrors.taxCode ? 'border-red-500 bg-red-50/50' : 'border-gray-200 focus:border-[#00b14f] focus:ring-4 focus:ring-green-50'
                          }`}
                        />
                        {validationErrors.taxCode && <p className="text-red-500 text-[12px] ml-1 font-bold italic">{validationErrors.taxCode}</p>}

                        <input
                          type="text"
                          placeholder="Tên theo giấy phép kinh doanh"
                          value={formData.businessName}
                          onChange={(event) => handleInputChange('businessName', event.target.value)}
                          className={`w-full px-5 py-4 bg-gray-50 border rounded-2xl focus:bg-white transition-all text-[15px] font-medium outline-none ${
                            validationErrors.businessName ? 'border-red-500 bg-red-50/50' : 'border-gray-200 focus:border-[#00b14f] focus:ring-4 focus:ring-green-50'
                          }`}
                        />
                        {validationErrors.businessName && <p className="text-red-500 text-[12px] ml-1 font-bold italic">{validationErrors.businessName}</p>}

                        <div className="relative">
                          <select
                            value={formData.registrationType}
                            onChange={(event) => handleInputChange('registrationType', event.target.value)}
                            className={`w-full px-5 py-4 bg-gray-50 border rounded-2xl appearance-none outline-none focus:border-[#00b14f] focus:bg-white transition-all text-[15px] font-medium ${
                              validationErrors.registrationType ? 'border-red-500' : 'border-gray-200'
                            }`}
                          >
                            <option value="">Đối tượng đăng ký</option>
                            <option value="company">Công ty</option>
                            <option value="business">Hộ kinh doanh</option>
                            <option value="cooperative">Hợp tác xã</option>
                          </select>
                          <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                        </div>
                        {validationErrors.registrationType && <p className="text-red-500 text-[12px] ml-1 font-bold italic">{validationErrors.registrationType}</p>}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="relative">
                            <select
                              value={formData.province}
                              onChange={(event) => handleInputChange('province', event.target.value)}
                              className={`w-full px-5 py-4 bg-gray-50 border rounded-2xl appearance-none outline-none focus:border-[#00b14f] focus:bg-white text-[15px] font-medium ${
                                validationErrors.province ? 'border-red-500' : 'border-gray-200'
                              }`}
                            >
                              <option value="">Tỉnh thành</option>
                              <option value="hanoi">Hà Nội</option>
                              <option value="hcm">TP. Hồ Chí Minh</option>
                            </select>
                            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                          </div>

                          <div className="relative">
                            <select
                              value={formData.ward}
                              onChange={(event) => handleInputChange('ward', event.target.value)}
                              className={`w-full px-5 py-4 bg-gray-50 border rounded-2xl appearance-none outline-none focus:border-[#00b14f] focus:bg-white text-[15px] font-medium ${
                                validationErrors.ward ? 'border-red-500' : 'border-gray-200'
                              }`}
                            >
                              <option value="">Xã phường</option>
                              <option value="ward-1">Phường 1</option>
                              <option value="ward-2">Phường 2</option>
                            </select>
                            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                          </div>
                        </div>
                        {(validationErrors.province || validationErrors.ward) && (
                          <p className="text-red-500 text-[12px] ml-1 font-bold italic">{validationErrors.province || validationErrors.ward}</p>
                        )}

                        <input
                          type="text"
                          placeholder="Địa chỉ chi tiết"
                          value={formData.detailAddress}
                          onChange={(event) => handleInputChange('detailAddress', event.target.value)}
                          className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:border-[#00b14f] outline-none transition-all text-[15px] font-medium"
                        />

                        <div className="space-y-3 pt-2">
                          <label className="text-[13px] font-extrabold text-gray-700 ml-1 uppercase tracking-wide">Giấy phép kinh doanh</label>
                          <div className={`flex items-center justify-between p-5 border rounded-2xl bg-[#fcfdfc] transition-all ${validationErrors.files ? 'border-red-500 bg-red-50/20' : 'border-gray-100'}`}>
                            <div className="flex flex-col gap-1 max-w-[60%]">
                              <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">JPG, PNG, PDF (MAX 5MB)</span>
                              {files.length > 0 && <span className="text-[13px] text-[#00b14f] font-bold">Đã chọn {files.length} tệp</span>}
                            </div>
                            <label className="cursor-pointer flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 rounded-xl text-[13px] font-extrabold hover:bg-green-50 hover:border-[#00b14f] transition-all shadow-sm">
                              <Upload size={16} className="text-[#00b14f]" />
                              Tải lên
                              <input
                                type="file"
                                multiple
                                accept=".jpg,.jpeg,.png,.pdf,.heif,.heic,application/pdf,image/*"
                                className="hidden"
                                onChange={(event) => {
                                  const fileList = event.target.files ? Array.from(event.target.files) : [];
                                  const tooLarge = fileList.find((file) => file.size > MAX_LICENSE_FILE_SIZE);
                                  if (tooLarge) {
                                    setFiles([]);
                                    setHasDraft(true);
                                    setValidationErrors((prev) => ({ ...prev, files: 'File vượt quá dung lượng tối đa 5MB' }));
                                    event.target.value = '';
                                    return;
                                  }

                                  setFiles(fileList);
                                  setHasDraft(true);
                                  setValidationErrors((prev) => ({ ...prev, files: '' }));
                                }}
                              />
                            </label>
                          </div>
                          {validationErrors.files && <p className="text-red-500 text-[12px] ml-1 font-bold italic">{validationErrors.files}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4">
                      {submitError && <p className="mb-4 text-center text-[13px] font-bold text-red-500">{submitError}</p>}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="group w-full py-5 bg-[#00b14f] hover:bg-[#009642] disabled:bg-green-300 text-white font-extrabold rounded-full transition-all shadow-xl shadow-green-200/50 text-[17px] active:scale-[0.98] disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          'Đang gửi...'
                        ) : isLoggedIn && isSeller ? (
                          'Hoàn tất đăng ký người bán'
                        ) : (
                          <>
                            Tiếp tục <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleFinalSubmit} className="space-y-6">
                    <div className="space-y-6">
                      <h3 className="text-[15px] font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wide">
                        <span className="w-1.5 h-5 bg-[#00b14f] rounded-full" />
                        Định danh đơn vị <span className="text-red-500 ml-1">(*)</span>
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[12px] font-bold text-gray-500 ml-1 uppercase">Tên gợi nhớ</label>
                          <input
                            type="text"
                            placeholder="VD: Cửa hàng rau sạch ABC"
                            value={formData.unitNickname}
                            onChange={(event) => handleInputChange('unitNickname', event.target.value)}
                            className={`w-full px-5 py-4 bg-gray-50 border rounded-2xl focus:bg-white outline-none transition-all text-[15px] font-medium ${
                              validationErrors.unitNickname ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-[#00b14f]'
                            }`}
                          />
                          {validationErrors.unitNickname && <p className="text-red-500 text-[12px] ml-1 font-bold italic">{validationErrors.unitNickname}</p>}
                        </div>

                        <div className="space-y-1">
                          <label className="text-[12px] font-bold text-gray-500 ml-1 uppercase">Mã đăng nhập</label>
                          <input
                            type="text"
                            placeholder="VD: freso_shop01"
                            value={formData.loginCode}
                            onChange={(event) => handleInputChange('loginCode', event.target.value)}
                            className={`w-full px-5 py-4 bg-gray-50 border rounded-2xl focus:bg-white outline-none transition-all text-[15px] font-medium ${
                              validationErrors.loginCode ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-[#00b14f]'
                            }`}
                          />
                          {validationErrors.loginCode && <p className="text-red-500 text-[12px] ml-1 font-bold italic">{validationErrors.loginCode}</p>}
                        </div>
                      </div>

                      <h3 className="text-[15px] font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wide pt-4">
                        <span className="w-1.5 h-5 bg-[#00b14f] rounded-full" />
                        Người đại diện <span className="text-red-500 ml-1">(*)</span>
                      </h3>

                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <input
                              type="text"
                              placeholder="Họ và tên"
                              value={formData.fullName}
                              onChange={(event) => handleInputChange('fullName', event.target.value)}
                              className={`w-full px-5 py-4 bg-gray-50 border rounded-2xl focus:bg-white transition-all text-[15px] font-medium outline-none ${
                                validationErrors.fullName ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-[#00b14f]'
                              }`}
                            />
                            {validationErrors.fullName && <p className="text-red-500 text-[12px] mt-1 ml-1 font-bold italic">{validationErrors.fullName}</p>}
                          </div>

                          <div>
                            <input
                              type="text"
                              placeholder="Số điện thoại"
                              value={formData.phoneNumber}
                              onChange={(event) => handleInputChange('phoneNumber', event.target.value)}
                              className={`w-full px-5 py-4 bg-gray-50 border rounded-2xl focus:bg-white transition-all text-[15px] font-medium outline-none ${
                                validationErrors.phoneNumber ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-[#00b14f]'
                              }`}
                            />
                            {validationErrors.phoneNumber && <p className="text-red-500 text-[12px] mt-1 ml-1 font-bold italic">{validationErrors.phoneNumber}</p>}
                          </div>
                        </div>

                        <div>
                          <input
                            type="email"
                            placeholder="Địa chỉ Email"
                            value={formData.email}
                            onChange={(event) => handleInputChange('email', event.target.value)}
                            className={`w-full px-5 py-4 bg-gray-50 border rounded-2xl focus:bg-white transition-all text-[15px] font-medium outline-none ${
                              validationErrors.email ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-[#00b14f]'
                            }`}
                          />
                          {validationErrors.email && <p className="text-red-500 text-[12px] mt-1 ml-1 font-bold italic">{validationErrors.email}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Mật khẩu"
                              value={formData.password}
                              onChange={(event) => handleInputChange('password', event.target.value)}
                              className={`w-full px-5 py-4 bg-gray-50 border rounded-2xl focus:bg-white outline-none transition-all text-[15px] font-medium ${
                                validationErrors.password ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-[#00b14f]'
                              }`}
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400">
                              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                            {validationErrors.password && <p className="text-red-500 text-[12px] mt-1 ml-1 font-bold italic">{validationErrors.password}</p>}
                          </div>

                          <div className="relative">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder="Xác nhận mật khẩu"
                              value={formData.confirmPassword}
                              onChange={(event) => handleInputChange('confirmPassword', event.target.value)}
                              className={`w-full px-5 py-4 bg-gray-50 border rounded-2xl focus:bg-white outline-none transition-all text-[15px] font-medium ${
                                validationErrors.confirmPassword ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-[#00b14f]'
                              }`}
                            />
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400">
                              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                            {validationErrors.confirmPassword && <p className="text-red-500 text-[12px] mt-1 ml-1 font-bold italic">{validationErrors.confirmPassword}</p>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="mt-1 size-5 rounded border-gray-300 text-[#00b14f] focus:ring-[#00b14f] cursor-pointer"
                          checked={formData.agreeToTerms}
                          onChange={(event) => handleInputChange('agreeToTerms', event.target.checked)}
                        />
                        <span className="text-[13px] text-gray-600 font-medium leading-relaxed">
                          Tôi đã đọc và đồng ý với <span className="text-[#00b14f] font-bold underline">Điều khoản sử dụng</span> và{' '}
                          <span className="text-[#00b14f] font-bold underline">Chính sách bảo mật</span> của Organica.
                        </span>
                      </label>
                      {validationErrors.agreeToTerms && <p className="text-red-500 text-[12px] ml-1 mt-1 font-bold italic">{validationErrors.agreeToTerms}</p>}
                    </div>

                    <div className="pt-4">
                      {submitError && <p className="mb-4 text-center text-[13px] font-bold text-red-500">{submitError}</p>}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-5 bg-[#00b14f] hover:bg-[#009642] disabled:bg-green-300 text-white font-extrabold rounded-full transition-all shadow-xl shadow-green-200/50 text-[17px] active:scale-[0.98] disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Đang gửi...' : 'Hoàn tất đăng ký'}
                      </button>
                    </div>
                  </form>
                )}

                {!isLoggedIn && (
                  <div className="mt-8 text-center border-t border-gray-50 pt-6">
                    <span className="text-[14px] text-gray-500 font-medium">Bạn đã có tài khoản? </span>
                    <a href={buildLoginHref()} className="text-[14px] font-extrabold text-[#00b14f] hover:text-[#006a4e] transition-colors underline underline-offset-4 decoration-2">
                      Đăng nhập
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <AuthPageFooter />
    </div>
  );
}
