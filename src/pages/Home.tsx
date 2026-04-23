import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MessageCircle, Store as StoreIcon, Heart, Bookmark, Share2, SlidersHorizontal, Check } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { getStoreStatus } from '../lib/storeUtils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const renderCaption = (caption: string) => {
  const m = caption.match(/^([^.!?]+[.!?])([\s\S]*)$/);
  if (!m) return <strong style={{ fontWeight: 600 }}>{caption}</strong>;
  return (
    <>
      <strong style={{ fontWeight: 600 }}>{m[1]}</strong>
      {m[2]}
    </>
  );
};

/**
 * Returns canvas/image styles based on the natural dimensions of the loaded image.
 *
 * Portrait  (ratio < 0.9)  → fixed 4:5 canvas, object-fit:contain, black bg
 * Square    (0.9–1.1)      → 1:1 canvas,        object-fit:cover
 * Landscape (ratio > 1.1)  → natural ratio canvas, object-fit:cover
 */
function getImageStyles(naturalRatio: number | undefined): {
  canvasStyle: React.CSSProperties;
  imgStyle: React.CSSProperties;
} {
  if (!naturalRatio || naturalRatio < 0.9) {
    return {
      canvasStyle: { aspectRatio: '4/5', background: 'black', overflow: 'hidden', position: 'relative' },
      imgStyle: { width: '100%', height: '100%', objectFit: 'contain', display: 'block' },
    };
  }
  if (naturalRatio <= 1.1) {
    return {
      canvasStyle: { aspectRatio: '1/1', background: 'black', overflow: 'hidden', position: 'relative' },
      imgStyle: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    };
  }
  // Landscape: let the image's own ratio define the canvas height
  return {
    canvasStyle: { aspectRatio: String(naturalRatio), background: 'black', overflow: 'hidden', position: 'relative' },
    imgStyle: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  };
}

