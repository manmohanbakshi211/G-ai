import { Link } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={36} className="text-indigo-600" />
        </div>
        <h1 className="text-6xl font-extrabold text-gray-900 mb-2">404</h1>
        <p className="text-lg text-gray-600 mb-1">Page Not Found</p>
        <p className="text-sm text-gray-400 mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <Link 
          to="/" 
          className="inline-flex items-center bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Home size={18} className="mr-2" />
          Go Home
        </Link>
      </div>
    </div>
  );
}
