import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, FileBadge } from 'lucide-react';

const readStorageValue = (key: string) =>
  window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || '';

const writeStorageValue = (key: string, value: string) => {
  if (!value) return;
  window.localStorage.setItem(key, value);
  window.sessionStorage.setItem(key, value);
};

type GeneralInfoData = {
  displayName: string;
  loginCode: string;
  taxCode: string;
  registrationType: string;
  businessName: string;
  address: string;
  statusLabel: string;
  licenseName: string;
  licenseUrl?: string;
};

type MagentoCustomAttribute = {
  attribute_code?: string;
  value?: unknown;
};

const readCustomAttribute = (customAttributes: MagentoCustomAttribute[], code: string): string => {
  const value = customAttributes.find((attr) => attr?.attribute_code === code)?.value;
  return typeof value === 'string' ? value : value != null ? String(value) : '';
};

const buildMagentoCustomerAddress = (addresses: unknown): string => {
  if (!Array.isArray(addresses) || !addresses.length) return '---';
  const first = addresses[0] as Record<string, unknown>;
  const streetRaw = first.street;
  const street = Array.isArray(streetRaw)
    ? streetRaw.map((s) => String(s || '').trim()).filter(Boolean).join(' ')
    : String(streetRaw || '').trim();
  const city = String(first.city || '').trim();
  const region = (first.region as Record<string, unknown> | undefined)?.region;
  const regionText = String(region || '').trim();
  const postcode = String(first.postcode || '').trim();
  const country = String(first.country_id || '').trim();
  const parts = [street, city, regionText, postcode, country].filter(Boolean);
  return parts.length ? parts.join(', ') : '---';
};

const getStatusLabel = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (!normalized) return 'Đang hoạt động';
  if (normalized === 'approved') return 'Đang hoạt động';
  if (normalized === 'pending') return 'Chờ duyệt';
  if (normalized === 'rejected') return 'Từ chối';
  return status;
};

const getRegistrationTypeLabel = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '---';
  if (normalized === 'company') return 'Công ty';
  if (normalized === 'business') return 'Hộ kinh doanh';
  if (normalized === 'cooperative') return 'Hợp tác xã';
  return value;
};

const mapLocationLabel = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'hanoi') return 'Hà Nội';
  if (normalized === 'hcm') return 'TP. Hồ Chí Minh';
  if (normalized === 'ward-1') return 'Phường 1';
  if (normalized === 'ward-2') return 'Phường 2';
  return value;
};

const buildAddress = (detail: string, ward: string, district: string, province: string) => {
  const parts = [detail, ward, district, province]
    .map((part) => mapLocationLabel(part))
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : '---';
};

const safeValue = (value: string, fallback = '---') => (value.trim() ? value : fallback);

