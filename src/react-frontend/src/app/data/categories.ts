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
    name: 'Rau củ quả',
    subcategories: ['Rau gia vị', 'Rau phổ thông', 'Củ quả', 'Rau đặc biệt', 'Nấm', 'Rau củ chế biến sẵn']
  },
  {
    name: 'Trái cây',
    subcategories: ['Trái cây phổ thông', 'Trái cây nhập khẩu']
  },
  {
    name: 'Thực phẩm tươi sống',
    subcategories: ['Thịt heo', 'Thịt bò-bê', 'Thịt trâu-nghé', 'Thịt dê', 'Thịt gà', 'Thịt vịt-gan-ngỗng', 'Thịt chim', 'Thịt ếch', 'Trứng', 'Giò-chả-nem']
  },
  {
    name: 'Thuỷ hải sản',
    subcategories: ['Cá', 'Tôm', 'Cua', 'Mực', 'Ngao ốc', 'Hải sản chế biến']
  },
  {
    name: 'Thực phẩm đông lạnh',
    subcategories: ['Thịt heo', 'Thịt bò-bê', 'Thịt trâu-nghé', 'Thịt dê', 'Thịt gà', 'Thịt vịt-gan-ngỗng', 'Thịt chim', 'Thịt ếch', 'Trứng', 'Giò-chả-nem', 'Xúc xích - lạp xưởng']
  },
  {
    name: 'Thực phẩm khô',
    subcategories: ['Gia vị', 'Gạo', 'Bột', 'Bún-miến-phở-nui', 'Hạt khô', 'Đồ uống', 'Kem-bơ-phô mai', 'Mứt siro', 'Trà - cà phê đóng gói', 'Thực phẩm khô khác']
  },
  {
    name: 'Tiện ích bếp',
    subcategories: ['Dụng cụ ăn uống', 'Đồ dùng bếp', 'Chất tẩy rửa', 'Dụng cụ vệ sinh', 'Sản phẩm khác']
  }
];

export const categoryIdMap: Record<string, number> = {
  'Rau củ quả': 2,
  'Trái cây': 10,
  'Thực phẩm tươi sống': 13,
  'Thuỷ hải sản': 24,
  'Thực phẩm đông lạnh': 31,
  'Thực phẩm khô': 43,
  'Tiện ích bếp': 54
};

export const subcategoryIdMap: Record<string, number> = {
  'Rau củ quả>Rau gia vị': 3,
  'Rau củ quả>Rau phổ thông': 7,
  'Rau củ quả>Củ quả': 4,
  'Rau củ quả>Rau đặc biệt': 8,
  'Rau củ quả>Nấm': 5,
  'Rau củ quả>Rau củ chế biến sẵn': 9,
  'Trái cây>Trái cây phổ thông': 11,
  'Trái cây>Trái cây nhập khẩu': 12,
  'Thực phẩm tươi sống>Thịt heo': 14,
  'Thực phẩm tươi sống>Thịt bò-bê': 19,
  'Thực phẩm tươi sống>Thịt trâu-nghé': 15,
  'Thực phẩm tươi sống>Thịt dê': 20,
  'Thực phẩm tươi sống>Thịt gà': 16,
  'Thực phẩm tươi sống>Thịt vịt-gan-ngỗng': 21,
  'Thực phẩm tươi sống>Thịt chim': 17,
  'Thực phẩm tươi sống>Thịt ếch': 22,
  'Thực phẩm tươi sống>Trứng': 18,
  'Thực phẩm tươi sống>Giò-chả-nem': 23,
  'Thuỷ hải sản>Cá': 25,
  'Thuỷ hải sản>Tôm': 28,
  'Thuỷ hải sản>Cua': 26,
  'Thuỷ hải sản>Mực': 29,
  'Thuỷ hải sản>Ngao ốc': 27,
  'Thuỷ hải sản>Hải sản chế biến': 30,
  'Thực phẩm đông lạnh>Thịt heo': 32,
  'Thực phẩm đông lạnh>Thịt bò-bê': 38,
  'Thực phẩm đông lạnh>Thịt trâu-nghé': 33,
  'Thực phẩm đông lạnh>Thịt dê': 39,
  'Thực phẩm đông lạnh>Thịt gà': 34,
  'Thực phẩm đông lạnh>Thịt vịt-gan-ngỗng': 40,
  'Thực phẩm đông lạnh>Thịt chim': 35,
  'Thực phẩm đông lạnh>Thịt ếch': 41,
  'Thực phẩm đông lạnh>Trứng': 36,
  'Thực phẩm đông lạnh>Giò-chả-nem': 42,
  'Thực phẩm đông lạnh>Xúc xích - lạp xưởng': 37,
  'Thực phẩm khô>Gia vị': 44,
  'Thực phẩm khô>Gạo': 49,
  'Thực phẩm khô>Bột': 45,
  'Thực phẩm khô>Bún-miến-phở-nui': 50,
  'Thực phẩm khô>Hạt khô': 46,
  'Thực phẩm khô>Đồ uống': 51,
  'Thực phẩm khô>Kem-bơ-phô mai': 47,
  'Thực phẩm khô>Mứt siro': 52,
  'Thực phẩm khô>Trà - cà phê đóng gói': 48,
  'Thực phẩm khô>Thực phẩm khô khác': 53,
  'Tiện ích bếp>Dụng cụ ăn uống': 55,
  'Tiện ích bếp>Đồ dùng bếp': 56,
  'Tiện ích bếp>Chất tẩy rửa': 57,
  'Tiện ích bếp>Dụng cụ vệ sinh': 58,
  'Tiện ích bếp>Sản phẩm khác': 59
};

