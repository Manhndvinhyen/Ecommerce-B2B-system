export type CategoryGroup = {
  name: string;
  subcategories: string[];
};

const normalizeVietnamese = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

export const toQuerySlug = (value: string) =>
  normalizeVietnamese(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const categoryMenu: CategoryGroup[] = [
  {
    name: 'Rau củ',
    subcategories: ['Củ quả', 'Rau gia vị', 'Rau phổ thông']
  },
  {
    name: 'Trái cây',
    subcategories: ['Trái cây nhập khẩu', 'Trái cây phổ thông']
  },
  {
    name: 'Thực phẩm tươi sống',
    subcategories: ['Thịt heo', 'Thịt gà']
  },
  {
    name: 'Thủy hải sản',
    subcategories: ['Cá', 'Tôm', 'Mực']
  },
  {
    name: 'Thực phẩm đông lạnh',
    subcategories: ['Giò-chả-nem', 'Xúc xích - lạp xưởng', 'Thit bo-be']
  },
  {
    name: 'Thực phẩm khô',
    subcategories: ['Gạo', 'Bún-miến-phở-nui', 'Hạt khô']
  },
  {
    name: 'Tiện ích bếp',
    subcategories: ['Đồ dùng bếp', 'Chất tẩy rửa', 'Dụng cụ vệ sinh']
  }
];

export const categoryIdMap: Record<string, number> = {
  'Thực phẩm': 3,
  'Rau củ': 4,
  'Rau củ quả': 4,
  'Trái cây': 10,
  'Thực phẩm tươi sống': 13,
  'Thủy hải sản': 17,
  'Thuỷ hải sản': 17,
  'Thực phẩm đông lạnh': 21,
  'Thực phẩm khô': 25,
  'Tiện ích bếp': 29
};

export const subcategoryIdMap: Record<string, number> = {
  'Rau củ>Củ quả': 5,
  'Rau củ>Rau gia vị': 8,
  'Rau củ>Rau phổ thông': 9,
  'Rau củ quả>Củ quả': 5,
  'Rau củ quả>Rau gia vị': 8,
  'Rau củ quả>Rau phổ thông': 9,
  'Trái cây>Trái cây phổ thông': 11,
  'Trái cây>Trái cây nhập khẩu': 12,
  'Thực phẩm tươi sống>Thịt heo': 14,
  'Thực phẩm tươi sống>Thịt gà': 15,
  'Thủy hải sản>Cá': 18,
  'Thủy hải sản>Tôm': 19,
  'Thủy hải sản>Mực': 20,
  'Thuỷ hải sản>Cá': 18,
  'Thuỷ hải sản>Tôm': 19,
  'Thuỷ hải sản>Mực': 20,
  'Thực phẩm đông lạnh>Giò-chả-nem': 22,
  'Thực phẩm đông lạnh>Xúc xích - lạp xưởng': 23,
  'Thực phẩm đông lạnh>Thit bo-be': 24,
  'Thực phẩm khô>Gạo': 26,
  'Thực phẩm khô>Bún-miến-phở-nui': 27,
  'Thực phẩm khô>Hạt khô': 28,
  'Tiện ích bếp>Đồ dùng bếp': 30,
  'Tiện ích bếp>Chất tẩy rửa': 31,
  'Tiện ích bếp>Dụng cụ vệ sinh': 32
};

export const getCategoryId = (categoryName: string) => categoryIdMap[categoryName];

export const getSubcategoryId = (categoryName: string, subcategoryName: string) =>
  subcategoryIdMap[`${categoryName}>${subcategoryName}`];

export const getCategoryNameFromQuery = (categoryQuery: string | null) => {
  if (!categoryQuery) {
    return categoryMenu[0].name;
  }

  const normalized = categoryQuery.trim().toLowerCase();
  const legacyAliases: Record<string, string> = {
    'rau-cu-qua': 'Rau củ',
    'thuy-hai-san': 'Thủy hải sản',
    'thuy-hai-san-': 'Thủy hải sản'
  };

  if (legacyAliases[normalized]) {
    return legacyAliases[normalized];
  }

  return categoryMenu.find((category) => toQuerySlug(category.name) === normalized)?.name ?? categoryMenu[0].name;
};

export const getSubcategoryNameFromQuery = (categoryName: string, subcategoryQuery: string | null) => {
  if (!subcategoryQuery) {
    return undefined;
  }

  const normalized = subcategoryQuery.trim().toLowerCase();
  const category = categoryMenu.find((item) => item.name === categoryName);
  if (!category) {
    return undefined;
  }

  return category.subcategories.find((subcategory) => toQuerySlug(subcategory) === normalized);
};

export const getCategoryPageLink = (category: string, subcategory?: string) => {
  const params = new URLSearchParams({
    view: 'category',
    category: toQuerySlug(category)
  });

  if (subcategory) {
    params.set('subcategory', toQuerySlug(subcategory));
  }

  return `/react/index.html?${params.toString()}`;
};

export type InferredCategory = {
  category: string;
  subcategory: string;
};

const pickSubcategoryFromText = (
  haystack: string,
  rules: Array<{ keywords: string[]; label: string }>,
  fallback: string
): string => {
  const matched = rules.find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)));
  return matched?.label ?? fallback;
};

