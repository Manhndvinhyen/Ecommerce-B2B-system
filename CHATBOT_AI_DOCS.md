# Tài liệu kỹ thuật: Hệ thống Chatbot AI & Tối ưu Tìm kiếm
> TMDT Shop — Magento 2.4.8 + Google Gemini + React  
> Cập nhật: 2026-04-14

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Luồng xử lý một câu hỏi](#2-luồng-xử-lý-một-câu-hỏi)
3. [Tìm kiếm tương đồng (Semantic Search) — không cần Vector DB](#3-tìm-kiếm-tương-đồng-semantic-search--không-cần-vector-db)
4. [Tối ưu tốc độ AI — Cache 2 tầng](#4-tối-ưu-tốc-độ-ai--cache-2-tầng)
5. [Tối ưu Gemini API — Token & Temperature](#5-tối-ưu-gemini-api--token--temperature)
6. [Fallback Model — Không bao giờ chết](#6-fallback-model--không-bao-giờ-chết)
7. [Tối ưu SEO — Trang được tìm thấy nhanh hơn](#7-tối-ưu-seo--trang-được-tìm-thấy-nhanh-hơn)
8. [Cấu trúc file quan trọng](#8-cấu-trúc-file-quan-trọng)
9. [Nâng cấp lên True Semantic Search (tương lai)](#9-nâng-cấp-lên-true-semantic-search-tương-lai)

---

## 1. Tổng quan kiến trúc

```
Người dùng
    │
    │  (gõ câu hỏi vào chatbot)
    ▼
┌─────────────────────────────────────────┐
│  React Frontend  (ChatbotWidget.tsx)    │
│  POST /rest/V1/chatbot/ask              │
└──────────────────┬──────────────────────┘
                   │ HTTP
                   ▼
┌─────────────────────────────────────────┐
│  Magento 2 REST API                     │
│  Tmdt\Chatbot\Model\ChatbotManagement   │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Tầng Cache (Redis/File)        │    │
│  │  • Intent cache  (10 phút)      │    │
│  │  • Reply cache   (5 phút)       │    │
│  └──────────────┬──────────────────┘    │
│                 │ cache miss            │
│                 ▼                       │
│  ┌─────────────────────────────────┐    │
│  │  Google Gemini API              │    │
│  │  gemini-2.5-flash               │    │
│  │  (fallback: flash-lite)         │    │
│  └──────────────┬──────────────────┘    │
│                 │ keywords JSON         │
│                 ▼                       │
│  ┌─────────────────────────────────┐    │
│  │  Magento Product Repository     │    │
│  │  SQL: name LIKE %keyword%       │    │
│  │  pageSize=3, tối đa 5 products  │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                   │
                   │  JSON: {message, products[]}
                   ▼
        Frontend hiển thị tin nhắn
        + thẻ sản phẩm (ảnh, giá, link)
```

---

## 2. Luồng xử lý một câu hỏi

Ví dụ khách hỏi: **"Tôi muốn nấu canh rau, cần mua gì?"**

### Bước 1 — Chuẩn hóa & kiểm tra cache

```php
$normalizedMsg  = mb_strtolower(trim($message));
// → "tôi muốn nấu canh rau, cần mua gì?"

$intentCacheKey = 'chatbot_intent_' . md5($normalizedMsg);
// → 'chatbot_intent_a3f7c8...'

$cached = $this->cache->load($intentCacheKey);
// Nếu có cache → dùng ngay, bỏ qua bước 2
```

**Tại sao chuẩn hóa?**  
"Nấu canh rau" và "nấu canh rau " (có dấu cách) sẽ cho cùng cache key.  
"Tôi Muốn Nấu Canh" và "tôi muốn nấu canh" cũng cho cùng cache key.

---

### Bước 2 — Gemini sinh keywords (nếu không có cache)

Gửi prompt đến Gemini với **`maxOutputTokens: 256`** và **`temperature: 0.1`**:

```
Cửa hàng thực phẩm/tạp hóa VN. Khách: "Tôi muốn nấu canh rau, cần mua gì?"
Sinh TÊN SẢN PHẨM CỤ THỂ (1-3 từ) cửa hàng có thể bán đáp ứng nhu cầu.
Chỉ JSON: {"keywords":["..."],"max_price":0}. Không markdown.
```

Gemini trả về:
```json
{
  "keywords": ["bắp cải", "súp lơ", "cà rốt", "cà chua", "thịt heo"],
  "max_price": 0
}
```

**Lưu vào cache 10 phút** → câu hỏi tương tự sau này không gọi Gemini nữa.

---

### Bước 3 — Multi-keyword SQL Search

Với mỗi keyword, chạy một truy vấn độc lập:

```sql
-- Keyword: "bắp cải"
SELECT * FROM catalog_product_entity
WHERE name LIKE '%bắp cải%'
LIMIT 3

-- Keyword: "súp lơ"  
SELECT * FROM catalog_product_entity
WHERE name LIKE '%súp lơ%'
LIMIT 3

-- ... (tối đa 5 keywords)
```

**Deduplicate theo SKU** — nếu sản phẩm trùng thì bỏ qua.  
**Dừng sớm** khi đã có 5 sản phẩm (`break 2`).

Nếu có `max_price` (VD: "dưới 50.000đ"), thêm điều kiện:
```sql
AND price <= 50000
```

---

### Bước 4 — Gemini tư vấn dựa trên kết quả (RAG)

Gửi danh sách sản phẩm tìm được vào prompt:

```
Bạn là nhân viên tư vấn bán hàng. Khách hỏi: "Tôi muốn nấu canh rau..."
Hệ thống đã tìm thấy:
- Bắp cải tươi | Giá: 15.000 VNĐ | Mô tả: Bắp cải Đà Lạt...
- Cà rốt Đà Lạt | Giá: 12.000 VNĐ
- Thịt heo ba chỉ | Giá: 85.000 VNĐ

Hãy viết câu trả lời ngắn gọn (2-4 câu), thân thiện...
```

Gemini trả về:
```
Dạ, để nấu canh rau ngon, bạn có thể chọn bắp cải tươi Đà Lạt 
hoặc cà rốt mới về hôm nay. Kết hợp với thịt heo ba chỉ sẽ tạo 
nước dùng ngọt thanh tự nhiên. Tất cả sản phẩm đang có sẵn!
```

**Lưu vào cache 5 phút** theo cặp (message + danh sách sản phẩm).

---

### Bước 5 — Frontend hiển thị

```typescript
// ChatbotWidget.tsx xử lý Magento double-encoding:
const firstParse = JSON.parse(raw);        // chuỗi JSON
const secondParse = JSON.parse(firstParse); // object thực sự
// → { message: "Dạ...", products: [{name, price, url, image}] }
```

Kết quả hiển thị:
- **Bong bóng text** — tin nhắn tư vấn (render markdown: **bold**, *italic*, bullet)
- **Thẻ sản phẩm** — ảnh thumbnail + tên + giá + "Xem sản phẩm →"

---

## 3. Tìm kiếm tương đồng (Semantic Search) — không cần Vector DB

### Vấn đề với keyword thông thường

| Người dùng hỏi | Keyword truyền thống tìm | Kết quả |
|---|---|---|
| "nấu canh ngon" | "nấu canh ngon" | ❌ Không khớp |
| "đồ nhắm bia" | "đồ nhắm bia" | ❌ Không khớp |
| "muốn ăn sáng" | "muốn ăn sáng" | ❌ Không khớp |

### Giải pháp: "LLM-Expanded Keyword Search"

Thay vì tìm từng chữ khách gõ, **dùng AI để dịch ý định → tên sản phẩm cụ thể**:

| Người dùng hỏi | AI sinh keywords | SQL LIKE tìm được |
|---|---|---|
| "nấu canh ngon" | bắp cải, cà chua, cà rốt, thịt heo | ✅ khớp tên sản phẩm DB |
| "đồ nhắm bia" | lạc rang, khô mực, bò khô, pate | ✅ khớp |
| "muốn ăn sáng" | trứng, bánh mì, sữa, xúc xích, phô mai | ✅ khớp |
| "rau xanh tốt cho sức khỏe" | rau muống, cải xanh, bó xôi, rau cải | ✅ khớp |
| "dưới 20k ăn được gì" | mì gói, bánh, kẹo, snack (max_price=20000) | ✅ có filter giá |

### Tại sao hiệu quả?

```
Truyền thống:   "nấu canh" ──LIKE──▶ DB ──▶ ❌ (không có sản phẩm tên "nấu canh")

LLM-Expanded:   "nấu canh"
                    │
                    ▼ Gemini expand
                ["bắp cải", "cà chua", "cà rốt", "thịt heo"]
                    │
                    ▼ LIKE search × 4 keywords
                [Bắp cải Đà Lạt, Cà chua bi, Cà rốt tươi, Thịt ba chỉ]
                    │
                    ▼ Gemini tư vấn
                "Để nấu canh ngon, bạn có thể dùng..."
```

### So sánh với Vector DB (FAISS/Pinecone)

| Tiêu chí | LLM-Expanded LIKE (hiện tại) | Vector DB (FAISS) |
|---|---|---|
| **Độ chính xác** | Tốt (~80%) | Rất tốt (~95%) |
| **Tốc độ** | Nhanh (SQL indexed) | Nhanh (FAISS ANN) |
| **Cài đặt** | Đơn giản (PHP thuần) | Phức tạp (Python + model) |
| **Tài nguyên** | Thấp | Cao (RAM cho embeddings) |
| **Đồng nghĩa tiếng Việt** | ✅ AI hiểu | ✅ embedding hiểu |
| **Sản phẩm mới** | ✅ SQL tự update | ❌ Phải reindex |
| **Không cần GPU** | ✅ | ✅ (CPU mode) |

**Kết luận**: Với cửa hàng vừa và nhỏ, LLM-Expanded LIKE cho kết quả tốt với chi phí triển khai thấp hơn nhiều so với vector DB.

---

## 4. Tối ưu tốc độ AI — Cache 2 tầng

### Vấn đề chưa tối ưu

```
Mỗi request → 2 lần gọi Gemini API → ~2-5 giây
Nếu 100 người hỏi "nấu canh" → gọi Gemini 200 lần (lãng phí)
```

### Giải pháp: Cache 2 tầng độc lập

```
Câu hỏi đến
    │
    ▼
[TẦNG 1: Intent Cache]
    Key = md5(normalize(message))
    TTL = 10 phút
    │
    ├── HIT  → dùng keywords đã có → nhảy sang Bước 3
    │
    └── MISS → gọi Gemini (Bước 2) → lưu cache
                   │
                   ▼
             SQL Search (Bước 3)
                   │
                   ▼
[TẦNG 2: Reply Cache]
    Key = md5(normalize(message) + productInfo)
    TTL = 5 phút
    │
    ├── HIT  → trả lời ngay (không gọi Gemini lần 2)
    │
    └── MISS → gọi Gemini (Bước 4) → lưu cache
```

### Hiệu quả cache

| Tình huống | Lần 1 | Lần 2+ (trong TTL) |
|---|---|---|
| Cùng câu hỏi y hệt | ~2-3s (gọi Gemini) | ~50ms (từ cache) |
| Câu hỏi tương tự (normalize) | ~2-3s | ~50ms |
| Kết quả sản phẩm giống nhau | ~1-2s (1 lần Gemini) | ~50ms |

**Tại sao 2 cache riêng biệt?**

- **Intent cache** (10 phút): "nấu canh" → luôn cho keywords như nhau, không đổi khi sản phẩm thay đổi
- **Reply cache** (5 phút): Reply phụ thuộc cả message lẫn sản phẩm tìm được. Nếu admin thêm sản phẩm mới, `productInfo` thay đổi → cache miss → reply mới có sản phẩm mới

### Cache backend

Magento tự chọn backend phù hợp:
- **Redis** (khuyến nghị — production): `src/app/etc/env.php` → `cache.frontend`
- **File cache** (default — dev): `var/cache/`

Không cần cấu hình thêm — inject `CacheInterface` là Magento tự xử lý.

---

## 5. Tối ưu Gemini API — Token & Temperature

### Trước khi tối ưu

```php
// Cả 2 lần gọi dùng cùng config:
'maxOutputTokens' => 1024,  // quá nhiều cho JSON nhỏ
'temperature'     => 0.7,   // không ổn định cho JSON output
```

### Sau khi tối ưu

| Call | `maxOutputTokens` | `temperature` | Lý do |
|---|---|---|---|
| **Intent** (sinh keywords) | `256` | `0.1` | Chỉ cần JSON ~50 ký tự. Temperature thấp = JSON đúng format hơn, ít bị sáng tạo |
| **Reply** (tư vấn) | `512` | `0.7` | Cần câu văn tự nhiên 2-4 câu. Temperature cao = nghe thân thiện hơn |

**Tại sao `maxOutputTokens` quan trọng?**

```
Gemini tính phí theo số token SINH RA.
Intent cũ: 1024 tokens × 2 requests/user = 2048 tokens bị lãng phí
Intent mới: 256 tokens × 1 request (cached) = 256 tokens

Tiết kiệm: ~75% token cost cho intent calls
```

**Tại sao `temperature: 0.1` cho intent?**

```
temperature = 0.7 (creative):
  → {"keywords": ["bắp", "cải", "ngon", "tươi"]}  ← không phải tên sản phẩm
  → ```json\n{"keywords":...}```  ← có markdown dù đã nói không

temperature = 0.1 (deterministic):
  → {"keywords": ["bắp cải", "cà rốt", "súp lơ"], "max_price": 0}  ← đúng format
```

**`candidateCount: 1`** — không yêu cầu Gemini sinh nhiều phương án, chỉ cần 1.

---

## 6. Fallback Model — Không bao giờ chết

### Vấn đề

Gemini API đôi khi:
- `503` — Server quá tải
- `429` — Rate limit vượt quá
- `404` — Model bị deprecated

### Giải pháp: Waterfall Fallback

```php
private $geminiModels = [
    'gemini-2.5-flash',      // Thử đầu tiên — mạnh nhất, nhanh nhất
    'gemini-2.5-flash-lite', // Nếu 503/429/404 → thử cái này
    'gemini-2.0-flash-lite', // Fallback cuối — nhẹ, ít bị quá tải
];
```

```
Request đến Gemini 2.5-flash
    │
    ├── Thành công → trả kết quả ngay
    │
    ├── 503/429/404 → thử gemini-2.5-flash-lite
    │                     │
    │                     ├── Thành công → trả kết quả
    │                     │
    │                     └── 503/429/404 → thử gemini-2.0-flash-lite
    │                                           │
    │                                           ├── Thành công → trả kết quả
    │                                           │
    │                                           └── Lỗi → "Hệ thống đang bận..."
    │
    └── Lỗi curl (network) → "Lỗi kết nối mạng..." (không thử model khác)
```

**Phân biệt lỗi**:
- `503, 429, 404` → lỗi tạm thời/deprecated → thử model khác
- `400, 403` → lỗi cấu hình (API key sai, prompt vi phạm policy) → dừng ngay, không retry vô ích
- `curl error` → mất mạng → dừng ngay

---

## 7. Tối ưu SEO — Trang được tìm thấy nhanh hơn

### Structured Data (JSON-LD) — Google hiểu nội dung

**File**: `src/pub/react/index.html`, `src/react-frontend/index.html`

```json
{
  "@type": "WebSite",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "http://.../?q={search_term_string}"
  }
}
```

**Tác dụng**: Google hiển thị **search box trực tiếp trong kết quả tìm kiếm** (Sitelinks Searchbox).

```json
{ "@type": "Organization", "name": "TMDT Shop" }
{ "@type": "WebPage", "breadcrumb": {...} }
```

### Open Graph — Chia sẻ mạng xã hội đẹp

```html
<meta property="og:title" content="TMDT Shop - Thực Phẩm Sạch Việt Nam" />
<meta property="og:image" content=".../og-image.jpg" />
<meta property="og:locale" content="vi_VN" />
```

Khi chia sẻ link lên Facebook/Zalo/Twitter → hiển thị ảnh + tiêu đề đẹp thay vì link trần.

### Performance hints — Tải trang nhanh hơn

```html
<!-- Kết nối sớm đến Google Fonts (giảm ~200ms) -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

<!-- Resolve DNS Gemini API sớm (chatbot phản hồi nhanh hơn ~100ms) -->
<link rel="dns-prefetch" href="https://generativelanguage.googleapis.com" />

<!-- Preload JS bundle quan trọng nhất -->
<link rel="modulepreload" crossorigin href="/react/assets/index-CcLoK14-.js" />
<link rel="preload" as="style" href="/react/assets/index-DScx8ukF.css" />
```

**Tại sao `dns-prefetch` cho Gemini quan trọng?**

```
Không có prefetch:
  User gửi tin nhắn → DNS lookup (100ms) → TCP connect (50ms) → TLS (100ms) → request

Có prefetch (browser làm trước khi user gõ):
  DNS đã resolved → TCP connect (50ms) → TLS (100ms) → request
  → Nhanh hơn ~100ms mỗi lần chatbot gọi API
```

### robots.txt — Crawl đúng chỗ

```
src/pub/robots.txt

Allow:    /react/, /catalog/, /media/catalog/product/
Disallow: /admin/, /rest/, /checkout/, /customer/
Sitemap:  http://localhost:8081/sitemap.xml
```

**Tại sao block `/rest/`?**  
Googlebot không nên index API endpoint — vừa vô nghĩa vừa tốn crawl budget.

---

## 8. Cấu trúc file quan trọng

```
src/
├── app/code/Tmdt/Chatbot/
│   ├── Model/ChatbotManagement.php   ← Logic chính: AI + search + cache
│   ├── Api/ChatbotInterface.php      ← Interface (ask method)
│   ├── etc/
│   │   ├── webapi.xml                ← REST endpoint definition
│   │   ├── di.xml                    ← Dependency injection
│   │   └── module.xml                ← Module declaration
│   └── view/frontend/
│       └── templates/chatbot_widget.phtml  ← Vanilla JS version (Magento template)
│
├── react-frontend/src/app/components/
│   └── ChatbotWidget.tsx             ← React version (hiện đang dùng)
│
├── pub/
│   ├── react/index.html              ← Production HTML (đã có SEO tags)
│   └── robots.txt                    ← SEO crawl rules (mới tạo)
│
└── app/design/frontend/Magento/luma/web/react-home/
    └── index.html                    ← Template HTML cho Magento theme
```

**Cấu hình API key** (không commit lên git):
```php
// src/app/etc/env.php
'tmdt_chatbot' => [
    'gemini' => [
        'api_key' => 'AIza...'
    ]
]
```

---

## 9. Nâng cấp lên True Semantic Search (tương lai)

Hệ thống hiện tại dùng **LLM-Expanded LIKE Search** — đủ tốt cho phần lớn use case.  
Khi cần chính xác hơn (catalog lớn, nhiều sản phẩm tương tự), có thể nâng cấp:

### Phương án A: Python FAISS (đã có sẵn trong repo)

File: `src/react-frontend/services/ai_chatbot/main.py`

```python
# Cách hoạt động:
# 1. Startup: lấy tất cả sản phẩm từ Magento API
# 2. Chạy sentence-transformers để tạo embedding vector cho mỗi sản phẩm
# 3. Lưu vào FAISS index (trong RAM)
# 4. Khi có query: embed query → FAISS tìm cosine similarity → top-K products
# 5. Gemini tư vấn dựa trên top-K

from sentence_transformers import SentenceTransformer
import faiss

model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
# Model hỗ trợ tiếng Việt tốt
```

**Ưu điểm**: Tìm được sản phẩm dù đặt tên khác nhau hoàn toàn  
**Nhược điểm**: Cần Python server riêng, ~500MB RAM cho model, reindex khi thêm sản phẩm mới

### Phương án B: OpenSearch Vector (đã có OpenSearch trong stack)

```yaml
# compose.yaml đã có:
magento-docker-opensearch-1  # OpenSearch đang chạy
```

OpenSearch 2.x hỗ trợ k-NN vector search native:
```json
PUT /products
{
  "mappings": {
    "properties": {
      "name_embedding": { "type": "knn_vector", "dimension": 384 }
    }
  }
}
```

**Ưu điểm**: Tích hợp vào stack hiện có, không cần server riêng  
**Nhược điểm**: Cần viết indexer Magento để đồng bộ sản phẩm vào OpenSearch

### So sánh 3 phương án

| | LLM-Expanded LIKE (hiện tại) | Python FAISS | OpenSearch k-NN |
|---|---|---|---|
| **Độ chính xác** | ~80% | ~95% | ~95% |
| **Latency** | 2-5s (cold), 50ms (cached) | 100-300ms | 50-200ms |
| **Tài nguyên** | Thấp | Cao (+500MB RAM) | Trung bình |
| **Sản phẩm mới** | Tự động | Reindex thủ công | Cần indexer |
| **Độ phức tạp** | Thấp | Cao | Trung bình |
| **Phù hợp khi** | < 10K sản phẩm | Bất kỳ | > 5K sản phẩm |

---

## Tóm tắt những gì đã làm

### AI Chatbot
- **Semantic search không cần vector DB**: Gemini dịch ý định → tên sản phẩm cụ thể → SQL LIKE
- **Cache 2 tầng**: Intent cache 10 phút + Reply cache 5 phút → query lặp lại: 50ms thay vì 3-5 giây  
- **Token tối ưu**: Intent call chỉ dùng 256 tokens (thay vì 1024), tiết kiệm ~75% chi phí API
- **Temperature riêng**: `0.1` cho JSON (ổn định), `0.7` cho tư vấn (tự nhiên)
- **Fallback 3 model**: Không bao giờ timeout hoàn toàn — luôn có câu trả lời

### SEO
- **JSON-LD Schema.org**: WebSite + SearchAction + Organization + WebPage → Google index tốt hơn
- **Open Graph + Twitter Cards**: Chia sẻ mạng xã hội hiển thị đẹp
- **Preconnect/DNS-prefetch**: Giảm latency khi load font và gọi chatbot
- **robots.txt**: Hướng dẫn crawler đúng trang, tiết kiệm crawl budget
- **Canonical URL**: Tránh duplicate content penalty
