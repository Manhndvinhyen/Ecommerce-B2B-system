const SITE_ORIGIN = 'https://organica.click';
const SITE_NAME = 'Organica';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/react/og-image.jpg`;

type MetaSelector = {
  name?: string;
  property?: string;
};

type SeoConfig = {
  title: string;
  description: string;
  canonicalPath?: string;
  image?: string;
  robots?: string;
  structuredData?: unknown;
};

const toAbsoluteUrl = (pathOrUrl: string) => {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return `${SITE_ORIGIN}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
};

const upsertMeta = (selector: MetaSelector, content: string) => {
  const selectorText = selector.name
    ? `meta[name="${selector.name}"]`
    : `meta[property="${selector.property}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selectorText);

  if (!element) {
    element = document.createElement('meta');
    if (selector.name) {
      element.setAttribute('name', selector.name);
    } else if (selector.property) {
      element.setAttribute('property', selector.property);
    }
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
};

const upsertCanonical = (href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }

  element.setAttribute('href', href);
};

const upsertStructuredData = (data: unknown) => {
  const id = 'route-seo-jsonld';
  let element = document.getElementById(id) as HTMLScriptElement | null;

  if (!element) {
    element = document.createElement('script');
    element.id = id;
    element.type = 'application/ld+json';
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(data);
};

const removeRouteStructuredData = () => {
  document.getElementById('route-seo-jsonld')?.remove();
};

export const buildCanonicalPath = (params: URLSearchParams) => {
  const canonicalParams = new URLSearchParams();
  const view = params.get('view');

  if (view) {
    canonicalParams.set('view', view);
  }

  ['category', 'subcategory', 'sku', 'q'].forEach((key) => {
    const value = params.get(key);
    if (value) {
      canonicalParams.set(key, value);
    }
  });

  const query = canonicalParams.toString();
  return query ? `/react/index.html?${query}` : '/react/';
};

export const applySeo = ({
  title,
  description,
  canonicalPath = '/react/',
  image = DEFAULT_IMAGE,
  robots = 'index, follow',
  structuredData
}: SeoConfig) => {
  const canonicalUrl = toAbsoluteUrl(canonicalPath);
  const imageUrl = toAbsoluteUrl(image);

  document.title = title;
  upsertMeta({ name: 'description' }, description);
  upsertMeta({ name: 'robots' }, robots);
  upsertMeta({ property: 'og:title' }, title);
  upsertMeta({ property: 'og:description' }, description);
  upsertMeta({ property: 'og:url' }, canonicalUrl);
  upsertMeta({ property: 'og:image' }, imageUrl);
  upsertMeta({ property: 'og:site_name' }, SITE_NAME);
  upsertMeta({ name: 'twitter:title' }, title);
  upsertMeta({ name: 'twitter:description' }, description);
  upsertMeta({ name: 'twitter:image' }, imageUrl);
  upsertCanonical(canonicalUrl);

  if (structuredData) {
    upsertStructuredData(structuredData);
  } else {
    removeRouteStructuredData();
  }
};

export const buildBreadcrumbJsonLd = (
  items: Array<{ name: string; path: string }>
) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: toAbsoluteUrl(item.path)
  }))
});

export const buildItemListJsonLd = (
  name: string,
  items: Array<{ name: string; path: string; image?: string; position?: number }>
) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name,
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: item.position ?? index + 1,
    url: toAbsoluteUrl(item.path),
    item: {
      '@type': 'Product',
      name: item.name,
      ...(item.image ? { image: toAbsoluteUrl(item.image) } : {})
    }
  }))
});

export const buildProductJsonLd = (product: {
  name: string;
  sku: string;
  image: string;
  description: string;
  price: number;
  category: string;
  canonicalPath: string;
}) => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: product.name,
  sku: product.sku,
  image: toAbsoluteUrl(product.image),
  description: product.description,
  category: product.category,
  url: toAbsoluteUrl(product.canonicalPath),
  offers: {
    '@type': 'Offer',
    priceCurrency: 'VND',
    price: product.price,
    availability: 'https://schema.org/InStock',
    url: toAbsoluteUrl(product.canonicalPath)
  }
});

export const getSiteOrigin = () => SITE_ORIGIN;
export const getSiteName = () => SITE_NAME;
