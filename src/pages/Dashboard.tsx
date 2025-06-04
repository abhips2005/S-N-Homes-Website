import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Home, Eye, Heart, Bell, Clock, Calendar, MapPin, IndianRupee, ArrowRight, MessageSquare, List } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PropertyService } from '../services/propertyService';
import LoadingSpinner from '../components/LoadingSpinner';
import MessageCenter from '../components/MessageCenter';
import UserListings from '../pages/UserListings';
import AIRecommendationButton from '../components/AIRecommendationButton';
import type { Property } from '../types';

const Dashboard: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'overview');
  const [userListingsCount, setUserListingsCount] = useState(0);
  const [recentProperties, setRecentProperties] = useState<Property[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [viewedProperties, setViewedProperties] = useState<Property[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }

    if (!loading && isAdmin) {
      navigate('/admin/dashboard');
    }
  }, [user, loading, isAdmin, navigate]);

  useEffect(() => {
    // Update URL when tab changes
    setSearchParams({ tab: activeTab });
  }, [activeTab, setSearchParams]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Listen for user refresh events to reload dashboard data
  useEffect(() => {
    const handleUserRefresh = () => {
      if (user) {
        loadDashboardData();
      }
    };

    window.addEventListener('refreshUser', handleUserRefresh);
    return () => window.removeEventListener('refreshUser', handleUserRefresh);
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    
    try {
      setLoadingStats(true);
      console.log('Starting to load dashboard data for user:', user.id);
      
      // Load user's property count
      console.log('Loading user properties...');
      const userProperties = await PropertyService.getPropertiesByUser(user.id);
      console.log('User properties loaded successfully:', userProperties.length);
      setUserListingsCount(userProperties.length);
      
      // Load recent properties for recommendations using simple query
      console.log('Loading recent properties...');
      const recentProps = await PropertyService.getAllAvailableProperties(4);
      console.log('Recent properties loaded successfully:', recentProps.length);
      setRecentProperties(recentProps);
      
      // Load recently viewed properties from user's viewing history
      if (user.viewingHistory && user.viewingHistory.length > 0) {
        console.log('Loading viewed properties from history...');
        const viewedProps: Property[] = [];
        // Load first 3 from viewing history
        for (const propertyId of user.viewingHistory.slice(0, 3)) {
          try {
            const property = await PropertyService.getPropertyById(propertyId);
            if (property) {
              viewedProps.push(property);
            }
          } catch (error) {
            console.warn(`Could not load viewed property ${propertyId}:`, error);
          }
        }
        console.log('Viewed properties loaded successfully:', viewedProps.length);
        setViewedProperties(viewedProps);
      } else {
        console.log('No viewing history found');
        setViewedProperties([]);
      }
      
      console.log('Dashboard data loaded successfully:', {
        userListingsCount: userProperties.length,
        recentProperties: recentProps.length,
        viewedProperties: user.viewingHistory?.length || 0
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      console.error('Error details:', {
        message: (error as any)?.message,
        stack: (error as any)?.stack,
        userId: user.id
      });
      // Don't show toast error for dashboard data loading - just log it
    } finally {
      setLoadingStats(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  const stats = [
    { 
      label: 'Saved Properties', 
      value: user?.savedProperties?.length || 0, 
      icon: Heart, 
      color: 'emerald',
      link: '/saved'
    },
    { 
      label: 'Properties Viewed', 
      value: user?.viewingHistory?.length || 0, 
      icon: Eye, 
      color: 'blue',
      link: '/history'
    },
    { 
      label: 'My Listings', 
      value: loadingStats ? '...' : userListingsCount, 
      icon: List, 
      color: 'purple',
      onClick: () => handleTabChange('listings')
    },
    { 
      label: 'Messages', 
      value: '0', // This would come from a message service
      icon: MessageSquare, 
      color: 'yellow',
      onClick: () => handleTabChange('messages')
    },
  ];

  // Create recent activity from user's actual viewing history
  const recentActivity = viewedProperties.map((property, index) => ({
    type: 'view',
    property: {
      title: property.title,
      location: `${property.location}, ${property.district}`,
      price: property.price,
      image: property.images[0] || 'https://via.placeholder.com/400x300?text=No+Image'
    },
    time: index === 0 ? 'Recently viewed' : `${index} view${index > 1 ? 's' : ''} ago`
  }));

  const savedSearches = [
    {
      title: '3 BHK in Trivandrum',
      filters: {
        location: 'Trivandrum',
        type: '3 BHK',
        budget: '50-80 Lakhs'
      }
    },
    {
      title: 'Villa in Kochi',
      filters: {
        location: 'Kochi',
        type: 'Villa',
        budget: '1-2 Crores'
      }
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {user?.name}!</h1>
          <p className="text-gray-600">Here's what's happening with your property search</p>
        </div>

        {/* Dashboard Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => handleTabChange('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => handleTabChange('messages')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'messages'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Messages
            </button>
            <button
              onClick={() => handleTabChange('listings')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'listings'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              My Listings
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={stat.onClick || (() => stat.link && navigate(stat.link))}
                >
                  <div className={`bg-${stat.color}-100 p-3 rounded-xl w-fit mb-4`}>
                    <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
                  <p className="text-gray-600">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-2 space-y-6"
              >
                <div className="bg-white rounded-2xl shadow-lg">
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex justify-between items-center">
                      <h2 className="text-xl font-semibold">Recent Activity</h2>
                      <Link 
                        to="/history" 
                        className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center"
                      >
                        View All <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {recentActivity.map((activity, index) => (
                      <div key={index} className="p-6 flex items-start space-x-4">
                        <img
                          src={activity.property.image}
                          alt={activity.property.title}
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{activity.property.title}</h3>
                          <div className="flex items-center text-sm text-gray-500 mt-1">
                            <MapPin className="w-4 h-4 mr-1" />
                            {activity.property.location}
                          </div>
                          <div className="flex items-center text-sm text-gray-500 mt-1">
                            <IndianRupee className="w-4 h-4 mr-1" />
                            {(activity.property.price / 100000).toFixed(2)} Lakhs
                          </div>
                        </div>
                        <span className="text-sm text-gray-400">{activity.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-2xl shadow-lg">
                  <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold">Saved Searches</h2>
                  </div>
                  <div className="p-6 space-y-4">
                    {savedSearches.map((search, index) => (
                      <Link
                        key={index}
                        to={`/properties?${new URLSearchParams(search.filters)}`}
                        className="block p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <h3 className="font-medium text-gray-900">{search.title}</h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {Object.entries(search.filters).map(([key, value]) => (
                            <span
                              key={key}
                              className="px-2 py-1 bg-white rounded-full text-xs text-gray-600"
                            >
                              {value}
                            </span>
                          ))}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="text-center">
                    <Bell className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
                    <h3 className="font-semibold mb-2">Get Property Alerts</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Stay updated with properties matching your preferences
                    </p>
                    <button className="w-full bg-emerald-600 text-white py-2 rounded-xl hover:bg-emerald-700 transition-colors">
                      Set Up Alerts
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}

        {activeTab === 'messages' && (
          <div className="mb-8">
            <MessageCenter />
          </div>
        )}

        {activeTab === 'listings' && (
          <div className="mb-8">
            <UserListings />
          </div>
        )}
      </div>

      {/* AI Recommendation Button */}
      <AIRecommendationButton properties={recentProperties} />
    </div>
  );
};

export default Dashboard;
