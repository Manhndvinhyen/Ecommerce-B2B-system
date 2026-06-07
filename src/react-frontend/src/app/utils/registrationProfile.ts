export type RegistrationProfilePayload = Record<string, unknown>;

const PROFILE_FIELDS = [
  'customer_id',
  'email',
  'full_name',
  'phone_number',
  'login_code',
  'tax_code',
  'business_name',
  'registration_type',
  'unit_nickname',
  'province',
  'district',
  'ward',
  'detail_address',
  'address_text',
  'status',
  'notes',
  'files',
  'license_name',
  'is_owner',
  'is_super_admin',
  'seller_access',
  'role',
] as const;

export const parseRegistrationBoolFlag = (value: unknown) =>
  value === true || value === 1 || value === '1' || String(value).trim().toLowerCase() === 'true';

const hasProfileKeys = (value: RegistrationProfilePayload) =>
  'role' in value ||
  'status' in value ||
  'seller_access' in value ||
  'is_owner' in value ||
  'unit_nickname' in value ||
  'customer_id' in value;

const mapProfileArray = (value: unknown[]): RegistrationProfilePayload => {
  const mapped: RegistrationProfilePayload = {};
  PROFILE_FIELDS.forEach((field, index) => {
    if (index in value) {
      mapped[field] = value[index];
    }
  });
  return mapped;
};

export const parseRegistrationProfilePayload = (payload: unknown): RegistrationProfilePayload => {
  if (!payload) {
    return {};
  }

  if (Array.isArray(payload)) {
    const mapped = payload.length >= PROFILE_FIELDS.length / 2 ? mapProfileArray(payload) : {};
    const nested = payload.reduce<RegistrationProfilePayload>((acc, item) => {
      const parsed = parseRegistrationProfilePayload(item);
      return hasProfileKeys(parsed) ? { ...acc, ...parsed } : acc;
    }, {});
    return { ...mapped, ...nested };
  }

  if (typeof payload !== 'object') {
    return {};
  }

  const objectPayload = payload as RegistrationProfilePayload;
  const data = objectPayload.data;
  if (data && typeof data === 'object') {
    return parseRegistrationProfilePayload(data);
  }

  if (hasProfileKeys(objectPayload)) {
    return objectPayload;
  }

  const numericValues = Object.keys(objectPayload)
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => objectPayload[key]);

  if (numericValues.length > 0) {
    return parseRegistrationProfilePayload(numericValues);
  }

  return objectPayload;
};
