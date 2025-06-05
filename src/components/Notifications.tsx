import React, { useState, useEffect } from 'react';
import { Clock, Check, Bell, Filter, RefreshCw } from 'lucide-react';
import { NotificationService } from '../services/NotificationService';
import { useAuth } from '../hooks/useAuth';
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
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'system' | 'property' | 'price' | 'news'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load notifications from Firebase
  const loadNotifications = async () => {
    if (!user?.uid) {
      console.log('No user ID available for loading notifications');
      setLoading(false);
      return;
    }

    try {
      console.log('Loading notifications for user:', user.uid);
      const userNotifications = await NotificationService.getUserNotifications(user.uid);
      setNotifications(userNotifications);
      console.log('Loaded notifications:', userNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadNotifications();
  }, [user?.uid]);

  // Filter notifications based on selected filters
  useEffect(() => {
    let filtered = notifications;

    // Filter by read status
    if (selectedFilter === 'unread') {
      filtered = filtered.filter(n => !n.read);
    } else if (selectedFilter === 'read') {
      filtered = filtered.filter(n => n.read);
    }

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(n => n.type === selectedType);
    }

    setFilteredNotifications(filtered);
  }, [notifications, selectedFilter, selectedType]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await NotificationService.markAsRead(notificationId);
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      
      console.log(`Marked notification ${notificationId} as read`);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user?.uid) return;

    try {
      await NotificationService.markAllAsRead(user.uid);
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
      
      toast.success('All notifications marked as read');
      console.log('Marked all notifications as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  // Refresh notifications
  const refreshNotifications = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
    toast.success('Notifications refreshed');
  };

  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'property':
        return '🏠';
      case 'price':
        return '💰';
      case 'system':
        return '🔔';
      case 'news':
        return '📰';
      default:
        return '📩';
    }
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  // Get type badge color
  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'property':
        return 'bg-blue-100 text-blue-800';
      case 'price':
        return 'bg-green-100 text-green-800';
      case 'system':
        return 'bg-gray-100 text-gray-800';
      case 'news':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const hasNotifications = notifications.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Bell className="text-emerald-600" />
                Notifications
              </h1>
              <p className="text-gray-600">
                {hasNotifications ? (
                  <>You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</>
                ) : (
                  'No notifications yet'
                )}
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={refreshNotifications}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  <Check className="w-4 h-4" />
                  Mark All Read
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">Status:</span>
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value as any)}
                className="px-3 py-1 border rounded-lg text-sm"
              >
                <option value="all">All</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Type:</span>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
                className="px-3 py-1 border rounded-lg text-sm"
              >
                <option value="all">All Types</option>
                <option value="system">System</option>
                <option value="property">Property</option>
                <option value="price">Price</option>
                <option value="news">News</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading notifications...</p>
          </div>
        )}

        {/* No User State */}
        {!loading && !user?.uid && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sign In Required</h3>
            <p className="text-gray-600">Please sign in to view your notifications.</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && user?.uid && !hasNotifications && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Notifications</h3>
            <p className="text-gray-600">You don't have any notifications yet. Check back later!</p>
          </div>
        )}

        {/* No Filtered Results */}
        {!loading && hasNotifications && filteredNotifications.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Filter className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Matching Notifications</h3>
            <p className="text-gray-600">No notifications match your current filters.</p>
          </div>
        )}

        {/* Notifications List */}
        {!loading && filteredNotifications.length > 0 && (
          <div className="space-y-4">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-lg shadow-sm border-l-4 p-6 transition-all hover:shadow-md ${
                  notification.read 
                    ? 'border-gray-300 opacity-80' 
                    : 'border-emerald-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                      <div className="flex-1">
                        <h3 className={`font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                          {notification.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(notification.type)}`}>
                            {notification.type}
                          </span>
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(notification.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <p className={`${notification.read ? 'text-gray-600' : 'text-gray-800'} leading-relaxed`}>
                      {notification.message}
                    </p>
                  </div>

                  <div className="ml-4 flex items-center gap-2">
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="flex items-center gap-1 px-3 py-1 text-sm bg-emerald-100 text-emerald-700 rounded-full hover:bg-emerald-200 transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        Mark Read
                      </button>
                    )}
                    
                    {!notification.read && (
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Debug Info for Development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-100 rounded-lg text-sm text-gray-600">
            <h4 className="font-medium mb-2">Debug Info:</h4>
            <p>User ID: {user?.uid || 'Not logged in'}</p>
            <p>Total Notifications: {notifications.length}</p>
            <p>Filtered Notifications: {filteredNotifications.length}</p>
            <p>Unread Count: {unreadCount}</p>
            <p>Loading: {loading ? 'Yes' : 'No'}</p>
            <p>Current Filter: {selectedFilter} / {selectedType}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications; 