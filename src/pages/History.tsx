import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Clock, MapPin, IndianRupee, Eye, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PropertyService } from '../services/propertyService';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Property } from '../types';
import toast from 'react-hot-toast';

const History: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [viewedProperties, setViewedProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
      return;
    }

    if (user && user.viewingHistory) {
      loadViewedProperties();
    } else {
      setLoadingProperties(false);
    }
  }, [user, loading, navigate]);

  const loadViewedProperties = async () => {
    if (!user || !user.viewingHistory || user.viewingHistory.length === 0) {
      setLoadingProperties(false);
      return;
    }

    try {
      setLoadingProperties(true);
      const properties: Property[] = [];
      
      // Load each property from the viewing history
      for (const propertyId of user.viewingHistory.slice(0, 20)) { // Limit to last 20
        try {
          const property = await PropertyService.getPropertyById(propertyId);
          if (property) {
            properties.push(property);
          }
        } catch (error) {
          console.warn(`Could not load property ${propertyId}:`, error);
        }
      }
      
      setViewedProperties(properties);
    } catch (error) {
      console.error('Error loading viewed properties:', error);
      toast.error('Failed to load viewing history');
    } finally {
      setLoadingProperties(false);
    }
  };

  const handlePropertyClick = (propertyId: string) => {
    navigate(`/property/${propertyId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/dashboard" 
            className="inline-flex items-center text-emerald-600 hover:text-emerald-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Viewing History</h1>
          <p className="text-gray-600">Properties you've recently viewed</p>
        </div>

        {loadingProperties ? (
          <div className="flex justify-center items-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : viewedProperties.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Viewing History</h2>
            <p className="text-gray-600 mb-6">
              You haven't viewed any properties yet. Start exploring to see your history here.
            </p>
            <Link
              to="/properties"
              className="inline-flex items-center px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
            >
              Browse Properties
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-gray-600">
                You've viewed {viewedProperties.length} properties recently
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {viewedProperties.map((property, index) => (
                <motion.div
                  key={property.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => handlePropertyClick(property.id)}
                >
                  <div className="relative">
                    <img
                      src={property.images[0] || 'https://via.placeholder.com/400x300?text=No+Image'}
                      alt={property.title}
                      className="w-full h-48 object-cover"
                    />
                    {property.is_premium && (
                      <div className="absolute top-4 left-4 bg-emerald-600 text-white px-3 py-1 rounded-full text-sm">
                        Premium
                      </div>
                    )}
                    <div className="absolute top-4 right-4 bg-white/90 px-2 py-1 rounded-full text-xs text-gray-600">
                      <Eye className="w-3 h-3 inline mr-1" />
                      {property.views} views
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="flex items-center space-x-2 text-gray-500 text-sm mb-3">
                      <MapPin className="w-4 h-4" />
                      <span>{property.location}, {property.district}</span>
                    </div>
                    
                    <h3 className="text-xl font-semibold mb-2 truncate">{property.title}</h3>
                    
                    <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600">
                      {property.bedrooms && property.bedrooms > 0 && (
                        <span>{property.bedrooms} Beds</span>
                      )}
                      {property.bathrooms && property.bathrooms > 0 && (
                        <span>{property.bathrooms} Baths</span>
                      )}
                      <span>{property.area} sq.ft</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        <IndianRupee className="w-5 h-5 text-emerald-600" />
                        <span className="text-xl font-bold text-emerald-600">
                          {(property.price / 100000).toFixed(2)} Lakhs
                        </span>
                      </div>
                      <div className="flex items-center text-xs text-gray-400">
                        <Clock className="w-3 h-3 mr-1" />
                        <span>Recently viewed</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default History; 