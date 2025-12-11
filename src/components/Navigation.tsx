import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex space-x-8">
            <Link
              to="/"
              className={`inline-flex items-center px-6 py-2 border-b-2 text-sm font-medium ${
                isActive('/')
                  ? 'border-blue-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } transition-colors`}
            >
              🚴‍♂️ Fiscalizador
            </Link>
            <Link
              to="/admin"
              className={`inline-flex items-center px-6 py-2 border-b-2 text-sm font-medium ${
                isActive('/admin')
                  ? 'border-blue-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } transition-colors`}
            >
              👨‍💼 Panel Admin
            </Link>
          </div>
          <div className="flex items-center">
            <span className="text-sm text-gray-500">
              FISCAMOTO Tracking System
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;