export const inferCategoryFromSku = (sku: string): InferredCategory | null => {
  const normalized = toQuerySlug(sku);
  const normalizedUpper = String(sku || '').toUpperCase();

  if (/^RCQ_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Rau củ', subcategory: 'Rau phổ thông' };
  }
  if (normalized.startsWith('rau-cu-')) {
    return { category: 'Rau củ', subcategory: 'Rau phổ thông' };
  }
  if (/^TC_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Trái cây', subcategory: 'Trái cây phổ thông' };
  }
  if (/^TPTS_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Thực phẩm tươi sống', subcategory: 'Thịt heo' };
  }
  if (/^THS_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Thủy hải sản', subcategory: 'Cá' };
  }
  if (/^TPDL_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Thực phẩm đông lạnh', subcategory: 'Giò-chả-nem' };
  }
  if (/^TPK_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Thực phẩm khô', subcategory: 'Gạo' };
  }
  if (/^TIB_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Tiện ích bếp', subcategory: 'Đồ dùng bếp' };
  }

  if (normalized.startsWith('rau-cu-qua-')) {
    return {
      category: 'Rau củ',
      subcategory: pickSubcategoryFromText(
        normalized,
        [
          { keywords: ['chilli', 'red-bell-pepper'], label: 'Rau gia vị' },
          { keywords: ['carrot', 'potato'], label: 'Củ quả' }
        ],
        'Rau phổ thông'
      )
    };
  }

  if (normalized.startsWith('cat-tc-')) {
    return {
      category: 'Trái cây',
      subcategory: normalized.includes('tao') ? 'Trái cây nhập khẩu' : 'Trái cây phổ thông'
    };
  }

  if (normalized.startsWith('cat-tpts-')) {
    return {
      category: 'Thực phẩm tươi sống',
      subcategory: pickSubcategoryFromText(normalized, [
        { keywords: ['heo'], label: 'Thịt heo' },
        { keywords: ['ga'], label: 'Thịt gà' }
      ], 'Thịt heo')
    };
  }

  if (normalized.startsWith('cat-ths-')) {
    return {
      category: 'Thủy hải sản',
      subcategory: pickSubcategoryFromText(normalized, [
        { keywords: ['ca'], label: 'Cá' },
        { keywords: ['tom'], label: 'Tôm' },
        { keywords: ['muc'], label: 'Mực' }
      ], 'Cá')
    };
  }

  if (normalized.startsWith('cat-tpdl-')) {
    return {
      category: 'Thực phẩm đông lạnh',
      subcategory: pickSubcategoryFromText(normalized, [
        { keywords: ['bo', 'be'], label: 'Thit bo-be' },
        { keywords: ['xuc-xich', 'lap-xuong'], label: 'Xúc xích - lạp xưởng' }
      ], 'Giò-chả-nem')
    };
  }

  if (normalized.startsWith('cat-tpk-')) {
    return {
      category: 'Thực phẩm khô',
      subcategory: pickSubcategoryFromText(normalized, [
        { keywords: ['gao'], label: 'Gạo' },
        { keywords: ['bun', 'mien', 'pho', 'nui'], label: 'Bún-miến-phở-nui' },
        { keywords: ['hat'], label: 'Hạt khô' }
      ], 'Gạo')
    };
  }

  if (normalized.startsWith('cat-tib-')) {
    return {
      category: 'Tiện ích bếp',
      subcategory: pickSubcategoryFromText(normalized, [
        { keywords: ['do-dung-bep', 'noi'], label: 'Đồ dùng bếp' },
        { keywords: ['chat-tay-rua', 'rua-chen'], label: 'Chất tẩy rửa' },
        { keywords: ['dung-cu-ve-sinh', 'ban-chai', 'co-noi'], label: 'Dụng cụ vệ sinh' }
      ], 'Đồ dùng bếp')
    };
  }

  return null;
};