export const GeneralInfo = () => {
  const [data, setData] = useState<GeneralInfoData>(() => ({
    displayName: readStorageValue('freso_branch_name') || 'Chưa cập nhật',
    loginCode: readStorageValue('freso_login_code') || '---',
    taxCode: readStorageValue('freso_tax_code') || '---',
    registrationType: readStorageValue('freso_registration_type') || 'Doanh nghiệp/Tổ chức',
    businessName: readStorageValue('freso_business_name') || '---',
    address: readStorageValue('freso_business_address') || '---',
    statusLabel: readStorageValue('freso_status_label') || 'Đang hoạt động',
    licenseName: readStorageValue('freso_license_name') || 'Chưa có file',
    licenseUrl: readStorageValue('freso_license_url') || '',
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadCustomerMe = async (token: string): Promise<GeneralInfoData> => {
    const res = await fetch(`${window.location.origin}/rest/V1/customers/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      window.localStorage.removeItem('freso_customer_token');
      window.sessionStorage.removeItem('freso_customer_token');
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || !payload || typeof payload !== 'object') {
      const message = (payload as { message?: string })?.message;
      throw new Error(message || 'Không thể tải thông tin doanh nghiệp.');
    }

    const customAttributes = Array.isArray(payload.custom_attributes)
      ? (payload.custom_attributes as MagentoCustomAttribute[])
      : [];
    const displayName = readCustomAttribute(customAttributes, 'tmdt_unit_nickname');
    const loginCode = readCustomAttribute(customAttributes, 'tmdt_login_code');
    const registrationType = readCustomAttribute(customAttributes, 'tmdt_registration_type');
    const businessName = readCustomAttribute(customAttributes, 'tmdt_business_name');
    const taxvat = String(payload.taxvat || '').trim();
    const address = buildMagentoCustomerAddress(payload.addresses);

    return {
      displayName: safeValue(displayName || data.displayName || ''),
      loginCode: safeValue(loginCode || data.loginCode || ''),
      taxCode: safeValue(taxvat || data.taxCode || ''),
      registrationType: getRegistrationTypeLabel(registrationType || data.registrationType || ''),
      businessName: safeValue(businessName || data.businessName || ''),
      address: safeValue(address || data.address || ''),
      statusLabel: safeValue(data.statusLabel || 'Đang hoạt động', 'Đang hoạt động'),
      licenseName: safeValue(data.licenseName || 'Chưa có file', 'Chưa có file'),
      licenseUrl: data.licenseUrl || '',
    };
  };

  const loadProfile = async () => {
    const token = readStorageValue('freso_customer_token');
    if (!token) {
      setIsLoading(false);
      setErrorMessage('Bạn cần đăng nhập để xem thông tin doanh nghiệp.');
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${window.location.origin}/rest/V1/tmdt-registration/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      const bodyText = await res.text().catch(() => '');
      let payload: Record<string, unknown> = {};
      if (bodyText.trim()) {
        try {
          payload = JSON.parse(bodyText) as Record<string, unknown>;
        } catch {
          payload = {};
        }
      }

      //  ĐOẠN CODE MỚI (Thay thế vào vị trí trên):
      if (res.status === 401) {
        window.localStorage.removeItem('freso_customer_token');
        window.sessionStorage.removeItem('freso_customer_token');
        throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      }

      if (!res.ok) {
        const payloadMessage = (payload as { message?: string })?.message;
        throw new Error(payloadMessage || 'Không thể tải thông tin doanh nghiệp.');
      }

      // Xử lý bóc tách mảng [true, { profile_info }] từ API response
      let info: Record<string, unknown> = {};
      if (Array.isArray(payload)) {
        if (payload[0] === true && payload[1] && typeof payload[1] === 'object') {
          info = payload[1] as Record<string, unknown>;
        }
      } else if (payload && typeof payload === 'object') {
        info = (payload as { data?: Record<string, unknown> }).data || (payload as Record<string, unknown>);
      }

      // Lấy thông tin địa chỉ thô từ API hoặc dùng hàm buildAddress kết hợp tỉnh thành
      const addressText = String((info as { address_text?: string }).address_text || '').trim();
      const fallbackAddress = buildAddress(
        String((info as { detail_address?: string }).detail_address || ''),
        String((info as { ward?: string }).ward || ''),
        String((info as { district?: string }).district || ''),
        String((info as { province?: string }).province || ''),
      );
      const nextData: GeneralInfoData = {
        displayName: safeValue(String((info as { unit_nickname?: string }).unit_nickname || data.displayName || '')),
        loginCode: safeValue(String((info as { login_code?: string }).login_code || data.loginCode || '')),
        taxCode: safeValue(String((info as { tax_code?: string }).tax_code || data.taxCode || '')),
        registrationType: getRegistrationTypeLabel(
          String((info as { registration_type?: string }).registration_type || data.registrationType || ''),
        ),
        businessName: safeValue(String((info as { business_name?: string }).business_name || data.businessName || '')),
        address: safeValue(addressText || data.address || fallbackAddress),
        statusLabel: getStatusLabel(String((info as { status?: string }).status || data.statusLabel || '')),
        licenseName: safeValue(String((info as { license_name?: string }).license_name || data.licenseName || ''), 'Chưa có file'),
        licenseUrl: (() => {
          const files = Array.isArray((info as { files?: unknown }).files) ? ((info as { files?: unknown }).files as unknown[]) : [];
          const first = files[0] as Record<string, unknown> | undefined;
          const url = first && typeof first.url === 'string' ? first.url : '';
          return url.trim();
        })(),
      };

      setData(nextData);

      writeStorageValue('freso_branch_name', nextData.displayName);
      writeStorageValue('freso_login_code', nextData.loginCode);
      writeStorageValue('freso_tax_code', nextData.taxCode);
      writeStorageValue('freso_registration_type', nextData.registrationType);
      writeStorageValue('freso_business_name', nextData.businessName);
      writeStorageValue('freso_business_address', nextData.address);
      writeStorageValue('freso_status_label', nextData.statusLabel);
      writeStorageValue('freso_license_name', nextData.licenseName);
      writeStorageValue('freso_license_url', nextData.licenseUrl || '');
    } catch (err) {
      console.error('[GeneralInfo] load profile failed', err);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setErrorMessage('Không thể kết nối tới máy chủ. Vui lòng thử lại.');
      } else {
        try {
          const fallbackData = await loadCustomerMe(token);
          setData(fallbackData);
          setErrorMessage('');

          writeStorageValue('freso_branch_name', fallbackData.displayName);
          writeStorageValue('freso_login_code', fallbackData.loginCode);
          writeStorageValue('freso_tax_code', fallbackData.taxCode);
          writeStorageValue('freso_registration_type', fallbackData.registrationType);
          writeStorageValue('freso_business_name', fallbackData.businessName);
          writeStorageValue('freso_business_address', fallbackData.address);
          writeStorageValue('freso_status_label', fallbackData.statusLabel);
          writeStorageValue('freso_license_name', fallbackData.licenseName);
          writeStorageValue('freso_license_url', fallbackData.licenseUrl || '');
        } catch (fallbackErr) {
          setErrorMessage(
            fallbackErr instanceof Error
              ? fallbackErr.message
              : err instanceof Error
                ? err.message
                : 'Không thể tải thông tin doanh nghiệp.',
          );
        }
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();

    const handleSync = (ev?: StorageEvent | null) => {
      if (!ev || ev.key === 'freso_last_profile_update' || ev.key === 'freso_customer_token') {
        loadProfile();
      }
    };

    const handleProfileUpdated = () => handleSync(null);

    window.addEventListener('storage', handleSync);
    window.addEventListener('freso:profile-updated', handleProfileUpdated as EventListener);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('freso:profile-updated', handleProfileUpdated as EventListener);
    };
  }, []);

  const statusTone = data.statusLabel.toLowerCase().includes('chờ')
    ? 'bg-amber-50 text-amber-700'
    : data.statusLabel.toLowerCase().includes('từ chối')
      ? 'bg-rose-50 text-rose-600'
      : 'bg-[#E9F8EF] text-[#00b14f]';

  const canOpenLicense = Boolean(data.licenseUrl && data.licenseName && data.licenseName !== 'Chưa có file');

  return (
    <div className="flex-1 bg-white p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center border border-gray-50">
            <ImageIcon size={28} className="text-gray-400" />
          </div>
          <div>
            <p className="text-[12.5px] text-black mb-0.5 font-light tracking-tight">Tên gợi nhớ</p>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tighter">{data.displayName}</h1>
          </div>
        </div>
      </div>

      <hr className="border-gray-100 mb-5" />

      {errorMessage && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          {errorMessage}
        </div>
      )}

      <section className="mb-6">
        <h2 className="text-[17px] font-bold text-gray-800 mb-3 tracking-tight">Thông tin chung</h2>
        <div className="grid grid-cols-2 gap-y-3.5 gap-x-16">
          <div>
            <p className="text-[12.5px] text-black mb-0.5 font-light tracking-tight">Mã đăng nhập</p>
            <p className="text-[15px] font-bold text-gray-800 tracking-tight">{data.loginCode}</p>
          </div>
          <div>
            <p className="text-[12.5px] text-black mb-0.5 font-light tracking-tight">Mã số thuế</p>
            <p className="text-[15px] font-bold text-gray-800 tracking-tight">{data.taxCode}</p>
          </div>
          <div>
            <p className="text-[12.5px] text-black mb-0.5 font-light tracking-tight">Đối tượng đăng ký</p>
            <p className="text-[15px] font-bold text-gray-800 tracking-tight">{data.registrationType}</p>
          </div>
          <div>
            <p className="text-[12.5px] text-black mb-0.5 font-light tracking-tight">Tên trên giấy phép kinh doanh</p>
            <p className="text-[15px] font-bold text-gray-800 tracking-tight">{data.businessName}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[12.5px] text-black mb-0.5 font-light tracking-tight">Địa chỉ</p>
            <p className="text-[15px] font-bold text-gray-800 tracking-tight leading-snug">{data.address}</p>
          </div>
          <div>
            <p className="text-[12.5px] text-black mb-1.5 font-light tracking-tight">Trạng thái</p>
            <span className={`inline-flex items-center px-3 py-1 text-[12.5px] font-bold rounded-md tracking-tight ${statusTone}`}>
              {isLoading ? 'Đang tải...' : data.statusLabel}
            </span>
          </div>
        </div>
      </section>

      <hr className="border-gray-100 mb-6" />

      <section>
        <h2 className="text-[17px] font-bold text-gray-800 mb-3 tracking-tight">Giấy phép kinh doanh</h2>
        <p className="text-[11.5px] text-black font-light tracking-tight mb-4">
          Hỗ trợ định dạng: JPG, PNG, JPEG, HEIF, HEIC, PDF - Dung lượng tối đa: 5MB
        </p>

        <button
          type="button"
          disabled={!canOpenLicense}
          onClick={() => {
            if (!canOpenLicense) return;
            window.open(data.licenseUrl, '_blank', 'noopener,noreferrer');
          }}
          className={`flex items-center gap-3 px-3 py-2 bg-[#F8F9FA] border border-gray-200 rounded-lg transition-all group max-w-fit ${
            canOpenLicense ? 'hover:bg-gray-50' : 'opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="w-7 h-7 bg-white rounded flex items-center justify-center text-[#00b14f] border border-gray-100 shadow-sm">
            <FileBadge size={16} />
          </div>
          <span className="text-[13px] font-bold text-gray-600 group-hover:text-[#00b14f] tracking-tight">
            {data.licenseName || 'Chưa có file'}
          </span>
        </button>
      </section>
    </div>
  );
};
