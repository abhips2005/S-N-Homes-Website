import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Pannellum from 'react-pannellum';
import { MapPin, Bed, Bath, Square, IndianRupee, Calendar, Heart, Share2, Eye, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PropertyService } from '../services/propertyService';
import { UserService } from '../services/userService';
import { NotificationService } from '../services/NotificationService';
import toast from 'react-hot-toast';
import type { Property } from '../types';

function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeImage, setActiveImage] = useState(0);
  const [showVirtualTour, setShowVirtualTour] = useState(false);

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadProperty();
    }
  }, [id]);

  const loadProperty = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      console.log('Loading property details for ID:', id);
      
      // Get property from Firebase
      const propertyData = await PropertyService.getPropertyById(id);
      
      if (propertyData) {
        setProperty(propertyData);
        
        // Track viewing history and increment views
        if (user) {
          try {
            await Promise.all([
              UserService.addToViewingHistory(user.id, id),
              PropertyService.incrementViews(id)
            ]);
            console.log('Viewing history tracked and views incremented');
            
            // Trigger notification for related properties
            await NotificationService.notifyRelatedProperties(user.id, propertyData);
            
            // Refresh user profile to get updated viewing history
            window.dispatchEvent(new CustomEvent('refreshUser'));
          } catch (error) {
            console.warn('Error tracking view:', error);
          }
        }
      } else {
        console.log('Property not found');
        setProperty(null);
      }
    } catch (error) {
      console.error('Error loading property:', error);
      toast.error('Failed to load property details');
      setProperty(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProperty = async () => {
    if (!user) {
      toast.error('Please login to save properties');
      navigate('/login');
      return;
    }

    if (!property) return;

    try {
      const isSaved = user.savedProperties?.includes(property.id) || false;
      
      if (isSaved) {
        await UserService.removeSavedProperty(user.id, property.id);
        toast.success('Property removed from saved');
      } else {
        await UserService.addSavedProperty(user.id, property.id);
        toast.success('Property saved successfully');
      }
      
      // Refresh user profile to get updated saved properties
      window.dispatchEvent(new CustomEvent('refreshUser'));
    } catch (error) {
      console.error('Error saving property:', error);
      toast.error('Failed to save property');
    }
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const handleGetMoreDetails = async () => {
    if (!user) {
      toast.error('Please login to contact the agent');
      navigate('/login');
      return;
    }
    
    if (!property) return;

    try {
      // Create WhatsApp message
      const userName = user.displayName || user.name || 'User';
      const propertyLink = `${window.location.origin}/property/${property.id}`;
      const message = `Hi, I am ${userName}. I would like to know more about this property: ${propertyLink}`;
      
      // WhatsApp API URL with your number and the message
      const whatsappNumber = '9605807957'; // Your WhatsApp number
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
      
      // Open WhatsApp in new tab
      window.open(whatsappUrl, '_blank');
      
      toast.success('Redirecting to WhatsApp...');
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      toast.error('Failed to open WhatsApp. Please try again.');
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Property Not Found</h2>
          <p className="text-gray-600 mb-4">The property you're looking for doesn't exist or has been removed.</p>
          <button 
            onClick={() => navigate('/properties')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
          >
            Browse Properties
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="bg-white rounded-2xl shadow-lg overflow-hidden"
        >
          {/* Image Gallery */}
          <div className="relative">
            <div className="aspect-w-16 aspect-h-9">
              {showVirtualTour && property.virtual_tour_url ? (
                <Pannellum
                  width="100%"
                  height="600px"
                  image={property.virtual_tour_url}
                  pitch={10}
                  yaw={180}
                  hfov={110}
                  autoLoad
                  onLoad={() => {
                    console.log('panorama loaded');
                  }}
                />
              ) : (
                <img
                  src={property.images[activeImage]}
                  alt={property.title}
                  className="w-full h-[600px] object-cover"
                />
              )}
            </div>
            
            <div className="absolute bottom-4 left-4 right-4 flex justify-center space-x-2">
              {property.images.map((_, index) => (
                <button
                  key={index}
                  className={`w-3 h-3 rounded-full ${
                    index === activeImage ? 'bg-white' : 'bg-white/50'
                  }`}
                  onClick={() => setActiveImage(index)}
                />
              ))}
            </div>

            <div className="absolute top-4 right-4 flex space-x-2">
              {property.virtual_tour_url && (
                <button
                  onClick={() => setShowVirtualTour(!showVirtualTour)}
                  className="px-4 py-2 bg-white/90 rounded-xl text-emerald-600 font-medium hover:bg-white transition-colors"
                >
                  {showVirtualTour ? 'View Photos' : '360° Tour'}
                </button>
              )}
              <button
                onClick={handleSaveProperty}
                className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
              >
                <Heart className={`w-6 h-6 text-emerald-600 ${user?.savedProperties?.includes(property.id) ? 'fill-emerald-600' : ''}`} />
              </button>
              <button className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors">
                <Share2 className="w-6 h-6 text-emerald-600" />
              </button>
            </div>
          </div>

          {/* Property Details */}
          <div className="p-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center space-x-2 text-gray-500 mb-2">
                  <MapPin className="w-5 h-5" />
                  <span>{property.location}, {property.district}</span>
                  {property.is_premium && (
                    <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-sm">
                      Premium
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-bold">{property.title}</h1>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end space-x-1 text-gray-500 mb-2">
                  <Eye className="w-5 h-5" />
                  <span>{property.views} views</span>
                </div>
                <div className="flex items-center space-x-1">
                  <IndianRupee className="w-6 h-6 text-emerald-600" />
                  <span className="text-3xl font-bold text-emerald-600">
                    {(property.price / 100000).toFixed(2)} Lakhs
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Property Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Bed className="w-5 h-5 text-gray-400" />
                      <span>{property.bedrooms} Bedrooms</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Bath className="w-5 h-5 text-gray-400" />
                      <span>{property.bathrooms} Bathrooms</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Square className="w-5 h-5 text-gray-400" />
                      <span>{property.area} sq.ft</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <span>Built {property.constructionYear}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Amenities</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {property.amenities.map((amenity, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-emerald-600 rounded-full" />
                        <span>{amenity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Nearby Places</h3>
                  <div className="space-y-2">
                    {property.nearbyPlaces.map((place, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span>{place.name}</span>
                        <span className="text-gray-500">{place.distance} km</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Additional Info</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Energy Rating</span>
                      <span className="font-medium">{property.energyRating}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Parking Spaces</span>
                      <span className="font-medium">{property.parkingSpaces}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Furnished</span>
                      <span className="font-medium">{property.furnished ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Land Area</span>
                      <span className="font-medium">{property.landArea} {property.landAreaUnit}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4">Contact Agent</h3>
                <div className="space-y-4">
                  <div className="flex flex-col space-y-1">
                    <span className="text-gray-600 text-sm">Property ID</span>
                    <span className="font-medium">{property.id}</span>
                  </div>
                  
                  <button
                    onClick={handleGetMoreDetails}
                    className="w-full bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition-colors flex justify-center items-center space-x-2"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>Get More Details</span>
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Description</h3>
              <p className="text-gray-700 leading-relaxed">{property.description}</p>
            </div>
          </div>
        </motion.div>
      </div>


    </div>
  );
}

export default PropertyDetails;