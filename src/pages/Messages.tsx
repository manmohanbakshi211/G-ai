import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Search } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';

export default function MessagesPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { token } = useAuth();

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('/api/conversations', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch conversations');
        return res.json();
      })
      .then(data => {
        const formattedData = data.map((conv: any) => ({
          ...conv,
          timestamp: new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        setConversations(formattedData);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredConversations = conversations.filter(conv =>
    conv.storeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen">
      <header className="bg-white px-4 py-3 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Messages</h1>
          <NotificationBell />
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-lg focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-sm"
          />
        </div>
      </header>

      <main className="p-0">
        {loading ? (
          <div className="divide-y divide-gray-100 bg-white">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center p-4 animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0"></div>
                <div className="ml-4 flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length > 0 ? (
          <div className="divide-y divide-gray-100 bg-white">
            {filteredConversations.map(conv => (
              <Link 
                key={conv.id} 
                to={`/chat/${conv.userId}`}
                className="flex items-center p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="relative">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-lg overflow-hidden">
                    {conv.logoUrl ? (
                      <img src={conv.logoUrl} className="w-full h-full object-cover" alt="logo" />
                    ) : (
                      conv.storeName.charAt(0)
                    )}
                  </div>
                  {conv.unread > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">
                      {conv.unread}
                    </div>
                  )}
                </div>
                <div className="ml-4 flex-1 overflow-hidden">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{conv.storeName}</h3>
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{conv.timestamp}</span>
                  </div>
                  <p className={`text-sm truncate ${conv.unread > 0 ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                    {conv.lastMessage}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : searchQuery ? (
          <div className="text-center py-20 text-gray-500">
            <Search className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p>No conversations matching "{searchQuery}"</p>
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            <MessageCircle className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p>No messages yet.</p>
            <p className="text-xs text-gray-400 mt-1">Start chatting with a store from their profile.</p>
          </div>
        )}
      </main>
    </div>
  );
}
