import React, { useState } from 'react';
import { User } from 'lucide-react';

type Profile = {
  name: string;
  phone: string;
  email: string;
  birthdate?: string | null;
  branch?: string;
  role?: string;
};

export const ProfileContent = () => {
  const [profile, setProfile] = useState<Profile>({
    name: 'Mai',
    phone: '0389960144',
    email: 'abcd@gmail.com',
    birthdate: null,
    branch: 'Chi nhánh 1',
    role: 'Chủ sở hữu',
  });

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Profile>(profile);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  function startEdit() {
    setForm(profile);
    setEditing(true);
  }

  async function saveProfile() {
    setSaving(true);
    try {
      // Try to send to backend; endpoint may vary in your setup
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setProfile(form);
      setEditing(false);
      alert('Cập nhật thông tin thành công');
    } catch (err) {
      console.error(err);
      alert('Lỗi khi cập nhật thông tin');
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setForm(profile);
    setEditing(false);
  }

  async function changePassword() {
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
      await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: pwCurrent, password: pwNew }),
      });
      setShowPasswordModal(false);
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
      alert('Đổi mật khẩu thành công');
    } catch (err) {
      console.error(err);
      alert('Lỗi khi đổi mật khẩu');
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
          <div>
            <p className="text-[12.5px] text-black mb-0.5 font-light tracking-tight">Ngày sinh</p>
            {editing ? (
              <input
                type="date"
                className="text-[14.5px] font-normal text-black tracking-tight border-b focus:outline-none"
                value={form.birthdate || ''}
                onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
              />
            ) : (
              <p className="text-[14.5px] font-normal text-black tracking-tight">{profile.birthdate || '-'}</p>
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
                placeholder="  Mật khẩu hiện tại"
                className="border p-2.5 rounded-full focus:outline-none focus:border-[#00b14f]" // Bo tròn ô input                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
              />
              <input
                type="password"
                placeholder="  Mật khẩu mới"
                className="border p-2.5 rounded-full focus:outline-none focus:border-[#00b14f]" // Bo tròn ô input                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
              />
              <input
                type="password"
                placeholder="  Xác nhận mật khẩu mới"
                className="border p-2.5 rounded-full focus:outline-none focus:border-[#00b14f]" // Bo tròn ô input                value={pwNew}
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
