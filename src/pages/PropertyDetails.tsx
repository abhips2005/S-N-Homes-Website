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
    <div className="min-h-screen bg-gray-50 pt-16 md:pt-20">
      <div className="max-w-7xl mx-auto px-2 md:px-4 py-4 md:py-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="bg-white rounded-xl md:rounded-2xl shadow-lg overflow-hidden"
        >
          {/* Image Gallery */}
          <div className="relative">
            <div className="aspect-w-16 aspect-h-9">
              {showVirtualTour && property.virtual_tour_url ? (
                <Pannellum
                  width="100%"
                  height={window.innerWidth < 768 ? "300px" : "600px"}
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
                  className="w-full h-[300px] md:h-[600px] object-cover"
                />
              )}
            </div>
            
            <div className="absolute bottom-2 md:bottom-4 left-2 md:left-4 right-2 md:right-4 flex justify-center space-x-2">
              {property.images.map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${
                    index === activeImage ? 'bg-white' : 'bg-white/50'
                  }`}
                  onClick={() => setActiveImage(index)}
                />
              ))}
            </div>

            <div className="absolute top-2 md:top-4 right-2 md:right-4 flex space-x-1 md:space-x-2">
              {property.virtual_tour_url && (
                <button
                  onClick={() => setShowVirtualTour(!showVirtualTour)}
                  className="px-3 py-2 md:px-4 md:py-2 bg-white/90 rounded-lg md:rounded-xl text-emerald-600 font-medium hover:bg-white transition-colors text-sm md:text-base"
                >
                  {showVirtualTour ? '📷' : '360°'}
                </button>
              )}
              <button
                onClick={handleSaveProperty}
                className="p-1.5 md:p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
              >
                <Heart className={`w-5 h-5 md:w-6 md:h-6 text-emerald-600 ${user?.savedProperties?.includes(property.id) ? 'fill-emerald-600' : ''}`} />
              </button>
              <button className="p-1.5 md:p-2 bg-white/90 rounded-full hover:bg-white transition-colors">
                <Share2 className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
              </button>
            </div>
          </div>

          {/* Property Details */}
          <div className="p-4 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-6 space-y-4 md:space-y-0">
              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-2 text-gray-500 mb-2">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="text-sm md:text-base">{property.location}, {property.district}</span>
                  </div>
                  {property.is_premium && (
                    <span className="bg-emerald-600 text-white px-2 py-1 md:px-3 md:py-1 rounded-full text-xs md:text-sm w-fit">
                      Premium
                    </span>
                  )}
                </div>
                <h1 className="text-xl md:text-3xl font-bold leading-tight">{property.title}</h1>
              </div>
              <div className="flex flex-row md:flex-col md:text-right items-center md:items-end justify-between md:justify-start space-x-4 md:space-x-0">
                <div className="flex items-center space-x-1 text-gray-500 text-sm md:text-base">
                  <Eye className="w-4 h-4 md:w-5 md:h-5" />
                  <span>{property.views} views</span>
                </div>
                <div className="flex items-center space-x-1">
                  <IndianRupee className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
                  <span className="text-xl md:text-3xl font-bold text-emerald-600">
                    {(property.price / 100000).toFixed(2)} Lakhs
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-6 md:mb-8">
              <div className="space-y-4 md:space-y-6">
                <div>
                  <h3 className="text-base md:text-lg font-semibold mb-3">Property Details</h3>
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div className="flex items-center space-x-2">
                      <Bed className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                      <span className="text-sm md:text-base">{property.bedrooms} Bedrooms</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Bath className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                      <span className="text-sm md:text-base">{property.bathrooms} Bathrooms</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Square className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                      <span className="text-sm md:text-base">{property.area} sq.ft</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                      <span className="text-sm md:text-base">Built {property.constructionYear}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base md:text-lg font-semibold mb-3">Amenities</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {property.amenities.map((amenity, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-emerald-600 rounded-full flex-shrink-0" />
                        <span className="text-sm md:text-base">{amenity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4 md:space-y-6">
                <div>
                  <h3 className="text-base md:text-lg font-semibold mb-3">Nearby Places</h3>
                  <div className="space-y-2">
                    {property.nearbyPlaces && property.nearbyPlaces.length > 0 ? (
                      property.nearbyPlaces.map((place, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm md:text-base">{place.name}</span>
                          <span className="text-gray-500 text-sm md:text-base">{place.distance} km</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm md:text-base">No nearby places listed</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-base md:text-lg font-semibold mb-3">Additional Info</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm md:text-base">Built Year</span>
                      <span className="font-medium text-sm md:text-base">{property.constructionYear || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm md:text-base">Parking Available</span>
                      <span className="font-medium text-sm md:text-base">{property.parkingSpaces ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm md:text-base">Furnished</span>
                      <span className="font-medium text-sm md:text-base">{property.furnished}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm md:text-base">Land Area</span>
                      <span className="font-medium text-sm md:text-base">{property.landArea} {property.landAreaUnit}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 md:p-6 rounded-xl">
                <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Contact Agent</h3>
                <div className="space-y-3 md:space-y-4">
                  <div className="flex flex-col space-y-1">
                    <span className="text-gray-600 text-xs md:text-sm">Property ID</span>
                    <span className="font-medium text-sm md:text-base break-all">{property.id}</span>
                  </div>
                  
                  <button
                    onClick={handleGetMoreDetails}
                    className="w-full bg-emerald-600 text-white py-3 md:py-3 rounded-xl hover:bg-emerald-700 transition-colors flex justify-center items-center space-x-2 text-sm md:text-base"
                  >
                    <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
                    <span>Get More Details</span>
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-base md:text-lg font-semibold mb-3">Description</h3>
              <p className="text-gray-700 leading-relaxed text-sm md:text-base">{property.description}</p>
            </div>
          </div>
        </motion.div>
      </div>


    </div>
  );
}

export default PropertyDetails;