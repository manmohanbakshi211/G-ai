import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Search, ChevronLeft, ChevronRight, Trash2, Edit3, X, ShieldAlert, ShieldCheck, CheckSquare, Square } from 'lucide-react';
import api, { getAdminHeaders } from '../lib/api';
import { useToast } from '../context/ToastContext';


const ROLES = ['all', 'customer', 'retailer', 'supplier', 'brand', 'manufacturer', 'admin'];

interface User {
  id: string; name: string; phone: string; email: string | null; role: string; createdAt: string; isBlocked: boolean;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/users', { 
        headers: getAdminHeaders(), 
        params: { search, role: roleFilter, page, limit: 15 } 
      });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search]);

  useEffect(() => { 
    fetchUsers(); 
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchUsers(); };

  const handleUpdateRole = async () => {
    if (!editUser) return;
    try {
      await api.put(`/api/admin/users/${editUser.id}`, { role: editRole }, { headers: getAdminHeaders() });
      setEditUser(null);
      showToast('Role updated successfully', { type: 'success' });
      fetchUsers();
    } catch {
      showToast('Failed to update role', { type: 'error' });
    }
  };

  const handleToggleBlock = async (user: User) => {
    try {
      await api.put(`/api/admin/users/${user.id}`, { isBlocked: !user.isBlocked }, { headers: getAdminHeaders() });
      showToast(`User ${user.isBlocked ? 'unblocked' : 'blocked'} successfully`, { type: 'success' });
      fetchUsers();
    } catch {
      showToast('Failed to change block status', { type: 'error' });
    }
  };

  const handleBulkBlock = async (block: boolean) => {
    if (selectedUserIds.size === 0) return;
    try {
      await api.post('/api/admin/users/bulk-update', { userIds: Array.from(selectedUserIds), isBlocked: block }, { headers: getAdminHeaders() });
      setSelectedUserIds(new Set());
      showToast(`${selectedUserIds.size} users ${block ? 'blocked' : 'unblocked'}`, { type: 'success' });
      fetchUsers();
    } catch {
      showToast('Failed to apply bulk update', { type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/admin/users/${id}`, { headers: getAdminHeaders() });
      setDeleteConfirm(null);
      showToast('User deleted successfully', { type: 'success' });
      fetchUsers();
    } catch {
      showToast('Failed to delete user', { type: 'error' });
    }
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map(u => u.id)));
    }
  };

  const toggleSelectUser = (id: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedUserIds(next);
  };

  const roleBadge = (role: string) => {
    const c: Record<string, string> = {
      admin: 'bg-red-50 text-red-700 ring-red-600/20',
      retailer: 'bg-blue-50 text-blue-700 ring-blue-600/20',
      customer: 'bg-gray-50 text-gray-700 ring-gray-600/20',
      supplier: 'bg-purple-50 text-purple-700 ring-purple-600/20',
      brand: 'bg-amber-50 text-amber-700 ring-amber-600/20',
      manufacturer: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    };
    return c[role] || 'bg-gray-50 text-gray-700 ring-gray-600/20';
  };

  return (
    <AdminLayout title="User Management">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300" />
        </form>
        <div className="flex gap-2">
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 capitalize">
            {ROLES.map(r => <option key={r} value={r}>{r === 'all' ? 'All Roles' : r}</option>)}
          </select>
          {selectedUserIds.size > 0 && (
            <div className="flex gap-2">
              <button onClick={() => handleBulkBlock(true)} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-red-700 transition-colors">Block ({selectedUserIds.size})</button>
              <button onClick={() => handleBulkBlock(false)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-700 transition-colors">Unblock</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-xs text-gray-500">{total} users found</p>
        <button onClick={toggleSelectAll} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          {selectedUserIds.size === users.length ? 'Deselect All' : 'Select All Page'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-5 py-3 w-10">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-indigo-600">
                      {selectedUserIds.size === users.length ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className={`hover:bg-gray-50/50 transition-colors ${u.isBlocked ? 'bg-red-50/30' : ''}`}>
                    <td className="px-5 py-3">
                      <button onClick={() => toggleSelectUser(u.id)} className={`${selectedUserIds.has(u.id) ? 'text-indigo-600' : 'text-gray-300'} hover:text-indigo-600`}>
                        {selectedUserIds.has(u.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${u.isBlocked ? 'bg-red-100' : 'bg-indigo-50'}`}>
                          <span className={`text-xs font-bold ${u.isBlocked ? 'text-red-600' : 'text-indigo-600'}`}>{u.name[0]?.toUpperCase()}</span>
                        </div>
                        <span className={`text-sm font-medium ${u.isBlocked ? 'text-red-900 line-through' : 'text-gray-900'}`}>{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{u.phone || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${roleBadge(u.role)}`}>{u.role}</span>
                    </td>
                    <td className="px-5 py-3">
                      {u.isBlocked ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-red-600"><ShieldAlert size={12} /> BLOCKED</span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600"><ShieldCheck size={12} /> Active</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => handleToggleBlock(u)} className={`p-1.5 rounded-lg transition-colors ${u.isBlocked ? 'text-emerald-600 hover:bg-emerald-50' : 'text-orange-600 hover:bg-orange-50'}`} title={u.isBlocked ? 'Unblock' : 'Block'}>
                          {u.isBlocked ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                        </button>
                        <button onClick={() => { setEditUser(u); setEditRole(u.role); }} className="p-1.5 rounded-lg text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors" title="Edit role"><Edit3 size={15} /></button>
                        <button onClick={() => setDeleteConfirm(u.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {users.map(u => (
              <div key={u.id} className={`bg-white rounded-xl border p-4 transition-colors ${u.isBlocked ? 'border-red-200 bg-red-50/20' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleSelectUser(u.id)} className={`${selectedUserIds.has(u.id) ? 'text-indigo-600' : 'text-gray-300'}`}>
                      {selectedUserIds.has(u.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                    </button>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${u.isBlocked ? 'bg-red-100' : 'bg-indigo-50'}`}>
                      <span className={`text-sm font-bold ${u.isBlocked ? 'text-red-600' : 'text-indigo-600'}`}>{u.name[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${u.isBlocked ? 'text-red-900 line-through' : 'text-gray-900'}`}>{u.name}</p>
                      <p className="text-xs text-gray-400">{u.phone || '—'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${roleBadge(u.role)}`}>{u.role}</span>
                    {u.isBlocked && <span className="text-[10px] font-bold text-red-600 uppercase">Blocked</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <span className="text-xs text-gray-400">Joined {new Date(u.createdAt).toLocaleDateString()}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleToggleBlock(u)} className={`p-1.5 rounded-lg ${u.isBlocked ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                      {u.isBlocked ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                    </button>
                    <button onClick={() => { setEditUser(u); setEditRole(u.role); }} className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><Edit3 size={15} /></button>
                    <button onClick={() => setDeleteConfirm(u.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600"><Trash2 size={15} /></button>
                  </div>
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

      {/* Edit Role Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Change Role</h3>
              <button onClick={() => setEditUser(null)} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-600 mb-3">Update role for <strong>{editUser.name}</strong></p>
            <select value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm mb-4 capitalize">
              {ROLES.filter(r => r !== 'all').map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setEditUser(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleUpdateRole} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-2">Delete User?</h3>
            <p className="text-sm text-gray-500 mb-4">This action cannot be undone. All data associated with this user will be permanently removed.</p>
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
