import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, MessageCircle, Store as StoreIcon, Heart, Bookmark, UserPlus, UserCheck, SlidersHorizontal, Check, Share2 } from 'lucide-react';
import StarRating from '../components/StarRating';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function HomePage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<{likedPostIds: string[], savedPostIds: string[], followedStoreIds: string[]}>({
    likedPostIds: [], savedPostIds: [], followedStoreIds: []
  });
  const [loading, setLoading] = useState(true);
  const { token, user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isOwnPost = (post: any) => post.isOwnPost === true;
  const getStoreLink = (post: any) => isOwnPost(post) ? '/profile' : `/store/${post.storeId}`;
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
  };
  const [feedType, setFeedType] = useState('global'); // 'global', 'following', or 'saved'
  const [locationRange, setLocationRange] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Carousel State — fetch from admin settings, fallback to defaults
  const defaultBannerImages = [
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
    "https://images.unsplash.com/photo-1555529771-835f59fc5efe?w=800&q=80",
    "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80"
  ];
  const [bannerImages, setBannerImages] = useState<string[]>(defaultBannerImages);
  const [appName, setAppName] = useState('Local Discoveries');
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    fetch('/api/app-settings')
      .then(res => res.json())
      .then(data => {
        if (data.carouselImages && data.carouselImages.length > 0) {
          setBannerImages(data.carouselImages);
        }
        if (data.appName) setAppName(data.appName);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (bannerImages.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % bannerImages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [bannerImages]);

  const fetchFeed = async () => {
    if (!token) return;
    setLoading(true);
    
    try {
       // Fetch interactions first (needed for saved tab)
       const intRes = await fetch(`/api/me/interactions`, {
         headers: { 'Authorization': `Bearer ${token}` }
       });
       
       if (intRes.status === 401 || intRes.status === 403) {
         logout();
         return;
       }
       
       const intData = await intRes.json();
       setInteractions(intData);

       if (feedType === 'saved') {
         const savedRes = await fetch(`/api/users/${user?.id}/saved`, {
           headers: { 'Authorization': `Bearer ${token}` }
         });
         if (savedRes.status === 401 || savedRes.status === 403) { logout(); return; }
         const savedData = await savedRes.json();
         setPosts(Array.isArray(savedData.posts) ? savedData.posts : []);
       } else {
         let lat = 0, lng = 0;
         if (locationRange !== 'all' && navigator.geolocation) {
           try {
             const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
               navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
             });
             lat = pos.coords.latitude;
             lng = pos.coords.longitude;
           } catch (err) {
             console.error("Failed to get location:", err);
           }
         }
         const postsRes = await fetch(`/api/posts?feedType=${feedType}&locationRange=${locationRange}&lat=${lat}&lng=${lng}`, {
           headers: { 'Authorization': `Bearer ${token}` }
         });
         if (postsRes.status === 401 || postsRes.status === 403) {
           logout();
           return;
         }
         const postsData = await postsRes.json();
         setPosts(Array.isArray(postsData.posts) ? postsData.posts : (Array.isArray(postsData) ? postsData : []));
       }
    } catch {
      setPosts([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFeed();
  }, [token, feedType, locationRange]);

  const toggleLike = async (postId: string) => {
    const isLiked = interactions.likedPostIds.includes(postId);
    setInteractions(prev => ({
      ...prev,
      likedPostIds: isLiked ? prev.likedPostIds.filter(id => id !== postId) : [...prev.likedPostIds, postId]
    }));
    try {
      await fetch(`/api/posts/${postId}/like`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    } catch {}
  };

  const toggleSave = async (postId: string) => {
    const isSaved = interactions.savedPostIds.includes(postId);
    setInteractions(prev => ({
      ...prev,
      savedPostIds: isSaved ? prev.savedPostIds.filter(id => id !== postId) : [...prev.savedPostIds, postId]
    }));
    try {
      await fetch(`/api/posts/${postId}/save`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    } catch {}
  };

  const toggleFollow = async (storeId: string) => {
    const isFollowed = interactions.followedStoreIds.includes(storeId);
    setInteractions(prev => ({
      ...prev,
      followedStoreIds: isFollowed ? prev.followedStoreIds.filter(id => id !== storeId) : [...prev.followedStoreIds, storeId]
    }));
    try {
      await fetch(`/api/stores/${storeId}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: user?.id })
      });
    } catch {}
  };

  const handleShare = async (post: any) => {
    const shareData = {
      title: post.store?.storeName || 'Check this out!',
      text: post.caption || `See this post from ${post.store?.storeName}`,
      url: window.location.origin + `/store/${post.storeId}`
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        showToast('Link copied to clipboard!', { type: 'success' });
      }
    } catch (e) { /* user cancelled share */ }
  };

  const getLikeCount = (post: any) => {
    const total = post._count?.likes ?? post.likes?.length ?? 0;
    const initiallyLiked = (post.likes?.length ?? 0) > 0;
    const currentlyLiked = interactions.likedPostIds.includes(post.id);
    if (initiallyLiked && !currentlyLiked) return Math.max(0, total - 1);
    if (!initiallyLiked && currentlyLiked) return total + 1;
    return total;
  };

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen pb-20">
      <header className="bg-white px-4 py-3 sticky top-0 z-20 border-b border-gray-100 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-900">{appName}</h1>
        <NotificationBell />
      </header>

      {/* Carousel Banner */}
      <div className="relative w-full h-40 bg-gray-200 overflow-hidden">
        {bannerImages.map((src, idx) => (
          <img
            key={idx}
            src={src}
            alt="Promotion Banner"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${idx === currentSlide ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
        <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-1.5">
          {bannerImages.map((_, idx) => (
            <span key={idx} className={`block w-1.5 h-1.5 rounded-full transition-colors ${idx === currentSlide ? 'bg-white' : 'bg-white/50'}`} />
          ))}
        </div>
      </div>

      {/* Feed Filters */}
      <div className="bg-white px-4 py-3 shadow-sm mb-4 sticky top-[60px] z-10">
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setFeedType('global')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${feedType === 'global' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              For You
            </button>
            <button 
              onClick={() => setFeedType('following')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${feedType === 'following' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Following
            </button>
            <button 
              onClick={() => setFeedType('saved')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${feedType === 'saved' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Saved
            </button>
          </div>
          <div className="relative">
            <button onClick={() => setShowFilters(!showFilters)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
              <SlidersHorizontal size={18} />
            </button>
            {showFilters && (
              <div className="absolute right-0 top-10 w-48 bg-white shadow-xl rounded-xl border border-gray-100 py-2 z-30">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Distance Range</div>
                <button 
                  onClick={() => { setLocationRange('all'); setShowFilters(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex justify-between items-center"
                >
                  Global <span>{locationRange === 'all' && <Check size={14} className="text-indigo-600"/>}</span>
                </button>
                <button 
                  onClick={() => { setLocationRange('3'); setShowFilters(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex justify-between items-center"
                >
                  Within 3km <span>{locationRange === '3' && <Check size={14} className="text-indigo-600"/>}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="px-4 space-y-6">
        {loading ? (
          <div className="space-y-6">
            {[1,2].map(i => (
              <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 animate-pulse">
                <div className="p-4 flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
                  <div className="flex-1 space-y-2"><div className="h-3 bg-gray-200 rounded w-1/3"></div><div className="h-2 bg-gray-200 rounded w-1/4"></div></div>
                </div>
                <div className="aspect-[3/4] bg-gray-200"></div>
                <div className="p-4 space-y-2"><div className="h-3 bg-gray-200 rounded w-1/2"></div><div className="h-2 bg-gray-200 rounded w-3/4"></div></div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <StoreIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-sm font-medium">
              {feedType === 'saved' ? 'No saved posts yet.' : 'No posts found.'}
            </p>
            <p className="text-xs mt-1 text-gray-400">
              {feedType === 'saved' ? 'Bookmark posts to see them here.' : 'Try adjusting your filters or follow more stores.'}
            </p>
          </div>
        ) : (
          posts.map(post => {
            const isLiked = interactions.likedPostIds.includes(post.id);
            const isSaved = interactions.savedPostIds.includes(post.id);
            const isFollowed = interactions.followedStoreIds.includes(post.storeId);
            const likeCount = getLikeCount(post);

            return (
              <div key={post.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 relative">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Link to={getStoreLink(post)} className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-indigo-600 font-bold flex-shrink-0 border border-gray-100 overflow-hidden">
                       <img src={post.store.logoUrl || '/uploads/default-logo.png'} alt={post.store.storeName} className="w-full h-full object-cover" />
                    </Link>
                    <div>
                      <Link to={getStoreLink(post)} className="block">
                        <h3 className="font-semibold text-gray-900 leading-tight hover:text-indigo-600 transition-colors">
                          {post.store.storeName}
                        </h3>
                        {post.store.owner?.role && post.store.owner.role !== 'customer' && (
                          <span className="inline-block mt-0.5 bg-indigo-100 text-indigo-700 text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wide font-bold">
                            {post.store.owner.role === 'retailer' ? 'Retail Store' : post.store.owner.role}
                          </span>
                        )}
                      </Link>
                      {!post.store.hideRatings && (
                        <div className="flex items-center space-x-2 mt-0.5">
                          <StarRating rating={post.store.averageRating || 0} size={10} />
                        </div>
                      )}
                    </div>
                  </div>
                  {!isOwnPost(post) && (
                    <button
                      onClick={() => toggleFollow(post.storeId)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors flex items-center ${isFollowed ? 'bg-gray-100 text-gray-700' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                    >
                      {isFollowed ? <><UserCheck size={14} className="mr-1" /> Following</> : <><UserPlus size={14} className="mr-1" /> Follow</>}
                    </button>
                  )}
                </div>
                
                <div className="aspect-[3/4] bg-gray-100 relative">
                  <img 
                    src={post.imageUrl || `https://picsum.photos/seed/${post.id}/800/800`} 
                    alt={post.product?.productName || 'Post Image'} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  {post.price && (
                    <div className="absolute bottom-3 left-3 bg-black/70 text-white px-2.5 py-1 rounded-lg text-sm font-bold backdrop-blur-sm">
                      ₹{Number(post.price).toLocaleString()}
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex space-x-4">
                      <button onClick={() => toggleLike(post.id)} className="flex items-center group transition-colors">
                        <Heart size={24} className={`transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-900 group-hover:text-red-500'}`} />
                        <span className="ml-1.5 font-semibold text-sm text-gray-700">{likeCount}</span>
                      </button>
                      {!isOwnPost(post) && post.store.chatEnabled !== false && (
                        <Link to={`/chat/${post.store.ownerId}`} className="flex items-center group transition-colors">
                          <MessageCircle size={24} className="text-gray-900 group-hover:text-indigo-600" />
                        </Link>
                      )}
                      <button onClick={() => handleShare(post)} className="flex items-center group transition-colors">
                        <Share2 size={22} className="text-gray-900 group-hover:text-indigo-600" />
                      </button>
                    </div>
                    <button onClick={() => toggleSave(post.id)} className="group transition-colors">
                      <Bookmark size={24} className={`transition-colors ${isSaved ? 'fill-gray-900 text-gray-900' : 'text-gray-900 group-hover:text-gray-600'}`} />
                    </button>
                  </div>

                  <div className="mt-2">
                    {post.product && (
                        <div className="flex items-center justify-between mb-1">
                          <h2 className="text-sm font-bold text-gray-900 leading-tight">{post.product.productName}</h2>
                          <p className="text-indigo-600 font-bold text-sm">₹{post.product.price?.toLocaleString()}</p>
                        </div>
                    )}
                    {post.caption && (
                      <p className="text-sm text-gray-800 line-clamp-2">
                        <span className="font-semibold mr-1.5">{post.store.storeName}</span>
                        {post.caption}
                      </p>
                    )}
                    {post.createdAt && (
                      <p className="text-[10px] text-gray-400 mt-1">{formatDate(post.createdAt)}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
