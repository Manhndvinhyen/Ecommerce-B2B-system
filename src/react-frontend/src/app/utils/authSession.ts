export const AUTH_STORAGE_KEYS = [
  'freso_customer_token',
  'freso_login_token',
  'freso_customer_email',
  'freso_customer_name',
  'freso_customer_phone',
  'freso_branch_name',
  'freso_login_code',
  'freso_role',
  'freso_status',
  'freso_seller_access',
  'freso_is_owner',
  'freso_is_super_admin',
  'freso_customer_cart_id',
  'freso_customer_cart_token',
];

export const getStoredAuthToken = () =>
  window.localStorage.getItem('freso_customer_token') || window.sessionStorage.getItem('freso_customer_token') || '';

export const clearStoredAuthSession = (options: { broadcastLogout?: boolean } = {}) => {
  AUTH_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });

  if (options.broadcastLogout) {
    window.localStorage.setItem('freso_last_logout', String(Date.now()));
  }
};

export const persistAuthValue = (storage: Storage, key: string, value?: string) => {
  const normalized = value?.trim() ?? '';
  if (!normalized) return;
  storage.setItem(key, normalized);
};

export const persistAuthSession = (
  primaryStorage: Storage,
  secondaryStorage: Storage,
  values: {
    customerToken: string;
    loginToken?: string;
    email?: string;
    fullName?: string;
    branchName?: string;
    role?: string;
    status?: string;
    sellerAccess?: boolean;
    isOwner?: boolean;
    isSuperAdmin?: boolean;
  }
) => {
  clearStoredAuthSession();

  const sharedStorage = window.localStorage;
  const tabStorage = window.sessionStorage;

  persistAuthValue(sharedStorage, 'freso_customer_token', values.customerToken);
  persistAuthValue(sharedStorage, 'freso_login_token', values.loginToken);
  persistAuthValue(sharedStorage, 'freso_customer_email', values.email);
  persistAuthValue(sharedStorage, 'freso_customer_name', values.fullName);
  persistAuthValue(sharedStorage, 'freso_branch_name', values.branchName);
  persistAuthValue(sharedStorage, 'freso_role', values.role);
  persistAuthValue(sharedStorage, 'freso_status', values.status);
  sharedStorage.setItem('freso_seller_access', values.sellerAccess ? '1' : '0');
  sharedStorage.setItem('freso_is_owner', values.isOwner ? '1' : '0');
  sharedStorage.setItem('freso_is_super_admin', values.isSuperAdmin ? '1' : '0');

  AUTH_STORAGE_KEYS.forEach((key) => {
    const value = sharedStorage.getItem(key);
    if (value !== null) {
      tabStorage.setItem(key, value);
    }
  });

  console.info('[OrganicaAuth] Auth session persisted for browser-wide tabs', {
    tokenStored: Boolean(values.customerToken),
    storage: 'localStorage',
    legacyPrimaryStorage: primaryStorage === window.localStorage ? 'localStorage' : 'sessionStorage',
    legacySecondaryStorage: secondaryStorage === window.localStorage ? 'localStorage' : 'sessionStorage',
  });
};

export const revokeCurrentToken = async (token = getStoredAuthToken()) => {
  if (!token) return;

  await fetch(`${window.location.origin}/tmdt/registration/logout`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  }).catch(() => null);
};

export const buildLoggedOutUrl = () => {
  const params = new URLSearchParams(window.location.search);
  params.delete('view');
  params.delete('tab');
  params.delete('category');
  params.delete('subcategory');
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
};

export const logoutCurrentDevice = async (targetUrl = buildLoggedOutUrl()) => {
  const token = getStoredAuthToken();
  clearStoredAuthSession({ broadcastLogout: true });
  await revokeCurrentToken(token);
  window.location.href = targetUrl;
};
