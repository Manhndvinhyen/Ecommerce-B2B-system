export const AUTH_STORAGE_KEYS = [
  'freso_customer_token',
  'freso_login_token',
  'freso_customer_email',
  'freso_customer_name',
  'freso_customer_phone',
  'freso_branch_name',
  'freso_login_code',
  'freso_role',
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
  }
) => {
  clearStoredAuthSession();

  persistAuthValue(primaryStorage, 'freso_customer_token', values.customerToken);
  persistAuthValue(primaryStorage, 'freso_login_token', values.loginToken);
  persistAuthValue(primaryStorage, 'freso_customer_email', values.email);
  persistAuthValue(primaryStorage, 'freso_customer_name', values.fullName);
  persistAuthValue(primaryStorage, 'freso_branch_name', values.branchName);

  // Keep the non-primary storage clean so "Ghi nho dang nhap" has predictable behavior.
  secondaryStorage.removeItem('freso_customer_token');
  secondaryStorage.removeItem('freso_login_token');
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
