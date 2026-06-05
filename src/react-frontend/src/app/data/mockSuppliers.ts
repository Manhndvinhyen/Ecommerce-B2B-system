export const supplierRegions = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Lạt', 'Miền Tây'];

export function getMockSupplierForProduct(sku: string, category: string) {
  const normalizedSku = String(sku || '').toLowerCase();
  if (normalizedSku.includes('ba-chi-heo') || normalizedSku.includes('ba_chi_heo') || normalizedSku.includes('tpts-ba-chi-heo')) {
    return { name: 'Tổng công ty Chăn nuôi CP Việt Nam', region: 'Hà Nội' };
  }
  if (normalizedSku.includes('tomato') || normalizedSku.includes('ca-chua') || normalizedSku.includes('ca_chua') || normalizedSku.includes('cc-02')) {
    return { name: 'Nông trại Hữu cơ Đà Lạt', region: 'Miền Tây' };
  }

  const regions = supplierRegions;
  const index = sku ? sku.length % regions.length : 0;
  let region = regions[index];
  const normalizedCategory = String(category || '').toLowerCase();
  
  let name = 'Tổng kho sỉ Thực phẩm B2B';
  if (normalizedCategory.includes('rau')) {
    name = 'Nông trại Hữu cơ Đà Lạt';
  } else if (normalizedCategory.includes('sản') || normalizedCategory.includes('thuỷ') || normalizedCategory.includes('thủy')) {
    name = 'Hợp tác xã Hải sản Quảng Ninh';
  } else if (
    normalizedCategory.includes('tươi sống') ||
    normalizedCategory.includes('thịt') ||
    normalizedCategory.includes('heo') ||
    normalizedCategory.includes('lợn') ||
    normalizedCategory.includes('bò') ||
    normalizedCategory.includes('bê') ||
    normalizedCategory.includes('trâu') ||
    normalizedCategory.includes('nghé') ||
    normalizedCategory.includes('dê') ||
    normalizedCategory.includes('gà') ||
    normalizedCategory.includes('vịt') ||
    normalizedCategory.includes('gan') ||
    normalizedCategory.includes('ngỗng') ||
    normalizedCategory.includes('chim') ||
    normalizedCategory.includes('ếch') ||
    normalizedCategory.includes('trứng')
  ) {
    name = 'Tổng công ty Chăn nuôi CP Việt Nam';
    region = 'Miền Tây';
  } else if (normalizedCategory.includes('khô')) {
    name = 'Tổng kho Gia vị và Đồ khô Hà Nội';
  }
  
  return { name, region };
}
