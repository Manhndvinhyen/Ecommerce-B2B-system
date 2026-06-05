import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock3, MapPin, Navigation, PackageCheck, Route, Truck, Warehouse } from 'lucide-react';

declare global {
  interface Window {
    L?: any;
  }
}

type LatLng = {
  lat: number;
  lng: number;
};

type TrackingOrder = {
  orderReference: string;
  status?: string;
  statusLabel?: string;
  supplier?: string;
  customerRegion?: string;
  shippingAddress?: string;
  deliveryDate?: string;
  deliveryTime?: string;
};

type OrderTrackingMapProps = {
  order: TrackingOrder;
};

const SIMULATED_SPEED_KMH = 30;
const SHIPPER_STEP = 0.018;
const SHIPPER_TICK_MS = 1800;

const trackingSteps = [
  'Đã đặt hàng',
  'Đã xác nhận',
  'Đang chuẩn bị hàng',
  'Đã bàn giao vận chuyển',
  'Đang giao hàng',
  'Đã giao thành công',
];

const warehouses = [
  { name: 'Kho Bắc Giang', regionHints: ['hà nội', 'quảng ninh', 'bắc'], lat: 21.273, lng: 106.1946 },
  { name: 'Kho Bình Dương', regionHints: ['tp. hồ chí minh', 'hồ chí minh', 'miền tây', 'đà lạt', 'nam'], lat: 10.9805, lng: 106.6517 },
];

const knownDestinations: Array<{ keywords: string[]; lat: number; lng: number; label: string }> = [
  { keywords: ['quận 1', 'quan 1'], lat: 10.776, lng: 106.700, label: 'Quận 1, TP. Hồ Chí Minh' },
  { keywords: ['quận 7', 'quan 7'], lat: 10.732, lng: 106.721, label: 'Quận 7, TP. Hồ Chí Minh' },
  { keywords: ['thủ đức', 'thu duc'], lat: 10.849, lng: 106.772, label: 'Thủ Đức, TP. Hồ Chí Minh' },
  { keywords: ['bình thạnh', 'binh thanh'], lat: 10.801, lng: 106.699, label: 'Bình Thạnh, TP. Hồ Chí Minh' },
  { keywords: ['hà nội', 'ha noi'], lat: 21.0278, lng: 105.8342, label: 'Hà Nội' },
  { keywords: ['đà lạt', 'da lat'], lat: 11.9404, lng: 108.4583, label: 'Đà Lạt' },
  { keywords: ['miền tây', 'can tho', 'cần thơ'], lat: 10.0452, lng: 105.7469, label: 'Miền Tây' },
];

const normalize = (value: string) => value.trim().toLowerCase();

const hashText = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 100000;
  }
  return hash;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const haversineKm = (from: LatLng, to: LatLng) => {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const routeDistanceKm = (points: LatLng[]) =>
  points.reduce((sum, point, index) => {
    if (index === 0) return sum;
    return sum + haversineKm(points[index - 1], point);
  }, 0);

const pointOnRoute = (points: LatLng[], distanceKm: number) => {
  if (points.length === 0) return { lat: 0, lng: 0 };
  if (points.length === 1 || distanceKm <= 0) return points[0];

  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentKm = haversineKm(start, end);
    if (travelled + segmentKm >= distanceKm) {
      const ratio = segmentKm === 0 ? 0 : (distanceKm - travelled) / segmentKm;
      return {
        lat: start.lat + (end.lat - start.lat) * ratio,
        lng: start.lng + (end.lng - start.lng) * ratio,
      };
    }
    travelled += segmentKm;
  }

  return points[points.length - 1];
};

const sliceRouteUntil = (points: LatLng[], distanceKm: number) => {
  if (points.length <= 1) return points;
  const travelledPoint = pointOnRoute(points, distanceKm);
  const result = [points[0]];
  let travelled = 0;

  for (let index = 1; index < points.length; index += 1) {
    const segmentKm = haversineKm(points[index - 1], points[index]);
    if (travelled + segmentKm < distanceKm) {
      result.push(points[index]);
      travelled += segmentKm;
      continue;
    }
    result.push(travelledPoint);
    break;
  }

  return result;
};

