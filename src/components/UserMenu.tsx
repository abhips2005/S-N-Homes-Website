import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, LogOut, Settings, Heart, History } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UserMenuProps {
  isTransparent?: boolean;
}

const UserMenu: React.FC<UserMenuProps> = ({ isTransparent = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 p-2 rounded-xl transition-colors ${
          isTransparent 
            ? 'hover:bg-white/20' 
            : 'hover:bg-gray-100'
        }`}
      >
        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
          isTransparent 
            ? 'bg-white/20 text-white' 
            : 'bg-emerald-100 text-emerald-600'
        }`}>
          <span className="font-medium">
            {user.name && user.name.length > 0 ? user.name[0].toUpperCase() : 'U'}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">{user.name || 'User'}</p>
            <p className="text-sm text-gray-500">{user.email || ''}</p>
          </div>

          <Link
            to="/dashboard"
            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => setIsOpen(false)}
          >
            <User className="w-4 h-4 mr-3" />
            Dashboard
          </Link>

          <Link
            to="/saved"
            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => setIsOpen(false)}
          >
            <Heart className="w-4 h-4 mr-3" />
            Saved Properties
          </Link>

          <Link
            to="/history"
            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => setIsOpen(false)}
          >
            <History className="w-4 h-4 mr-3" />
            Viewing History
          </Link>

          <Link
            to="/settings"
            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => setIsOpen(false)}
          >
            <Settings className="w-4 h-4 mr-3" />
            Settings
          </Link>

          <button
            onClick={() => {
              logout();
              setIsOpen(false);
            }}
            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
