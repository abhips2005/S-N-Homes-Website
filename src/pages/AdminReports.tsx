import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, Home, IndianRupee, ArrowUp, ArrowDown, FileText, Download } from 'lucide-react';
import { PropertyService } from '../services/propertyService';
import { UserService } from '../services/userService';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

type ReportData = {
  propertiesCount: {
    total: number;
    available: number;
    sold: number;
    rented: number;
  };
  usersCount: {
    total: number;
    active: number;
    newThisMonth: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    percentageChange: number;
  };
  popularLocations: {
    name: string;
    count: number;
  }[];
  propertyTypeDistribution: {
    type: string;
    count: number;
  }[];
  listingsOverTime: {
    month: string;
    count: number;
  }[];
};

const AdminReports: React.FC = () => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [dateRange, setDateRange] = useState('month'); // month, quarter, year
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, [dateRange]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      
      // Fetch real data from database
      const [userStats, allProperties, allUsers] = await Promise.all([
        UserService.getUserStats(),
        PropertyService.getAllAvailableProperties(1000),
        UserService.getAllUsers()
      ]);

      // Calculate properties by status
      const propertiesCount = {
        total: allProperties.length,
        available: allProperties.filter(p => p.status === 'available').length,
        sold: allProperties.filter(p => p.status === 'sold').length,
        rented: allProperties.filter(p => p.status === 'rented').length,
      };

      // Calculate users data
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      
      const newThisMonth = allUsers.filter(user => {
        const userDate = new Date(user.created_at);
        return userDate.getMonth() === currentMonth && userDate.getFullYear() === currentYear;
      }).length;

      const usersCount = {
        total: allUsers.length,
        active: allUsers.filter(user => user.verified).length,
        newThisMonth
      };

      // Calculate popular locations
      const locationCounts: { [key: string]: number } = {};
      allProperties.forEach(property => {
        const location = property.district || property.location;
        locationCounts[location] = (locationCounts[location] || 0) + 1;
      });

      const popularLocations = Object.entries(locationCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate property type distribution
      const typeCounts: { [key: string]: number } = {};
      allProperties.forEach(property => {
        const type = property.type || 'Other';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });

      const propertyTypeDistribution = Object.entries(typeCounts)
        .map(([type, count]) => ({ type: type.charAt(0).toUpperCase() + type.slice(1), count }))
        .sort((a, b) => b.count - a.count);

      // Calculate listings over time (last 6 months)
      const listingsOverTime = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        const monthNum = date.getMonth();
        
        const count = allProperties.filter(property => {
          const propertyDate = new Date(property.created_at);
          return propertyDate.getMonth() === monthNum && propertyDate.getFullYear() === year;
        }).length;
        
        listingsOverTime.push({ month, count });
      }

      // Calculate revenue (estimated based on premium properties and listing fees)
      const premiumCount = allProperties.filter(p => p.is_premium).length;
      const estimatedRevenue = (premiumCount * 5000) + (allProperties.length * 500); // Example calculation
      
      const reportData: ReportData = {
        propertiesCount,
        usersCount,
        revenue: {
          total: estimatedRevenue,
          thisMonth: Math.floor(estimatedRevenue * 0.15), // Estimate this month's revenue
          percentageChange: 12.5 // This would need historical data to calculate properly
        },
        popularLocations,
        propertyTypeDistribution,
        listingsOverTime
      };

      setReportData(reportData);
    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = () => {
    // In a real app, this would generate and download a PDF or CSV report
    const reportContent = JSON.stringify(reportData, null, 2);
    const blob = new Blob([reportContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kerala-estates-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Report downloaded successfully!');
  };

  if (loading || !reportData) {
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-600 mt-2">Real-time platform analytics and insights</p>
          </div>
          <div className="flex space-x-4">
            <div className="flex border border-gray-200 rounded-xl overflow-hidden">
              <button
                className={`px-4 py-2 ${dateRange === 'month' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700'}`}
                onClick={() => setDateRange('month')}
              >
                Month
              </button>
              <button
                className={`px-4 py-2 ${dateRange === 'quarter' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700'}`}
                onClick={() => setDateRange('quarter')}
              >
                Quarter
              </button>
              <button
                className={`px-4 py-2 ${dateRange === 'year' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700'}`}
                onClick={() => setDateRange('year')}
              >
                Year
              </button>
            </div>
            <button
              onClick={handleDownloadReport}
              className="bg-emerald-600 text-white px-6 py-2 rounded-xl hover:bg-emerald-700 flex items-center space-x-2"
            >
              <Download className="w-5 h-5" />
              <span>Export Report</span>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-500 font-medium">Properties</h3>
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Home className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-3xl font-bold mb-2">{reportData.propertiesCount.total}</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center">
                <span className="block text-green-600 font-medium">{reportData.propertiesCount.available}</span>
                <span className="text-gray-500">Available</span>
              </div>
              <div className="text-center">
                <span className="block text-red-600 font-medium">{reportData.propertiesCount.sold}</span>
                <span className="text-gray-500">Sold</span>
              </div>
              <div className="text-center">
                <span className="block text-blue-600 font-medium">{reportData.propertiesCount.rented}</span>
                <span className="text-gray-500">Rented</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-500 font-medium">Users</h3>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold mb-2">{reportData.usersCount.total}</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Active: <span className="font-medium">{reportData.usersCount.active}</span></span>
              <span className="text-gray-500">New: <span className="font-medium text-green-600">+{reportData.usersCount.newThisMonth}</span> this month</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-500 font-medium">Revenue (Est.)</h3>
              <div className="p-2 bg-amber-100 rounded-lg">
                <IndianRupee className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-3xl font-bold mb-2">₹{(reportData.revenue.total / 100000).toFixed(2)} L</p>
            <div className="flex items-center text-sm">
              <span className="text-gray-500 mr-2">This {dateRange}:</span>
              <span className={`flex items-center ${reportData.revenue.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {reportData.revenue.percentageChange >= 0 ? (
                  <ArrowUp className="w-4 h-4 mr-1" />
                ) : (
                  <ArrowDown className="w-4 h-4 mr-1" />
                )}
                {Math.abs(reportData.revenue.percentageChange)}%
              </span>
            </div>
          </motion.div>
        </div>

        {/* Charts and Data Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Popular Locations */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Popular Locations</h3>
            <div className="space-y-4">
              {reportData.popularLocations.map((location) => (
                <div key={location.name} className="flex items-center">
                  <div className="w-32 text-gray-700">{location.name}</div>
                  <div className="flex-1 px-4">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-emerald-600 h-2.5 rounded-full"
                        style={{
                          width: `${(location.count / reportData.popularLocations[0].count) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-12 text-right text-gray-500">{location.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Property Type Distribution */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Property Types</h3>
            <div className="space-y-4">
              {reportData.propertyTypeDistribution.map((item) => (
                <div key={item.type} className="flex items-center">
                  <div className="w-32 text-gray-700">{item.type}</div>
                  <div className="flex-1 px-4">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{
                          width: `${(item.count / reportData.propertyTypeDistribution.reduce((acc, curr) => acc + curr.count, 0)) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-12 text-right text-gray-500">{item.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Listings */}
          <div className="bg-white rounded-xl shadow-md p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Property Listings Over Time</h3>
            <div className="h-64 flex items-end">
              {reportData.listingsOverTime.map((data, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center flex-1"
                >
                  <div
                    style={{
                      height: `${(data.count / Math.max(...reportData.listingsOverTime.map(item => item.count))) * 200}px`,
                    }}
                    className="w-8 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg"
                  ></div>
                  <div className="mt-2 text-xs text-gray-500">{data.month}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminReports; 