const formatDistance = (value: number) => `${value.toFixed(value >= 10 ? 1 : 2)} km`;

const formatEta = (remainingKm: number) => {
  if (remainingKm <= 0.05) return '0 phút';
  const minutes = Math.max(1, Math.round((remainingKm / SIMULATED_SPEED_KMH) * 60));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
};

const pickWarehouse = (supplier: string, customerRegion: string, dbList: any[] = []) => {
  const parts = supplier.split('·').map(p => p.trim());
  const supplierRegion = parts[1] || parts[0] || '';
  const normalizedRegion = normalize(supplierRegion);

  let nameKeyword = 'Bình Dương';
  if (normalizedRegion.includes('hà nội') || normalizedRegion.includes('ha noi') || normalizedRegion.includes('bắc giang') || normalizedRegion.includes('bac giang') || normalizedRegion.includes('bắc') || normalizedRegion.includes('bac')) {
    nameKeyword = 'Bắc Giang';
  } else if (normalizedRegion.includes('đà lạt') || normalizedRegion.includes('da lat')) {
    nameKeyword = 'Bắc Giang';
  }

  const found = dbList.find((w: any) => w.name && w.name.includes(nameKeyword));
  if (found) {
    return { name: found.name, lat: found.lat, lng: found.lng || found.lon };
  }

  // Static fallback if API is still loading or fails
  if (nameKeyword === 'Bắc Giang') {
    return { name: 'Kho Bắc Giang', lat: 21.273, lng: 106.1946 };
  }
  return { name: 'Kho Bình Dương', lat: 10.9805, lng: 106.6517 };
};


const buildDestination = (shippingAddress: string, customerRegion: string, warehouse: LatLng) => {
  const haystack = normalize(`${shippingAddress} ${customerRegion}`);
  const known = knownDestinations.find((destination) =>
    destination.keywords.some((keyword) => haystack.includes(keyword))
  );

  if (known) {
    return { lat: known.lat, lng: known.lng, label: known.label };
  }

  const hash = hashText(haystack || 'freso-demo-destination');
  const latOffset = 0.045 + (hash % 80) / 1000;
  const lngOffset = 0.035 + ((Math.floor(hash / 7) % 90) / 1000);
  const direction = hash % 2 === 0 ? 1 : -1;

  return {
    lat: warehouse.lat + latOffset * direction,
    lng: warehouse.lng + lngOffset,
    label: shippingAddress || customerRegion || 'Địa chỉ nhận hàng mô phỏng',
  };
};

const buildRoute = (warehouse: LatLng, destination: LatLng, seed: string) => {
  const hash = hashText(seed);
  const bend = ((hash % 70) - 35) / 1000;
  const secondBend = (((Math.floor(hash / 5) % 70) - 35) / 1000);

  return [
    warehouse,
    {
      lat: warehouse.lat * 0.68 + destination.lat * 0.32 + bend,
      lng: warehouse.lng * 0.68 + destination.lng * 0.32 - secondBend,
    },
    {
      lat: warehouse.lat * 0.32 + destination.lat * 0.68 - secondBend,
      lng: warehouse.lng * 0.32 + destination.lng * 0.68 + bend,
    },
    destination,
  ];
};

const getTimelineIndex = (status: string | undefined, progress: number) => {
  const normalized = normalize(status || '');
  if (normalized.includes('delivered') || normalized.includes('complete') || progress >= 1) return 5;
  if (normalized.includes('shipping') || normalized.includes('delivering')) return 4;
  if (normalized.includes('processing')) return 2;
  if (normalized.includes('paid')) return progress > 0.2 ? 4 : 3;
  if (normalized.includes('pending')) return 0;
  return progress > 0.2 ? 4 : 3;
};

