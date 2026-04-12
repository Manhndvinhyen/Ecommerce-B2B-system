export type CategoryGroup = {
  name: string;
  subcategories: string[];
};

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

export const getCategoryPageLink = (category: string, subcategory?: string) => {
  const params = new URLSearchParams({
    view: 'category',
    category
  });

  if (subcategory) {
    params.set('subcategory', subcategory);
  }

  return `./index.html?${params.toString()}`;
};
