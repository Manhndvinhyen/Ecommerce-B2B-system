# SEO Checklist & Checkpoints

Production domain used in code: `https://organica.click`

## Checkpoint 1 - SEO Foundation

- [x] Update `robots.txt` sitemap from localhost to production domain.
- [x] Stop blocking every query-string URL while the React app still uses `?view=...` routes.
- [x] Add dynamic route SEO helper for title, description, robots, canonical, Open Graph, Twitter card, and JSON-LD.
- [x] Mark private utility routes as `noindex, nofollow`: login, register, forgot password, cart, wishlist, checkout, dashboard.
- [x] Mark search-result routes as `noindex, follow` to avoid thin/duplicate search-result indexation.
- [x] Add category/search `ItemList` structured data for visible product lists.
- [x] Add product `Product` structured data for product detail pages.
- [x] Add breadcrumb structured data for category/search/product pages.

## Checkpoint 2 - URL & Canonical Cleanup

- [x] Canonicalize product detail pages by SKU instead of volatile `id` query params.
- [x] Canonicalize category pages by category/subcategory query params.
- [ ] Add clean public routes such as `/san-pham/{slug}-{sku}` and `/danh-muc/{category}`.
- [ ] Add Magento/Nginx rewrite rules that serve React routes from clean URLs.
- [ ] Redirect old query URLs to clean URLs once clean routes are stable.
- [ ] Generate canonical tags on the first HTML response for clean URLs.

## Checkpoint 3 - Magento Catalog SEO Data

- [ ] Extend product import CSV with `meta_title`, `meta_description`, and image labels.
- [ ] Review category meta title/description in Magento admin or seed script.
- [ ] Ensure product/category URL keys are unique, stable, lowercase, and Vietnamese-slug friendly.
- [ ] Re-generate Magento sitemap after updating production URLs.
- [ ] Submit `https://organica.click/sitemap.xml` to Google Search Console.

## Checkpoint 4 - Regional SEO

- [ ] Add seller/supplier identity for products.
- [ ] Add seller warehouse/source region fields: province, district, ward, optional latitude/longitude.
- [ ] Add product service-region or delivery-region fields.
- [ ] Add database indexes for public region filters.
- [ ] Create indexable landing pages by category and region, for example:
  - `/danh-muc/rau-cu-qua/tp-ho-chi-minh`
  - `/danh-muc/thuc-pham-tuoi-song/ha-noi`
  - `/nha-cung-cap/tp-ho-chi-minh`
- [ ] Add region landing pages to sitemap.
- [ ] Add `ItemList`, `BreadcrumbList`, and region-specific copy to each landing page.

## Checkpoint 5 - Search Ranking By Buyer-Seller Region

- [ ] Read buyer province/district/ward from `tmdt_customer_registration` after login.
- [ ] Add region boost to search ranking:
  - Exact district match: highest boost.
  - Same province: medium boost.
  - Same service region: lower boost.
- [ ] Keep public/bot search results deterministic and not personalized.
- [ ] Keep logged-in personalized ranking client/API-side and out of SEO canonical pages.

## Checkpoint 6 - Similar Account Recommendations

- [x] Add purchase history storage tables for later recommendation work.
- [x] Add customer purchase history REST API.
- [x] Add dashboard purchase history UI.
- [x] Save checkout items into purchase history after successful checkout.
- [x] Store the customer's latest purchase region for later regional recommendations.
- [ ] Build anonymized account segments from registration type, region, wishlist, cart/order history, and searches.
- [ ] Store aggregate recommendations by segment, not by individual account.
- [ ] Expose public aggregate blocks such as "Doanh nghiệp cùng khu vực thường mua".
- [ ] Do not expose private customer data in crawlable pages.
- [ ] Use recommendation blocks as supporting internal links on category/region pages.

## Checkpoint 7 - Internal Product Search

- [x] Create a broad food-focused synonym dictionary for common food, grocery, fresh food, seafood, meat, vegetable, fruit, dry food, and seasoning terms.
- [x] Connect the synonym dictionary to the current React product search flow.
- [x] Expand a user query into related search terms and merge GraphQL product results by SKU.
- [x] Add product-list filters for mocked supplier region and price sorting.
- [x] Add mocked supplier names/regions until real supplier data exists.
- [x] Re-rank/filter expanded search results to reduce synonym noise.
- [ ] Do not treat mocked supplier data as production-ready. Current mock files/logic:
  - `src/react-frontend/src/app/data/mockSuppliers.ts`
  - mocked supplier fields in `ProductCategoryPage.tsx`
  - `freso_preferred_region` local/session storage in `CheckoutPage.tsx`
  - `customer_region` purchase-history field in `Tmdt_Search`
  These are placeholders until supplier login/profile/product ownership is implemented.
- [ ] Before merging to main, replace mock supplier assignment with real supplier/product-region data.
- [x] Add Magento module `Tmdt_Search`.
- [x] Add Magento product attribute `tmdt_search_keywords`.
- [x] Generate `tmdt_search_keywords` from product name, SKU, category, descriptions, origin, and synonym dictionary.
- [x] Hook keyword generation into product save.
- [x] Add CLI command `tmdt:search:regenerate-keywords` for existing/imported products.
- [ ] Run `bin/magento setup:upgrade` so Magento creates the new attribute.
- [ ] Run `bin/magento tmdt:search:regenerate-keywords --reindex` after setup upgrade.
- [ ] Move synonym expansion/ranking from frontend to a backend search module once `Tmdt_Search` exists.

## Verification Checklist

- [x] Run frontend typecheck after SEO changes.
- [x] Run production build after SEO changes.
- [ ] Inspect generated HTML/head in browser for home, category, search, product, login, and checkout routes.
- [ ] Validate JSON-LD with Google Rich Results Test.
- [ ] Verify `robots.txt` and sitemap are reachable on production domain.
