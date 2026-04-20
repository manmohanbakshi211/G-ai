import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Save, Upload, X, Plus, Trash2, Palette, Type, Image, RotateCcw } from 'lucide-react';
import api, { getAdminHeaders } from '../lib/api';
import { useToast } from '../context/ToastContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface AppSettings {
  id: string;
  appName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  carouselImages: string[];
  updatedAt: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appName, setAppName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCarousel, setUploadingCarousel] = useState(false);
  const { showToast } = useToast();

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/settings', { headers: getAdminHeaders() });
      const data = res.data;
      setSettings(data);
      setAppName(data.appName || '');
      setLogoUrl(data.logoUrl || '');
      setPrimaryColor(data.primaryColor || '#4f46e5');
      setAccentColor(data.accentColor || '#6366f1');
      setCarouselImages(data.carouselImages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/api/admin/settings', {
        appName,
        logoUrl: logoUrl || null,
        primaryColor,
        accentColor,
        carouselImages,
      }, { headers: getAdminHeaders() });
      showToast('Settings saved successfully!', { type: 'success' });
      fetchSettings();
    } catch {
      showToast('Failed to save settings', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/api/admin/settings/upload', formData, {
        headers: { ...getAdminHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      setLogoUrl(res.data.url);
      showToast('Logo uploaded!', { type: 'success' });
    } catch {
      showToast('Failed to upload logo', { type: 'error' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleUploadCarouselImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCarousel(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/api/admin/settings/upload', formData, {
        headers: { ...getAdminHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      setCarouselImages(prev => [...prev, res.data.url]);
      showToast('Carousel image added!', { type: 'success' });
    } catch {
      showToast('Failed to upload image', { type: 'error' });
    } finally {
      setUploadingCarousel(false);
    }
  };

  const addImageUrl = () => {
    if (!newImageUrl.trim()) return;
    setCarouselImages(prev => [...prev, newImageUrl.trim()]);
    setNewImageUrl('');
  };

  const removeCarouselImage = (index: number) => {
    setCarouselImages(prev => prev.filter((_, i) => i !== index));
  };

  const resetToDefaults = () => {
    setAppName('Local Discoveries');
    setPrimaryColor('#4f46e5');
    setAccentColor('#6366f1');
    setLogoUrl('');
    setCarouselImages([]);
  };

  if (loading) {
    return (
      <AdminLayout title="App Settings">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="App Settings">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top action bar */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Customize the look and feel of your application.</p>
            {settings?.updatedAt && (
              <p className="text-xs text-gray-400 mt-0.5">Last updated: {new Date(settings.updatedAt).toLocaleString()}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={resetToDefaults} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2">
              <RotateCcw size={14} /> Reset
            </button>
            <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors flex items-center gap-2 disabled:opacity-50">
              <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* App Identity */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Type size={16} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">App Identity</h3>
              <p className="text-xs text-gray-400">Set your application name and logo</p>
            </div>
          </div>
          <div className="p-6 space-y-5">
            {/* App Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Application Name</label>
              <input
                value={appName}
                onChange={e => setAppName(e.target.value)}
                placeholder="e.g. Local Discoveries"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300"
              />
            </div>

            {/* Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">App Logo</label>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <div className="relative group">
                    <img
                      src={logoUrl.startsWith('http') ? logoUrl : `${API_BASE}${logoUrl}`}
                      alt="App Logo"
                      className="w-16 h-16 rounded-xl object-cover border border-gray-200"
                    />
                    <button
                      onClick={() => setLogoUrl('')}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <Image size={20} className="text-gray-300" />
                  </div>
                )}
                <div>
                  <label className="cursor-pointer px-4 py-2 rounded-xl bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors inline-flex items-center gap-2">
                    <Upload size={14} /> {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    <input type="file" accept="image/*" onChange={handleUploadLogo} className="hidden" disabled={uploadingLogo} />
                  </label>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 2MB. Recommended: 200x200px</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Theme Colors */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <Palette size={16} className="text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Theme Colors</h3>
              <p className="text-xs text-gray-400">Customize the color palette of the user-facing app</p>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                  />
                  <input
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    placeholder="#4f46e5"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Accent Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={e => setAccentColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                  />
                  <input
                    value={accentColor}
                    onChange={e => setAccentColor(e.target.value)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    placeholder="#6366f1"
                  />
                </div>
              </div>
            </div>
            {/* Color Preview */}
            <div className="mt-5 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Preview</p>
              <div className="flex gap-3">
                <div className="flex-1 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: primaryColor }}>
                  Primary Button
                </div>
                <div className="flex-1 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: accentColor }}>
                  Accent Button
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Management */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <Image size={16} className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Home Carousel</h3>
              <p className="text-xs text-gray-400">Manage the banner images on the main app's home feed</p>
            </div>
          </div>
          <div className="p-6">
            {/* Current images */}
            {carouselImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                {carouselImages.map((img, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-video">
                    <img
                      src={img.startsWith('http') ? img : `${API_BASE}${img}`}
                      alt={`Carousel ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <button
                        onClick={() => removeCarouselImage(idx)}
                        className="p-2 rounded-lg bg-white/90 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-sm"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                      #{idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 mb-5 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Image size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500 font-medium">No carousel images</p>
                <p className="text-xs text-gray-400 mt-0.5">Add images to display on the home feed banner</p>
              </div>
            )}

            {/* Add by URL */}
            <div className="flex gap-2 mb-3">
              <input
                value={newImageUrl}
                onChange={e => setNewImageUrl(e.target.value)}
                placeholder="Paste image URL (e.g. https://images.unsplash.com/...)"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                onKeyDown={e => e.key === 'Enter' && addImageUrl()}
              />
              <button onClick={addImageUrl} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors flex items-center gap-1.5">
                <Plus size={14} /> Add
              </button>
            </div>

            {/* Upload */}
            <label className="cursor-pointer w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2">
              <Upload size={16} /> {uploadingCarousel ? 'Uploading...' : 'Or upload from device'}
              <input type="file" accept="image/*" onChange={handleUploadCarouselImage} className="hidden" disabled={uploadingCarousel} />
            </label>
          </div>
        </div>

        {/* Save Button (bottom) */}
        <div className="flex justify-end pb-6">
          <button onClick={handleSave} disabled={saving} className="px-8 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
            <Save size={16} /> {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
