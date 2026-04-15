import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Search, ChevronLeft, ChevronRight, Trash2, Star, Users, Package, MapPin } from 'lucide-react';
import api, { getAdminHeaders } from '../lib/api';



interface StoreData {
  id: string; storeName: string; category: string; address: string; averageRating: number | null; reviewCount: number; createdAt: string;
  owner: { name: string; phone: string };
  _count: { followers: number; posts: number; products: number };
}

export default function Stores() {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/stores', { 
        headers: getAdminHeaders(), 
        params: { search, page, limit: 15 } 
      });
      setStores(res.data.stores);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { 
    fetchStores(); 
  }, [fetchStores]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchStores(); };

  const handleDelete = async (id: string) => {
    await api.delete(`/api/admin/stores/${id}`, { headers: getAdminHeaders() });
    setDeleteConfirm(null);
    fetchStores();
  };

  return (
    <AdminLayout title="Store Directory">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search stores or categories..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300" />
        </form>
      </div>

      <p className="text-xs text-gray-500 mb-3">{total} stores found</p>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Store</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rating</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stats</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stores.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-900">{s.storeName}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[200px]">{s.address}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-gray-700">{s.owner.name}</p>
                      <p className="text-xs text-gray-400">{s.owner.phone}</p>
                    </td>
                    <td className="px-5 py-3"><span className="px-2.5 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-700 rounded-full">{s.category}</span></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <Star size={14} className="text-amber-400 fill-amber-400" />
                        <span className="text-sm font-medium text-gray-700">{s.averageRating?.toFixed(1) || '—'}</span>
                        <span className="text-xs text-gray-400">({s.reviewCount})</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Users size={12} />{s._count.followers}</span>
                        <span className="flex items-center gap-1"><Package size={12} />{s._count.products}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setDeleteConfirm(s.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {stores.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{s.storeName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.owner.name}</p>
                  </div>
                  <span className="px-2.5 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-700 rounded-full flex-shrink-0">{s.category}</span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <MapPin size={12} className="text-gray-400" />
                  <p className="text-xs text-gray-400 truncate">{s.address}</p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Star size={12} className="text-amber-400 fill-amber-400" />{s.averageRating?.toFixed(1) || '—'}</span>
                    <span className="flex items-center gap-1"><Users size={12} />{s._count.followers}</span>
                    <span className="flex items-center gap-1"><Package size={12} />{s._count.products}</span>
                  </div>
                  <button onClick={() => setDeleteConfirm(s.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
              <div className="flex gap-1.5">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft size={16} /></button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-2">Delete Store?</h3>
            <p className="text-sm text-gray-500 mb-4">This will permanently remove the store and all associated data including posts and products.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500">Delete</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
