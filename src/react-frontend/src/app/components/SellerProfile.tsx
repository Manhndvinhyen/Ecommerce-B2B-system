import React, { useState } from 'react';
import { ProfileContent } from './ProfileContent';
import { GeneralInfo } from './GeneralInfo';
import { User, Building2, ShieldCheck, CreditCard } from 'lucide-react';

export function SellerProfile() {
  const [activeSubTab, setActiveSubTab] = useState<'account' | 'business'>('account');

  return (
    <div className="flex-1 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      {/* Profile Header Visual Card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-6 text-white mb-6 shadow-md">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <User size={200} />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="px-2.5 py-0.8 bg-white/20 text-white rounded-full text-[10px] font-black uppercase tracking-wider">
              B2B Merchant Partner
            </span>
            <h2 className="text-xl font-black tracking-tight">Hồ sơ đối tác người bán</h2>
            <p className="text-xs text-white/80 font-medium">
              Quản lý thông tin tài khoản cá nhân và cấu hình pháp lý doanh nghiệp sỉ của bạn trên Freso
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-white/10 text-white rounded-xl text-xs font-black flex items-center gap-1.5 border border-white/10">
              <ShieldCheck size={14} />
              <span>Đã xác minh</span>
            </span>
          </div>
        </div>
      </div>

      {/* Sub tabs navigation */}
      <div className="flex border-b border-gray-100 mb-6 gap-2">
        <button
          onClick={() => setActiveSubTab('account')}
          className={`pb-4 px-4 text-xs font-black flex items-center gap-2 transition-all relative ${
            activeSubTab === 'account'
              ? 'text-green-600'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <User size={15} />
          <span>Tài khoản người bán</span>
          {activeSubTab === 'account' && (
            <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-green-600 rounded-t-full" />
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('business')}
          className={`pb-4 px-4 text-xs font-black flex items-center gap-2 transition-all relative ${
            activeSubTab === 'business'
              ? 'text-green-600'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <Building2 size={15} />
          <span>Thông tin cửa hàng / Doanh nghiệp</span>
          {activeSubTab === 'business' && (
            <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-green-600 rounded-t-full" />
          )}
        </button>
      </div>

      {/* Merged Content render */}
      <div className="bg-transparent">
        {activeSubTab === 'account' ? (
          <div className="p-0 border-0 shadow-none">
            <ProfileContent />
          </div>
        ) : (
          <div className="p-0 border-0 shadow-none">
            <GeneralInfo />
          </div>
        )}
      </div>
    </div>
  );
}
