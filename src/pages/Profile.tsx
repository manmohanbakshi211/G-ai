import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Clock, Calendar, MessageCircle, ArrowLeft, Grid, Plus, Settings, LogOut, ChevronRight, History, Star, AlertTriangle, HelpCircle, Bookmark, UserCheck, Pin, X, Image as ImageIcon, Trash2, DollarSign, Navigation, ExternalLink, Store, Heart, Share2, Package } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import ImageCropper from '../components/ImageCropper';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import KYCForm from '../components/KYCForm';
import StarRating from '../components/StarRating';

// Helper: determine open/closed status from store times
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
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  const isOpen = closeMinutes > openMinutes
    ? nowMinutes >= openMinutes && nowMinutes < closeMinutes
    : nowMinutes >= openMinutes || nowMinutes < closeMinutes;
  const formatTime = (h: number, m: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  if (isOpen) return { isOpen: true, label: `Open · Closes at ${formatTime(closeH, closeM)}` };
  return { isOpen: false, label: `Closed · Opens tomorrow at ${formatTime(openH, openM)}` };
}

export default function ProfilePage() {
  const [store, setStore] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [showKYC, setShowKYC] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostCaption, setNewPostCaption] = useState('');
  const [newPostImage, setNewPostImage] = useState('');
  const [newPostUploading, setNewPostUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [rawImageUrl, setRawImageUrl] = useState('');
  const [chatCount, setChatCount] = useState(0);
  const [newPostPrice, setNewPostPrice] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const currentUserId = user?.id;

  const [interactions, setInteractions] = useState<{likedPostIds: string[], savedPostIds: string[], followedStoreIds: string[]}>({
    likedPostIds: [], savedPostIds: [], followedStoreIds: []
  });

  useEffect(() => {
    if (user) {
      fetch(`/api/me/interactions`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        .then(res => res.json())
        .then(data => setInteractions(data))
        .catch(console.error);
    }
  }, [user]);

  const toggleLike = async (postId: string) => {
    const isLiked = interactions.likedPostIds.includes(postId);
    setInteractions(prev => ({ ...prev, likedPostIds: isLiked ? prev.likedPostIds.filter(id => id !== postId) : [...prev.likedPostIds, postId] }));
    try { await fetch(`/api/posts/${postId}/like`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }); } catch (e) { console.error(e); }
  };

  const toggleSave = async (postId: string) => {
    const isSaved = interactions.savedPostIds.includes(postId);
    setInteractions(prev => ({ ...prev, savedPostIds: isSaved ? prev.savedPostIds.filter(id => id !== postId) : [...prev.savedPostIds, postId] }));
    try { await fetch(`/api/posts/${postId}/save`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }); } catch (e) { console.error(e); }
  };

  const handleShare = async (post: any) => {
    const shareData = {
      title: store?.storeName || 'Check this out!',
      text: post.caption || `See this post`,
      url: window.location.origin + `/store/${store?.id}`
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(shareData.url); alert('Link copied to clipboard!'); }
    } catch (e) {}
  };

  const getLikeCount = (post: any) => {
    const baseCount = post.likes?.length || 0;
    const initiallyLiked = post.likes?.some((l: any) => l.userId === user?.id);
    const currentlyLiked = interactions.likedPostIds.includes(post.id);
    if (initiallyLiked && !currentlyLiked) return Math.max(0, baseCount - 1);
    if (!initiallyLiked && currentlyLiked) return baseCount + 1;
    return baseCount;
  };

  useEffect(() => {
    fetchStoreData();
    fetchChatCount();
  }, []);

  const fetchStoreData = async () => {
    try {
      const storeRes = await fetch(`/api/users/${currentUserId}/store`);
      let storeData = await storeRes.json();
      
      if (!storeData && user?.role === 'retailer') {
        storeData = {
          id: 'mock-store',
          ownerId: currentUserId,
          storeName: user?.name + "'s Store",
          category: 'General',
          description: 'Set up your store bio in Edit Profile.',
          address: 'Add your address',
          phone: '',
          phoneVisible: true,
          latitude: 0,
          longitude: 0,
          _count: { followers: 0, posts: 0 }
        };
      }

      if (storeData) {
        setStore(storeData);

        const postsRes = await fetch(`/api/stores/${storeData.id}/posts`);
        if (postsRes.ok) {
          const postsData = await postsRes.json();
          setPosts(postsData);
        }

        const reviewsRes = await fetch(`/api/reviews/store/${storeData.id}`);
        if (reviewsRes.ok) {
          const revData = await reviewsRes.json();
          setReviews(revData);
        }
      } else {
        setStore(null);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchChatCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const convos = await res.json();
        setChatCount(convos.length);
      }
    } catch (e) { /* silent */ }
  };

  const handleDeletePost = (postId: string) => {
    setPostToDelete(postId);
  };

  const confirmDeletePost = async () => {
    if (!postToDelete) return;
    try {
      const res = await fetch(`/api/posts/${postToDelete}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }});
      if (!res.ok) throw new Error('Failed to delete post');
      setPosts(posts.filter(p => p.id !== postToDelete));
      if (selectedPost?.id === postToDelete) setSelectedPost(null);
    } catch (e) {
      console.error("Failed to delete post", e);
      alert("Failed to delete post");
    } finally {
      setPostToDelete(null);
    }
  };

  useEffect(() => {
    if (selectedPost) {
      setTimeout(() => {
        document.getElementById(`post-${selectedPost.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [selectedPost]);

  const handleTogglePin = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/posts/${postId}/pin`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }});
      if (res.ok) {
        const updated = await res.json();
        setPosts(posts.map(p => p.id === postId ? updated : p));
      } else {
        const err = await res.json();
        alert(err.error || "Maximum 3 pinned posts allowed.");
      }
    } catch (err) {
      console.error("Pin failed", err);
    }
  };

  const handleCreatePost = async () => {
    if (!store || store.id === 'mock-store') {
      alert('Please set up your store in Edit Profile first.');
      return;
    }
    if (!newPostImage) {
      alert('Please upload an image for the post.');
      return;
    }
    setNewPostUploading(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ storeId: store.id, caption: newPostCaption, imageUrl: newPostImage, ...(newPostPrice ? { price: parseFloat(newPostPrice) } : {}) })
      });
      if (res.ok) {
        const newPost = await res.json();
        setPosts([newPost, ...posts]);
        setShowNewPostModal(false);
        setNewPostCaption('');
        setNewPostImage('');
        setNewPostPrice('');
      } else {
        alert('Failed to create post.');
      }
    } catch (e) {
      console.error(e);
    }
    setNewPostUploading(false);
  };

  const handlePostImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setRawImageUrl(data.url);
        setShowCropper(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter recent posts (last 30 days) and sort pinned first
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  // Pinned posts are exempt from 30-day auto-removal
  const recentPosts = posts.filter(p => p.isPinned || new Date(p.createdAt || new Date()) >= thirtyDaysAgo);
  const sortedPosts = [...recentPosts].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isBusinessAccount = user?.role !== 'customer';

  // ========================
  // CUSTOMER PROFILE VIEW
  // ========================
  if (!isBusinessAccount) {
    return (
      <div className="max-w-md mx-auto bg-gray-50 min-h-screen pb-20">
        <header className="sticky top-0 bg-white z-20 px-4 py-3 flex items-center justify-between border-b border-gray-100">
           <h1 className="text-xl font-bold text-gray-900">Your Account</h1>
           <div className="flex items-center space-x-3">
             <NotificationBell />
             <Link to="/settings"><Settings size={20} className="text-gray-900" /></Link>
           </div>
        </header>

        <div className="p-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center mb-6">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-3xl mb-3">
                 {user?.name?.charAt(0)}
              </div>
              <h2 className="font-bold text-xl text-gray-900">{user?.name}</h2>
              <p className="text-gray-500 mb-4">{user?.email}</p>
              <button 
                onClick={() => navigate('/settings')}
                className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold w-full">
                Edit Personal Details
              </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="divide-y divide-gray-100">
              <div onClick={() => navigate('/settings')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
                <div className="flex items-center text-gray-700"><UserCheck size={20} className="mr-3 text-indigo-500" /> Following Stores</div>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
              <div onClick={() => navigate('/settings')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
                <div className="flex items-center text-gray-700"><Bookmark size={20} className="mr-3 text-indigo-500" /> Saved Posts & Stores</div>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
              <div onClick={() => navigate('/settings')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
                <div className="flex items-center text-gray-700"><MapPin size={20} className="mr-3 text-indigo-500" /> Saved Locations</div>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
              <div onClick={() => navigate('/settings')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
                <div className="flex items-center text-gray-700"><History size={20} className="mr-3 text-indigo-500" /> Search History</div>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
              <div onClick={() => navigate('/settings')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
                <div className="flex items-center text-gray-700"><Star size={20} className="mr-3 text-indigo-500" /> My Reviews</div>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="divide-y divide-gray-100">
              <div onClick={() => navigate('/support', { state: { activeTab: 'help' } })} className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
                <div className="flex items-center text-gray-700"><HelpCircle size={20} className="mr-3 text-gray-400" /> Help & Feedback</div>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
              <div onClick={() => navigate('/support', { state: { activeTab: 'complaints' } })} className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
                <div className="flex items-center text-red-600"><AlertTriangle size={20} className="mr-3" /> Complaint Box</div>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </div>
          </div>

          <button onClick={handleLogout} className="w-full bg-white border border-red-200 text-red-600 font-semibold py-3 rounded-xl flex items-center justify-center">
            <LogOut size={18} className="mr-2" /> Log Out
          </button>
        </div>
      </div>
    );
  }

  // ========================
  // NO STORE SETUP YET
  // ========================
  if (!store || store.id === 'mock-store') {
    if (showKYC) {
      return (
        <KYCForm 
          onComplete={() => {
            fetchStoreData();
            navigate('/retailer/dashboard');
          }} 
          onLogout={handleLogout} 
          onBack={() => setShowKYC(false)} 
        />
      );
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
        <div className="absolute top-0 -left-6 w-80 h-80 bg-indigo-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-4000"></div>
        
        <div className="w-full max-w-md px-6 py-12 relative z-10 text-center">
            <div className="w-24 h-24 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-100 border border-white/40">
               <Store size={40} className="text-indigo-600" />
            </div>
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 mb-3">Business Profile Not Setup</h2>
            <p className="text-gray-500 mb-10 text-center text-sm px-4">You need to complete the Initial KYC to verify your business and open your digital storefront.</p>
            <button 
               onClick={() => setShowKYC(true)}
               className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all"
            >
               Set Up Your Store
            </button>
            <button onClick={handleLogout} className="mt-6 text-gray-500 font-semibold flex items-center mx-auto hover:text-gray-800 transition-colors">
              <LogOut size={18} className="mr-2" /> Log Out
            </button>
        </div>
      </div>
    );
  }

  // ========================
  // RETAILER PROFILE VIEW (FINAL SPEC)
  // ========================
  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen pb-20">
      {/* HEADER BAR */}
      <header className="sticky top-0 bg-white z-20 px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900 truncate">{store.storeName}</h1>
        <div className="flex space-x-3 items-center">
          <NotificationBell />
          <Link to="/settings" state={{ activeTab: 'bulk_upload' }}>
             <Settings size={20} className="text-gray-900" />
          </Link>
        </div>
      </header>

      <main>
        {/* PROFILE HEADER SECTION */}
        <div className="px-4 pt-4 pb-2 bg-white">
          {/* Logo + Stats Row */}
          <div className="flex items-start">
            <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center flex-shrink-0 border border-gray-200 overflow-hidden">
              <img 
                src={store.logoUrl || '/uploads/default-logo.png'} 
                alt={store.storeName}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* STATS: ONLY Posts, Followers, Chats */}
            <div className="flex-1 flex justify-around ml-4 mt-2">
              <div className="flex flex-col items-center">
                <span className="font-bold text-lg text-gray-900">{sortedPosts.length}</span>
                <span className="text-xs text-gray-500">Posts</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold text-lg text-gray-900">{store._count?.followers || 0}</span>
                <span className="text-xs text-gray-500">Followers</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold text-lg text-gray-900">{chatCount}</span>
                <span className="text-xs text-gray-500">Chats</span>
              </div>
            </div>
          </div>

          {/* Store Info */}
          <div className="mt-4">
            <h2 className="font-bold text-gray-900 text-[15px] flex items-center">
              {store.storeName}
              {user?.role && user.role !== 'customer' && (
                <span className="ml-2 bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-bold">
                  {user.role === 'retailer' ? 'Retail Store' : user.role}
                </span>
              )}
            </h2>
            {store && !store.hideRatings && typeof store.averageRating === 'number' && (
              <div className="flex items-center space-x-2 my-1">
                <StarRating rating={store.averageRating || 0} size={14} />
                <span className="text-xs font-medium text-gray-500">
                  {store.averageRating ? store.averageRating.toFixed(1) : 'No ratings'} ({store.reviewCount || 0})
                </span>
              </div>
            )}
            <p className="text-gray-500 text-xs mt-0.5 mb-1">{store.category}</p>
            {store.description && (
              <p className="text-sm text-gray-800 leading-tight mt-1.5 whitespace-pre-line">{store.description}</p>
            )}
            
            {/* Store Details Card */}
            <div className="mt-3 space-y-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
               {/* Address */}
               <div className="flex items-start text-xs text-gray-700">
                 <MapPin size={14} className="mr-2 mt-0.5 flex-shrink-0 text-indigo-500" />
                 <span className="font-medium">{store.address}</span>
               </div>
               {/* Postal Code + City/State */}
               {(store.postalCode || store.city || store.state) && (
                 <div className="flex items-start text-xs text-gray-700">
                   <MapPin size={14} className="mr-2 mt-0.5 flex-shrink-0 text-indigo-500 invisible" />
                   <span className="text-gray-500">
                     {store.postalCode && <span>{store.postalCode}</span>}
                     {(store.city || store.state) && <span>{store.postalCode ? ' · ' : ''}{[store.city, store.state].filter(Boolean).join(', ')}</span>}
                   </span>
                 </div>
               )}

               {/* Phone (conditionally shown) */}
               {store.phoneVisible !== false && store.phone && (
                 <div className="flex items-start text-xs text-gray-700">
                   <Phone size={14} className="mr-2 mt-0.5 flex-shrink-0 text-indigo-500" />
                   <span>{store.phone}</span>
                 </div>
               )}

               {/* Open/Closed Status */}
               {(() => {
                 const status = getStoreStatus(store.openingTime, store.closingTime, store.is24Hours, store.workingDays);
                 return status ? (
                   <div className="flex items-start text-xs">
                     <Clock size={14} className={`mr-2 mt-0.5 flex-shrink-0 ${status.isOpen ? 'text-green-500' : 'text-red-500'}`} />
                     <span className={`font-semibold ${status.isOpen ? 'text-green-600' : 'text-red-600'}`}>{status.label}</span>
                   </div>
                 ) : null;
               })()}

               {/* Store Timing */}
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

               {/* Direction to Store */}
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

          {/* ACTION BUTTONS: STRICTLY Edit Profile + New Post ONLY */}
          <div className="grid grid-cols-2 gap-2 mt-5">
            <Link to="/retailer/dashboard" className="bg-gray-100 text-gray-900 py-2 rounded-lg font-semibold text-sm flex items-center justify-center hover:bg-gray-200 transition-colors">
              Edit Profile
            </Link>
            <button 
              onClick={() => setShowNewPostModal(true)} 
              className="bg-indigo-600 text-white py-2 rounded-lg font-semibold text-sm flex items-center justify-center hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} className="mr-1.5" /> New Post
            </button>
          </div>
        </div>

        {/* TABS: STRICTLY Posts + Reviews ONLY */}
        <div className="flex border-t border-b border-gray-200 mt-2 sticky top-[61px] bg-white z-10 w-full">
          <button 
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-3 flex justify-center uppercase font-bold text-xs tracking-wider transition-colors ${
              activeTab === 'posts' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-400'
            }`}
          >
            Posts
          </button>
          {!store.hideRatings && (
             <button 
               onClick={() => setActiveTab('reviews')}
               className={`flex-1 py-3 flex justify-center uppercase font-bold text-xs tracking-wider transition-colors ${
                 activeTab === 'reviews' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-400'
               }`}
             >
               Reviews
             </button>
          )}
        </div>

        {/* TAB CONTENT */}
        <div className="min-h-[300px] bg-white">
          {/* POSTS TAB */}
          {activeTab === 'posts' && (
            <div>
              {/* Manage Posts Header */}
              {posts.length > 0 && (
                <div className="flex items-center justify-between p-3 pb-1 border-b border-gray-50">
                   <span className="text-xs text-gray-500 font-medium">Last 30 days • {sortedPosts.length} post{sortedPosts.length !== 1 ? 's' : ''}</span>
                </div>
              )}

              {/* Post Grid */}
              <div className="grid grid-cols-3 gap-0.5 mt-1">
                {sortedPosts.map(post => (
                  <div 
                    key={post.id} 
                    className="aspect-[3/4] relative cursor-pointer group bg-gray-100"
                    onClick={() => setSelectedPost(post)}
                  >
                    <img 
                      src={post.imageUrl} 
                      alt={post.caption || 'Post'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {/* PIN / UNPIN CONTROL (visible on hover or if pinned) */}
                    <button 
                       onClick={(e) => handleTogglePin(e, post.id)} 
                       title={post.isPinned ? 'Unpin post' : 'Pin post (max 3)'}
                       className={`absolute top-1.5 right-1.5 p-1.5 rounded-full transition-all shadow-sm z-10 ${
                         post.isPinned 
                           ? 'bg-indigo-600 text-white' 
                           : 'bg-black/40 text-white opacity-0 group-hover:opacity-100 hover:bg-black/60'
                       }`}
                    >
                       <Pin size={12} fill={post.isPinned ? 'white' : 'transparent'} />
                    </button>
                    {/* Price overlay */}
                    {post.product && (
                      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                        ${post.product.price}
                      </div>
                    )}
                  </div>
                ))}
                {sortedPosts.length === 0 && (
                  <div className="col-span-3 py-16 text-center text-gray-500 flex flex-col items-center">
                    <Grid className="h-10 w-10 text-gray-300 mb-2" />
                    <p className="text-sm font-medium">No recent posts</p>
                    <p className="text-xs mt-1 text-gray-400">Posts within the last 30 days appear here.</p>
                    <button 
                      onClick={() => setShowNewPostModal(true)}
                      className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      Create Your First Post
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* REVIEWS TAB (hidden if hideRatings is on) */}
          {activeTab === 'reviews' && !store.hideRatings && (
             <div className="p-4 bg-gray-50 min-h-[300px]">
                {reviews.length === 0 ? (
                   <div className="text-center py-16 text-gray-500 flex flex-col items-center">
                      <Star className="h-10 w-10 text-gray-300 mb-2" />
                      <p className="text-sm font-medium">No reviews yet</p>
                      <p className="text-xs mt-1 text-gray-400">Customer reviews will appear here.</p>
                   </div>
                ) : (
                   <div className="space-y-3">
                      {reviews.map((review: any) => (
                         <div key={review.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                             <div className="flex items-center justify-between mb-2">
                               <div className="flex items-center">
                                 {[1, 2, 3, 4, 5].map(star => (
                                   <Star key={star} size={14} className={star <= review.rating ? "text-yellow-400 fill-current" : "text-gray-300"} />
                                 ))}
                               </div>
                               <span className="text-[10px] text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                             </div>
                             <p className="text-sm text-gray-700">{review.comment}</p>
                             {review.user && <p className="text-xs text-gray-400 mt-2">– {review.user.name}</p>}
                         </div>
                      ))}
                   </div>
                )}
             </div>
          )}
        </div>
      </main>

      {/* POST DETAIL / MANAGE POST MODAL (LIST VIEW) */}
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
              {sortedPosts.map(post => {
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
                         {user?.role && user.role !== 'customer' && (
                            <span className="inline-block mt-0.5 mb-0.5 bg-indigo-100 text-indigo-700 text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wide font-bold">
                              {user.role === 'retailer' ? 'Retail Store' : user.role}
                            </span>
                         )}
                         <span className="text-[10px] text-gray-500 block leading-none">{new Date(post.createdAt).toLocaleDateString()}</span>
                       </div>
                     </div>
                     <div className="flex items-center space-x-2">
                        <button 
                          onClick={(e) => handleTogglePin(e, post.id)} 
                          className={`text-[11px] font-bold py-1.5 px-3 rounded-full flex items-center transition-colors ${
                            post.isPinned 
                              ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <Pin size={12} className="mr-1" fill={post.isPinned ? "currentColor" : "none"} /> {post.isPinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button onClick={() => handleDeletePost(post.id)} className="text-red-600 font-bold text-[11px] py-1.5 px-3 bg-red-50 hover:bg-red-100 transition-colors rounded-full flex items-center">
                           <Trash2 size={12} className="mr-1" /> Delete
                        </button>
                     </div>
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
                          <span className="font-bold text-lg text-gray-900">${post.product.price.toFixed(2)}</span>
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

      {/* NEW POST MODAL */}
      {showNewPostModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-2xl p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">New Post</h3>
              <button onClick={() => { setShowNewPostModal(false); setNewPostImage(''); setNewPostCaption(''); setNewPostPrice(''); }}>
                <X size={24} className="text-gray-400" />
              </button>
            </div>
            
            {/* Image Upload */}
            <div className="mb-4">
              {showCropper && rawImageUrl ? (
                <ImageCropper
                  imageUrl={rawImageUrl}
                  onComplete={async (croppedDataUrl) => {
                    // Upload cropped image
                    try {
                      const blob = await fetch(croppedDataUrl).then(r => r.blob());
                      const formData = new FormData();
                      formData.append('file', blob, 'cropped-post.jpg');
                      const res = await fetch('/api/upload', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                        body: formData
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setNewPostImage(data.url);
                      }
                    } catch (e) { console.error(e); }
                    setShowCropper(false);
                    setRawImageUrl('');
                  }}
                  onCancel={() => { setShowCropper(false); setRawImageUrl(''); }}
                />
              ) : newPostImage ? (
                <div className="relative">
                  <img src={newPostImage} alt="Preview" className="w-full aspect-[3/4] object-cover rounded-xl" />
                  <button 
                    onClick={() => setNewPostImage('')}
                    className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-gray-300 rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors">
                  <ImageIcon size={32} className="text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500 font-medium">Tap to upload image</span>
                  <span className="text-[10px] text-gray-400 mt-1">Will be cropped to 3:4 ratio</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePostImageUpload} />
                </label>
              )}
            </div>

            {/* Caption */}
            <textarea 
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
              rows={3}
              placeholder="Write a caption..."
              value={newPostCaption}
              onChange={(e) => setNewPostCaption(e.target.value)}
            />

            {/* Optional Price */}
            <div className="mt-3">
              <label className="block text-xs text-gray-500 font-medium mb-1">Price (optional)</label>
              <div className="relative">
                <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                  placeholder="e.g. 299 or 1,500"
                  value={newPostPrice}
                  onChange={(e) => setNewPostPrice(e.target.value)}
                />
              </div>
            </div>

            {/* Post Button */}
            <button 
              onClick={handleCreatePost}
              disabled={newPostUploading || !newPostImage}
              className="w-full mt-4 bg-indigo-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
            >
              {newPostUploading ? 'Publishing...' : 'Publish Post'}
            </button>
          </div>
        </div>
      )}
      {/* POST DELETE CONFIRMATION MODAL */}
      {postToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setPostToDelete(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Post?</h3>
              <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this post? This action cannot be undone.</p>
              <div className="flex space-x-3">
                <button onClick={() => setPostToDelete(null)} className="flex-1 py-2.5 rounded-xl font-medium text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                <button onClick={confirmDeletePost} className="flex-1 py-2.5 rounded-xl font-medium text-sm text-white bg-red-600 hover:bg-red-700 transition-colors">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
