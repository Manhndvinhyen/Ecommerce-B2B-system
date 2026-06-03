import { useState, useEffect } from 'react';
import {
  MapPin,
  RefreshCw,
  X,
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudFog,
  Snowflake,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface WeatherData {
  cityName: string;
  temp: number;
  humidity: number;
  weatherCode: number;
  isGps: boolean;
}

interface CachedData {
  cityName: string;
  temp: number;
  humidity: number;
  weatherCode: number;
  lat: number;
  lon: number;
  isGps: boolean;
  timestamp: number;
}

const CACHE_KEY = 'freso_weather_cache_v2';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
const DISMISS_KEY = 'freso_weather_dismissed';

// Format city name from English to Vietnamese if needed (for IP API fallbacks)
function formatRegionName(region: string): string {
  const normalized = region.trim().toLowerCase();
  if (normalized.includes('hanoi') || normalized.includes('ha noi')) return 'Hà Nội';
  if (normalized.includes('ho chi minh') || normalized.includes('sai gon') || normalized.includes('saigon')) return 'TP. Hồ Chí Minh';
  if (normalized.includes('da nang') || normalized.includes('danang')) return 'Đà Nẵng';
  if (normalized.includes('hai phong') || normalized.includes('haiphong')) return 'Hải Phòng';
  if (normalized.includes('can tho') || normalized.includes('cantho')) return 'Cần Thơ';
  if (normalized.includes('quang ninh')) return 'Quảng Ninh';
  if (normalized.includes('khanh hoa') || normalized.includes('nha trang')) return 'Khánh Hòa';
  if (normalized.includes('dong nai')) return 'Đồng Nai';
  if (normalized.includes('binh duong')) return 'Bình Dương';
  return region;
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsDenied, setGpsDenied] = useState<boolean>(false);

  useEffect(() => {
    // Check if dismissed in this session
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (dismissed === 'true') {
      setIsDismissed(true);
    }

    loadWeatherData(true);
  }, []);

  // Fetch location and then fetch weather
  const loadWeatherData = async (useGps: boolean = true) => {
    if (useGps) {
      setGpsLoading(true);
      setGpsDenied(false);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // 1. Check Cache
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsedCache: CachedData = JSON.parse(cached);
        const age = Date.now() - parsedCache.timestamp;
        if (age < CACHE_DURATION && (!useGps || parsedCache.isGps)) {
          setWeather({
            cityName: parsedCache.cityName,
            temp: parsedCache.temp,
            humidity: parsedCache.humidity,
            weatherCode: parsedCache.weatherCode,
            isGps: parsedCache.isGps
          });
          setLoading(false);
          setGpsLoading(false);
          setGpsDenied(false);
          return;
        }
      }

      let lat: number;
      let lon: number;
      let cityName = '';
      let isGps = false;

      if (useGps && navigator.geolocation) {
        // Precise location using GPS
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              enableHighAccuracy: true
            });
          });
          lat = position.coords.latitude;
          lon = position.coords.longitude;
          isGps = true;
          setGpsDenied(false);

          // Try reverse geocoding via Nominatim to get Vietnamese name
          try {
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=vi`,
              { headers: { 'User-Agent': 'FresoWeatherWidget/1.0' } }
            );
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              if (geoData.address) {
                cityName = geoData.address.city ||
                  geoData.address.town ||
                  geoData.address.suburb ||
                  geoData.address.village ||
                  geoData.address.state ||
                  'Vị trí của bạn';
              } else {
                cityName = 'Vị trí của bạn';
              }
            } else {
              cityName = 'Vị trí của bạn';
            }
          } catch (geoErr) {
            console.warn('Reverse geocoding failed, fallback to default label', geoErr);
            cityName = 'Vị trí của bạn';
          }
        } catch (geoErr: any) {
          console.warn('Geolocation GPS failed or denied', geoErr);
          if (geoErr && geoErr.code === 1) {
            // User denied Geolocation (PERMISSION_DENIED)
            setGpsDenied(true);
            throw new Error('Quyền định vị bị từ chối.');
          }
          // Fall back to IP-based if GPS fails due to other reasons
          const ipData = await fetchIpLocation();
          lat = ipData.lat;
          lon = ipData.lon;
          cityName = ipData.cityName;
        }
      } else {
        // IP-based geolocation
        const ipData = await fetchIpLocation();
        lat = ipData.lat;
        lon = ipData.lon;
        cityName = ipData.cityName;
      }

      // 2. Fetch Weather Data from Open-Meteo
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code`
      );
      if (!weatherRes.ok) {
        throw new Error('Không thể tải thông tin thời tiết cho vị trí hiện tại.');
      }

      const weatherData = await weatherRes.json();
      const temp = Math.round(weatherData.current.temperature_2m);
      const humidity = Math.round(weatherData.current.relative_humidity_2m);
      const weatherCode = weatherData.current.weather_code;

      // Update State
      setWeather({ cityName, temp, humidity, weatherCode, isGps });

      // Save to cache
      const cacheData: CachedData = {
        cityName,
        temp,
        humidity,
        weatherCode,
        lat,
        lon,
        isGps,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

    } catch (err: any) {
      console.error('Weather load error:', err);
      setError(err?.message || 'Không thể xác định vị trí hoặc tải dữ liệu thời tiết.');
    } finally {
      setLoading(false);
      setGpsLoading(false);
    }
  };

  // Helper to fetch IP Location details
  const fetchIpLocation = async () => {
    // We request from free.freeipapi.com (handles CORS and HTTPS cleanly)
    const ipRes = await fetch('https://free.freeipapi.com/api/json');
    if (!ipRes.ok) {
      throw new Error('Lỗi kết nối định vị IP.');
    }
    const ipData = await ipRes.json();
    
    if (!ipData.latitude || !ipData.longitude) {
      throw new Error('Không thể định vị được địa chỉ IP hiện tại.');
    }

    const lat = ipData.latitude;
    const lon = ipData.longitude;
    let cityName = 'Vị trí của bạn';

    if (ipData.regionName) {
      cityName = formatRegionName(ipData.regionName);
    } else if (ipData.cityName) {
      cityName = formatRegionName(ipData.cityName);
    }

    return { lat, lon, cityName };
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, 'true');
    setIsDismissed(true);
  };

  const triggerGpsLocate = () => {
    loadWeatherData(true);
  };

  const handleShowInstruction = () => {
    alert(
      "Hướng dẫn cấp lại quyền vị trí:\n" +
      "1. Nhấp vào biểu tượng 🔒 (Khóa) hoặc biểu tượng Cài đặt ở góc trái thanh địa chỉ trình duyệt.\n" +
      "2. Tìm mục 'Vị trí' (Location) và chuyển sang 'Cho phép' (Allow) hoặc đặt lại cài đặt.\n" +
      "3. Tải lại trang (F5) để widget hiển thị thời tiết chính xác tại khu vực của bạn."
    );
  };

  if (isDismissed) {
    return null;
  }

  // Weather style and details mapper based on WMO code
  const getWeatherDetails = (code: number) => {
    // Clear sky
    if (code === 0) {
      return {
        condition: 'Clear',
        description: 'nắng đẹp',
        emoji: '☀️',
        bgClass: 'bg-gradient-to-r from-amber-50 to-orange-100/90 border-amber-200 text-amber-950',
        iconClass: 'text-amber-500 hover:rotate-45 transition-transform duration-500',
        iconComp: Sun,
        notice: '✅ Thời tiết thuận lợi, cam kết giao hàng đúng hẹn',
        noticeClass: 'bg-green-100/80 text-green-800 border border-green-200'
      };
    }
    // Clouds
    if ([1, 2, 3].includes(code)) {
      return {
        condition: 'Clouds',
        description: 'nhiều mây',
        emoji: '⛅',
        bgClass: 'bg-gradient-to-r from-blue-50/80 to-slate-100 border-sky-100 text-slate-800',
        iconClass: 'text-sky-400',
        iconComp: Cloud,
        notice: '✅ Thời tiết thuận lợi, cam kết giao hàng đúng hẹn',
        noticeClass: 'bg-green-100/80 text-green-800 border border-green-200'
      };
    }
    // Mist / Fog
    if ([45, 48].includes(code)) {
      return {
        condition: 'Mist',
        description: 'có sương mù',
        emoji: '🌫️',
        bgClass: 'bg-gradient-to-r from-zinc-50 to-slate-200/90 border-zinc-300 text-zinc-900',
        iconClass: 'text-zinc-400',
        iconComp: CloudFog,
        notice: '⚠️ Sương mù hạn chế tầm nhìn, một số đơn hàng có thể giao chậm 10-20 phút',
        noticeClass: 'bg-amber-100/80 text-amber-800 border border-amber-200'
      };
    }
    // Rain
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
      let desc = 'đang mưa';
      if ([51, 53, 55].includes(code)) desc = 'mưa phùn nhẹ';
      else if ([61, 80].includes(code)) desc = 'mưa vừa';
      else if ([63, 65, 81, 82].includes(code)) desc = 'mưa to';
      return {
        condition: 'Rain',
        description: desc,
        emoji: '🌧️',
        bgClass: 'bg-gradient-to-r from-blue-50 to-indigo-100/90 border-blue-200 text-indigo-950',
        iconClass: 'text-blue-500 animate-bounce',
        iconComp: CloudRain,
        notice: '⚠️ Một số đơn hàng có thể giao chậm 15-30 phút do trời mưa',
        noticeClass: 'bg-rose-100/80 text-rose-800 border border-rose-200'
      };
    }
    // Thunderstorm
    if ([95, 96, 99].includes(code)) {
      return {
        condition: 'Thunderstorm',
        description: 'có giông bão',
        emoji: '⛈️',
        bgClass: 'bg-gradient-to-r from-slate-800 to-indigo-950 border-slate-700 text-slate-100 shadow-md',
        iconClass: 'text-yellow-400 animate-pulse',
        iconComp: CloudLightning,
        notice: '⚠️ Thời tiết giông bão nguy hiểm, một số đơn hàng có thể giao chậm 30-45 phút',
        noticeClass: 'bg-red-500/20 text-red-200 border border-red-500/30'
      };
    }
    // Snow
    if ([71, 73, 75, 77, 85, 86].includes(code)) {
      return {
        condition: 'Snow',
        description: 'có tuyết rơi',
        emoji: '❄️',
        bgClass: 'bg-gradient-to-r from-sky-50 to-blue-100 border-sky-200 text-sky-950',
        iconClass: 'text-sky-400 animate-spin',
        iconComp: Snowflake,
        notice: '⚠️ Tuyết rơi ảnh hưởng di chuyển, một số đơn hàng có thể giao chậm 20-40 phút',
        noticeClass: 'bg-sky-100/80 text-sky-800 border border-sky-200'
      };
    }
    // Fallback
    return {
      condition: 'Clear',
      description: 'trời quang đãng',
      emoji: '☀️',
      bgClass: 'bg-gradient-to-r from-amber-50 to-orange-100/90 border-amber-200 text-amber-950',
      iconClass: 'text-amber-500',
      iconComp: Sun,
      notice: '✅ Thời tiết ổn định, cam kết giao hàng đúng hẹn',
      noticeClass: 'bg-green-100/80 text-green-800 border border-green-200/50'
    };
  };

  if (loading) {
    return (
      <div className="w-full bg-gray-50 border-b border-gray-100 py-3.5 px-4 animate-pulse">
        <div className="container mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-gray-200 rounded-full"></div>
            <div className="h-4 w-48 bg-gray-200 rounded"></div>
          </div>
          <div className="h-4 w-32 bg-gray-200 rounded hidden md:block"></div>
          <div className="h-4 w-64 bg-gray-200 rounded hidden lg:block"></div>
        </div>
      </div>
    );
  }

  if (gpsDenied) {
    return (
      <div className="w-full bg-amber-50 border-b border-amber-100 py-3.5 px-4 shadow-sm text-amber-900">
        <div className="container mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-1.5 rounded-xl bg-amber-100/80 text-amber-600">
              <MapPin className="size-5" />
            </span>
            <span className="text-xs md:text-sm font-medium">
              📍 Để biết vị trí của bạn ảnh hưởng như thế nào đến tình trạng giao hàng và thời gian nhận hàng, vui lòng chia sẻ vị trí của bạn.
            </span>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={handleShowInstruction}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white hover:bg-amber-100/50 transition-colors border border-amber-200 text-amber-800"
            >
              Cách cấp quyền
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-full hover:bg-black/5 active:bg-black/10 transition-colors text-amber-700"
              title="Ẩn thông báo"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="w-full bg-amber-50 border-b border-amber-100 py-2.5 px-4 text-xs text-amber-800">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" />
            <span>Không thể xác định vị trí thời tiết của bạn. Vui lòng cấp quyền định vị hoặc thử lại.</span>
          </div>
          <button 
            onClick={() => loadWeatherData()} 
            className="flex items-center gap-1 hover:text-amber-950 transition-colors font-medium ml-4"
          >
            <RefreshCw className="size-3" /> Thử lại
          </button>
        </div>
      </div>
    );
  }

  const details = getWeatherDetails(weather.weatherCode);
  const WeatherIconComp = details.iconComp;

  return (
    <div className={`w-full border-b transition-all duration-500 ease-in-out py-3.5 px-4 shadow-sm ${details.bgClass}`}>
      <div className="container mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-6">

        {/* Left Section: Weather status */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2.5">
            <span className={`p-1.5 rounded-xl bg-white/40 shadow-sm ${details.iconClass}`}>
              <WeatherIconComp className="size-5 md:size-5.5" />
            </span>
            <span className="font-semibold text-sm md:text-base leading-tight">
              {details.emoji} {weather.cityName} {details.description}
            </span>
          </div>

          <span className="text-gray-400/80 hidden sm:inline">|</span>

          {/* Middle Section: Temp & Humidity */}
          <div className="flex items-center gap-1.5 text-xs md:text-sm font-medium opacity-90">
            <span className="font-bold">{weather.temp}°C</span>
            <span className="opacity-40">|</span>
            <span>Độ ẩm {weather.humidity}%</span>
          </div>

          {/* GPS Locate Button */}
          <button
            onClick={triggerGpsLocate}
            disabled={gpsLoading}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/50 hover:bg-white/80 transition-all border border-black/5 disabled:opacity-50 ml-1.5 ${weather.isGps ? 'text-green-700 bg-green-50/70 border-green-200/50' : 'text-gray-700'
              }`}
            title="Định vị chính xác bằng GPS"
          >
            <MapPin className={`size-3 ${gpsLoading ? 'animate-spin' : ''}`} />
            {gpsLoading ? 'Đang định vị...' : weather.isGps ? 'Đã định vị' : 'Gần bạn'}
          </button>
        </div>

        {/* Right Section: Delivery Alert & Actions */}
        <div className="flex items-center justify-between md:justify-end gap-3.5 w-full md:w-auto border-t border-black/5 pt-2.5 md:pt-0 md:border-t-0">

          {/* Delivery delay warning */}
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium border shadow-xs transition-colors flex items-center gap-2 ${details.noticeClass}`}>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${details.condition === 'Clear' || details.condition === 'Clouds' ? 'bg-green-400' : 'bg-rose-400'
                }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${details.condition === 'Clear' || details.condition === 'Clouds' ? 'bg-green-500' : 'bg-rose-500'
                }`}></span>
            </span>
            <span>{details.notice}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Manual refresh button */}
            <button
              onClick={() => loadWeatherData()}
              className="p-1.5 rounded-full hover:bg-black/5 active:bg-black/10 transition-colors text-current opacity-60 hover:opacity-100"
              title="Cập nhật thời tiết"
            >
              <RefreshCw className="size-4" />
            </button>

            {/* Close/Dismiss button */}
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-full hover:bg-black/5 active:bg-black/10 transition-colors text-current opacity-60 hover:opacity-100"
              title="Ẩn widget"
            >
              <X className="size-4" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
