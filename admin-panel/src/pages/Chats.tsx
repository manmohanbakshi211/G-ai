import { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { MessageSquare, Clock, ChevronRight, X } from 'lucide-react';
import api, { getAdminHeaders } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Chat {
  id: string;
  user1: { id: string; name: string; role: string };
  user2: { id: string; name: string; role: string };
  lastMessage: string;
  timestamp: string;
  count: number;
}

interface Message {
  id: string;
  sender: { id: string; name: string };
  receiver: { id: string; name: string };
  message: string;
  imageUrl: string | null;
  createdAt: string;
}

export default function Chats() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/chats', { headers: getAdminHeaders() });
      setChats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (chat: Chat) => {
    setSelectedChat(chat);
    setHistoryLoading(true);
    try {
      const res = await api.get('/api/admin/chats/history', { 
        headers: getAdminHeaders(),
        params: { u1: chat.user1.id, u2: chat.user2.id }
      });
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const roleBadge = (role: string) => {
    const c: Record<string, string> = {
      admin: 'bg-red-50 text-red-700',
      retailer: 'bg-blue-50 text-blue-700',
      customer: 'bg-gray-50 text-gray-700',
      supplier: 'bg-purple-50 text-purple-700',
      brand: 'bg-amber-50 text-amber-700',
      manufacturer: 'bg-emerald-50 text-emerald-700',
    };
    return c[role] || 'bg-gray-50 text-gray-700';
  };

  return (
    <AdminLayout title="Chat Monitoring">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
        {/* Chat List */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare size={18} className="text-indigo-600" /> Conversations
            </h2>
            <span className="text-xs bg-white px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 font-medium">{chats.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
            ) : chats.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <MessageSquare size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">No conversations found</p>
              </div>
            ) : (
              chats.map(chat => (
                <button 
                  key={chat.id}
                  onClick={() => fetchHistory(chat)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors flex items-center gap-3 group ${selectedChat?.id === chat.id ? 'bg-indigo-50/50 ring-1 ring-inset ring-indigo-100' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-bold text-gray-900 truncate max-w-[120px]">{chat.user1.name}</span>
                      <span className="text-[10px] text-gray-300">↔</span>
                      <span className="text-sm font-bold text-gray-900 truncate max-w-[120px]">{chat.user2.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mb-1.5">{chat.lastMessage}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <Clock size={10} /> {new Date(chat.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      <span className="inline-block w-1 h-1 bg-gray-200 rounded-full" />
                      {chat.count} messages
                    </div>
                  </div>
                  <ChevronRight size={16} className={`text-gray-300 group-hover:text-gray-500 transition-colors ${selectedChat?.id === chat.id ? 'text-indigo-400' : ''}`} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat History */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden shadow-sm relative">
          {!selectedChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                <MessageSquare size={32} className="opacity-20 text-indigo-600" />
              </div>
              <h3 className="text-gray-900 font-bold mb-1">Select a Conversation</h3>
              <p className="text-sm max-w-[200px]">Click on a conversation to monitor the messages and media shared between users.</p>
            </div>
          ) : (
            <>
              {/* History Header */}
              <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-indigo-700 font-bold text-xs ring-1 ring-indigo-50">
                      {selectedChat.user1.name[0]}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-emerald-700 font-bold text-xs ring-1 ring-emerald-50">
                      {selectedChat.user2.name[0]}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{selectedChat.user1.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${roleBadge(selectedChat.user1.role)}`}>{selectedChat.user1.role}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-bold text-gray-900">{selectedChat.user2.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${roleBadge(selectedChat.user2.role)}`}>{selectedChat.user2.role}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedChat(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
                {historyLoading ? (
                  <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
                ) : (
                  history.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender.id === selectedChat.user1.id ? 'items-start' : 'items-end'}`}>
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{msg.sender.name}</span>
                        <span className="text-[9px] text-gray-300">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                        msg.sender.id === selectedChat.user1.id 
                          ? 'bg-white text-gray-800 rounded-tl-none border border-gray-100' 
                          : 'bg-indigo-600 text-white rounded-tr-none'
                      }`}>
                        {msg.message && <p className="leading-relaxed">{msg.message}</p>}
                        {msg.imageUrl && (
                          <img src={`${API_BASE}${msg.imageUrl}`} alt="Attachment" className="mt-2 rounded-lg max-h-60 w-full object-cover border border-black/5 cursor-pointer hover:brightness-95 transition-all"
                            onClick={() => window.open(`${API_BASE}${msg.imageUrl}`, '_blank')} />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
