import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  Eye,
  EyeOff,
  Store,
  User,
  UserCircle,
} from 'lucide-react';
import { AuthPageFooter } from './auth/AuthPageFooter';
import { AuthPageHeader } from './auth/AuthPageHeader';

declare const __FRESO_GOOGLE_CLIENT_ID__: string;

type LoginFormData = {
  restaurantCode: string;
  identifier: string;
  password: string;
  rememberMe: boolean;
};

type LoginApiResponse = {
  success: boolean;
  message: string;
  token: string;
  customer_id?: number;
  email?: string;
  full_name?: string;
  branch_name?: string;
  redirect_url?: string;
};

type SessionStartResponse = {
  success: boolean;
  message?: string;
  email?: string;
  full_name?: string;
  branch_name?: string;
  redirect_url?: string;
};

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (element: HTMLElement, options: Record<string, string>) => void;
};

type GoogleWindow = Window & {
  google?: {
    accounts?: {
      id?: GoogleAccountsId;
    };
  };
};

const parseLoginApiResponse = (rawData: unknown): LoginApiResponse | null => {
  if (Array.isArray(rawData)) {
    return {
      success: Boolean(rawData[0]),
      message: String(rawData[1] ?? ''),
      token: String(rawData[2] ?? ''),
      customer_id: typeof rawData[3] === 'number' ? rawData[3] : undefined,
      email: typeof rawData[4] === 'string' ? rawData[4] : undefined,
      full_name: typeof rawData[5] === 'string' ? rawData[5] : undefined,
      branch_name: typeof rawData[6] === 'string' ? rawData[6] : undefined,
      redirect_url: typeof rawData[7] === 'string' ? rawData[7] : undefined,
    };
  }

  if (!rawData || typeof rawData !== 'object') {
    return null;
  }

  const data = rawData as Partial<LoginApiResponse>;

  return {
    success: Boolean(data.success),
    message: String(data.message ?? ''),
    token: String(data.token ?? ''),
    customer_id: typeof data.customer_id === 'number' ? data.customer_id : undefined,
    email: typeof data.email === 'string' ? data.email : undefined,
    full_name: typeof data.full_name === 'string' ? data.full_name : undefined,
    branch_name: typeof data.branch_name === 'string' ? data.branch_name : undefined,
    redirect_url: typeof data.redirect_url === 'string' ? data.redirect_url : undefined,
  };
};

const defaultFormData: LoginFormData = {
  restaurantCode: '',
  identifier: '',
  password: '',
  rememberMe: false,
};

const syncAuthStorage = (key: string, value: string) => {
  if (!value) return;
  window.localStorage.setItem(key, value);
  window.sessionStorage.setItem(key, value);
};