export const getCategoryId = (categoryName: string) => categoryIdMap[categoryName];

export const getSubcategoryId = (categoryName: string, subcategoryName: string) =>
  subcategoryIdMap[`${categoryName}>${subcategoryName}`];

export const getCategoryNameFromQuery = (categoryQuery: string | null) => {
  if (!categoryQuery) {
    return categoryMenu[0].name;
  }

  const normalized = categoryQuery.trim().toLowerCase();
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
    return { category: 'Rau củ quả', subcategory: 'Rau phổ thông' };
  }
  if (normalized.startsWith('rau-cu-')) {
    return { category: 'Rau củ quả', subcategory: 'Rau phổ thông' };
  }
  if (/^TC_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Trái cây', subcategory: 'Trái cây phổ thông' };
  }
  if (/^TPTS_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Thực phẩm tươi sống', subcategory: 'Giò-chả-nem' };
  }
  if (/^THS_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Thuỷ hải sản', subcategory: 'Hải sản chế biến' };
  }
  if (/^TPDL_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Thực phẩm đông lạnh', subcategory: 'Giò-chả-nem' };
  }
  if (/^TPK_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Thực phẩm khô', subcategory: 'Thực phẩm khô khác' };
  }
  if (/^TIB_\d{3,}$/.test(normalizedUpper)) {
    return { category: 'Tiện ích bếp', subcategory: 'Sản phẩm khác' };
  }

  if (normalized.startsWith('rau-cu-qua-')) {
    return {
      category: 'Rau củ quả',
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
        { keywords: ['bo', 'be'], label: 'Thịt bò-bê' },
        { keywords: ['trau', 'nghe'], label: 'Thịt trâu-nghé' },
        { keywords: ['de'], label: 'Thịt dê' },
        { keywords: ['ga'], label: 'Thịt gà' },
        { keywords: ['vit', 'ngong'], label: 'Thịt vịt-gan-ngỗng' },
        { keywords: ['chim'], label: 'Thịt chim' },
        { keywords: ['ech'], label: 'Thịt ếch' },
        { keywords: ['trung'], label: 'Trứng' }
      ], 'Giò-chả-nem')
    };
  }

  if (normalized.startsWith('cat-ths-')) {
    return {
      category: 'Thuỷ hải sản',
      subcategory: pickSubcategoryFromText(normalized, [
        { keywords: ['ca'], label: 'Cá' },
        { keywords: ['tom'], label: 'Tôm' },
        { keywords: ['cua'], label: 'Cua' },
        { keywords: ['muc'], label: 'Mực' },
        { keywords: ['ngao', 'oc'], label: 'Ngao ốc' }
      ], 'Hải sản chế biến')
    };
  }

  if (normalized.startsWith('cat-tpdl-')) {
    return {
      category: 'Thực phẩm đông lạnh',
      subcategory: pickSubcategoryFromText(normalized, [
        { keywords: ['heo'], label: 'Thịt heo' },
        { keywords: ['bo', 'be'], label: 'Thịt bò-bê' },
        { keywords: ['trau', 'nghe'], label: 'Thịt trâu-nghé' },
        { keywords: ['de'], label: 'Thịt dê' },
        { keywords: ['ga'], label: 'Thịt gà' },
        { keywords: ['vit', 'ngong'], label: 'Thịt vịt-gan-ngỗng' },
        { keywords: ['chim'], label: 'Thịt chim' },
        { keywords: ['ech'], label: 'Thịt ếch' },
        { keywords: ['trung'], label: 'Trứng' },
        { keywords: ['xuc-xich', 'lap-xuong'], label: 'Xúc xích - lạp xưởng' }
      ], 'Giò-chả-nem')
    };
  }

  if (normalized.startsWith('cat-tpk-')) {
    return {
      category: 'Thực phẩm khô',
      subcategory: pickSubcategoryFromText(normalized, [
        { keywords: ['gia-vi'], label: 'Gia vị' },
        { keywords: ['gao'], label: 'Gạo' },
        { keywords: ['bot'], label: 'Bột' },
        { keywords: ['bun', 'mien', 'pho', 'nui'], label: 'Bún-miến-phở-nui' },
        { keywords: ['hat'], label: 'Hạt khô' },
        { keywords: ['do-uong'], label: 'Đồ uống' },
        { keywords: ['kem', 'bo', 'pho-mai'], label: 'Kem-bơ-phô mai' },
        { keywords: ['mut', 'siro'], label: 'Mứt siro' },
        { keywords: ['tra', 'ca-phe'], label: 'Trà - cà phê đóng gói' }
      ], 'Thực phẩm khô khác')
    };
  }

  if (normalized.startsWith('cat-tib-')) {
    return {
      category: 'Tiện ích bếp',
      subcategory: pickSubcategoryFromText(normalized, [
        { keywords: ['dung-cu-an-uong'], label: 'Dụng cụ ăn uống' },
        { keywords: ['do-dung-bep', 'noi'], label: 'Đồ dùng bếp' },
        { keywords: ['chat-tay-rua', 'rua-chen'], label: 'Chất tẩy rửa' },
        { keywords: ['dung-cu-ve-sinh', 'ban-chai', 'co-noi'], label: 'Dụng cụ vệ sinh' }
      ], 'Sản phẩm khác')
    };
  }

  return null;
};
