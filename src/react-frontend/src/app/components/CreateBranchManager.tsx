import React, { useState } from 'react';

const readStorageValue = (key: string) =>
  window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || '';

const buildAuthToken = () => readStorageValue('freso_customer_token');

const isValidPhone = (value: string) => /^\s*(\+?84|0)\d{9,10}\s*$/.test(value.replace(/\s/g, ''));
const isValidEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

export type CreateBranchManagerProps = {
  isSuperAdmin: boolean;
  compact?: boolean;
  onCreated?: () => void;
};

type FormState = {
  branchName: string;
  phoneNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const emptyForm: FormState = {
  branchName: '',
  phoneNumber: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export const CreateBranchManager = ({ isSuperAdmin, compact = false, onCreated }: CreateBranchManagerProps) => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (submitError) setSubmitError('');
    if (submitSuccess) setSubmitSuccess('');
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.branchName.trim()) {
      nextErrors.branchName = 'Vui long nhap ten co so.';
    }
    if (!form.phoneNumber.trim()) {
      nextErrors.phoneNumber = 'Vui long nhap so dien thoai.';
    } else if (!isValidPhone(form.phoneNumber)) {
      nextErrors.phoneNumber = 'So dien thoai chua hop le.';
    }
    if (!form.email.trim()) {
      nextErrors.email = 'Vui long nhap email.';
    } else if (!isValidEmail(form.email)) {
      nextErrors.email = 'Email chua hop le.';
    }
    if (!form.password.trim()) {
      nextErrors.password = 'Vui long nhap mat khau.';
    } else if (form.password.trim().length < 6) {
      nextErrors.password = 'Mat khau can it nhat 6 ky tu.';
    }
    if (form.confirmPassword.trim() !== form.password.trim()) {
      nextErrors.confirmPassword = 'Mat khau xac nhan khong khop.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    const token = buildAuthToken();
    if (!token) {
      setSubmitError('Ban can dang nhap de tao tai khoan co so.');
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
            branchName: form.branchName.trim(),
            phoneNumber: form.phoneNumber.trim(),
            email: form.email.trim(),
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
        throw new Error(payload?.message || bodyText || 'Khong the tao tai khoan co so.');
      }

      setSubmitSuccess('Tao tai khoan co so thanh cong.');
      setForm(emptyForm);
      onCreated?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Khong the tao tai khoan co so.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className={compact ? 'bg-white' : 'flex-1 bg-white p-8'}>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Chi tai khoan chu so huu moi co quyen tao co so.
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? 'bg-white' : 'flex-1 bg-white p-8'}>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tighter text-gray-800">Tao moi co so</h1>
        <p className="mt-1 text-[13px] text-gray-500">
          Tai khoan co so dang nhap bang ma nha hang, email hoac so dien thoai va mat khau.
        </p>
      </div>

      <hr className="mb-6 border-gray-100" />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="text-[13px] font-semibold text-gray-700">Ten co so</label>
          <input
            value={form.branchName}
            onChange={(event) => handleChange('branchName', event.target.value)}
            className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors ${
              errors.branchName ? 'border-rose-400 bg-rose-50' : 'border-gray-200 focus:border-green-500'
            }`}
            placeholder="VD: Co so Quan 1"
          />
          {errors.branchName && <p className="mt-1 text-xs text-rose-500">{errors.branchName}</p>}
        </div>

        <div>
          <label className="text-[13px] font-semibold text-gray-700">So dien thoai</label>
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

        <div>
          <label className="text-[13px] font-semibold text-gray-700">Email</label>
          <input
            value={form.email}
            onChange={(event) => handleChange('email', event.target.value)}
            className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors ${
              errors.email ? 'border-rose-400 bg-rose-50' : 'border-gray-200 focus:border-green-500'
            }`}
            placeholder="VD: coso@company.com"
          />
          {errors.email && <p className="mt-1 text-xs text-rose-500">{errors.email}</p>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-[13px] font-semibold text-gray-700">Mat khau</label>
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
            <label className="text-[13px] font-semibold text-gray-700">Xac nhan mat khau</label>
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
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {submitError}
          </div>
        )}

        {submitSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {submitSuccess}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-[#00b14f] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#009845] disabled:opacity-60"
          >
            {isSubmitting ? 'Dang tao...' : 'Tao tai khoan'}
          </button>
        </div>
      </form>
    </div>
  );
};