const startCustomerSession = async (token: string, storage: Storage): Promise<string | null> => {
  if (!token) {
    return null;
  }

  const response = await fetch(`${window.location.origin}/tmdt/registration/session`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  const data = (await response.json().catch(() => null)) as SessionStartResponse | null;

  if (!response.ok || !data?.success) {
    return null;
  }

  const normalizedEmail = typeof data.email === 'string' ? data.email.trim() : '';
  const normalizedFullName = typeof data.full_name === 'string' ? data.full_name.trim() : '';
  const normalizedBranchName = typeof data.branch_name === 'string' ? data.branch_name.trim() : '';

  if (normalizedEmail) {
    storage.setItem('freso_customer_email', normalizedEmail);
  }

  if (normalizedFullName) {
    storage.setItem('freso_customer_name', normalizedFullName);
  }

  if (normalizedBranchName) {
    storage.setItem('freso_branch_name', normalizedBranchName);
  }

  const redirectUrl = typeof data.redirect_url === 'string' ? data.redirect_url.trim() : '';
  return redirectUrl || null;
};

const fetchMagentoCustomerToken = async (identifier: string, password: string): Promise<string | null> => {
  if (!identifier || !password) {
    return null;
  }

  try {
    const response = await fetch(`${window.location.origin}/rest/V1/integration/customer/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: identifier, password }),
    });

    if (!response.ok) {
      return null;
    }

    const token = await response.json().catch(() => null);
    return typeof token === 'string' ? token.trim() : null;
  } catch (_error) {
    return null;
  }
};

const verifyMagentoCustomerToken = async (token: string): Promise<boolean> => {
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${window.location.origin}/rest/V1/customers/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    return response.ok;
  } catch (_error) {
    return false;
  }
};

const persistAuthDebug = (payload: Record<string, unknown>) => {
  try {
    window.localStorage.setItem('freso_auth_debug', JSON.stringify({
      ...payload,
      timestamp: new Date().toISOString(),
    }));
  } catch (_error) {
    // ignore storage errors
  }
};

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<LoginFormData>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isGoogleButtonRendered, setIsGoogleButtonRendered] = useState(false);
  const [googleSignInError, setGoogleSignInError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const restaurantCodeRef = useRef<HTMLInputElement | null>(null);
  const googleClientIdFromEnv = ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_GOOGLE_CLIENT_ID ?? '').trim();
  const googleClientIdFromBuild = (typeof __FRESO_GOOGLE_CLIENT_ID__ === 'string' ? __FRESO_GOOGLE_CLIENT_ID__ : '').trim();
  const googleClientId = googleClientIdFromEnv || googleClientIdFromBuild;

  const getPostLoginRedirect = (rawRedirectUrl?: string): string => {
    if (rawRedirectUrl && rawRedirectUrl.trim()) {
      return rawRedirectUrl;
    }
    return '/react/index.html?view=dashboard';
  };

  const navigateHome = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete('view');
    params.delete('category');
    params.delete('subcategory');

    const query = params.toString();
    const target = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.location.href = target;
  };

  const buildRegisterHref = () => {
    const params = new URLSearchParams(window.location.search);
    params.set('view', 'register');
    params.delete('category');
    params.delete('subcategory');
    return `${window.location.pathname}?${params.toString()}`;
  };

  const buildForgotPasswordHref = () => {
    const params = new URLSearchParams(window.location.search);
    params.set('view', 'forgot-password');
    params.delete('category');
    params.delete('subcategory');
    return `${window.location.pathname}?${params.toString()}`;
  };

  const handleInputChange = <K extends keyof LoginFormData>(field: K, value: LoginFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (submitError) {
      setSubmitError('');
    }
  };

  const validate = (): boolean => {
    if (!formData.restaurantCode.trim()) {
      setSubmitError('Vui lòng nhập Mã nhà hàng.');
      return false;
    }

    if (!formData.identifier.trim()) {
      setSubmitError('Vui lòng nhập Email hoặc số điện thoại.');
      return false;
    }

    if (!formData.password.trim()) {
      setSubmitError('Vui lòng nhập Mật khẩu.');
      return false;
    }

    return true;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    fetch(`${window.location.origin}/rest/V1/tmdt-registration/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payload: formData }),
    })
      .then(async (response) => {
        const rawData = await response.json().catch(() => null);
        const data = parseLoginApiResponse(rawData);

        if (!response.ok || data?.success === false || !data?.token) {
          throw new Error(data?.message || 'Thông tin đăng nhập không hợp lệ.');
        }

        const primaryStorage = formData.rememberMe ? window.localStorage : window.sessionStorage;
        const secondaryStorage = formData.rememberMe ? window.sessionStorage : window.localStorage;
        const fallbackEmail = data.email || formData.identifier.trim();
        const magentoUsername = (data.email || formData.identifier).trim();
        const magentoToken = await fetchMagentoCustomerToken(magentoUsername, formData.password);
        if (!magentoToken) {
          persistAuthDebug({
            flow: 'password',
            hasCustomToken: Boolean(data.token),
            hasMagentoToken: false,
            isMagentoTokenValid: false,
            tokenStored: false,
            magentoUsername,
            error: 'missing_magento_token'
          });
          throw new Error('Không thể lấy token Magento từ /rest/V1/integration/customer/token.');
        }
        const customerToken = magentoToken;
        const isMagentoTokenValid = await verifyMagentoCustomerToken(customerToken);
        persistAuthDebug({
          flow: 'password',
          hasCustomToken: Boolean(data.token),
          hasMagentoToken: true,
          isMagentoTokenValid,
          tokenStored: Boolean(customerToken),
          tokenPreview: customerToken.slice(0, 8)
        });
        primaryStorage.setItem('freso_customer_token', customerToken);
        primaryStorage.setItem('freso_login_token', data.token);
        secondaryStorage.setItem('freso_customer_token', customerToken);
        primaryStorage.setItem('freso_customer_email', fallbackEmail);

        if (data.full_name?.trim()) {
          primaryStorage.setItem('freso_customer_name', data.full_name.trim());
        }

        if (data.branch_name?.trim()) {
          primaryStorage.setItem('freso_branch_name', data.branch_name.trim());
        }

    const sessionRedirect = await startCustomerSession(data.token, primaryStorage);
        window.location.href = sessionRedirect || getPostLoginRedirect(data.redirect_url);
      })
      .catch((error: unknown) => {
        setSubmitError(error instanceof Error ? error.message : 'Không thể đăng nhập vào hệ thống.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleGoogleCredential = (response: GoogleCredentialResponse) => {
    const idToken = response.credential?.trim() ?? '';

    if (!idToken) {
      setSubmitError('Không thể lấy thông tin đăng nhập từ Google.');
      return;
    }

    const restaurantCode = (formData.restaurantCode || restaurantCodeRef.current?.value || '').trim();
    if (!restaurantCode) {
      setSubmitError('Vui lòng nhập Mã nhà hàng trước khi đăng nhập Google.');
      return;
    }

    setIsGoogleSubmitting(true);
    setSubmitError('');

    fetch(`${window.location.origin}/rest/V1/tmdt-registration/google-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload: {
          restaurantCode,
          googleIdToken: idToken,
        },
      }),
    })
      .then(async (responseData) => {
        const rawData = await responseData.json().catch(() => null);
        const data = parseLoginApiResponse(rawData);

        if (!responseData.ok || data?.success === false || !data?.token) {
          throw new Error(data?.message || 'Đăng nhập Google không thành công.');
        }

        const primaryStorage = formData.rememberMe ? window.localStorage : window.sessionStorage;
        const secondaryStorage = formData.rememberMe ? window.sessionStorage : window.localStorage;
        const isMagentoTokenValid = await verifyMagentoCustomerToken(data.token);
        persistAuthDebug({
          flow: 'google',
          hasCustomToken: Boolean(data.token),
          hasMagentoToken: Boolean(data.token),
          isMagentoTokenValid,
          tokenStored: Boolean(data.token),
          tokenPreview: data.token.slice(0, 8)
        });
        primaryStorage.setItem('freso_customer_token', data.token);
        secondaryStorage.setItem('freso_customer_token', data.token);
        primaryStorage.setItem('freso_customer_email', data.email || '');

        if (data.full_name?.trim()) {
          primaryStorage.setItem('freso_customer_name', data.full_name.trim());
        }

        if (data.branch_name?.trim()) {
          primaryStorage.setItem('freso_branch_name', data.branch_name.trim());
        }

  const sessionRedirect = await startCustomerSession(data.token, primaryStorage);
        window.location.href = sessionRedirect || getPostLoginRedirect(data.redirect_url);
        const storage = formData.rememberMe ? window.localStorage : window.sessionStorage;
        syncAuthStorage('freso_customer_token', data.token);
        syncAuthStorage('freso_customer_email', data.email || '');

        if (data.full_name?.trim()) {
          syncAuthStorage('freso_customer_name', data.full_name.trim());
        }

        if (data.branch_name?.trim()) {
          syncAuthStorage('freso_branch_name', data.branch_name.trim());
        }

        void startCustomerSession(data.token, storage).catch(() => null);
        window.location.href = getPostLoginRedirect(data.redirect_url);
      })
      .catch((error: unknown) => {
        setSubmitError(error instanceof Error ? error.message : 'Không thể đăng nhập bằng Google.');
      })
      .finally(() => {
        setIsGoogleSubmitting(false);
      });
  };

  useEffect(() => {
    setIsGoogleButtonRendered(false);
    setGoogleSignInError('');

    if (!googleClientId || !googleButtonRef.current) {
      return;
    }

    const renderTimeoutId = window.setTimeout(() => {
      setGoogleSignInError(
        `Google Sign-In chưa được cấp quyền cho domain hiện tại (${window.location.origin}). Vui lòng thêm origin này vào Authorized JavaScript origins trong Google Cloud Console.`,
      );
    }, 5000);

    const windowRef = window as GoogleWindow;
    const mountGoogleButton = () => {
      const googleId = windowRef.google?.accounts?.id;
      if (!googleId || !googleButtonRef.current) {
        return;
      }

      googleId.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      googleButtonRef.current.innerHTML = '';
      googleId.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: '360',
      });
      window.clearTimeout(renderTimeoutId);
      setIsGoogleButtonRendered(true);
    };

    if (windowRef.google?.accounts?.id) {
      mountGoogleButton();
      return;
    }

    const scriptId = 'google-identity-services-sdk';
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', mountGoogleButton);
      return () => {
        existingScript.removeEventListener('load', mountGoogleButton);
      };
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', mountGoogleButton);
    script.addEventListener('error', () => {
      window.clearTimeout(renderTimeoutId);
      setGoogleSignInError('Không thể tải Google Sign-In. Vui lòng kiểm tra mạng hoặc CSP.');
      setSubmitError('Không thể tải Google Sign-In. Vui lòng thử lại sau.');
    });
    document.head.appendChild(script);

    return () => {
      window.clearTimeout(renderTimeoutId);
      script.removeEventListener('load', mountGoogleButton);
    };
  }, [googleClientId]);

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

            <h1 className="text-[28px] lg:text-[36px] font-extrabold text-[#004d39] leading-[1.2] mb-6 tracking-tight">Đăng nhập</h1>
            <p className="text-[#006a4e]/70 text-[15px] lg:text-[17px] mb-12 font-medium leading-relaxed italic">
              Vui lòng đăng nhập bằng tài khoản đã đăng ký để quản lý hoạt động mua hàng doanh nghiệp.
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
                    <UserCircle size={20} className="text-[#00b14f]" />
                    Tài khoản đăng nhập
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-5">
                    <div className="space-y-1 group">
                      <label className="text-[12px] font-bold text-gray-500 ml-1 uppercase tracking-wide">Mã nhà hàng</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="VD: freso_shop01"
                          value={formData.restaurantCode}
                          onChange={(event) => handleInputChange('restaurantCode', event.target.value)}
                          ref={restaurantCodeRef}
                          className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:border-[#00b14f] focus:ring-4 focus:ring-green-50 outline-none transition-all text-[15px] font-medium placeholder:text-gray-400"
                        />
                        <Store className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      </div>
                    </div>

                    <div className="space-y-1 group">
                      <label className="text-[12px] font-bold text-gray-500 ml-1 uppercase tracking-wide">Email hoặc số điện thoại</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Nhập email hoặc số điện thoại"
                          value={formData.identifier}
                          onChange={(event) => handleInputChange('identifier', event.target.value)}
                          className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:border-[#00b14f] focus:ring-4 focus:ring-green-50 outline-none transition-all text-[15px] font-medium placeholder:text-gray-400"
                        />
                        <User className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      </div>
                    </div>

                    <div className="space-y-1 group">
                      <label className="text-[12px] font-bold text-gray-500 ml-1 uppercase tracking-wide">Mật khẩu</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Nhập mật khẩu"
                          value={formData.password}
                          onChange={(event) => handleInputChange('password', event.target.value)}
                          className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:border-[#00b14f] focus:ring-4 focus:ring-green-50 outline-none transition-all text-[15px] font-medium placeholder:text-gray-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.rememberMe}
                        onChange={(event) => handleInputChange('rememberMe', event.target.checked)}
                        className="mt-1 size-5 rounded border-gray-300 text-[#00b14f] focus:ring-[#00b14f] cursor-pointer"
                      />
                      <span className="text-[13px] text-gray-600 font-medium leading-relaxed">Ghi nhớ đăng nhập</span>
                    </label>
                    <a href={buildForgotPasswordHref()} className="text-[13px] font-extrabold text-[#00b14f] hover:text-[#006a4e] transition-colors underline underline-offset-4 decoration-2">
                      Quên mật khẩu?
                    </a>
                  </div>

                  {submitError && <p className="text-[13px] font-bold text-red-500 text-center">{submitError}</p>}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || isGoogleSubmitting}
                      className="group w-full py-5 bg-[#00b14f] hover:bg-[#009642] disabled:bg-green-300 text-white font-extrabold rounded-full transition-all shadow-xl shadow-green-200/50 text-[17px] active:scale-[0.98] disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
                      {!isSubmitting && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                    </button>
                  </div>

                  {googleClientId && (
                    <>
                      <div className="relative py-1">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-gray-100" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-white px-4 text-[12px] font-semibold text-gray-400 uppercase tracking-wide">Hoặc</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="w-full flex justify-center" ref={googleButtonRef} />
                        {!isGoogleButtonRendered && !googleSignInError && (
                          <button
                            type="button"
                            disabled
                            className="w-full py-3 rounded-full border border-gray-200 bg-gray-50 text-gray-500 text-[14px] font-semibold"
                          >
                            Đang tải đăng nhập Google...
                          </button>
                        )}
                        {googleSignInError && <p className="text-[12px] text-center text-amber-700 font-medium">{googleSignInError}</p>}
                        {isGoogleSubmitting && <p className="text-[12px] text-center text-gray-500 font-medium">Đang xác thực tài khoản Google...</p>}
                      </div>
                    </>
                  )}
                </form>

                <div className="mt-8 text-center border-t border-gray-50 pt-6">
                  <span className="text-[14px] text-gray-500 font-medium">Bạn chưa có tài khoản? </span>
                  <a href={buildRegisterHref()} className="text-[14px] font-extrabold text-[#00b14f] hover:text-[#006a4e] transition-colors underline underline-offset-4 decoration-2">
                    Đăng ký ngay
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
