import React from 'react';
import { motion } from 'framer-motion';
import { Home, Users, FileText, Settings, TrendingUp, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminDashboard: React.FC = () => {
  const stats = [
    { label: 'Total Properties', value: '245', icon: Home, change: '+12%', positive: true },
    { label: 'Active Users', value: '1,234', icon: Users, change: '+5.3%', positive: true },
    { label: 'Pending Approvals', value: '23', icon: FileText, change: '-2%', positive: false },
    { label: 'Reports', value: '15', icon: AlertTriangle, change: '+3%', positive: false },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-lg"
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
            <h2 className="text-xl font-semibold mb-6">Recent Activity</h2>
            {/* Add activity list */}
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
