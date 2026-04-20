import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Phone, Clock, Calendar, MessageCircle, ArrowLeft, Navigation, UserPlus, UserCheck, Grid, Package, Info, Share2, Bookmark, X, Star, ExternalLink, Heart } from 'lucide-react';
import StarRating from '../components/StarRating';
import ReviewModal from '../components/ReviewModal';
import NotificationBell from '../components/NotificationBell';
import { getStoreStatus } from '../lib/storeUtils';
import { useToast } from '../context/ToastContext';

export default function StoreProfilePage() {
  const { id } = useParams();
  const { showToast } = useToast();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [productSearch, setProductSearch] = useState('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const currentUserId = currentUser?.id || '';
  const token = localStorage.getItem('token') || '';
  const currentUserRole = currentUser?.role || 'customer';

  const [interactions, setInteractions] = useState<{likedPostIds: string[], savedPostIds: string[], followedStoreIds: string[]}>({
    likedPostIds: [], savedPostIds: [], followedStoreIds: []
  });

  useEffect(() => {
    if (currentUserId && token) {
      fetch(`/api/me/interactions`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setInteractions(data); })
        .catch(() => {});
    }
  }, [currentUserId]);

  const toggleLike = async (postId: string) => {
    const isLiked = interactions.likedPostIds.includes(postId);
    setInteractions(prev => ({ ...prev, likedPostIds: isLiked ? prev.likedPostIds.filter(id => id !== postId) : [...prev.likedPostIds, postId] }));
    try { await fetch(`/api/posts/${postId}/like`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); } catch (e) { console.error(e); }
  };

  const toggleSave = async (postId: string) => {
    const isSaved = interactions.savedPostIds.includes(postId);
    setInteractions(prev => ({ ...prev, savedPostIds: isSaved ? prev.savedPostIds.filter(id => id !== postId) : [...prev.savedPostIds, postId] }));
    try { await fetch(`/api/posts/${postId}/save`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); } catch (e) { console.error(e); }
  };

  const handleShare = async (post: any) => {
    const url = `${window.location.origin}/store/${store?.id}`;
    try {
      if (navigator.share) await navigator.share({ title: store?.storeName, text: post.caption || '', url });
      else { await navigator.clipboard.writeText(url); showToast('Link copied to clipboard!', { type: 'success' }); }
    } catch (e) {}
  };

  const getLikeCount = (post: any) => {
    const total = post._count?.likes ?? post.likes?.length ?? 0;
    const initiallyLiked = (post.likes?.length ?? 0) > 0;
    const currentlyLiked = interactions.likedPostIds.includes(post.id);
    if (initiallyLiked && !currentlyLiked) return Math.max(0, total - 1);
    if (!initiallyLiked && currentlyLiked) return total + 1;
    return total;
  };

  useEffect(() => {
    fetchStoreData();
  }, [id]);

  useEffect(() => {
    if (selectedPost) {
      setTimeout(() => {
        document.getElementById(`post-${selectedPost.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [selectedPost]);

  const fetchStoreData = async () => {
    try {
      const storeRes = await fetch(`/api/stores/${id}?userId=${currentUserId}`);
      const storeData = await storeRes.json();
      setStore(storeData);
      setIsFollowing(storeData.followers?.length > 0);
      setFollowersCount(storeData._count?.followers || 0);

      const productsRes = await fetch(`/api/products?storeId=${id}`);
      const productsData = await productsRes.json();
      setProducts(Array.isArray(productsData) ? productsData : (productsData.products ?? []));

      const postsRes = await fetch(`/api/stores/${id}/posts`);
      const postsData = await postsRes.json();
      setPosts(Array.isArray(postsData) ? postsData : (postsData.posts ?? []));

      const reviewsRes = await fetch(`/api/reviews/store/${id}`);
      const reviewsData = await reviewsRes.json();
      setReviews(Array.isArray(reviewsData) ? reviewsData : (reviewsData.reviews ?? []));

      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  const toggleFollow = async () => {
    try {
      const res = await fetch(`/api/stores/${id}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: currentUserId })
      });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.following === 'boolean') {
        setIsFollowing(data.following);
        setFollowersCount(prev => data.following ? prev + 1 : Math.max(0, prev - 1));
      }
    } catch {}
  };

  const filteredProducts = products.filter(p =>
    p.productName?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category?.toLowerCase().includes(productSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!store) {
    return <div className="p-4 text-center">Store not found</div>;
  }

  // Check if current user is owner
  const isOwner = store.ownerId === currentUserId;
  const storeStatus = getStoreStatus(store.openingTime, store.closingTime, store.is24Hours, store.workingDays);
  const showReviews = !store.hideRatings;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20">
      <header className="sticky top-0 bg-white z-20 px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center">
          <Link to="/" className="mr-4 text-gray-900">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-lg font-bold text-gray-900 truncate">{store.storeName}</h1>
        </div>
        <div className="flex space-x-3 items-center">
          <Share2 size={20} className="text-gray-900" />
          {isOwner && (
            <Link to="/settings" className="text-gray-900 hover:text-indigo-600 transition-colors">
              <Info size={20} />
            </Link>   
          )}
          <NotificationBell />
        </div>
      </header>

      <main>
        {/* Profile Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center text-indigo-600 font-bold text-3xl flex-shrink-0 border border-gray-200 overflow-hidden">
              <img 
                src={store.logoUrl || '/uploads/default-logo.png'} 
                alt={store.storeName}
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="flex-1 flex justify-around ml-4">
              <div className="flex flex-col items-center">
                <span className="font-bold text-lg text-gray-900">{store._count?.posts || posts.length}</span>
                <span className="text-xs text-gray-500">Posts</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold text-lg text-gray-900">{followersCount}</span>
                <span className="text-xs text-gray-500">Followers</span>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <h2 className="font-bold text-gray-900 text-sm flex items-center">
              {store.storeName}
              {store.owner?.role && store.owner.role !== 'customer' && (
                <span className="ml-2 bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-bold">
                  {store.owner.role === 'retailer' ? 'Retail Store' : store.owner.role}
                </span>
              )}
            </h2>
            {/* Star Rating — only if hideRatings is off */}
            {showReviews && (
              <div className="flex items-center space-x-2 my-1">
                <StarRating rating={store.averageRating || 0} size={14} />
                <span className="text-xs font-medium text-gray-500">
                  {store.averageRating ? store.averageRating.toFixed(1) : 'No ratings'} ({store.reviewCount || 0})
                </span>
              </div>
            )}
            <p className="text-gray-500 text-xs mb-1">{store.category}</p>
            <p className="text-sm text-gray-800 leading-tight">{store.description}</p>

            {/* Store Details Section */}
            <div className="mt-3 space-y-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
              {/* Address */}
              <div className="flex items-start text-xs text-gray-700">
                <MapPin size={14} className="mr-2 mt-0.5 flex-shrink-0 text-indigo-500" />
                <span className="font-medium">{store.address}</span>
              </div>
              {(store.postalCode || store.city || store.state) && (
                <div className="flex items-start text-xs text-gray-700">
                  <MapPin size={14} className="mr-2 mt-0.5 flex-shrink-0 text-indigo-500 invisible" />
                  <span className="text-gray-500">
                    {store.postalCode && <span>{store.postalCode}</span>}
                    {(store.city || store.state) && <span>{store.postalCode ? ' · ' : ''}{[store.city, store.state].filter(Boolean).join(', ')}</span>}
                  </span>
                </div>
              )}

              {/* Phone */}
              {store.phoneVisible !== false && store.phone && (
                <div className="flex items-start text-xs text-gray-700">
                  <Phone size={14} className="mr-2 mt-0.5 flex-shrink-0 text-indigo-500" />
                  <span>{store.phone}</span>
                </div>
              )}

              {/* Open/Closed Status */}
              {storeStatus && (
                <div className="flex items-start text-xs">
                  <Clock size={14} className={`mr-2 mt-0.5 flex-shrink-0 ${storeStatus.isOpen ? 'text-green-500' : 'text-red-500'}`} />
                  <span className={`font-semibold ${storeStatus.isOpen ? 'text-green-600' : 'text-red-600'}`}>
                    {storeStatus.label}
                  </span>
                </div>
              )}

              {/* Timing range (always show if set) */}
              {(store.openingTime || store.closingTime) && (
                <div className="flex items-start text-xs text-gray-600">
                  <Clock size={14} className="mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
                  <span>Hours: {store.openingTime || '--:--'} – {store.closingTime || '--:--'}</span>
                </div>
              )}

              {/* Working Days */}
              {store.workingDays && (
                <div className="flex items-start text-xs text-gray-600">
                  <Calendar size={14} className="mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
                  <span>{store.workingDays}</span>
                </div>
              )}

              {/* Direction to Store — at the bottom of details */}
              {store.latitude && store.longitude && store.latitude !== 0 && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg mt-1 hover:bg-indigo-100 transition-colors w-full justify-center"
                >
                  <Navigation size={14} className="mr-1.5" />
                  Direction to Store
                  <ExternalLink size={10} className="ml-1.5 opacity-60" />
                </a>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 mt-4">
            {isOwner ? (
              <>
                <Link to="/retailer/dashboard" className="flex-1 bg-gray-100 text-gray-900 py-1.5 rounded-lg font-semibold text-sm text-center flex justify-center items-center">
                  Edit Profile
                </Link>
                <Link to="/retailer/dashboard" className="flex-1 bg-gray-100 text-gray-900 py-1.5 rounded-lg font-semibold text-sm text-center flex justify-center items-center">
                  New Post
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={toggleFollow}
                  className={`flex-1 py-1.5 rounded-lg font-semibold text-sm flex items-center justify-center ${
                    isFollowing ? 'bg-gray-100 text-gray-900' : 'bg-indigo-600 text-white'
                  }`}
                >
                  {isFollowing ? <><UserCheck size={16} className="mr-1.5" /> Following</> : <><UserPlus size={16} className="mr-1.5" /> Follow</>}
                </button>
                {store.chatEnabled !== false && (
                  <Link
                    to={`/chat/${store.ownerId}`}
                    className="flex-1 bg-gray-100 text-gray-900 py-1.5 rounded-lg font-semibold text-sm flex items-center justify-center"
                  >
                    Message
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-200 mt-4 sticky top-[53px] bg-white z-10 shadow-sm">
          <button 
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${
              activeTab === 'posts' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
            }`}
          >
            <Grid size={20} />
          </button>
          
          {showReviews && (
            <button 
              onClick={() => setActiveTab('reviews')}
              className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${
                activeTab === 'reviews' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
              }`}
            >
              <Star size={20} />
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="min-h-[300px]">
          {activeTab === 'posts' && (
            <div className="grid grid-cols-3 gap-0.5">
              {[...posts].sort((a,b) => (b.isPinned === a.isPinned ? 0 : b.isPinned ? 1 : -1)).map(post => (
                <div 
                  key={post.id} 
                  className="aspect-[3/4] relative cursor-pointer group"
                  onClick={() => setSelectedPost(post)}
                >
                  <img 
                    src={post.imageUrl} 
                    alt={post.caption || 'Post'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {post.isPinned && (
                    <div className="absolute top-1.5 right-1.5 p-1.5 bg-indigo-600 rounded-full shadow-sm z-10 transition-all">
                      <Star size={12} className="fill-white text-white" />
                    </div>
                  )}
                  {post.product && (
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                      ₹{Number(post.product.price).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
              {posts.length === 0 && (
                <div className="col-span-3 py-10 text-center text-gray-500">
                  <Grid className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                  <p className="text-sm">No posts yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && showReviews && (
            <div className="p-4 bg-gray-50 min-h-[300px]">
              {!isOwner && currentUserRole === 'customer' && (
                <button
                  onClick={() => setIsReviewModalOpen(true)}
                  className="w-full mb-6 py-3 bg-white border border-gray-200 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition-colors shadow-sm"
                >
                  Write a Review
                </button>
              )}

              <div className="space-y-4">
                {reviews.map(review => (
                  <div key={review.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-semibold text-gray-900 text-sm">{review.user.name}</span>
                        <div className="mt-1">
                          <StarRating rating={review.rating} size={12} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-700 mt-2">{review.comment}</p>
                    )}
                  </div>
                ))}
                {reviews.length === 0 && (
                  <div className="py-10 text-center text-gray-500">
                    <Star className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                    <p className="text-sm">No reviews yet for this store.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Post Detail Modal (List View) */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col">
          <header className="flex items-center justify-between p-4 bg-white text-gray-900 border-b border-gray-200 shadow-sm z-10">
            <button onClick={() => setSelectedPost(null)} className="hover:bg-gray-100 p-1.5 rounded-full transition-colors">
              <ArrowLeft size={24} />
            </button>
            <div className="flex flex-col items-center">
              <span className="font-bold text-[10px] text-gray-400 uppercase tracking-widest">Posts</span>
              <span className="font-bold text-sm">{store.storeName}</span>
            </div>
            <div className="w-8"></div>
          </header>
          
          <div className="flex-1 overflow-y-auto pb-20">
            <div className="max-w-md mx-auto sm:py-6">
              {[...posts].sort((a,b) => (b.isPinned === a.isPinned ? 0 : b.isPinned ? 1 : -1)).map(post => {
                const isLiked = interactions.likedPostIds.includes(post.id);
                const isSaved = interactions.savedPostIds.includes(post.id);
                const likeCount = getLikeCount(post);
                return (
                <div key={post.id} id={`post-${post.id}`} className="bg-white mb-4 sm:border sm:border-gray-200 sm:rounded-2xl border-y border-gray-200 shadow-sm overflow-hidden scroll-mt-20">
                  <div className="flex items-center p-3 justify-between">
                     <div className="flex items-center">
                       <div className="w-8 h-8 rounded-full bg-black border border-gray-100 overflow-hidden mr-3">
                         <img src={store.logoUrl || '/uploads/default-logo.png'} alt="store" className="w-full h-full object-cover" />
                       </div>
                       <div>
                         <span className="font-bold text-sm block leading-tight hover:text-indigo-600 transition-colors cursor-pointer">
                           {store.storeName}
                         </span>
                         {store.owner?.role && store.owner.role !== 'customer' && (
                            <span className="inline-block mt-0.5 mb-0.5 bg-indigo-100 text-indigo-700 text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wide font-bold">
                              {store.owner.role === 'retailer' ? 'Retail Store' : store.owner.role}
                            </span>
                         )}
                         <span className="text-[10px] text-gray-500 block leading-none">{new Date(post.createdAt).toLocaleDateString()}</span>
                       </div>
                     </div>
                     {post.isPinned && (
                       <Star size={16} className="fill-indigo-600 text-indigo-600 mr-2" />
                     )}
                  </div>
                  
                  <div className="bg-gray-50 relative border-y border-gray-100">
                    <img 
                      src={post.imageUrl} 
                      alt={post.caption || 'Post image'}
                      className="w-full h-auto max-h-[500px] object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex space-x-4">
                         <button onClick={() => toggleLike(post.id)} className="flex items-center group transition-colors">
                            <Heart size={24} className={`transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-900 group-hover:text-red-500'}`} />
                            <span className="ml-1.5 font-semibold text-sm text-gray-700">{likeCount}</span>
                         </button>
                         <button className="text-gray-900 hover:text-indigo-500 transition-colors"><MessageCircle size={24} /></button>
                         <button onClick={() => handleShare(post)} className="text-gray-900 hover:text-indigo-500 transition-colors"><Share2 size={24} /></button>
                      </div>
                      <div className="flex items-center space-x-4">
                        {post.product && (
                          <span className="font-bold text-lg text-gray-900">₹{Number(post.product.price).toLocaleString()}</span>
                        )}
                        {!post.product && post.price && (
                          <span className="font-bold text-lg text-gray-900">₹{post.price}</span>
                        )}
                        <button onClick={() => toggleSave(post.id)} className="group transition-colors">
                           <Bookmark size={24} className={`transition-colors ${isSaved ? 'fill-gray-900 text-gray-900' : 'text-gray-900 group-hover:text-gray-600'}`} />
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <span className="font-bold text-sm mr-2">{store.storeName}</span>
                      <span className="text-sm text-gray-800 leading-snug">{post.caption}</span>
                    </div>

                    {post.product && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <Package size={16} className="text-indigo-600 mr-2" />
                            <span className="font-semibold text-sm">{post.product.productName}</span>
                          </div>
                        </div>
                        <div className="flex space-x-2 mt-3">
                          {!isOwner && store.chatEnabled !== false && (
                            <Link
                              to={`/chat/${store.ownerId}`}
                              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium text-center"
                            >
                              Message Store
                            </Link>
                          )}
                          <a
                            href={store.latitude && store.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}` : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 bg-gray-200 text-gray-900 py-2 rounded-lg text-sm font-medium text-center"
                          >
                            Navigate
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {store && id && showReviews && (
         <ReviewModal
           isOpen={isReviewModalOpen}
           onClose={() => setIsReviewModalOpen(false)}
           targetId={id}
           targetType="store"
           targetName={store.storeName}
           onReviewSubmitted={fetchStoreData}
         />
      )}
    </div>
  );
}
