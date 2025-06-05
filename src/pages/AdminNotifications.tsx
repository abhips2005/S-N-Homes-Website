import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Bell, 
  Send, 
  Users, 
  Eye, 
  Calendar, 
  Home, 
  Tag, 
  Settings, 
  Star,
  Plus,
  Filter,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { NotificationService } from '../services/NotificationService';
import { UserService } from '../services/userService';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'system' | 'property' | 'price' | 'news';
  targetUsers: 'all' | 'specific' | 'byLocation' | 'byActivity';
  targetUserIds?: string[];
  targetLocation?: string;
  created_at: string;
  sent_count: number;
  read_count: number;
  created_by: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  lastActive?: string;
}

const AdminNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'system' as 'system' | 'property' | 'price' | 'news',
    targetUsers: 'all' as 'all' | 'specific' | 'byLocation' | 'byActivity',
    targetLocation: '',
    targetUserIds: [] as string[]
  });

  useEffect(() => {
    loadNotifications();
    loadUsers();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      console.log('Loading admin notifications from Firestore...');
      const data = await NotificationService.getAdminNotifications();
      console.log('Loaded admin notifications:', data);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await UserService.getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleCreateNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const notification = {
        ...formData,
        targetUserIds: formData.targetUsers === 'specific' ? selectedUsers : []
      };

      await NotificationService.createNotification(notification);
      toast.success('Notification sent successfully!');
      
      // Reset form
      setFormData({
        title: '',
        message: '',
        type: 'system',
        targetUsers: 'all',
        targetLocation: '',
        targetUserIds: []
      });
      setSelectedUsers([]);
      setShowCreateForm(false);
      
      // Reload notifications
      loadNotifications();
    } catch (error) {
      console.error('Error creating notification:', error);
      toast.error('Failed to send notification');
    }
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getFilteredUsers = () => {
    return users.filter(user => 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getFilteredNotifications = () => {
    if (filterType === 'all') return notifications;
    return notifications.filter(notification => notification.type === filterType);
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

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">Notification Management</h1>
            <p className="text-gray-600">Send notifications to users and track engagement</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={async () => {
                // Create a test notification for all current users to test the system
                try {
                  console.log('=== ADMIN TEST NOTIFICATION DEBUG ===');
                  const users = await UserService.getAllUsers();
                  console.log('Firebase users found:', users.map(u => ({ id: u.id, name: u.name, email: u.email })));
                  
                  const testRequest = {
                    title: 'Admin Test Notification',
                    message: 'This is a test notification sent from admin panel to verify the notification system is working correctly.',
                    type: 'system' as const,
                    targetUsers: 'all' as const
                  };
                  
                  console.log('Sending notification request:', testRequest);
                  await NotificationService.createNotification(testRequest);
                  console.log('Notification sent successfully');
                  
                  toast.success(`Admin test notification sent!`);
                  loadNotifications();
                } catch (error) {
                  console.error('Error sending test notification:', error);
                  toast.error('Failed to send test notification');
                }
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 flex items-center space-x-2"
            >
              <Bell className="w-5 h-5" />
              <span>Send Test</span>
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Create Notification</span>
            </button>
          </div>
        </div>

        {/* Create Notification Form */}
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-6 mb-8"
          >
            <h2 className="text-xl font-semibold mb-6">Create New Notification</h2>
            
            <form onSubmit={handleCreateNotification} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Notification title"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="system">System</option>
                    <option value="property">Property</option>
                    <option value="price">Price Update</option>
                    <option value="news">News</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Notification message"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Audience
                </label>
                <select
                  value={formData.targetUsers}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetUsers: e.target.value as any }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Users</option>
                  <option value="specific">Specific Users</option>
                  <option value="byLocation">By Location</option>
                  <option value="byActivity">By Recent Activity</option>
                </select>
              </div>

              {formData.targetUsers === 'byLocation' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Location
                  </label>
                  <input
                    type="text"
                    value={formData.targetLocation}
                    onChange={(e) => setFormData(prev => ({ ...prev, targetLocation: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter location (e.g., Kochi, Trivandrum)"
                  />
                </div>
              )}

              {formData.targetUsers === 'specific' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Users ({selectedUsers.length} selected)
                  </label>
                  <div className="border border-gray-300 rounded-xl p-4 max-h-64 overflow-y-auto">
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Search users..."
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      {getFilteredUsers().map(user => (
                        <label key={user.id} className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            onChange={() => handleUserSelect(user.id)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 flex items-center space-x-2"
                >
                  <Send className="w-5 h-5" />
                  <span>Send Notification</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Notification History */}
        <div className="bg-white rounded-2xl shadow-lg">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Notification History</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-4 py-2 rounded-full ${
                    filterType === 'all'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('system')}
                  className={`px-4 py-2 rounded-full ${
                    filterType === 'system'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  System
                </button>
                <button
                  onClick={() => setFilterType('property')}
                  className={`px-4 py-2 rounded-full ${
                    filterType === 'property'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Property
                </button>
                <button
                  onClick={() => setFilterType('price')}
                  className={`px-4 py-2 rounded-full ${
                    filterType === 'price'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Price
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : getFilteredNotifications().length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Notifications</h3>
                <p className="text-gray-600">Start sending notifications to your users!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {getFilteredNotifications().map(notification => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-gray-200 rounded-xl p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="bg-gray-100 rounded-full p-2">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{notification.title}</h3>
                          <p className="text-gray-600 mt-1">{notification.message}</p>
                          <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                            <span className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>{formatTime(notification.created_at)}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Users className="w-4 h-4" />
                              <span>{notification.sent_count} sent</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Eye className="w-4 h-4" />
                              <span>{notification.read_count} read</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          notification.type === 'system' ? 'bg-gray-100 text-gray-800' :
                          notification.type === 'property' ? 'bg-emerald-100 text-emerald-800' :
                          notification.type === 'price' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {notification.type}
                        </span>
                        <span className="text-sm text-gray-500">
                          {Math.round((notification.read_count / notification.sent_count) * 100) || 0}% read
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminNotifications; 