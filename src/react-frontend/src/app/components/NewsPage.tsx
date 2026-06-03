import React, { useState, useEffect } from 'react';
import { 
  Newspaper, 
  RefreshCw, 
  Calendar, 
  ExternalLink, 
  Search, 
  BookOpen, 
  X, 
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Tag
} from 'lucide-react';

interface Article {
  guid: string;
  title: string;
  link: string;
  summary: string;
  image: string;
  pubDate: string;
  category: string;
  timestamp: number;
  source: string;
}

const KEYWORDS = [
  'nông sản', 'nông nghiệp', 'xuất khẩu nông sản', 'giá nông sản',
  'cà phê', 'lúa gạo', 'gạo', 'hồ tiêu', 'trái cây', 'thủy sản', 'hải sản',
  'tôm', 'cá tra', 'phân bón', 'xuất khẩu gạo', 'nông dân', 'sầu riêng',
  'thanh long', 'mắc ca', 'hạt điều', 'chăn nuôi', 'thu hoạch', 'giá lúa',
  'giá heo', 'giá tiêu', 'giá cà phê', 'trồng trọt', 'mùa vụ', 'thương lái',
  'chôm chôm', 'măng cụt', 'vải thiều', 'nhãn', 'dưa hấu', 'xoài', 'mía đường',
  'ngư dân', 'nuôi biển', 'thức ăn chăn nuôi', 'heo hơi', 'lâm sản',
  'logistics', 'chuỗi cung ứng', 'thị trường hàng hóa', 'rau quả', 'nông lâm'
];

const CATEGORIES = [
  { id: 'all', label: 'Tất cả tin tức', color: 'bg-green-100 text-green-800' },
  { id: 'market', label: 'Giá cả & Thị trường', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'export', label: 'Xuất nhập khẩu', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { id: 'agriculture', label: 'Nông nghiệp & Nông dân', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'logistics', label: 'Logistics & Chuỗi cung ứng', color: 'bg-sky-100 text-sky-800 border-sky-200' },
  { id: 'seafood', label: 'Thủy hải sản', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'produce', label: 'Trái cây & Rau củ', color: 'bg-rose-100 text-rose-800 border-rose-200' }
];

// Fallback images to make the interface premium when articles don't have images
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?auto=format&fit=crop&q=80&w=800', // coffee
  'https://images.unsplash.com/photo-1534073828943-f801091bb18c?auto=format&fit=crop&q=80&w=800', // rice field
  'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&q=80&w=800', // fresh vegetables
  'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?auto=format&fit=crop&q=80&w=800', // logistics cargo
  'https://images.unsplash.com/photo-1516253593875-bd7ba052fbc5?auto=format&fit=crop&q=80&w=800'  // pepper/spices
];

