import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap as GoogleMapComponent, useJsApiLoader, Marker as MarkerComponent } from '@react-google-maps/api';

const GoogleMap = GoogleMapComponent as any;
const Marker = MarkerComponent as any;
import {
  MapPin, Navigation, Store, X, Clock, Phone,
  ChevronUp, Layers, LocateFixed, Search, SlidersHorizontal
} from 'lucide-react';
import { Link } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

// Custom map style — clean, minimal, matches app's light aesthetic
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'landscape', stylers: [{ color: '#f8f8f8' }] },
  { featureType: 'water', stylers: [{ color: '#c9e8f5' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'simplified' }] },
];

function getStoreStatus(openingTime?: string, closingTime?: string, is24Hours?: boolean, workingDays?: string) {
  // Check working days first
  if (workingDays) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = dayNames[new Date().getDay()];
    if (!workingDays.includes(today)) {
      return { isOpen: false, label: 'Closed Today' };
    }
  }
  if (is24Hours) return { isOpen: true, label: 'Open 24 Hours' };
  if (!openingTime || !closingTime) return null;
  const now = new Date();
  const [openH, openM] = openingTime.split(':').map(Number);
  const [closeH, closeM] = closingTime.split(':').map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;
  const isOpen =
    closeMin > openMin ? nowMin >= openMin && nowMin < closeMin : nowMin >= openMin || nowMin < closeMin;
  const fmt = (h: number, m: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };
  return {
    isOpen,
    label: isOpen
      ? `Open · Closes ${fmt(closeH, closeM)}`
      : `Closed · Opens ${fmt(openH, openM)}`,
  };
}

const STORE_CATEGORIES = [
  'Electronics', 'Fashion', 'Grocery', 'Food', 'Beauty', 'Sports', 'Health',
  'General', 'Jewellery', 'Vehicles', 'Education', 'Services', 'Furniture', 'Pharmacy'
];

