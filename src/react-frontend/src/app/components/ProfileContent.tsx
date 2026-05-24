import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';

type Profile = {
  name: string;
  phone: string;
  email: string;
  branch?: string;
  role?: string;
};

export const ProfileContent = () => {
  const readStorageValue = (key: string) =>
    window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || '';

  const writeStorageValue = (key: string, value: string) => {
    if (!value) return;
    window.localStorage.setItem(key, value);
    window.sessionStorage.setItem(key, value);
  };

  const getAuthToken = () => readStorageValue('freso_customer_token');

  const getStoredProfile = (): Profile => {
    const name = readStorageValue('freso_customer_name') || 'Khách hàng';
    const email = readStorageValue('freso_customer_email') || 'chua-cap-nhat@freso.vn';
    const branch = readStorageValue('freso_branch_name') || 'Chưa cập nhật';
    const phone = readStorageValue('freso_customer_phone') || '';
    return {
      name,
      phone,
      email,
      branch,
      role: 'Khách hàng',
    };
  };

  const [profile, setProfile] = useState<Profile>(() => getStoredProfile());

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Profile>(profile);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    const stored = getStoredProfile();
    setProfile(stored);
    setForm(stored);

    const token = getAuthToken();
    if (!token) return;

    const loadCustomerMe = async () => {
      const res = await fetch(`${window.location.origin}/rest/V1/customers/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => null);
      if (!data || typeof data !== 'object') return;

      // Xử lý bóc tách mảng nếu API trả về mảng dữ liệu
      let info: any = data;
      if (Array.isArray(data)) {
        if (data[0] === true && data[1] && typeof data[1] === 'object') {
          info = data[1];
        }
      }

      const email = typeof info.email === 'string' ? info.email : '';
      const firstname = typeof info.firstname === 'string' ? info.firstname : '';
      const lastname = typeof info.lastname === 'string' ? info.lastname : '';
      const name = [firstname, lastname].filter(Boolean).join(' ').trim() || typeof info.full_name === 'string' ? info.full_name : '';

      const phone = typeof info.phone_number === 'string' ? info.phone_number : typeof info.phone === 'string' ? info.phone : '';

      const customAttributes = Array.isArray(info.custom_attributes) ? info.custom_attributes : [];
      const unitNickname = customAttributes.find((attr) => attr?.attribute_code === 'tmdt_unit_nickname')?.value || info.unit_nickname;
      const branch = typeof unitNickname === 'string' && unitNickname.trim() ? unitNickname.trim() : '';

      setProfile((prev) => ({
        ...prev,
        name: name || prev.name,
        email: email || prev.email,
        branch: branch || prev.branch,
        phone: phone || prev.phone,
      }));
      setForm((prev) => ({
        ...prev,
        name: name || prev.name,
        email: email || prev.email,
        branch: branch || prev.branch,
        phone: phone || prev.phone,
      }));

      writeStorageValue('freso_customer_email', email);
      writeStorageValue('freso_customer_name', name);
      writeStorageValue('freso_branch_name', branch);
      writeStorageValue('freso_customer_phone', phone);
    };

    const loadRegistrationProfile = async () => {
      const res = await fetch(`${window.location.origin}/rest/V1/tmdt-registration/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        window.localStorage.removeItem('freso_customer_token');
        window.sessionStorage.removeItem('freso_customer_token');
        return;
      }

      const bodyText = await res.text().catch(() => '');
      let payload: Record<string, unknown> | unknown[] = {};
      if (bodyText.trim()) {
        try {
          payload = JSON.parse(bodyText) as Record<string, unknown> | unknown[];
        } catch {
          payload = {};
        }
      }

      let info: Record<string, unknown> = {};
      if (Array.isArray(payload)) {
        if (payload[0] === true && payload[1] && typeof payload[1] === 'object') {
          info = payload[1] as Record<string, unknown>;
        }
      } else if (payload && typeof payload === 'object') {
        info = (payload as { data?: Record<string, unknown> }).data || (payload as Record<string, unknown>);
      }

      const phone =
        typeof (info as { phone_number?: unknown }).phone_number === 'string'
          ? String((info as { phone_number?: unknown }).phone_number)
          : typeof (info as { phone?: unknown }).phone === 'string'
            ? String((info as { phone?: unknown }).phone)
            : '';

      if (!phone.trim()) return;

      setProfile((prev) => ({
        ...prev,
        phone: phone || prev.phone,
      }));
      setForm((prev) => ({
        ...prev,
        phone: phone || prev.phone,
      }));

      writeStorageValue('freso_customer_phone', phone);
    };

    Promise.allSettled([loadCustomerMe(), loadRegistrationProfile()]).catch((err) => {
      console.error('[ProfileContent] load profile failed', err);
    });
  }, []);

  function startEdit() {
    setForm(profile);
    setEditing(true);
  }

  async function saveProfile() {
    if (!form.email.trim()) {
      alert('Email không được để trống');
      return;
    }
    setSaving(true);
    try {
      const token = getAuthToken();
      if (token) {
        const response = await fetch(`${window.location.origin}/rest/V1/tmdt-registration/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            payload: {
              fullName: form.name.trim(),
              phoneNumber: form.phone.trim(),
              email: form.email.trim(),
              unitNickname: form.branch?.trim() || undefined,
            },
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          const message = payload?.message || 'Lỗi khi cập nhật thông tin';
          throw new Error(message);
        }
      }
      const nextProfile = {
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        branch: form.branch?.trim() || form.branch,
      };
      setProfile(nextProfile);
      writeStorageValue('freso_customer_email', nextProfile.email || '');
      writeStorageValue('freso_customer_name', nextProfile.name || '');
      writeStorageValue('freso_branch_name', nextProfile.branch || '');
      writeStorageValue('freso_customer_phone', nextProfile.phone || '');
      try {
        window.localStorage.setItem('freso_last_profile_update', String(Date.now()));
      } catch (_err) {
        // ignore
      }
      window.dispatchEvent(new CustomEvent('freso:profile-updated'));
      setEditing(false);
      alert('Cập nhật thông tin thành công');
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Lỗi khi cập nhật thông tin');
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setForm(profile);
    setEditing(false);
  }

  async function changePassword() {
    const token = getAuthToken();
    if (!token) {
      alert('Bạn cần đăng nhập để đổi mật khẩu');
      return;
    }
    if (pwNew !== pwConfirm) {
      alert('Mật khẩu mới không khớp');
      return;
    }
    if (!pwNew || pwNew.length < 6) {
      alert('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    setPwSaving(true);
    try {
      const response = await fetch(`${window.location.origin}/rest/V1/customers/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: pwCurrent,
          newPassword: pwNew,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload?.message || 'Lỗi khi đổi mật khẩu';
        throw new Error(message);
      }
      setShowPasswordModal(false);
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
      try {
        window.localStorage.removeItem('freso_customer_token');
        window.sessionStorage.removeItem('freso_customer_token');
        window.localStorage.setItem('freso_last_logout', String(Date.now()));
      } catch (_err) {
        // ignore
      }
      alert('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
      window.location.replace('/react/index.html?view=login');
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Lỗi khi đổi mật khẩu');
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="flex-1 bg-white p-8 overflow-y-auto">
      {/* Profile Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center border border-gray-50">
            <User size={32} className="text-gray-400" />
          </div>
          {editing ? (
            <input
              className="text-2xl font-bold text-gray-800 tracking-tighter border-b focus:outline-none"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          ) : (
            <h1 className="text-2xl font-bold text-gray-800 tracking-tighter">{profile.name}</h1>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="px-5 py-1.5 border border-[#00b14f] text-[#00b14f] rounded-full text-[13px] font-bold hover:bg-[#E9F8EF] transition-colors tracking-tight"
          >
            Đổi mật khẩu
          </button>

          {editing ? (
            <div className="flex gap-2">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="px-5 py-1.5 bg-[#00b14f] text-white rounded-full text-[13px] font-bold hover:bg-[#009845] transition-colors shadow-sm tracking-tight"
              >
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
              <button
                onClick={cancelEdit}
                className="px-5 py-1.5 border border-gray-200 text-gray-700 rounded-full text-[13px] font-medium hover:bg-gray-50 transition-colors tracking-tight"
              >
                Hủy
              </button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              className="px-6 py-1.5 bg-[#00b14f] text-white rounded-full text-[13px] font-bold hover:bg-[#009845] transition-colors shadow-sm tracking-tight"
            >
              Chỉnh sửa
            </button>
          )}
        </div>
      </div>

      <hr className="border-gray-100 mb-5" />

      {/* Thông tin chung */}
      <section className="mb-6">
        <h2 className="text-[17px] font-bold text-gray-800 mb-3 tracking-tight">Thông tin chung</h2>
        <div className="grid grid-cols-2 gap-y-3.5 gap-x-16">
          <div>
            <p className="text-[12.5px] text-black mb-0.5 font-light tracking-tight">Số điện thoại</p>
            {editing ? (
              <input
                className="text-[14.5px] font-bold text-gray-800 tracking-tight border-b focus:outline-none"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            ) : (
              <p className="text-[14.5px] font-bold text-gray-800 tracking-tight">{profile.phone}</p>
            )}
          </div>
          <div className="col-span-2">
            <p className="text-[12.5px] text-black mb-0.5 font-light tracking-tight">Email</p>
            {editing ? (
              <input
                className="text-[14.5px] font-bold text-gray-800 tracking-tight border-b w-full focus:outline-none"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            ) : (
              <p className="text-[14.5px] font-bold text-gray-800 tracking-tight">{profile.email}</p>
            )}
          </div>
        </div>
      </section>

      <hr className="border-gray-100 mb-6" />

      {/* Thông tin tài khoản */}
      <section>
        <h2 className="text-[17px] font-bold text-gray-800 mb-3 tracking-tight">Thông tin tài khoản</h2>
        <div className="grid grid-cols-2 gap-y-3.5 gap-x-16">
          <div>
            <p className="text-[12.5px] text-black mb-1.5 font-light tracking-tight">Chi nhánh trực thuộc</p>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-gray-800 rounded-full" />
              <p className="text-[14.5px] font-bold text-gray-800 tracking-tight">{profile.branch}</p>
            </div>
          </div>
          <div>
            <p className="text-[12.5px] text-black mb-1.5 font-light tracking-tight">Vai trò</p>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-gray-800 rounded-full" />
              <p className="text-[14.5px] font-bold text-gray-800 tracking-tight">{profile.role}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Đổi mật khẩu</h3>
            <div className="flex flex-col gap-3">
              <input
                type="password"
                placeholder="Mật khẩu hiện tại"
                className="border p-2.5 rounded-full focus:outline-none focus:border-[#00b14f]"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
              />
              <input
                type="password"
                placeholder="Mật khẩu mới"
                className="border p-2.5 rounded-full focus:outline-none focus:border-[#00b14f]"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
              />
              <input
                type="password"
                placeholder="Xác nhận mật khẩu mới"
                className="border p-2.5 rounded-full focus:outline-none focus:border-[#00b14f]"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 border rounded text-sm"
              >
                Hủy
              </button>
              <button
                onClick={changePassword}
                disabled={pwSaving}
                className="px-4 py-2 bg-[#00b14f] text-white rounded text-sm hover:bg-[#009845]"
              >
                {pwSaving ? 'Đang...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