export function NewsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  const ITEMS_PER_PAGE = 21;

  // Reset page to 1 when search query or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  // Load from local storage on mount
  useEffect(() => {
    loadCachedData();
  }, []);

  const loadCachedData = () => {
    try {
      const cachedArticles = localStorage.getItem('freso_news_articles');
      const cachedTime = localStorage.getItem('freso_news_last_synced');
      
      if (cachedArticles && cachedTime) {
        const parsedArticles = JSON.parse(cachedArticles) as Article[];
        
        // Force sync immediately if cache contains old data without source info
        const hasOldFormat = parsedArticles.length > 0 && parsedArticles.some(a => !a.source);
        if (hasOldFormat) {
          console.log('[News] Old format detected. Syncing new multiple feeds directly...');
          localStorage.removeItem('freso_news_articles');
          localStorage.removeItem('freso_news_last_synced');
          syncNews();
          return;
        }

        setArticles(parsedArticles);
        
        const lastSyncedDate = new Date(parseInt(cachedTime, 10));
        setLastSynced(formatLastSyncedTime(lastSyncedDate));
        setLoading(false);

        // Check if 30 minutes have passed (30 * 60 * 1000 = 1,800,000 ms)
        const timeDiff = Date.now() - parseInt(cachedTime, 10);
        if (timeDiff > 1800000) {
          console.log('[News] Cache expired. Syncing automatically...');
          syncNews();
        }
      } else {
        // No cache, fetch immediately
        syncNews();
      }
    } catch (err) {
      console.error('[News] Error loading cached data:', err);
      syncNews();
    }
  };

  const formatLastSyncedTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${hours}:${minutes}:${seconds} ngày ${day}/${month}`;
  };

  const classifyArticle = (title: string, summary: string): string => {
    const text = `${title} ${summary}`.toLowerCase();
    
    if (text.includes('giá') || text.includes('thị trường') || text.includes('tiêu dùng') || text.includes('chi phí') || text.includes('mua bán') || text.includes('giá heo') || text.includes('giá lúa') || text.includes('giá tiêu') || text.includes('giá cà phê') || text.includes('heo hơi')) {
      return 'market';
    }
    if (text.includes('xuất khẩu') || text.includes('nhập khẩu') || text.includes('giao thương') || text.includes('thương mại') || text.includes('đối tác') || text.includes('thuế quan')) {
      return 'export';
    }
    if (text.includes('logistics') || text.includes('vận chuyển') || text.includes('chuỗi cung ứng') || text.includes('kho bãi') || text.includes('cảng') || text.includes('tàu biển') || text.includes('container') || text.includes('vận tải')) {
      return 'logistics';
    }
    if (text.includes('thủy sản') || text.includes('hải sản') || text.includes('tôm') || text.includes('cá tra') || text.includes('cá hồi') || text.includes('đánh bắt') || text.includes('ngư dân') || text.includes('bè cá') || text.includes('nuôi biển')) {
      return 'seafood';
    }
    if (text.includes('trái cây') || text.includes('rau củ') || text.includes('sầu riêng') || text.includes('thanh long') || text.includes('xoài') || text.includes('mắc ca') || text.includes('hạt điều') || text.includes('bưởi') || text.includes('chuối') || text.includes('chôm chôm') || text.includes('vải thiều') || text.includes('nhãn') || text.includes('dưa hấu')) {
      return 'produce';
    }
    // Default to agriculture if keyword is met
    return 'agriculture';
  };

  const syncNews = async () => {
    setSyncing(true);
    setError(null);
    try {
      const rssFeeds = [
        { url: 'https://vnexpress.net/rss/kinh-doanh.rss', source: 'VnExpress' },
        { url: 'https://vnexpress.net/rss/thoi-su.rss', source: 'VnExpress' },
        { url: 'https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss', source: 'VnExpress' },
        { url: 'https://vnexpress.net/rss/tin-moi-nhat.rss', source: 'VnExpress' },
        { url: 'https://nongnghiepmoitruong.vn/nong-nghiep.rss', source: 'Báo Nông nghiệp VN' },
        { url: 'https://nongnghiepmoitruong.vn/trong-trot.rss', source: 'Báo Nông nghiệp VN' },
        { url: 'https://nongnghiepmoitruong.vn/chan-nuoi.rss', source: 'Báo Nông nghiệp VN' },
        { url: 'https://nongnghiepmoitruong.vn/thuy-san.rss', source: 'Báo Nông nghiệp VN' },
        { url: 'https://nongnghiepmoitruong.vn/nong-san-viet.rss', source: 'Báo Nông nghiệp VN' },
        { url: 'https://nongnghiepmoitruong.vn/thi-truong.rss', source: 'Báo Nông nghiệp VN' },
        { url: 'https://nongnghiepmoitruong.vn/vat-tu-nong-nghiep.rss', source: 'Báo Nông nghiệp VN' }
      ];

      const parseXml = (xmlText: string, source: string) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const items = xmlDoc.getElementsByTagName('item');
        
        const list: any[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const title = item.getElementsByTagName('title')[0]?.textContent || '';
          const link = item.getElementsByTagName('link')[0]?.textContent || '';
          const description = item.getElementsByTagName('description')[0]?.textContent || '';
          const pubDateStr = item.getElementsByTagName('pubDate')[0]?.textContent || '';
          const guid = item.getElementsByTagName('guid')[0]?.textContent || link;
          
          list.push({ title, link, description, pubDateStr, guid, source });
        }
        return list;
      };

      const fetchFeed = async (feed: { url: string; source: string }) => {
        const timestampedUrl = `${feed.url}?t=${Date.now()}`;
        
        // 1. Try local PHP RSS proxy first (same origin, bypasses CORS & 403 Forbidden)
        try {
          const proxyUrl = `/health_check.php?url=${encodeURIComponent(timestampedUrl)}`;
          const response = await fetch(proxyUrl);
          if (response.ok) {
            const xmlText = await response.text();
            return parseXml(xmlText, feed.source);
          }
          console.warn(`[News] Local proxy responded with status ${response.status} for ${feed.url}, trying public backup...`);
        } catch (e) {
          console.warn(`[News] Local proxy failed for ${feed.url}, trying public backup...`, e);
        }

        // 2. Try AllOrigins proxy as first public backup
        try {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(timestampedUrl)}`;
          const response = await fetch(proxyUrl);
          if (response.ok) {
            const xmlText = await response.text();
            return parseXml(xmlText, feed.source);
          }
          console.warn(`[News] AllOrigins proxy responded with status ${response.status} for ${feed.url}, trying second backup...`);
        } catch (e) {
          console.warn(`[News] AllOrigins proxy failed for ${feed.url}, trying second backup...`, e);
        }

        // 3. Try CorsProxy.io as second public backup
        try {
          const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(timestampedUrl)}`;
          const response = await fetch(proxyUrl);
          if (response.ok) {
            const xmlText = await response.text();
            return parseXml(xmlText, feed.source);
          }
        } catch (e) {
          console.warn(`[News] CorsProxy.io failed for ${feed.url} too:`, e);
        }

        return []; // Always return empty array instead of undefined
      };

      const results = await Promise.all(rssFeeds.map(fetchFeed));
      
      // Filter out any undefined or null results just in case, then flatten
      const allRawArticles = results.filter(Boolean).flat();

      if (allRawArticles.length === 0) {
        throw new Error('Không lấy được dữ liệu từ các nguồn RSS.');
      }

      const parsedArticles: Article[] = [];
      const seenGuids = new Set<string>();

      for (let i = 0; i < allRawArticles.length; i++) {
        const raw = allRawArticles[i];

        if (!raw || !raw.guid) continue; // Undefined item guard

        if (seenGuids.has(raw.guid)) continue;

        // Parse image source
        const matchImg = raw.description.match(/src="([^"]+)"/);
        let image = matchImg ? matchImg[1] : '';
        
        // Extract fallback image if src is not inside double quotes (nongnghiep.vn sometimes uses src=URL without quotes or with single quotes)
        if (!image) {
          const matchSingleImg = raw.description.match(/src='([^']+)'/);
          image = matchSingleImg ? matchSingleImg[1] : '';
        }
        if (!image) {
          const matchUnquotedImg = raw.description.match(/src=([^\s>]+)/);
          image = matchUnquotedImg ? matchUnquotedImg[1].replace(/['"]/g, '') : '';
        }

        if (image && image.includes('_180x108')) {
          image = image.replace('_180x108', '_500x300');
        }

        const summary = raw.description.replace(/<[^>]*>/g, '').trim();
        const timestamp = Date.parse(raw.pubDateStr) || Date.now();

        // Check keywords: if from Nong Nghiep, bypass keyword check. If from VnExpress, check strictly.
        const isFromNongNghiep = raw.source === 'Báo Nông nghiệp VN';
        const textToSearch = `${raw.title} ${summary}`.toLowerCase();
        const matchesKeyword = isFromNongNghiep || KEYWORDS.some(keyword => textToSearch.includes(keyword));

        if (matchesKeyword) {
          seenGuids.add(raw.guid);
          const category = classifyArticle(raw.title, summary);
          parsedArticles.push({
            guid: raw.guid,
            title: raw.title,
            link: raw.link,
            summary,
            image: image || FALLBACK_IMAGES[parsedArticles.length % FALLBACK_IMAGES.length],
            pubDate: raw.pubDateStr,
            category,
            timestamp,
            source: raw.source
          });
        }
      }

      // Sort articles by date descending
      parsedArticles.sort((a, b) => b.timestamp - a.timestamp);

      // Update state & cache
      setArticles(parsedArticles);

      const now = Date.now();
      localStorage.setItem('freso_news_articles', JSON.stringify(parsedArticles));
      localStorage.setItem('freso_news_last_synced', String(now));
      setLastSynced(formatLastSyncedTime(new Date(now)));
    } catch (err) {
      console.error('[News] Error syncing news:', err);
      setError('Không thể đồng bộ tin tức mới nhất. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.');
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  };

  // Filter & Search Logic
  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          article.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalArticles = filteredArticles.length;
  const totalPages = Math.ceil(totalArticles / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedArticles = filteredArticles.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const getCategoryLabel = (catId: string) => {
    return CATEGORIES.find(c => c.id === catId)?.label || 'Tin tức';
  };

  const getCategoryColor = (catId: string) => {
    return CATEGORIES.find(c => c.id === catId)?.color || 'bg-gray-100 text-gray-800';
  };

  // Formatting date string nicely
  const formatDateString = (pubDateStr: string): string => {
    try {
      const date = new Date(pubDateStr);
      if (isNaN(date.getTime())) return pubDateStr;
      
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${hours}:${minutes} - ${day}/${month}/${year}`;
    } catch {
      return pubDateStr;
    }
  };

  return (
    <div style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }} className="min-h-screen bg-slate-50/50 pb-16 text-gray-800">
      
      {/* Hero Banner Section */}
      <section className="bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#0f766e] text-white py-12 px-6 shadow-md relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-green-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full blur-2xl pointer-events-none -ml-16 -mb-16"></div>

        <div className="max-w-[1200px] mx-auto relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold tracking-wider text-green-200 border border-white/10 uppercase flex items-center gap-1.5 shadow-sm">
                <TrendingUp size={12} className="animate-pulse" />
                VnExpress RSS Sync
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 flex items-center gap-3">
              <Newspaper size={36} className="text-green-300 drop-shadow-md" />
              Tin Tức Nông Sản
            </h1>
            <p className="text-green-100 text-sm max-w-xl font-medium">
              Cập nhật liên tục giá cả thị trường, thông tin xuất khẩu, chính sách và logistics nông nghiệp Việt Nam từ các nguồn VnExpress và Báo Nông nghiệp Việt Nam uy tín.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 flex flex-col items-start gap-2 shadow-xl w-full md:w-auto min-w-[280px]">
            <div className="flex items-center gap-2 text-xs font-semibold text-green-200">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400"></span>
              </span>
              <span>Đồng bộ tự động mỗi 30 phút</span>
            </div>
            <div className="text-xs text-white/90">
              Cập nhật cuối: <span className="font-bold text-white">{lastSynced || 'Chưa cập nhật'}</span>
            </div>
            <button
              onClick={syncNews}
              disabled={syncing}
              className="mt-1 w-full bg-green-500 hover:bg-green-600 active:scale-95 text-white py-2 px-4 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
            </button>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 mt-8">
        
        {/* Search & Categories Filter bar */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col gap-4">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 size-5" />
            <input
              type="text"
              placeholder="Nhập từ khóa tìm kiếm tin tức..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-green-600 focus:bg-white transition-all shadow-inner placeholder-slate-400 text-gray-800"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Tag size={12} />
              <span>Chủ đề nông nghiệp</span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {CATEGORIES.map(category => {
                const isActive = selectedCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 text-xs font-bold rounded-full transition-all duration-150 border active:scale-95 ${
                      isActive 
                        ? 'bg-green-600 border-green-600 text-white shadow-md shadow-green-600/10'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    {category.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Error notice */}
        {error && (
          <div className="mt-6 p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl flex items-start gap-3 shadow-xs">
            <AlertTriangle className="size-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs font-semibold">{error}</div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs animate-pulse flex flex-col h-[400px]">
                <div className="h-[200px] bg-slate-200 w-full" />
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="h-4 bg-slate-200 rounded-full w-1/3" />
                    <div className="h-5 bg-slate-200 rounded-full w-full" />
                    <div className="h-5 bg-slate-200 rounded-full w-5/6" />
                    <div className="h-4 bg-slate-200 rounded-full w-full" />
                    <div className="h-4 bg-slate-200 rounded-full w-4/5" />
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
                    <div className="h-4 bg-slate-200 rounded-full w-1/4" />
                    <div className="h-8 bg-slate-200 rounded-xl w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Grid list of articles */}
            {filteredArticles.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                  {paginatedArticles.map((article) => (
                    <article 
                      key={article.guid}
                      className="bg-white rounded-2xl border border-slate-100 hover:border-slate-250 overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col h-[420px] group cursor-pointer"
                      onClick={() => setActiveArticle(article)}
                    >
                      {/* Cover image container */}
                      <div className="h-[200px] w-full overflow-hidden relative bg-slate-100 shrink-0">
                        <img 
                          src={article.image} 
                          alt={article.title} 
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            const imgTarget = e.target as HTMLImageElement;
                            imgTarget.src = FALLBACK_IMAGES[2]; // fallback
                          }}
                        />
                        <span className={`absolute top-3 left-3 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shadow-md tracking-wider border z-10 ${getCategoryColor(article.category)}`}>
                          {getCategoryLabel(article.category)}
                        </span>
                      </div>

                      {/* Content Area */}
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <h2 className="text-base font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-green-700 transition-colors">
                            {article.title}
                          </h2>
                          <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">
                            {article.summary}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 text-[11px] text-gray-400 font-medium">
                          <div className="flex items-center gap-1">
                            <Calendar size={13} />
                            <span>{formatDateString(article.pubDate)}</span>
                          </div>
                          
                          <button 
                            className="flex items-center gap-1 font-bold text-green-700 hover:text-green-800 transition-colors group-hover:translate-x-1 transition-transform duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveArticle(article);
                            }}
                          >
                            Xem tiếp
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 mt-12 pt-6 gap-4">
                    <span className="text-xs font-semibold text-slate-500">
                      Hiển thị <span className="font-bold text-slate-800">{startIndex + 1}</span> - <span className="font-bold text-slate-800">{Math.min(startIndex + ITEMS_PER_PAGE, totalArticles)}</span> trong tổng số <span className="font-bold text-slate-800">{totalArticles}</span> bài viết
                    </span>
                    
                    <div className="flex items-center gap-1.5">
                      {/* Previous Page Button */}
                      <button
                        onClick={() => {
                          if (currentPage > 1) {
                            setCurrentPage(currentPage - 1);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        disabled={currentPage === 1}
                        className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-slate-600 disabled:opacity-40 disabled:pointer-events-none transition-all duration-150 flex items-center justify-center cursor-pointer"
                        aria-label="Trang trước"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      
                      {/* Page Numbers */}
                      {Array.from({ length: totalPages }, (_, idx) => {
                        const pageNum = idx + 1;
                        if (totalPages > 6 && pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - currentPage) > 1) {
                          if (pageNum === 2 && currentPage > 3) return <span key="ellipsis-start" className="px-1.5 text-slate-400 text-xs">...</span>;
                          if (pageNum === totalPages - 1 && currentPage < totalPages - 2) return <span key="ellipsis-end" className="px-1.5 text-slate-400 text-xs">...</span>;
                          return null;
                        }
                        
                        const isPageActive = currentPage === pageNum;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => {
                              setCurrentPage(pageNum);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className={`w-9 h-9 text-xs font-bold rounded-xl border transition-all duration-150 flex items-center justify-center active:scale-95 cursor-pointer ${
                              isPageActive
                                ? 'bg-green-600 border-green-600 text-white shadow-md shadow-green-600/10'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350 hover:bg-slate-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      {/* Next Page Button */}
                      <button
                        onClick={() => {
                          if (currentPage < totalPages) {
                            setCurrentPage(currentPage + 1);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        disabled={currentPage === totalPages}
                        className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-slate-600 disabled:opacity-40 disabled:pointer-events-none transition-all duration-150 flex items-center justify-center cursor-pointer"
                        aria-label="Trang sau"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Empty State
              <div className="bg-white rounded-3xl border border-slate-100 py-16 px-6 text-center shadow-xs mt-8 max-w-md mx-auto">
                <div className="w-16 h-16 bg-slate-50 border border-slate-200 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <BookOpen size={28} />
                </div>
                <h3 className="text-base font-bold text-gray-800 mb-1">Không tìm thấy bài viết nào</h3>
                <p className="text-xs text-gray-400 max-w-xs mx-auto mb-4">
                  Không tìm thấy tin tức phù hợp với từ khóa của bạn hoặc không khớp với các bài viết nông nghiệp được lọc.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs py-2 px-4 rounded-full transition-colors shadow-sm cursor-pointer"
                >
                  Xóa bộ lọc tìm kiếm
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Lightbox / Detail Modal */}
      {activeArticle && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
          onClick={() => setActiveArticle(null)}
        >
          <div 
            className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col relative select-text"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setActiveArticle(null)}
              className="absolute top-4 right-4 z-20 bg-black/40 hover:bg-black/60 text-white hover:scale-105 active:scale-95 transition-all p-2 rounded-full shadow-lg"
              aria-label="Đóng"
            >
              <X size={16} />
            </button>

            {/* Modal Scrollable container */}
            <div className="overflow-y-auto flex-1">
              
              {/* Modal Cover Image */}
              <div className="h-[280px] sm:h-[340px] w-full relative bg-slate-100">
                <img 
                  src={activeArticle.image} 
                  alt={activeArticle.title} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const imgTarget = e.target as HTMLImageElement;
                    imgTarget.src = FALLBACK_IMAGES[2];
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-5 right-5 text-white z-10">
                  <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shadow-md tracking-wider border mr-2 ${getCategoryColor(activeArticle.category)}`}>
                    {getCategoryLabel(activeArticle.category)}
                  </span>
                  <span className="text-xs font-semibold text-white/90 bg-black/35 backdrop-blur-md px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Calendar size={11} /> {formatDateString(activeArticle.pubDate)}
                  </span>
                </div>
              </div>

              {/* Modal Core Contents */}
              <div className="p-6 sm:p-8 space-y-4">
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">
                  {activeArticle.title}
                </h2>
                
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 border-b border-slate-100 pb-3">
                  <span>Nguồn: </span>
                  <span className="text-red-600 uppercase font-extrabold tracking-wide">{activeArticle.source || 'VnExpress'}</span>
                </div>

                <div className="text-sm sm:text-base text-gray-700 leading-relaxed font-normal bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-100">
                  {activeArticle.summary}
                </div>

                <div className="text-xs text-slate-400 italic">
                  * Ghi chú: Đây là tóm tắt từ nguồn RSS feed của {activeArticle.source || 'VnExpress'}. Bản quyền bài viết thuộc về tòa soạn báo {activeArticle.source || 'VnExpress'}.
                </div>
              </div>
            </div>

            {/* Modal Sticky Footer Actions */}
            <div className="bg-slate-50 border-t border-slate-100 p-5 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
              <button
                onClick={() => setActiveArticle(null)}
                className="w-full sm:w-auto px-6 py-2.5 border border-slate-200 hover:bg-white text-gray-600 rounded-xl text-xs font-bold active:scale-95 transition-all"
              >
                Đóng
              </button>
              
              <a
                href={activeArticle.link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-green-600/10"
              >
                Đọc bài viết gốc
                <ExternalLink size={14} />
              </a>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