export default function MapPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [radius, setRadius] = useState<number>(5);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [storesExpanded, setStoresExpanded] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Distance helper
  const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number): string => {
    const d = getDistanceKm(lat1, lng1, lat2, lng2);
    return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
  };

  const getZoomForRadius = (r: number) => {
    if (r <= 2) return 15;
    if (r <= 5) return 13;
    if (r <= 10) return 12;
    if (r <= 25) return 11;
    return 10;
  };

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    id: 'google-map-script',
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation(DEFAULT_CENTER)
      );
    } else {
      setUserLocation(DEFAULT_CENTER);
    }
  }, []);

  useEffect(() => {
    fetch('/api/stores?limit=200')
      .then(r => r.ok ? r.json() : { stores: [] })
      .then(data => setStores(Array.isArray(data) ? data : (data.stores ?? [])))
      .catch(() => setStores([]));
  }, []);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setZoom(getZoomForRadius(radius));
    }
  }, [radius]);

  const recenterMap = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.panTo(userLocation);
      mapRef.current.setZoom(15);
    }
  };

  const flyToStore = (store: any) => {
    if (mapRef.current && store.latitude && store.longitude) {
      mapRef.current.panTo({ lat: store.latitude, lng: store.longitude });
      mapRef.current.setZoom(16);
    }
    setSelectedStore(store);
  };

  const storeStatus = selectedStore
    ? getStoreStatus(selectedStore.openingTime, selectedStore.closingTime, selectedStore.is24Hours, selectedStore.workingDays)
    : null;

  const selectedStoreDistance = selectedStore && userLocation
    ? getDistance(userLocation.lat, userLocation.lng, selectedStore.latitude, selectedStore.longitude)
    : null;

  const filteredStores = stores.filter(
    (s) => {
      // Category filter
      if (selectedCategory && s.category?.toLowerCase() !== selectedCategory.toLowerCase()) return false;
      // Search filter
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.storeName?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.manualProductText?.toLowerCase().includes(q)
      );
    }
  );

  const validStores = filteredStores
    .filter((s) => {
      if (!s.latitude || !s.longitude || s.latitude === 0) return false;
      if (!userLocation) return true;
      const dist = getDistanceKm(userLocation.lat, userLocation.lng, s.latitude, s.longitude);
      return dist <= radius && dist <= 100;
    })
    .sort((a, b) => {
      if (!userLocation) return 0;
      const distA = getDistanceKm(userLocation.lat, userLocation.lng, a.latitude, a.longitude);
      const distB = getDistanceKm(userLocation.lat, userLocation.lng, b.latitude, b.longitude);
      return distA - distB;
    });

  if (loadError) {
    return (
      <div className="max-w-md mx-auto bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">Map failed to load</h2>
          <p className="text-sm text-gray-500 mt-2">Please check your Google Maps API key configuration.</p>
        </div>
      </div>
    );
  }

  if (!isLoaded || !userLocation) {
    return (
      <div className="max-w-md mx-auto bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-medium text-gray-500">Loading map…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative overflow-hidden">

      {/* ── Header ── */}
      <header className="bg-white absolute top-0 left-0 right-0 z-20 border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Nearby Stores</h1>
          <NotificationBell />
        </div>
        {/* Search Bar + Filter */}
        <div className="px-4 pb-2 flex items-center space-x-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search electronics, fashion, grocery..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-gray-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-200 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`p-2.5 rounded-xl border transition-colors flex-shrink-0 ${
              showFilter || selectedCategory ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
            }`}
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>
        {/* Filter Panel */}
        {showFilter && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3 mt-1">
          {/* Categories */}
          <div className="flex space-x-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setSelectedCategory('')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                !selectedCategory ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {STORE_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  selectedCategory === cat ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {/* Radius Filter */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold text-gray-700">Search Radius</span>
              <span className="text-xs font-bold text-indigo-600">{radius} km</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>
        </div>
        )}
      </header>

      {/* ── Google Map ── */}
      <div className={`absolute inset-0 pb-16 ${showFilter ? 'pt-[210px]' : 'pt-[112px]'}`} style={{ transition: 'padding-top 0.2s ease' }}>
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={userLocation}
          zoom={getZoomForRadius(radius)}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onClick={() => setSelectedStore(null)}
          options={{
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeId: mapType,
            styles: mapType === 'roadmap' ? MAP_STYLES : [],
            clickableIcons: false,
          }}
        >
          {/* User dot */}
          <Marker
            position={userLocation}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#4F46E5',
              fillOpacity: 1,
              strokeWeight: 3,
              strokeColor: '#ffffff',
            }}
            zIndex={100}
            title="You are here"
          />

          {/* Store markers */}
          {validStores.map((store) => {
            const sStatus = getStoreStatus(store.openingTime, store.closingTime, store.is24Hours, store.workingDays);
            const isSelected = selectedStore?.id === store.id;
            const pinColor = isSelected ? '#4F46E5' : (sStatus?.isOpen ? '#10B981' : '#EF4444');
            return (
            <Marker
              key={store.id}
              position={{ lat: store.latitude, lng: store.longitude }}
              onClick={() => flyToStore(store)}
              icon={{
                url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
                    <ellipse cx="20" cy="46" rx="6" ry="2" fill="rgba(0,0,0,0.15)"/>
                    <path d="M20 0C9 0 0 9 0 20c0 15 20 28 20 28S40 35 40 20C40 9 31 0 20 0z"
                      fill="${pinColor}"
                      stroke="#ffffff"
                      stroke-width="2"/>
                    <circle cx="20" cy="18" r="10" fill="#000" stroke="#fff" stroke-width="1.5"/>
                    <text x="20" y="22" text-anchor="middle" font-size="12" font-family="sans-serif"
                      fill="#ffffff">🏪</text>
                  </svg>`)}`,
                scaledSize: new google.maps.Size(40, 48),
                anchor: new google.maps.Point(20, 48),
              }}
              zIndex={isSelected ? 20 : 10}
            />
          );
          })}
        </GoogleMap>
      </div>

      {/* ── Floating Map Controls ── */}
      <div className="absolute right-4 z-10 flex flex-col space-y-2"
        style={{ top: showFilter ? '220px' : '124px', transition: 'top 0.2s ease' }}>
        {/* Recenter */}
        <button
          onClick={recenterMap}
          className="w-10 h-10 bg-white shadow-md border border-gray-200 rounded-full flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition-colors"
          title="Your location"
        >
          <LocateFixed size={18} />
        </button>
        {/* Map type toggle */}
        <button
          onClick={() => setMapType(t => t === 'roadmap' ? 'satellite' : 'roadmap')}
          className="w-10 h-10 bg-white shadow-md border border-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
          title="Toggle map type"
        >
          <Layers size={18} />
        </button>
      </div>

      {/* ── Store Count Pill ── */}
      {!selectedStore && (
        <div
          className="absolute left-4 z-10 bg-white shadow-md border border-gray-100 rounded-full px-3 py-1.5 flex items-center space-x-1.5"
          style={{ top: showFilter ? '220px' : '124px', transition: 'top 0.2s ease' }}
        >
          <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
          <span className="text-xs font-semibold text-gray-700">
            {validStores.length} store{validStores.length !== 1 ? 's' : ''} nearby
          </span>
        </div>
      )}

      {/* ── Store Details Bottom Sheet ── */}
      {selectedStore && (
        <div className="absolute bottom-16 left-0 right-0 px-4 pb-2 z-20">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">

            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-8 h-1 bg-gray-200 rounded-full"></div>
            </div>

            {/* Store info */}
            <div className="px-4 pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-black rounded-xl overflow-hidden flex-shrink-0">
                    <img
                      src={selectedStore.logoUrl || '/uploads/default-logo.png'}
                      alt={selectedStore.storeName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900 truncate">{selectedStore.storeName}</h3>
                    </div>
                    {selectedStore.category && (
                      <p className="text-xs text-indigo-600 font-medium mt-0.5">{selectedStore.category}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStore(null)}
                  className="ml-2 w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0"
                >
                  <X size={14} className="text-gray-500" />
                </button>
              </div>

              {/* Status & address */}
              <div className="mt-3 space-y-1.5">
                {selectedStoreDistance && (
                  <div className="flex items-center space-x-1.5 text-xs text-gray-500">
                    <MapPin size={13} className="text-indigo-500 flex-shrink-0" />
                    <span className="font-semibold">{selectedStoreDistance} away</span>
                  </div>
                )}
                {storeStatus && (
                  <div className="flex items-center space-x-1.5">
                    <Clock size={13} className={storeStatus.isOpen ? 'text-green-500' : 'text-red-400'} />
                    <span className={`text-xs font-medium ${storeStatus.isOpen ? 'text-green-600' : 'text-red-500'}`}>
                      {storeStatus.label}
                    </span>
                  </div>
                )}
                {selectedStore.address && (
                  <div className="flex items-center space-x-1.5">
                    <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600 truncate">{selectedStore.address}</span>
                  </div>
                )}
                {selectedStore.phone && (
                  <div className="flex items-center space-x-1.5">
                    <Phone size={13} className="text-gray-400" />
                    <span className="text-xs text-gray-600">{selectedStore.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-4 pb-4 flex space-x-3">
              <Link
                to={`/store/${selectedStore.id}`}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold text-center hover:bg-gray-200 transition-colors flex items-center justify-center space-x-1.5"
              >
                <Store size={14} />
                <span>View Store</span>
              </Link>
              <a
                href={
                  selectedStore.latitude && selectedStore.longitude && selectedStore.latitude !== 0
                    ? `https://www.google.com/maps/dir/?api=1&destination=${selectedStore.latitude},${selectedStore.longitude}`
                    : '#'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center space-x-1.5 hover:bg-indigo-700 transition-colors"
              >
                <Navigation size={14} />
                <span>Navigate</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Stores Near You — Expandable ── */}
      {!selectedStore && validStores.length > 0 && (
        <div className={`absolute bottom-16 left-0 right-0 px-4 z-10 transition-all duration-300 ${storesExpanded ? 'max-h-[60vh]' : ''}`}>
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            {/* Header — clickable to expand/collapse */}
            <button
              onClick={() => setStoresExpanded(!storesExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between"
            >
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stores Near You ({validStores.length})</p>
              <ChevronUp size={14} className={`text-gray-400 transition-transform duration-300 ${storesExpanded ? '' : 'rotate-180'}`} />
            </button>

            {/* Collapsed: horizontal scroll of small circles */}
            {!storesExpanded && (
              <div className="px-4 pb-3 flex space-x-2 overflow-x-auto scrollbar-none">
                {validStores.slice(0, 8).map((store) => (
                  <button
                    key={store.id}
                    onClick={() => flyToStore(store)}
                    className="flex-shrink-0 flex flex-col items-center space-y-1 w-14"
                  >
                    <div className="w-11 h-11 bg-black rounded-xl overflow-hidden border-2 border-transparent hover:border-indigo-400 transition-all">
                      <img
                        src={store.logoUrl || '/uploads/default-logo.png'}
                        alt={store.storeName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[9px] font-medium text-gray-600 text-center leading-tight line-clamp-2 w-full">
                      {store.storeName}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Expanded: scrollable list of detail cards */}
            {storesExpanded && (
              <div className="px-3 pb-3 max-h-[50vh] overflow-y-auto space-y-2">
                {validStores.map((store) => {
                  const sStatus = getStoreStatus(store.openingTime, store.closingTime, store.is24Hours, store.workingDays);
                  const dist = userLocation ? getDistance(userLocation.lat, userLocation.lng, store.latitude, store.longitude) : null;
                  return (
                    <div
                      key={store.id}
                      className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden hover:border-indigo-200 transition-colors"
                    >
                      <button
                        onClick={() => { flyToStore(store); setStoresExpanded(false); }}
                        className="w-full p-3 text-left"
                      >
                        {/* Top row: logo + info */}
                        <div className="flex items-start space-x-3">
                          <div className="w-12 h-12 bg-black rounded-xl overflow-hidden flex-shrink-0">
                            <img
                              src={store.logoUrl || '/uploads/default-logo.png'}
                              alt={store.storeName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-sm text-gray-900 truncate">{store.storeName}</h4>
                            </div>
                            {store.category && <p className="text-xs text-indigo-600 font-medium">{store.category}</p>}
                          </div>
                        </div>
                        {/* Status + Address */}
                        <div className="mt-2 space-y-1">
                          {dist && (
                            <div className="flex items-center text-xs text-gray-500 mb-1">
                              <MapPin size={12} className="mr-1.5 text-indigo-500" />
                              <span className="font-semibold">{dist} away</span>
                            </div>
                          )}
                          {sStatus && (
                            <div className="flex items-center text-xs">
                              <Clock size={12} className={`mr-1.5 ${sStatus.isOpen ? 'text-green-500' : 'text-red-500'}`} />
                              <span className={`font-semibold ${sStatus.isOpen ? 'text-green-600' : 'text-red-500'}`}>
                                {sStatus.label}
                              </span>
                            </div>
                          )}
                          {store.address && (
                            <div className="flex items-center text-xs text-gray-500">
                              <MapPin size={12} className="mr-1.5 text-gray-400" />
                              <span className="truncate">{store.address}</span>
                            </div>
                          )}
                          {store.phone && (
                            <div className="flex items-center text-xs text-gray-500">
                              <Phone size={12} className="mr-1.5 text-gray-400" />
                              <span>{store.phone}</span>
                            </div>
                          )}
                        </div>
                      </button>
                      {/* Action buttons */}
                      <div className="px-3 pb-3 flex space-x-3 border-t border-gray-100 pt-3 mt-2">
                        <Link
                          to={`/store/${store.id}`}
                          className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-xs font-semibold text-center hover:bg-gray-200 transition-colors flex items-center justify-center space-x-1.5"
                        >
                          <Store size={14} />
                          <span>View Store</span>
                        </Link>
                        <a
                          href={store.latitude && store.longitude && store.latitude !== 0 ? `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}` : '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 hover:bg-indigo-700 transition-colors"
                        >
                          <Navigation size={14} />
                          <span>Navigate</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
