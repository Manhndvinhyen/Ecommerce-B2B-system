import React, { useMemo, useState } from 'react';

const readStorageValue = (key: string) =>
  window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || '';

const buildAuthToken = () => readStorageValue('freso_customer_token');

const isValidPhone = (value: string) => /^\s*(\+?84|0)\d{9,10}\s*$/.test(value.replace(/\s/g, ''));

export type CreateBranchManagerProps = {
  isSuperAdmin: boolean;
};

type FormState = {
  loginCode: string;
  branchName: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
};

const emptyForm: FormState = {
  loginCode: '',
  branchName: '',
  phoneNumber: '',
  password: '',
  confirmPassword: '',
};

export const CreateBranchManager = ({ isSuperAdmin }: CreateBranchManagerProps) => {
  const initialLoginCode = useMemo(() => readStorageValue('freso_login_code'), []);
  const [form, setForm] = useState<FormState>({
    ...emptyForm,
    loginCode: initialLoginCode,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
    if (submitError) {
      setSubmitError('');
    }
    if (submitSuccess) {
      setSubmitSuccess('');
    }
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.loginCode.trim()) {
      nextErrors.loginCode = 'Vui lòng nhập Mã đăng nhập.';
    }
    if (!form.branchName.trim()) {
      nextErrors.branchName = 'Vui lòng nhập Chi nhánh.';
    }
    if (!form.phoneNumber.trim()) {
      nextErrors.phoneNumber = 'Vui lòng nhập Số điện thoại.';
    } else if (!isValidPhone(form.phoneNumber)) {
      nextErrors.phoneNumber = 'Số điện thoại chưa hợp lệ.';
    }
    if (!form.password.trim()) {
      nextErrors.password = 'Vui lòng nhập Mật khẩu.';
    } else if (form.password.trim().length < 6) {
      nextErrors.password = 'Mật khẩu cần ít nhất 6 ký tự.';
    }
    if (form.confirmPassword.trim() !== form.password.trim()) {
      nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    const token = buildAuthToken();
    if (!token) {
      setSubmitError('Bạn cần đăng nhập để tạo quản lý chi nhánh.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch(`${window.location.origin}/rest/V1/tmdt-registration/addusers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payload: {
            loginCode: form.loginCode.trim(),
            branchName: form.branchName.trim(),
            phoneNumber: form.phoneNumber.trim(),
            password: form.password.trim(),
          },
        }),
      });

      const bodyText = await response.text().catch(() => '');
      let payload: { message?: string; success?: boolean } | null = null;
      if (bodyText.trim()) {
        try {
          payload = JSON.parse(bodyText) as { message?: string; success?: boolean };
        } catch {
          payload = null;
        }
      }

      if (!response.ok || payload?.success === false) {
        const message = payload?.message || bodyText || 'Không thể tạo tài khoản quản lý chi nhánh.';
        throw new Error(message);
      }

      setSubmitSuccess('Tạo tài khoản quản lý chi nhánh thành công.');
      setForm((prev) => ({
        ...emptyForm,
        loginCode: prev.loginCode,
      }));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Không thể tạo tài khoản quản lý chi nhánh.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex-1 bg-white p-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          Chỉ tài khoản chủ nhà hàng (Super Admin) mới có quyền tạo quản lý chi nhánh.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white p-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tighter">Tạo mới quản lý chi nhánh</h1>
        <p className="text-[13px] text-gray-500 mt-1">
          Tài khoản này đăng nhập bằng Mã nhà hàng + Số điện thoại + Mật khẩu.
        </p>
      </div>

      <hr className="border-gray-100 mb-6" />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="text-[13px] font-semibold text-gray-700">Mã đăng nhập (Mã nhà hàng)</label>
          <input
            value={form.loginCode}
            onChange={(event) => handleChange('loginCode', event.target.value)}
            className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors ${
              errors.loginCode ? 'border-rose-400 bg-rose-50' : 'border-gray-200 focus:border-green-500'
            }`}
            placeholder="VD: RST-0001"
          />
          {errors.loginCode && <p className="mt-1 text-xs text-rose-500">{errors.loginCode}</p>}
        </div>

        <div>
          <label className="text-[13px] font-semibold text-gray-700">Chi nhánh</label>
          <input
            value={form.branchName}
            onChange={(event) => handleChange('branchName', event.target.value)}
            className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors ${
              errors.branchName ? 'border-rose-400 bg-rose-50' : 'border-gray-200 focus:border-green-500'
            }`}
            placeholder="VD: Chi nhánh Quận 1"
          />
          {errors.branchName && <p className="mt-1 text-xs text-rose-500">{errors.branchName}</p>}
        </div>

        <div>
          <label className="text-[13px] font-semibold text-gray-700">Số điện thoại</label>
          <input
            value={form.phoneNumber}
            onChange={(event) => handleChange('phoneNumber', event.target.value)}
            className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors ${
              errors.phoneNumber ? 'border-rose-400 bg-rose-50' : 'border-gray-200 focus:border-green-500'
            }`}
            placeholder="VD: 090x xxx xxx"
          />
          {errors.phoneNumber && <p className="mt-1 text-xs text-rose-500">{errors.phoneNumber}</p>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-[13px] font-semibold text-gray-700">Mật khẩu</label>
            <input
              type="password"
              value={form.password}
              onChange={(event) => handleChange('password', event.target.value)}
              className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors ${
                errors.password ? 'border-rose-400 bg-rose-50' : 'border-gray-200 focus:border-green-500'
              }`}
            />
            {errors.password && <p className="mt-1 text-xs text-rose-500">{errors.password}</p>}
          </div>
          <div>
            <label className="text-[13px] font-semibold text-gray-700">Xác nhận mật khẩu</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => handleChange('confirmPassword', event.target.value)}
              className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors ${
                errors.confirmPassword ? 'border-rose-400 bg-rose-50' : 'border-gray-200 focus:border-green-500'
              }`}
            />
            {errors.confirmPassword && <p className="mt-1 text-xs text-rose-500">{errors.confirmPassword}</p>}
          </div>
        </div>

        {submitError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 text-sm">
            {submitError}
          </div>
        )}

        {submitSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm">
            {submitSuccess}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-full bg-[#00b14f] text-white text-sm font-bold hover:bg-[#009845] transition-colors disabled:opacity-60"
          >
            {isSubmitting ? 'Đang tạo...' : 'Tạo tài khoản'}
          </button>
        </div>
      </form>
    </div>
  );
};