const loadLeaflet = (onReady: () => void) => {
  if (typeof window !== 'undefined' && window.L) {
    onReady();
    return;
  }

  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.id = 'leaflet-css';
    document.head.appendChild(link);
  }

  const existingScript = document.getElementById('leaflet-js');
  if (existingScript) {
    existingScript.addEventListener('load', onReady, { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.id = 'leaflet-js';
  script.async = true;
  script.onload = onReady;
  document.body.appendChild(script);
};

export function TrackingTimeline({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Tracking Timeline</p>
          <h3 className="text-sm font-black text-slate-900">Tiến trình đơn hàng</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
          {trackingSteps[currentIndex]}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-6">
        {trackingSteps.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <div key={step} className="relative flex gap-3 md:block">
              {index < trackingSteps.length - 1 && (
                <div
                  className={`absolute left-[15px] top-8 h-[calc(100%+0.75rem)] w-px md:left-[calc(50%+18px)] md:top-4 md:h-px md:w-[calc(100%-36px)] ${
                    done ? 'bg-emerald-300' : 'bg-slate-200'
                  }`}
                />
              )}
              <div
                className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-black md:mx-auto ${
                  done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : active
                      ? 'border-emerald-500 bg-white text-emerald-700 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]'
                      : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                {done ? <Check className="size-4" /> : index + 1}
              </div>
              <p
                className={`pt-1 text-xs font-bold md:mt-2 md:text-center ${
                  active || done ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {step}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OrderTrackingMap({ order }: OrderTrackingMapProps) {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [progress, setProgress] = useState(0.34);
  const [dbWarehouses, setDbWarehouses] = useState<any[]>([]);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    fetch('/rest/V1/tmdt-orders/warehouses')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDbWarehouses(data);
        }
      })
      .catch((err) => console.error('Failed to load DB warehouses in tracking map:', err));
  }, []);

  const trackingModel = useMemo(() => {
    const warehouse = pickWarehouse(order.supplier || '', order.customerRegion || '', dbWarehouses);
    const destination = buildDestination(order.shippingAddress || '', order.customerRegion || '', warehouse);
    const routePoints = buildRoute(warehouse, destination, `${order.orderReference}${order.shippingAddress}${order.supplier}`);
    const totalDistanceKm = routeDistanceKm(routePoints);

    return {
      warehouse,
      destination,
      routePoints,
      totalDistanceKm,
    };
  }, [order.customerRegion, order.orderReference, order.shippingAddress, order.supplier, dbWarehouses]);


  const travelledKm = trackingModel.totalDistanceKm * progress;
  const remainingKm = Math.max(0, trackingModel.totalDistanceKm - travelledKm);
  const shipperPosition = pointOnRoute(trackingModel.routePoints, travelledKm);
  const currentIndex = getTimelineIndex(order.status, progress);
  const currentStatus = progress >= 1 ? 'Đã giao thành công' : trackingSteps[currentIndex];

  useEffect(() => {
    loadLeaflet(() => setLeafletLoaded(true));
  }, []);

  useEffect(() => {
    if (progress >= 1) return;
    const timer = window.setInterval(() => {
      setProgress((prev) => Math.min(1, prev + SHIPPER_STEP));
    }, SHIPPER_TICK_MS);

    return () => window.clearInterval(timer);
  }, [progress]);

  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapRef.current || !window.L) return;

    const map = window.L.map(mapContainerRef.current, {
      center: [shipperPosition.lat, shipperPosition.lng],
      zoom: 11,
      zoomControl: false,
      scrollWheelZoom: false,
    });

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);
    window.L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = {};
    };
  }, [leafletLoaded, shipperPosition.lat, shipperPosition.lng]);

  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || !window.L) return;

    Object.values(layersRef.current).forEach((layer) => layer?.remove?.());
    const routeLatLngs = trackingModel.routePoints.map((point) => [point.lat, point.lng]);
    const completedLatLngs = sliceRouteUntil(trackingModel.routePoints, travelledKm).map((point) => [point.lat, point.lng]);

    const warehouseIcon = window.L.divIcon({
      html: '<div style="width:30px;height:30px;border-radius:10px;background:#0f172a;color:white;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 8px 18px rgba(15,23,42,.22);font-size:16px;">⌂</div>',
      className: 'freso-warehouse-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    const destinationIcon = window.L.divIcon({
      html: '<div style="width:28px;height:28px;border-radius:999px;background:#10b981;border:4px solid white;box-shadow:0 8px 18px rgba(16,185,129,.28);"></div>',
      className: 'freso-destination-marker',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const shipperIcon = window.L.divIcon({
      html: '<div style="width:34px;height:34px;border-radius:999px;background:#f97316;color:white;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 10px 24px rgba(249,115,22,.35);font-size:17px;">➤</div>',
      className: 'freso-shipper-marker',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    layersRef.current.remainingRoute = window.L.polyline(routeLatLngs, {
      color: '#cbd5e1',
      weight: 5,
      opacity: 0.95,
      dashArray: '9 10',
    }).addTo(mapRef.current);
    layersRef.current.completedRoute = window.L.polyline(completedLatLngs, {
      color: '#10b981',
      weight: 6,
      opacity: 0.95,
    }).addTo(mapRef.current);
    layersRef.current.warehouse = window.L.marker([trackingModel.warehouse.lat, trackingModel.warehouse.lng], {
      icon: warehouseIcon,
    })
      .bindPopup(trackingModel.warehouse.name)
      .addTo(mapRef.current);
    layersRef.current.destination = window.L.marker([trackingModel.destination.lat, trackingModel.destination.lng], {
      icon: destinationIcon,
    })
      .bindPopup(trackingModel.destination.label)
      .addTo(mapRef.current);
    layersRef.current.shipper = window.L.marker([shipperPosition.lat, shipperPosition.lng], {
      icon: shipperIcon,
    })
      .bindPopup('Shipper mô phỏng')
      .addTo(mapRef.current);

    const bounds = window.L.latLngBounds(routeLatLngs);
    mapRef.current.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
  }, [leafletLoaded, progress, shipperPosition.lat, shipperPosition.lng, trackingModel, travelledKm]);

  return (
    <div className="space-y-4">
      <TrackingTimeline currentIndex={currentIndex} />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Order Tracking Map</p>
              <h3 className="text-sm font-black text-slate-900">Theo dõi đơn hàng trên bản đồ</h3>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-orange-700">
              <Truck className="size-3.5" />
              Shipper mô phỏng
            </span>
          </div>
          <div className="relative h-[340px] bg-slate-100">
            <div ref={mapContainerRef} className="h-full w-full" />
            {!leafletLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-xs font-bold text-slate-500">
                Đang tải bản đồ vận chuyển...
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Trạng thái hiện tại</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                <PackageCheck className="size-5" />
              </div>
              <div>
                <p className="text-base font-black text-slate-900">{currentStatus}</p>
                <p className="text-xs font-semibold text-slate-500">{order.statusLabel || order.status || 'Demo tracking'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <Route className="mb-2 size-4 text-slate-400" />
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Khoảng cách</p>
              <p className="mt-1 text-lg font-black text-slate-900">{formatDistance(trackingModel.totalDistanceKm)}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <Clock3 className="mb-2 size-4 text-slate-400" />
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">ETA còn lại</p>
              <p className="mt-1 text-lg font-black text-slate-900">{formatEta(remainingKm)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex items-start gap-3">
              <Warehouse className="mt-0.5 size-4 text-slate-400" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Điểm xuất phát</p>
                <p className="mt-1 text-xs font-black text-slate-800">{trackingModel.warehouse.name}</p>
              </div>
            </div>
            <div className="my-3 h-px bg-slate-100" />
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 text-emerald-500" />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Địa chỉ nhận hàng</p>
                <p className="mt-1 line-clamp-2 text-xs font-black text-slate-800">
                  {order.shippingAddress || trackingModel.destination.label}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              <span>Tiến độ tuyến đường</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <Navigation className="size-3.5 text-orange-500" />
              Còn lại {formatDistance(remainingKm)} với tốc độ giả lập {SIMULATED_SPEED_KMH} km/h.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
