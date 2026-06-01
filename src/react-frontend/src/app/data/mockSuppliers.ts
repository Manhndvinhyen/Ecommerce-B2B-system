export const supplierRegions = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Lạt', 'Miền Tây'];

export function getMockSupplierForProduct(sku: string, category: string) {
  const regions = supplierRegions;
  const index = sku ? sku.length % regions.length : 0;
  const region = regions[index];
  
  let name = 'Tổng kho sỉ Thực phẩm B2B';
  if (category && category.includes('Rau')) {
    name = 'Nông trại Hữu cơ Đà Lạt';
  } else if (category && (category.includes('sản') || category.includes('Thuỷ'))) {
    name = 'Hợp tác xã Hải sản Quảng Ninh';
  } else if (category && category.includes('tươi sống')) {
    name = 'Tổng công ty Chăn nuôi CP Việt Nam';
  } else if (category && category.includes('khô')) {
    name = 'Tổng kho Gia vị và Đồ khô Hà Nội';
  }
  
  return { name, region };
}
