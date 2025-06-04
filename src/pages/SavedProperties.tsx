import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PropertyService } from '../services/propertyService';
import { UserService } from '../services/userService';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import type { Property } from '../types';

const SavedProperties: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [savedProperties, setSavedProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSavedProperties();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Listen for user refresh events to reload saved properties
  useEffect(() => {
    const handleUserRefresh = () => {
      if (user) {
        loadSavedProperties();
      }
    };

    window.addEventListener('refreshUser', handleUserRefresh);
    return () => window.removeEventListener('refreshUser', handleUserRefresh);
  }, [user]);

  const loadSavedProperties = async () => {
    if (!user || !user.savedProperties || user.savedProperties.length === 0) {
      setLoading(false);
      setSavedProperties([]);
      return;
    }

    try {
      setLoading(true);
      console.log('Loading saved properties for user:', user.id);
      console.log('Saved property IDs:', user.savedProperties);

      const properties: Property[] = [];
      
      // Load each saved property
      for (const propertyId of user.savedProperties) {
        try {
          const property = await PropertyService.getPropertyById(propertyId);
          if (property) {
            properties.push(property);
          } else {
            console.warn(`Property ${propertyId} not found, removing from saved list`);
            // Remove invalid property ID from user's saved list
            await UserService.removeSavedProperty(user.id, propertyId);
          }
        } catch (error) {
          console.warn(`Error loading property ${propertyId}:`, error);
        }
      }

      console.log('Saved properties loaded successfully:', properties.length);
      setSavedProperties(properties);
      
      // Refresh user profile to get updated saved properties
      window.dispatchEvent(new CustomEvent('refreshUser'));
    } catch (error) {
      console.error('Error loading saved properties:', error);
      toast.error('Failed to load saved properties');
      setSavedProperties([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveProperty = async (propertyId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!user) {
      toast.error('Please login to manage saved properties');
      return;
    }

    try {
      await UserService.removeSavedProperty(user.id, propertyId);
      setSavedProperties(prev => prev.filter(p => p.id !== propertyId));
      toast.success('Property removed from saved');
      
      // Refresh user profile to get updated saved properties
      window.dispatchEvent(new CustomEvent('refreshUser'));
    } catch (error) {
      console.error('Error removing saved property:', error);
      toast.error('Failed to remove property');
    }
  };

  const handleViewProperty = async (propertyId: string) => {
    // Track viewing history if user is logged in
    if (user) {
      try {
        await UserService.addToViewingHistory(user.id, propertyId);
        await PropertyService.incrementViews(propertyId);
        
        // Refresh user profile to get updated viewing history
        window.dispatchEvent(new CustomEvent('refreshUser'));
      } catch (error) {
        console.error('Error tracking view:', error);
      }
    }
    
    navigate(`/property/${propertyId}`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col items-center justify-center h-64">
            <p className="text-gray-500 mb-4">Please login to view your saved properties</p>
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
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Saved Properties</h1>
          <button
            onClick={() => navigate('/properties')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex items-center space-x-2"
          >
            <Search className="w-5 h-5" />
            <span>Browse More Properties</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : savedProperties.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <Heart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold mb-4">No Saved Properties</h2>
            <p className="text-gray-600 mb-6">
              You haven't saved any properties yet. Browse our listings and save properties you're interested in!
            </p>
            <button
              onClick={() => navigate('/properties')}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors inline-flex items-center space-x-2"
            >
              <Search className="w-5 h-5" />
              <span>Browse Properties</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedProperties.map(property => (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => handleViewProperty(property.id)}
              >
                <div className="relative">
                  <img
                    src={property.images[0] || 'https://via.placeholder.com/400x300?text=No+Image'}
                    alt={property.title}
                    className="w-full h-48 object-cover"
                  />
                  {property.is_premium && (
                    <span className="absolute top-2 left-2 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs">
                      Premium
                    </span>
                  )}
                  <button 
                    className="absolute top-2 right-2 p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                    onClick={(e) => handleRemoveProperty(property.id, e)}
                  >
                    <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1">{property.title}</h3>
                  <p className="text-gray-600 text-sm mb-2">{property.location}, {property.district}</p>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-emerald-600 font-bold text-xl">
                      ₹{(property.price / 100000).toFixed(2)} Lakhs
                    </span>
                    <span className="text-gray-500 text-xs">
                      {property.views || 0} views
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{property.bedrooms} Beds</span>
                    <span>{property.bathrooms} Baths</span>
                    <span>{property.area} sq ft</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedProperties; 