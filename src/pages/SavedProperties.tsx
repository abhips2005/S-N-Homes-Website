import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { Property } from '../types';

// Mock saved properties data
const mockProperties: Property[] = [
  {
    id: 'KE-123456-789',
    title: 'Luxury Villa in Kochi',
    description: 'Beautiful 4BHK villa with modern amenities and stunning views.',
    price: 15000000,
    type: 'residential',
    location: 'Kochi',
    district: 'Ernakulam',
    bedrooms: 4,
    bathrooms: 3,
    area: 2500,
    landArea: 10,
    landAreaUnit: 'cent',
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'
    ],
    features: ['Swimming Pool', 'Garden', 'Security'],
    user_id: 'user1',
    created_at: '2024-03-10',
    is_premium: true,
    status: 'available',
    virtual_tour_url: 'https://pannellum.org/images/cerro-toco-0.jpg',
    amenities: ['Pool', 'Garden', 'Security', 'Gym', 'Parking', 'Power Backup'],
    nearbyPlaces: [
      { name: 'City Mall', type: 'shopping', distance: 1.5 },
      { name: 'International School', type: 'school', distance: 2 },
      { name: 'Metro Station', type: 'transport', distance: 0.5 }
    ],
    energyRating: 'A',
    constructionYear: 2022,
    lastRenovated: '2023',
    parkingSpaces: 2,
    furnished: true,
    views: 150,
    coordinates: {
      latitude: 9.9312,
      longitude: 76.2673
    }
  },
  {
    id: 'KE-654321-987',
    title: 'Modern Apartment in Trivandrum',
    description: 'Spacious 3BHK apartment with great amenities.',
    price: 8500000,
    type: 'flat',
    location: 'Trivandrum',
    district: 'Thiruvananthapuram',
    bedrooms: 3,
    bathrooms: 2,
    area: 1800,
    landArea: 0,
    landAreaUnit: 'cent',
    images: [
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'
    ],
    features: ['Gym', 'Parking', 'Security'],
    user_id: 'user1',
    created_at: '2024-02-15',
    is_premium: false,
    status: 'available',
    virtual_tour_url: '',
    amenities: ['Gym', 'Parking', 'Security', 'Power Backup'],
    nearbyPlaces: [
      { name: 'Shopping Mall', type: 'shopping', distance: 1.0 },
      { name: 'School', type: 'school', distance: 1.5 },
      { name: 'Hospital', type: 'hospital', distance: 2.0 }
    ],
    energyRating: 'B',
    constructionYear: 2020,
    lastRenovated: '',
    parkingSpaces: 1,
    furnished: true,
    views: 85,
    coordinates: {
      latitude: 8.5241,
      longitude: 76.9366
    }
  }
];

const SavedProperties: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [savedProperties, setSavedProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would be an API call to fetch the user's saved properties
    // For now, we'll use mock data
    if (user) {
      setTimeout(() => {
        setSavedProperties(mockProperties);
        setLoading(false);
      }, 1000);
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleViewProperty = (propertyId: string) => {
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
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
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
                className="bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer"
                onClick={() => handleViewProperty(property.id)}
              >
                <div className="relative">
                  <img
                    src={property.images[0]}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      // In a real app, this would remove the property from saved
                      setSavedProperties(prev => prev.filter(p => p.id !== property.id));
                    }}
                  >
                    <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1">{property.title}</h3>
                  <p className="text-gray-600 text-sm mb-2">{property.location}, {property.district}</p>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-emerald-600 font-medium">
                      ₹{(property.price / 100000).toFixed(2)} Lakhs
                    </span>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span>{property.bedrooms} bed</span>
                      <span>•</span>
                      <span>{property.bathrooms} bath</span>
                    </div>
                  </div>
                  <p className="text-gray-500 text-sm line-clamp-2">{property.description}</p>
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