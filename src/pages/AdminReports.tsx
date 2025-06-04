import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, Home, IndianRupee, ArrowUp, ArrowDown, FileText, Download } from 'lucide-react';

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
    // Simulate API call to fetch report data
    setLoading(true);
    setTimeout(() => {
      // Mock data - Replace with API call
      const mockReportData: ReportData = {
        propertiesCount: {
          total: 156,
          available: 87,
          sold: 45,
          rented: 24,
        },
        usersCount: {
          total: 312,
          active: 245,
          newThisMonth: 28,
        },
        revenue: {
          total: 2450000,
          thisMonth: 320000,
          percentageChange: 12.5,
        },
        popularLocations: [
          { name: 'Kochi', count: 42 },
          { name: 'Trivandrum', count: 31 },
          { name: 'Kozhikode', count: 25 },
          { name: 'Thrissur', count: 18 },
          { name: 'Kollam', count: 14 },
        ],
        propertyTypeDistribution: [
          { type: 'Residential', count: 78 },
          { type: 'Flat', count: 45 },
          { type: 'Land', count: 22 },
          { type: 'Commercial', count: 11 },
        ],
        listingsOverTime: [
          { month: 'Jan', count: 12 },
          { month: 'Feb', count: 18 },
          { month: 'Mar', count: 15 },
          { month: 'Apr', count: 21 },
          { month: 'May', count: 24 },
          { month: 'Jun', count: 28 },
        ],
      };
      setReportData(mockReportData);
      setLoading(false);
    }, 1000);
  }, [dateRange]);

  const handleDownloadReport = () => {
    // In a real app, this would generate and download a PDF or CSV report
    console.log('Download report functionality would go here');
    alert('Report download functionality would be implemented here');
  };

  if (loading || !reportData) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 pb-12 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-500 font-medium">Properties</h3>
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Home className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-3xl font-bold mb-2">{reportData.propertiesCount.total}</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Available: {reportData.propertiesCount.available}</span>
              <span className="text-gray-500">Sold: {reportData.propertiesCount.sold}</span>
              <span className="text-gray-500">Rented: {reportData.propertiesCount.rented}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-500 font-medium">Users</h3>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold mb-2">{reportData.usersCount.total}</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Active: {reportData.usersCount.active}</span>
              <span className="text-gray-500">New: +{reportData.usersCount.newThisMonth} this month</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-500 font-medium">Revenue</h3>
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
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-500 font-medium">Reports</h3>
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-3xl font-bold mb-2">12</p>
            <div className="text-sm text-gray-500">
              <span>Last generated: Today</span>
            </div>
          </div>
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