export default function HomePage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<{
    likedPostIds: string[];
    savedPostIds: string[];
    followedStoreIds: string[];
  }>({ likedPostIds: [], savedPostIds: [], followedStoreIds: [] });
  const [loading, setLoading] = useState(true);
  const [feedType, setFeedType] = useState('global');
  const [locationRange, setLocationRange] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  // naturalWidth / naturalHeight ratio for each post's image
  const [imgRatios, setImgRatios] = useState<Record<string, number>>({});

  const { token, user, logout } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  const getDistance = (lat?: number, lng?: number): string | null => {
    if (!userLoc || !lat || !lng) return null;
    const R = 6371;
    const dLat = (lat - userLoc.lat) * (Math.PI / 180);
    const dLon = (lng - userLoc.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((userLoc.lat * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return d < 1 ? `${Math.round(d * 1000)} m away` : `${d.toFixed(1)} km away`;
  };

  const handleImgLoad =
    (postId: string) => (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = e.currentTarget;
      if (naturalWidth > 0 && naturalHeight > 0) {
        setImgRatios(prev => ({ ...prev, [postId]: naturalWidth / naturalHeight }));
      }
    };

  const isOwnPost = (post: any) => post.isOwnPost === true;
  const getStoreLink = (post: any) => (isOwnPost(post) ? '/profile' : `/store/${post.storeId}`);

  const fetchFeed = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const intRes = await fetch('/api/me/interactions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (intRes.status === 401 || intRes.status === 403) { logout(); return; }
      setInteractions(await intRes.json());

      if (feedType === 'saved') {
        const savedRes = await fetch(`/api/users/${user?.id}/saved`, {
          headers: { Authorization: `Bearer ${token}` },
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
          } catch {}
        }
        const postsRes = await fetch(
          `/api/posts?feedType=${feedType}&locationRange=${locationRange}&lat=${lat}&lng=${lng}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (postsRes.status === 401 || postsRes.status === 403) { logout(); return; }
        const postsData = await postsRes.json();
        setPosts(
          Array.isArray(postsData.posts)
            ? postsData.posts
            : Array.isArray(postsData)
            ? postsData
            : []
        );
      }
    } catch {
      setPosts([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchFeed(); }, [token, feedType, locationRange]);

  const toggleLike = async (postId: string) => {
    const isLiked = interactions.likedPostIds.includes(postId);
    setInteractions(prev => ({
      ...prev,
      likedPostIds: isLiked
        ? prev.likedPostIds.filter(id => id !== postId)
        : [...prev.likedPostIds, postId],
    }));
    try {
      await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  };

  const toggleSave = async (postId: string) => {
    const isSaved = interactions.savedPostIds.includes(postId);
    setInteractions(prev => ({
      ...prev,
      savedPostIds: isSaved
        ? prev.savedPostIds.filter(id => id !== postId)
        : [...prev.savedPostIds, postId],
    }));
    try {
      await fetch(`/api/posts/${postId}/save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  };

  const toggleFollow = async (storeId: string) => {
    const isFollowed = interactions.followedStoreIds.includes(storeId);
    setInteractions(prev => ({
      ...prev,
      followedStoreIds: isFollowed
        ? prev.followedStoreIds.filter(id => id !== storeId)
        : [...prev.followedStoreIds, storeId],
    }));
    try {
      await fetch(`/api/stores/${storeId}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: user?.id }),
      });
    } catch {}
  };

  const handleShare = async (post: any) => {
    const shareData = {
      title: post.store?.storeName || 'Check this out!',
      text: post.caption || `See this post from ${post.store?.storeName}`,
      url: window.location.origin + `/store/${post.storeId}`,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        showToast('Link copied to clipboard!', { type: 'success' });
      }
    } catch {}
  };

  const getLikeCount = (post: any) => {
    const total = post._count?.likes ?? post.likes?.length ?? 0;
    const initiallyLiked = (post.likes?.length ?? 0) > 0;
    const currentlyLiked = interactions.likedPostIds.includes(post.id);
    if (initiallyLiked && !currentlyLiked) return Math.max(0, total - 1);
    if (!initiallyLiked && currentlyLiked) return total + 1;
    return total;
  };

  const tabs = [
    { key: 'global', label: 'For you' },
    { key: 'following', label: 'Following' },
    { key: 'saved', label: 'Saved' },
  ];

  return (
    <div style={{ background: 'var(--dk-bg)', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="max-w-md mx-auto">

        {/* ── Sticky top block ── */}
        <div className="sticky top-0 z-20" style={{ background: 'var(--dk-bg)' }}>
          <AppHeader />

          {/* Location bar */}
          <div
            className="px-4 py-2 flex items-center justify-between"
            style={{ background: 'var(--dk-bg-soft)' }}
          >
            <div className="flex items-center gap-1.5">
              <MapPin size={13} style={{ color: 'var(--dk-accent)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--dk-text-secondary)' }}>
                Showing stores near{' '}
                <strong style={{ color: 'var(--dk-text-primary)', fontWeight: 600 }}>
                  your area
                </strong>
              </span>
            </div>
            <button
              style={{ fontSize: 12, color: 'var(--dk-accent)', fontWeight: 600 }}
              onClick={() => console.log('TODO: navigate to location picker')}
            >
              Change
            </button>
          </div>

          {/* Tabs + distance filter */}
          <div
            className="px-4 py-2.5 flex items-center justify-between"
            style={{ borderBottom: '0.5px solid var(--dk-border)' }}
          >
            <div
              className="flex p-0.5 rounded-full gap-0.5"
              style={{ background: 'var(--dk-surface)' }}
            >
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFeedType(tab.key)}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
                  style={
                    feedType === tab.key
                      ? { background: '#1A1A1A', color: 'white' }
                      : { background: 'transparent', color: '#555' }
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-1.5 rounded-full"
                style={{ color: 'var(--dk-text-secondary)' }}
              >
                <SlidersHorizontal size={16} />
              </button>
              {showFilters && (
                <div
                  className="absolute right-0 top-9 w-44 bg-white shadow-xl rounded-xl py-2 z-30"
                  style={{ border: '1px solid var(--dk-border)' }}
                >
                  <div
                    className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--dk-text-tertiary)' }}
                  >
                    Distance
                  </div>
                  {[
                    { key: 'all', label: 'Global' },
                    { key: '3', label: 'Within 3 km' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setLocationRange(opt.key); setShowFilters(false); }}
                      className="w-full text-left px-4 py-2 text-sm flex justify-between items-center hover:bg-gray-50"
                      style={{ color: 'var(--dk-text-primary)' }}
                    >
                      {opt.label}
                      {locationRange === opt.key && (
                        <Check size={14} style={{ color: 'var(--dk-accent)' }} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Feed ── */}
        <main className="px-4 pt-4 space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div
                  key={i}
                  className="bg-white overflow-hidden animate-pulse"
                  style={{
                    border: '0.5px solid var(--dk-border)',
                    borderRadius: 'var(--dk-radius-xl)',
                  }}
                >
                  <div className="p-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                      <div className="h-2 bg-gray-200 rounded w-1/4" />
                    </div>
                  </div>
                  <div style={{ aspectRatio: '4/5', background: '#e5e7eb' }} />
                  <div className="p-3 space-y-2">
                    <div className="h-5 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <StoreIcon
                className="mx-auto mb-3"
                size={44}
                style={{ color: 'var(--dk-border-strong)' }}
              />
              <p className="text-sm font-medium" style={{ color: 'var(--dk-text-secondary)' }}>
                {feedType === 'saved' ? 'No saved posts yet.' : 'No posts found.'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--dk-text-tertiary)' }}>
                {feedType === 'saved'
                  ? 'Bookmark posts to see them here.'
                  : 'Try adjusting your filters or follow more stores.'}
              </p>
            </div>
          ) : (
            posts.map(post => {
              const isLiked = interactions.likedPostIds.includes(post.id);
              const isSaved = interactions.savedPostIds.includes(post.id);
              const isFollowed = interactions.followedStoreIds.includes(post.storeId);
              const likeCount = getLikeCount(post);
              const distance = getDistance(post.store?.latitude, post.store?.longitude);
              const status = getStoreStatus(
                post.store?.openingTime,
                post.store?.closingTime,
                post.store?.is24Hours,
                post.store?.workingDays
              );
              const { canvasStyle, imgStyle } = getImageStyles(imgRatios[post.id]);

              return (
                <div
                  key={post.id}
                  className="bg-white overflow-hidden"
                  style={{
                    border: '0.5px solid var(--dk-border)',
                    borderRadius: 'var(--dk-radius-xl)',
                  }}
                >
                  {/* ── Card header ── */}
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Link to={getStoreLink(post)} className="flex-shrink-0">
                        <img
                          src={post.store?.logoUrl || '/uploads/default-logo.png'}
                          alt={post.store?.storeName}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            border: '2px solid var(--dk-accent)',
                            objectFit: 'cover',
                          }}
                        />
                      </Link>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <Link to={getStoreLink(post)}>
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: 'var(--dk-text-primary)',
                                lineHeight: '1.3',
                              }}
                            >
                              {post.store?.storeName}
                            </span>
                          </Link>
                          {post.store?.isVerified && (
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                              <circle cx="6.5" cy="6.5" r="6.5" fill="var(--dk-success)" />
                              <path
                                d="M3.5 6.5l2 2 4-4"
                                stroke="white"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                        {/* Status row */}
                        <div
                          className="flex items-center gap-1 flex-wrap"
                          style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 1 }}
                        >
                          {status && (
                            <span
                              style={{
                                color: status.isOpen ? 'var(--dk-success)' : 'var(--dk-danger)',
                                fontWeight: 500,
                              }}
                            >
                              ● {status.isOpen ? 'Open now' : 'Closed'}
                            </span>
                          )}
                          {distance && (
                            <>
                              <span style={{ color: 'var(--dk-border-strong)' }}>·</span>
                              <span>{distance}</span>
                            </>
                          )}
                          {post.store?.category && (
                            <>
                              <span style={{ color: 'var(--dk-border-strong)' }}>·</span>
                              <span>{post.store.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {!isOwnPost(post) && (
                      <button
                        onClick={() => toggleFollow(post.storeId)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors flex-shrink-0 ml-2"
                        style={
                          isFollowed
                            ? { background: 'var(--dk-surface)', color: 'var(--dk-text-secondary)' }
                            : { background: 'var(--dk-accent)', color: 'white' }
                        }
                      >
                        {isFollowed ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>

                  {/* ── Image canvas ─ aspect ratio adapts to photo dimensions ── */}
                  <div style={canvasStyle}>
                    <img
                      src={post.imageUrl || `https://picsum.photos/seed/${post.id}/800/800`}
                      alt={post.product?.productName || 'Post'}
                      style={imgStyle}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onLoad={handleImgLoad(post.id)}
                    />
                    {post.price && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 12,
                          left: 12,
                          background: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 700,
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        ₹{Number(post.price).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* ── Action bar + caption ── */}
                  <div className="px-4 pt-3 pb-3">
                    <div className="flex items-center" style={{ gap: 16 }}>
                      {/* Like */}
                      <button
                        onClick={() => toggleLike(post.id)}
                        className="flex items-center gap-1"
                      >
                        <Heart
                          size={21}
                          fill={isLiked ? '#FF4444' : 'none'}
                          color={isLiked ? '#FF4444' : 'var(--dk-text-primary)'}
                          strokeWidth={2}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--dk-text-secondary)',
                          }}
                        >
                          {likeCount}
                        </span>
                      </button>

                      {/* Chat */}
                      {!isOwnPost(post) && post.store?.chatEnabled !== false && (
                        <Link
                          to={`/chat/${post.store?.ownerId}`}
                          state={{
                            referredPost: {
                              id: post.id,
                              imageUrl: post.imageUrl,
                              caption: post.caption,
                              price: post.price,
                            },
                          }}
                          className="flex items-center gap-1"
                        >
                          <MessageCircle
                            size={21}
                            fill="none"
                            color="var(--dk-text-primary)"
                            strokeWidth={2}
                          />
                          <span style={{ fontSize: 13, color: 'var(--dk-text-primary)' }}>
                            Chat
                          </span>
                        </Link>
                      )}

                      {/* Share */}
                      <button
                        onClick={() => handleShare(post)}
                        className="flex items-center gap-1"
                      >
                        <Share2
                          size={19}
                          fill="none"
                          color="var(--dk-text-primary)"
                          strokeWidth={2}
                        />
                        <span style={{ fontSize: 13, color: 'var(--dk-text-primary)' }}>
                          Share
                        </span>
                      </button>

                      <div style={{ flex: 1 }} />

                      {/* Save */}
                      <button onClick={() => toggleSave(post.id)}>
                        <Bookmark
                          size={21}
                          fill={isSaved ? 'var(--dk-text-primary)' : 'none'}
                          color="var(--dk-text-primary)"
                          strokeWidth={2}
                        />
                      </button>
                    </div>

                    {/* Product name + price */}
                    {post.product && (
                      <div className="flex items-center justify-between mt-2">
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'var(--dk-text-primary)',
                          }}
                        >
                          {post.product.productName}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--dk-accent)' }}>
                          ₹{post.product.price?.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Caption */}
                    {post.caption && (
                      <p
                        className="line-clamp-3"
                        style={{
                          fontSize: 13,
                          color: 'var(--dk-text-primary)',
                          lineHeight: '1.45',
                          marginTop: 6,
                        }}
                      >
                        {renderCaption(post.caption)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </main>
      </div>
    </div>
  );
}
