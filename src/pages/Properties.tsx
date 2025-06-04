import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Filter, SortAsc, MapPin, Bed, Bath, Square, IndianRupee, Heart, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PropertyCard from '../components/PropertyCard';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { PropertyService, PropertyFilters } from '../services/propertyService';
import { UserService } from '../services/userService';
import type { Property } from '../types';
import toast from 'react-hot-toast';

function Properties() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [filters, setFilters] = useState<PropertyFilters>({
    location: searchParams.get('location') || '',
    type: searchParams.get('type') || '',
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    bedrooms: searchParams.get('bedrooms') ? Number(searchParams.get('bedrooms')) : undefined,
    furnished: searchParams.get('furnished') === 'true' || undefined,
  });

  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'created_at');
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);

  // Load properties
  const loadProperties = async (reset = false) => {
    try {
      setLoading(true);
      
      // Always use the filtered query method now (it handles simple cases too)
      console.log('Using filtered query method');
      const { properties: newProperties, lastDoc: newLastDoc } = await PropertyService.getProperties(
        filters,
        { limitCount: 12, lastDoc: reset ? null : lastDoc },
        sortBy
      );
      
      if (reset) {
        setProperties(newProperties);
      } else {
        setProperties(prev => [...prev, ...newProperties]);
      }
      
      setLastDoc(newLastDoc);
      setHasMore(newProperties.length === 12);
    } catch (error) {
      console.error('Error loading properties:', error);
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  // Load properties on component mount and when filters/sort change
  useEffect(() => {
    loadProperties(true);
  }, [filters, sortBy]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== false) {
        params.set(key, String(value));
      }
    });
    
    if (sortBy !== 'created_at') {
      params.set('sortBy', sortBy);
    }
    
    setSearchParams(params);
  }, [filters, sortBy, setSearchParams]);

  const handleFilterChange = (key: keyof PropertyFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveProperty = async (propertyId: string, isSaved: boolean) => {
    if (!user) {
      toast.error('Please login to save properties');
      navigate('/login');
      return;
    }

    try {
      if (isSaved) {
        await UserService.removeSavedProperty(user.id, propertyId);
        toast.success('Property removed from saved');
      } else {
        await UserService.addSavedProperty(user.id, propertyId);
        toast.success('Property saved successfully');
      }
    } catch (error) {
      console.error('Error saving property:', error);
      toast.error('Failed to save property');
    }
  };

  const handlePropertyClick = async (propertyId: string) => {
    // Track viewing history
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

  const loadMore = () => {
    if (!loading && hasMore) {
      loadProperties(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      {/* Filters Section */}
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <LocationAutocomplete
                value={filters.location || ''}
                onChange={(location) => handleFilterChange('location', location)}
                placeholder="Search location..."
              />
            </div>
            
            <select
              className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              value={filters.type || ''}
              onChange={(e) => handleFilterChange('type', e.target.value || undefined)}
            >
              <option value="">All Types</option>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="flat">Flat</option>
              <option value="villa">Villa</option>
              <option value="land">Land</option>
            </select>

            <select
              className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              value={filters.bedrooms || ''}
              onChange={(e) => handleFilterChange('bedrooms', e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">Any Bedrooms</option>
              <option value="1">1+ Bedroom</option>
              <option value="2">2+ Bedrooms</option>
              <option value="3">3+ Bedrooms</option>
              <option value="4">4+ Bedrooms</option>
              <option value="5">5+ Bedrooms</option>
            </select>

            <select
              className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              value={filters.minPrice || ''}
              onChange={(e) => handleFilterChange('minPrice', e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">Min Price</option>
              <option value="1000000">₹10 Lakhs</option>
              <option value="2500000">₹25 Lakhs</option>
              <option value="5000000">₹50 Lakhs</option>
              <option value="10000000">₹1 Crore</option>
              <option value="20000000">₹2 Crores</option>
            </select>

            <select
              className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              value={filters.maxPrice || ''}
              onChange={(e) => handleFilterChange('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">Max Price</option>
              <option value="2500000">₹25 Lakhs</option>
              <option value="5000000">₹50 Lakhs</option>
              <option value="10000000">₹1 Crore</option>
              <option value="20000000">₹2 Crores</option>
              <option value="50000000">₹5 Crores</option>
            </select>
            
            <select
              className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="created_at">Latest</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Properties Grid */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {loading && properties.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="ml-2 text-gray-600">Loading properties...</span>
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Properties Found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your search filters</p>
            <button
              onClick={() => setFilters({})}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {properties.map((property) => (
                <motion.div
                  key={property.id}
                  variants={itemVariants}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => handlePropertyClick(property.id)}
                >
                  <div className="relative">
                    <img
                      src={property.images[0] || 'https://via.placeholder.com/400x300?text=No+Image'}
                      alt={property.title}
                      className="w-full h-64 object-cover"
                    />
                    {property.is_premium && (
                      <div className="absolute top-4 left-4 bg-emerald-600 text-white px-3 py-1 rounded-full text-sm">
                        Premium
                      </div>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveProperty(property.id, user?.savedProperties?.includes(property.id) || false);
                      }}
                      className="absolute top-4 right-4 p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                    >
                      <Heart 
                        className={`w-5 h-5 ${
                          user?.savedProperties?.includes(property.id) 
                            ? 'text-red-500 fill-current' 
                            : 'text-emerald-600'
                        }`} 
                      />
                    </button>
                  </div>
                  
                  <div className="p-6">
                    <div className="flex items-center space-x-2 text-gray-500 text-sm mb-3">
                      <MapPin className="w-4 h-4" />
                      <span>{property.location}, {property.district}</span>
                    </div>
                    
                    <h3 className="text-xl font-semibold mb-2 truncate">{property.title}</h3>
                    
                    <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600">
                      {property.bedrooms && property.bedrooms > 0 && (
                        <div className="flex items-center space-x-1">
                          <Bed className="w-4 h-4 text-gray-400" />
                          <span>{property.bedrooms} Beds</span>
                        </div>
                      )}
                      {property.bathrooms && property.bathrooms > 0 && (
                        <div className="flex items-center space-x-1">
                          <Bath className="w-4 h-4 text-gray-400" />
                          <span>{property.bathrooms} Baths</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-1">
                        <Square className="w-4 h-4 text-gray-400" />
                        <span>{property.area} sq.ft</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        <IndianRupee className="w-5 h-5 text-emerald-600" />
                        <span className="text-xl font-bold text-emerald-600">
                          {(property.price / 100000).toFixed(2)} Lakhs
                        </span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePropertyClick(property.id);
                        }}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center mt-12">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-8 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span>Load More Properties</span>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Properties;