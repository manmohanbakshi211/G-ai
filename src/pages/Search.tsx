import { useState, useEffect } from 'react';
import { Search as SearchIcon, Filter, MapPin, Store, X, SlidersHorizontal, Navigation, Clock, ChevronRight, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{products: any[], stores: any[]}>({ products: [], stores: [] });
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [sortBy, setSortBy] = useState('relevance');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const navigate = useNavigate();
  const { token } = useAuth();
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Fetch search history on mount
  useEffect(() => {
    if (!token) return;
    const fetchHistory = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.id) return;
        const res = await fetch(`/api/users/${user.id}/search-history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const uniqueQueries = [...new Set(data.map((d: any) => d.query))] as string[];
          setSearchHistory(uniqueQueries.slice(0, 8));
        }
      } catch {}
    };
    fetchHistory();
  }, [token]);

  // Save search to history
  const saveSearch = (q: string) => {
    if (!q.trim() || !token) return;
    fetch('/api/search-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ query: q.trim() })
    }).then(() => {
      setSearchHistory(prev => {
        const filtered = prev.filter(s => s.toLowerCase() !== q.trim().toLowerCase());
        return [q.trim(), ...filtered].slice(0, 8);
      });
    }).catch(() => {});
  };

  const clearHistory = async () => {
    if (!token) return;
    try {
      await fetch('/api/search-history', { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      setSearchHistory([]);
    } catch {}
  };

  const categories = ['Electronics', 'Fashion', 'Home & Garden', 'Sports', 'Beauty', 'Groceries', 'General', 'Food', 'Vehicles', 'Jewellery', 'Entertainment', 'Health', 'Education', 'Services'];

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation(null)
      );
    }
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults({ products: [], stores: [] });
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      saveSearch(query);
      fetch(`/api/search/ai?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : { products: [], stores: [] })
        .then(data => {
          setResults({ products: Array.isArray(data.products) ? data.products : [], stores: Array.isArray(data.stores) ? data.stores : [] });
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const hasResults = results.products.length > 0 || results.stores.length > 0;

  const filteredProducts = results.products.filter(p => {
    if (selectedCategory && p.category?.toLowerCase() !== selectedCategory.toLowerCase()) return false;
    if (p.price < priceRange[0] || p.price > priceRange[1]) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'price_low') return a.price - b.price;
    if (sortBy === 'price_high') return b.price - a.price;
    if (sortBy === 'name') return a.productName.localeCompare(b.productName);
    return 0;
  });

  const filteredStores = results.stores.filter(s => {
    if (selectedCategory && s.category?.toLowerCase() !== selectedCategory.toLowerCase()) return false;
    return true;
  }).sort((a, b) => {
    const aOpen = isStoreOpen(a).open ? 0 : 1;
    const bOpen = isStoreOpen(b).open ? 0 : 1;
    return aOpen - bOpen;
  });

  const hasFilters = selectedCategory || sortBy !== 'relevance' || priceRange[0] > 0 || priceRange[1] < 10000;
  const clearFilters = () => { setSelectedCategory(''); setPriceRange([0, 10000]); setSortBy('relevance'); };

  // Distance calculation (Haversine)
  const getDistance = (storeLat: number, storeLng: number): string | null => {
    if (!userLocation || !storeLat || !storeLng) return null;
    const R = 6371;
    const dLat = (storeLat - userLocation.lat) * Math.PI / 180;
    const dLon = (storeLng - userLocation.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(storeLat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;
    return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
  };

  // Check if store is open now
  const isStoreOpen = (store: any): { open: boolean, label: string } => {
    // Check working days first
    if (store.workingDays) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const today = dayNames[new Date().getDay()];
      if (!store.workingDays.includes(today)) {
        return { open: false, label: 'Closed Today' };
      }
    }
    if (store.is24Hours) return { open: true, label: 'Open 24 Hours' };
    if (!store.openingTime || !store.closingTime) return { open: false, label: 'Hours not set' };
    const now = new Date();
    const [oh, om] = store.openingTime.split(':').map(Number);
    const [ch, cm] = store.closingTime.split(':').map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const openMins = oh * 60 + om;
    const closeMins = ch * 60 + cm;
    const isOpen = nowMins >= openMins && nowMins < closeMins;
    if (isOpen) {
      return { open: true, label: `Open · Closes at ${formatTime12(store.closingTime)}` };
    } else {
      return { open: false, label: `Closed · Opens at ${formatTime12(store.openingTime)}` };
    }
  };

  const formatTime12 = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const openDirections = (store: any) => {
    if (store.latitude && store.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`, '_blank');
    } else if (store.address) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(store.address)}`, '_blank');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen pb-20">
      <header className="bg-white px-4 py-4 sticky top-0 z-10 border-b border-gray-100 flex items-center space-x-3">
        <div className="flex items-center space-x-3 flex-1">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search products, brands, or stores..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 border-transparent rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-xl transition-colors relative ${showFilters ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <SlidersHorizontal size={20} />
            {hasFilters && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
            )}
          </button>
        </div>
        <NotificationBell />
      </header>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-100 p-4 space-y-4 shadow-sm">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedCategory === cat 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Price Range</label>
            <div className="flex items-center space-x-3">
              <input type="number" min="0" value={priceRange[0]} onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])} className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500" placeholder="Min" />
              <span className="text-gray-400">–</span>
              <input type="number" min="0" value={priceRange[1]} onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])} className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500" placeholder="Max" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Sort By</label>
            <div className="flex flex-wrap gap-2">
              {[{ id: 'relevance', label: 'Relevance' }, { id: 'price_low', label: 'Price: Low → High' }, { id: 'price_high', label: 'Price: High → Low' }, { id: 'name', label: 'Name A-Z' }].map(opt => (
                <button key={opt.id} onClick={() => setSortBy(opt.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${sortBy === opt.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{opt.label}</button>
              ))}
            </div>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-red-500 font-semibold flex items-center">
              <X size={12} className="mr-1" /> Clear All Filters
            </button>
          )}
        </div>
      )}

      <main className="p-4">
        {loading ? (
          <div className="w-full space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 animate-pulse flex space-x-4">
                <div className="w-24 h-24 bg-gray-200 rounded-xl flex-shrink-0"></div>
                <div className="flex-1 space-y-2 py-2"><div className="h-4 bg-gray-200 rounded w-3/4"></div><div className="h-3 bg-gray-200 rounded w-1/2"></div><div className="h-4 bg-gray-200 rounded w-1/4 mt-4"></div></div>
              </div>
            ))}
          </div>
        ) : hasResults ? (
          <div className="space-y-6">
            
            {filteredStores.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Stores ({filteredStores.length})</h2>
                <div className="space-y-3">
                  {filteredStores.map(store => {
                    const status = isStoreOpen(store);
                    const distance = getDistance(store.latitude, store.longitude);
                    return (
                      <div 
                        key={store.id} 
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => navigate(`/store/${store.id}`)}
                      >
                        <div className="p-4">
                          <div className="flex items-start space-x-3 mb-3">
                            <div className="w-12 h-12 bg-black rounded-full overflow-hidden flex-shrink-0">
                              <img src={store.logoUrl || '/uploads/default-logo.png'} alt={store.storeName} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-gray-900 leading-tight flex items-center">
                                {store.storeName}
                                {store.owner?.role && store.owner.role !== 'customer' && (
                                   <span className="ml-1.5 bg-indigo-100 text-indigo-700 text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wide font-bold shrink-0">
                                     {store.owner.role === 'retailer' ? 'Retail Store' : store.owner.role}
                                   </span>
                                )}
                              </h3>
                              {store.category && <p className="text-xs text-gray-500 mt-0.5">{store.category}</p>}
                              <div className="flex flex-col mt-1 space-y-1">
                                {distance ? (
                                  <span className="text-xs text-gray-500 flex items-center">
                                    <MapPin size={10} className="mr-1 text-indigo-500" />
                                    <span className="font-semibold">{distance} away</span>
                                  </span>
                                ) : !userLocation ? (
                                  <span className="text-[10px] text-amber-600 font-medium">📍 Enable location for distance</span>
                                ) : null}
                                <span className={`text-xs font-medium flex items-center ${status.open ? 'text-green-600' : 'text-red-500'}`}>
                                  <Clock size={10} className="mr-1" />
                                  {status.label || (status.open ? 'Open' : 'Closed')}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex space-x-3 mt-3 border-t border-gray-100 pt-3">
                            <Link 
                              to={`/store/${store.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-xs font-semibold text-center hover:bg-gray-200 transition-colors flex items-center justify-center space-x-1.5"
                            >
                              <Store size={14} />
                              <span>View Store</span>
                            </Link>
                            <button 
                              onClick={(e) => { e.stopPropagation(); openDirections(store); }}
                              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 hover:bg-indigo-700 transition-colors"
                            >
                              <Navigation size={14} /> 
                              <span>Navigate</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredProducts.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Products ({filteredProducts.length})</h2>
                <div className="space-y-4">
                  {filteredProducts.map(product => (
                    <div key={product.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex space-x-4">
                      <div className="w-24 h-24 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                        <img src={`https://picsum.photos/seed/${product.id}/200/200`} alt={product.productName} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-bold text-gray-900 leading-tight">{product.productName}</h3>
                          <p className="text-sm text-gray-500 mt-1">{product.brand}</p>
                        </div>
                        <div className="flex items-end justify-between mt-2">
                          <p className="text-lg font-bold text-indigo-600">₹{product.price.toLocaleString()}</p>
                          <Link to={`/store/${product.storeId}`} className="flex items-center text-xs text-gray-500 hover:text-indigo-600">
                            <Store size={12} className="mr-1" />{product.store?.storeName}
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredProducts.length === 0 && filteredStores.length === 0 && hasFilters && (
              <div className="text-center py-10 text-gray-500">
                <Filter className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                <p className="text-sm">No results match your filters.</p>
                <button onClick={clearFilters} className="text-indigo-600 text-sm font-medium mt-2">Clear Filters</button>
              </div>
            )}

          </div>
        ) : query.length >= 2 ? (
          <div className="text-center py-20 text-gray-500">
            <SearchIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p>No results found for "{query}"</p>
          </div>
        ) : (
          <div className="py-6">
            {/* Recent Searches */}
            {searchHistory.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Recent Searches</h2>
                  <button onClick={clearHistory} className="text-xs text-red-500 font-medium flex items-center hover:text-red-600">
                    <Trash2 size={12} className="mr-1" /> Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {searchHistory.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(q)}
                      className="bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100 text-sm text-gray-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors flex items-center"
                    >
                      <Clock size={12} className="mr-1.5 text-gray-400" />
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Popular Categories</h2>
            <div className="grid grid-cols-2 gap-3">
              {categories.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setQuery(cat)}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-left font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
