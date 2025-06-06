import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Edit2, Trash2, Plus, Eye, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PropertyService } from '../services/propertyService';
import toast from 'react-hot-toast';
import type { Property } from '../types';

interface UserListingsProps {
  preloadedListings?: Property[];
  isLoading?: boolean;
}

const UserListings: React.FC<UserListingsProps> = ({ preloadedListings, isLoading: parentLoading }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listings, setListings] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const dataLoadedRef = useRef(false);

  const loadUserListings = useCallback(async () => {
    if (!user || loadingRef.current || dataLoadedRef.current) return;
    
    try {
      loadingRef.current = true;
      setLoading(true);
      console.log('Loading user listings for user:', user.id);
      const userProperties = await PropertyService.getPropertiesByUser(user.id);
      console.log('User properties loaded successfully:', userProperties.length);
      setListings(userProperties);
      dataLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading user listings:', error);
      console.error('Error details:', {
        message: (error as any)?.message,
        stack: (error as any)?.stack,
        userId: user.id
      });
      toast.error('Failed to load your listings');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [user]);

  // Use preloaded data if available, otherwise load from API
  useEffect(() => {
    if (preloadedListings && preloadedListings.length >= 0) {
      console.log('Using preloaded listings data:', preloadedListings.length);
      setListings(preloadedListings);
      setLoading(parentLoading || false);
      dataLoadedRef.current = true;
    } else if (user && !dataLoadedRef.current) {
      loadUserListings();
    }
  }, [user, loadUserListings, preloadedListings, parentLoading]);

  const handleCreateListing = () => {
    navigate('/add-property');
  };

  const handleEditListing = (propertyId: string) => {
    // In a real app, this would navigate to an edit page with the property ID
    navigate(`/edit-property/${propertyId}`);
  };

  const handleViewListing = (propertyId: string) => {
    navigate(`/property/${propertyId}`);
  };

  const confirmDelete = (propertyId: string) => {
    setPropertyToDelete(propertyId);
    setShowDeleteModal(true);
  };

  const handleDeleteListing = async () => {
    if (!propertyToDelete) return;
    
    try {
      await PropertyService.deleteProperty(propertyToDelete);
      setListings(prevListings => prevListings.filter(listing => listing.id !== propertyToDelete));
      toast.success('Property listing deleted');
      setShowDeleteModal(false);
      setPropertyToDelete(null);
      // Don't need to reload data since we updated the state directly
    } catch (error) {
      console.error('Error deleting property:', error);
      toast.error('Failed to delete property');
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setPropertyToDelete(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col items-center justify-center h-64">
            <p className="text-gray-500 mb-4">Please login to view your listings</p>
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
          <h1 className="text-2xl font-bold">My Listings</h1>
          <button
            onClick={handleCreateListing}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Create New Listing</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : listings.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">No Listings Yet</h2>
            <p className="text-gray-600 mb-6">
              You haven't listed any properties yet. Create your first listing now!
            </p>
            <button
              onClick={handleCreateListing}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors inline-flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Create New Listing</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map(listing => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-lg overflow-hidden"
              >
                <div className="relative">
                  <img
                    src={listing.images[0]}
                    alt={listing.title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-2 right-2 flex space-x-1">
                    <button
                      onClick={() => handleViewListing(listing.id)}
                      className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                      title="View Property"
                    >
                      <Eye className="w-4 h-4 text-emerald-600" />
                    </button>
                    <button
                      onClick={() => handleEditListing(listing.id)}
                      className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                      title="Edit Property"
                    >
                      <Edit2 className="w-4 h-4 text-emerald-600" />
                    </button>
                    <button
                      onClick={() => confirmDelete(listing.id)}
                      className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                      title="Delete Property"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                  {listing.is_premium && (
                    <span className="absolute top-2 left-2 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs">
                      Premium
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1">{listing.title}</h3>
                  <p className="text-gray-600 text-sm mb-2">{listing.location}, {listing.district}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-600 font-medium">
                      ₹{(listing.price / 100000).toFixed(2)} Lakhs
                    </span>
                    <span className="text-xs text-gray-500">
                      {listing.views} views
                    </span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">ID: {listing.id}</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        listing.status === 'available' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : listing.status === 'sold' 
                          ? 'bg-red-100 text-red-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Confirm Deletion</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this property listing? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 flex items-center space-x-1"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={handleDeleteListing}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center space-x-1"
                >
                  <Check className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserListings; 