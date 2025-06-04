import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Home, Users, FileText, Settings, TrendingUp, AlertTriangle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { UserService } from '../services/userService';
import { PropertyService } from '../services/propertyService';
import LoadingSpinner from '../components/LoadingSpinner';

interface DashboardStats {
  totalProperties: number;
  activeUsers: number;
  totalReports: number;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalProperties: 0,
    activeUsers: 0,
    totalReports: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load real statistics from database
      const [userStats, properties, allUsers] = await Promise.all([
        UserService.getUserStats(),
        PropertyService.getAllAvailableProperties(1000), // Get all properties for counting
        UserService.getAllUsers()
      ]);

      // Calculate statistics
      const totalProperties = properties.length;
      const activeUsers = userStats.totalUsers;
      
      setStats({
        totalProperties,
        activeUsers,
        totalReports: 0 // This would come from a reports service
      });

      // Get recent users (last 5)
      const sortedUsers = allUsers
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
      setRecentUsers(sortedUsers);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    { 
      label: 'Total Properties', 
      value: stats.totalProperties.toString(), 
      icon: Home, 
      change: '+12%', 
      positive: true,
      link: '/admin/properties'
    },
    { 
      label: 'Active Users', 
      value: stats.activeUsers.toString(), 
      icon: Users, 
      change: '+5.3%', 
      positive: true,
      link: '/admin/users'
    },
    { 
      label: 'Reports', 
      value: stats.totalReports.toString(), 
      icon: AlertTriangle, 
      change: '+3%', 
      positive: false,
      link: '/admin/reports'
    },
  ];

  const handleCardClick = (link: string) => {
    navigate(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Monitor and manage your platform</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {statsCards.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
              onClick={() => handleCardClick(stat.link)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="bg-emerald-100 p-3 rounded-xl">
                  <stat.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <span className={`text-sm font-medium ${stat.positive ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.change}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
              <p className="text-gray-600">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-lg"
          >
            <h2 className="text-xl font-semibold mb-6">Recent Users</h2>
            <div className="space-y-4">
              {recentUsers.length > 0 ? (
                recentUsers.map((user, index) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800'
                        : user.role === 'agent'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.role}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No recent users</p>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-lg"
          >
            <h2 className="text-xl font-semibold mb-6">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/admin/properties"
                className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <Home className="w-6 h-6 text-emerald-600 mr-3" />
                <span>Manage Properties</span>
              </Link>
              <Link
                to="/admin/users"
                className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <Users className="w-6 h-6 text-emerald-600 mr-3" />
                <span>Manage Users</span>
              </Link>
              <Link
                to="/admin/reports"
                className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <FileText className="w-6 h-6 text-emerald-600 mr-3" />
                <span>View Reports</span>
              </Link>
              <Link
                to="/admin/settings"
                className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <Settings className="w-6 h-6 text-emerald-600 mr-3" />
                <span>Settings</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
