import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

export interface Notification {
  id: string;
  type: string;
  content: string;
  isRead: boolean;
  referenceId?: string;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/notifications', { credentials: 'include', 
        
      });
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const newSocket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket'],
    });

    newSocket.on('newNotification', (notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    if (!user) return;
    await fetch(`/api/notifications/${id}/read`, { credentials: 'include', 
      method: 'POST',
      
    });
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    if (!user) return;
    await fetch(`/api/notifications/read-all`, { credentials: 'include', 
      method: 'POST',
      
    });
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
