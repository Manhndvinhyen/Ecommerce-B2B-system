# Tích hợp frontend trang chủ với Magento (Docker)

Tài liệu này hướng dẫn cách nối frontend hiện tại với Magento 2 chạy bằng Docker qua GraphQL.

## 1) Contract tích hợp

- **Input:** frontend gọi Magento GraphQL endpoint.
- **Output:** danh sách sản phẩm hiển thị trong block `Sản phẩm nổi bật từ Magento`.
- **Error mode:** nếu Magento chưa chạy/CORS lỗi/không có sản phẩm, UI tự fallback sang dữ liệu mẫu.
- **Success criteria:** mở trang chủ thấy sản phẩm từ Magento thay vì chỉ dữ liệu hard-code.

## 2) File đã được thêm/sửa

- `src/app/lib/magento.ts`: Magento GraphQL client + mapper dữ liệu sản phẩm.
- `src/app/components/ProductsPage.tsx`: gọi API Magento, có loading/error/fallback và render danh sách sản phẩm.
- `.env.example`: biến môi trường cho URL Magento.

## 3) Cấu hình môi trường frontend

Tạo file `.env` từ `.env.example`:

- `VITE_MAGENTO_URL`: URL Magento expose từ Docker (ví dụ `http://localhost:8080`).
- `VITE_MAGENTO_STORE_CODE`: để trống nếu dùng default store; điền `default` nếu hệ thống yêu cầu.

## 4) Cấu hình Magento (Docker)

Đảm bảo stack Magento Docker đang chạy và truy cập được:

- Magento storefront/admin hoạt động tại URL bạn đặt ở `VITE_MAGENTO_URL`.
- GraphQL endpoint hoạt động tại:
  - `${VITE_MAGENTO_URL}/graphql`
  - hoặc `${VITE_MAGENTO_URL}/{storeCode}/graphql`

### Bật CORS để frontend gọi trực tiếp từ browser

Nếu frontend chạy khác origin với Magento, cần CORS. Có 2 hướng:

1. **Khuyên dùng:** đặt reverse proxy (Nginx/Traefik) để frontend và Magento cùng domain.
2. **Nhanh để dev:** bật CORS trong web server của Magento (Nginx/Apache) cho origin frontend.

Ví dụ header CORS cần có (dev):

- `Access-Control-Allow-Origin: http://localhost:5173` (hoặc origin frontend của bạn)
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## 5) Seed dữ liệu sản phẩm trong Magento

Để frontend có dữ liệu thật:

- Tạo vài sản phẩm ở Magento Admin.
- Đảm bảo product được enable, có giá, có ảnh và thuộc website/store view đang dùng.

### Chia sẻ dữ liệu cho cả team (quan trọng)

Nếu bạn import bằng CSV (ví dụ `category-products-seed.csv`) thì dữ liệu chỉ nằm trong DB local của bạn.

- CSV dùng chung được đặt tại: `src/pub/media/import/category-products-seed.csv`
- Import bằng lệnh:
  - `bin/import-products-seed`
- `bin/setup-dev` và `bin/setup-new-machine` đã tự động chạy bước này nếu file CSV tồn tại.

Để đảm bảo teammate pull về ra **đúng y hệt DB của bạn** (không chỉ sản phẩm):

- Export dump mới: `bin/db-dump`
- Commit file `dump/magento.sql.gz`
- Teammate chạy: `bin/setup-dev` (hoặc `bin/setup-new-machine`)

## 6) Edge cases đã xử lý trong frontend

- Magento chưa chạy hoặc endpoint lỗi.
- GraphQL trả về `errors`.
- Product không có ảnh/giá.
- Magento trả danh sách rỗng.

## 7) Bước tiếp theo nên làm

- Thêm trang chi tiết sản phẩm theo `url_key`.
- Nối search box trong header sang Magento GraphQL `products(search: ...)`.
- Nối cart/checkout qua Magento REST/GraphQL để hoàn chỉnh flow mua hàng.

## 8) Pipeline đồng bộ frontend React vào Magento theme (không sửa component UI)

Mục tiêu: mỗi lần bạn thay đổi code ở `src/app/**`, chỉ cần chạy 1 lệnh để build và đẩy sang `magento.test`.

### File hạ tầng đã thêm

- `index.html`: entry HTML cho Vite build.
- `src/main.tsx`: mount `App` + import style tổng.
- `scripts/magento-sync.mjs`: copy `dist/` vào Magento theme và cập nhật layout/template homepage dùng React bundle.
- `scripts/magento-refresh.mjs`: chạy `cache:clean`, `cache:flush`, `setup:static-content:deploy`, `indexer:reindex` trong container Magento.
- `.env.magento-sync.example`: mẫu env cho đường dẫn theme và tên container.

### Scripts mới

- `npm run build`: build Vite.
- `npm run sync:magento`: sync bundle vào `app/design/frontend/MyCompany/MyTheme`.
- `npm run refresh:magento`: refresh static/cache/indexers trong Docker.
- `npm run deploy:magento`: chạy full chain `build -> sync -> refresh`.

### Cấu hình nhanh

Tạo file env shell cục bộ (tuỳ chọn), hoặc export trực tiếp trước khi chạy script:

- `MAGENTO_THEME_DIR`: ví dụ `/Users/socnhi/Sites/magento/src/app/design/frontend/MyCompany/MyTheme`
- `MAGENTO_PHP_CONTAINER`: ví dụ `magento-phpfpm-1`
- `MAGENTO_LOCALES`: ví dụ `en_US vi_VN`

### Lưu ý quan trọng

- Pipeline này **không chỉnh sửa component giao diện React** (`src/app/components/**`).
- Nó chỉ build + nhúng output vào theme Magento để homepage ở `magento.test` render từ bundle React.
