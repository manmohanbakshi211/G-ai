/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, Search, MapPin, MessageCircle, User } from 'lucide-react';
import clsx from 'clsx';
import HomePage from './pages/Home';
import SearchPage from './pages/Search';
import MapPage from './pages/Map';
import MessagesPage from './pages/Messages';
import ProfilePage from './pages/Profile';
import StoreProfilePage from './pages/StoreProfile';
import RetailerDashboard from './pages/RetailerDashboard';
import ChatPage from './pages/Chat';
import SignupPage from './pages/Signup';
import LoginPage from './pages/Login';
import UserSettings from './pages/UserSettings';
import SupportPage from './pages/Support';
import NotFoundPage from './pages/NotFound';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function BottomNav() {
  const location = useLocation();
  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/search', icon: Search, label: 'Search' },
    { path: '/map', icon: MapPin, label: 'Map' },
    { path: '/messages', icon: MessageCircle, label: 'Messages' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  // Don't show bottom nav on specific pages like chat or auth
  if (location.pathname.startsWith('/chat/') || location.pathname === '/signup' || location.pathname === '/login') return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-40">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              className={clsx(
                "flex flex-col items-center justify-center w-full h-full space-y-1",
                isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-900"
              )}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

import { ToastProvider } from './context/ToastContext';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <NotificationProvider>
            <div className="min-h-screen bg-gray-50 pb-16">
              <Routes>
                <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/store/:id" element={<StoreProfilePage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/login" element={<LoginPage />} />
                
                {/* Protected Routes */}
                <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/retailer/dashboard" element={<ProtectedRoute><RetailerDashboard /></ProtectedRoute>} />
                <Route path="/chat/:userId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><UserSettings /></ProtectedRoute>} />
                <Route path="/support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              <BottomNav />
            </div>
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}
