import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bell, Home, Calendar, Tag, Settings, Star, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { NotificationService } from '../services/NotificationService';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'system' | 'property' | 'price' | 'news';
  user_id: string;
  created_at: string;
  read: boolean;
  property_id?: string;
  data?: any;
}

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    loadNotifications();
  }, [user]);

  const loadNotifications = async () => {
    if (!user) {
      console.log('No user logged in');
      setLoading(false);
      return;
    }

    console.log('Current logged in user:', { id: user.id, name: user.name, email: user.email });

    try {
      const userNotifications = await NotificationService.getUserNotifications(user.id);
      console.log('Received notifications from service:', userNotifications);
      setNotifications(userNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await NotificationService.markAsRead(notification.id);
      setNotifications(prevNotifications =>
        prevNotifications.map(n =>
          n.id === notification.id ? { ...n, read: true } : n
        )
      );
    }

    // Navigate based on notification type
    if (notification.type === 'property' && notification.property_id) {
      navigate(`/property/${notification.property_id}`);
    } else if (notification.type === 'price' && notification.property_id) {
      navigate(`/property/${notification.property_id}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    
    await NotificationService.markAllAsRead(user.id);
    setNotifications(prevNotifications =>
      prevNotifications.map(n => ({ ...n, read: true }))
    );
  };

  const getFilteredNotifications = () => {
    if (activeFilter === 'all') {
      return notifications;
    }
    return notifications.filter(notification => notification.type === activeFilter);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `${diffMinutes} min ago`;
      }
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'property':
        return <Home className="w-5 h-5 text-emerald-600" />;
      case 'price':
        return <Tag className="w-5 h-5 text-blue-600" />;
      case 'system':
        return <Settings className="w-5 h-5 text-gray-600" />;
      case 'news':
        return <Star className="w-5 h-5 text-amber-500" />;
      default:
        return <Bell className="w-5 h-5 text-emerald-600" />;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col items-center justify-center h-64">
            <p className="text-gray-500 mb-4">Please login to view your notifications</p>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <div className="flex space-x-3">
            {notifications.some(n => !n.read) && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>
        </div>

        <div className="mb-6 flex space-x-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-full ${
              activeFilter === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveFilter('property')}
            className={`px-4 py-2 rounded-full flex items-center space-x-1 ${
              activeFilter === 'property'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Properties</span>
          </button>
          <button
            onClick={() => setActiveFilter('price')}
            className={`px-4 py-2 rounded-full flex items-center space-x-1 ${
              activeFilter === 'price'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Price Updates</span>
          </button>
          <button
            onClick={() => setActiveFilter('system')}
            className={`px-4 py-2 rounded-full flex items-center space-x-1 ${
              activeFilter === 'system'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>System</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : getFilteredNotifications().length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <Bell className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold mb-4">No Notifications</h2>
            <p className="text-gray-600">
              You don't have any notifications yet. We'll notify you about property updates and important information.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {getFilteredNotifications().map(notification => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-xl shadow-md overflow-hidden cursor-pointer ${
                  notification.read ? '' : 'border-l-4 border-emerald-600'
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="p-4 flex items-start">
                  <div className="bg-gray-100 rounded-full p-2 mr-3 flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className={`font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                        {notification.title}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                    <p className={`text-sm mt-1 ${notification.read ? 'text-gray-500' : 'text-gray-600'}`}>
                      {notification.message}
                    </p>
                  </div>
                  {(notification.type === 'property' || notification.type === 'price') && (
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications; 