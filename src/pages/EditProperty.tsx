import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Plus, Minus, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PropertyService } from '../services/propertyService';
import toast from 'react-hot-toast';
import type { Property } from '../types';
import { v4 as uuidv4 } from 'uuid';
import LocationAutocomplete from '../components/LocationAutocomplete';
import LoadingSpinner from '../components/LoadingSpinner';

function EditProperty() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  // Form state
  const [property, setProperty] = useState<Partial<Property>>({
    type: 'residential',
    amenities: [],
    images: [],
    features: [],
  });

  // Form fields
  const [amenity, setAmenity] = useState('');
  const [feature, setFeature] = useState('');

  // Kerala districts
  const keralaDistricts = [
    'Thiruvananthapuram', 
    'Kollam', 
    'Pathanamthitta', 
    'Alappuzha', 
    'Kottayam', 
    'Idukki', 
    'Ernakulam', 
    'Thrissur', 
    'Palakkad', 
    'Malappuram', 
    'Kozhikode', 
    'Wayanad', 
    'Kannur', 
    'Kasaragod'
  ];

  // Property types
  const propertyTypes = [
    { value: 'residential', label: 'Residential' },
    { value: 'commercial', label: 'Commercial' },
    { value: 'flat', label: 'Flat' },
    { value: 'villa', label: 'Villa' },
    { value: 'land', label: 'Land Only' }
  ];
  
  // Load property data
  useEffect(() => {
    if (id && user) {
      loadPropertyData();
    }
  }, [id, user]);

  const loadPropertyData = async () => {
    if (!id) {
      toast.error('Property ID not found');
      navigate('/dashboard?tab=listings');
      return;
    }

    try {
      setLoading(true);
      console.log('Loading property data for editing:', id);
      
      const propertyData = await PropertyService.getPropertyById(id);
      
      if (propertyData) {
        // Verify user owns this property
        if (propertyData.user_id !== user?.id) {
          toast.error('You can only edit your own properties');
          navigate('/dashboard?tab=listings');
          return;
        }
        
        console.log('Property data loaded successfully:', propertyData);
        setProperty(propertyData);
        setImagePreviewUrls(propertyData.images || []);
      } else {
        toast.error('Property not found');
        navigate('/dashboard?tab=listings');
      }
    } catch (error) {
      console.error('Error loading property:', error);
      toast.error('Failed to load property details');
      navigate('/dashboard?tab=listings');
    } finally {
      setLoading(false);
    }
  };

  // Add new location handler for OSM component
  const handleLocationChange = (location: string) => {
    setProperty(prev => ({ ...prev, location }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!property.title || !property.type || !property.location || 
        !property.district || !property.area || !property.price) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    if (!id) {
      toast.error('Property ID not found');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Updating property:', id);
      console.log('Property data:', property);
      
      // Prepare update data
      const updateData: Partial<Property> = {
        title: property.title,
        description: property.description,
        price: Number(property.price),
        type: property.type,
        location: property.location,
        district: property.district,
        bedrooms: Number(property.bedrooms),
        bathrooms: Number(property.bathrooms),
        area: Number(property.area),
        landArea: Number(property.landArea) || 0,
        landAreaUnit: property.landAreaUnit || 'cent',
        amenities: property.amenities || [],
        features: property.features || [],
        furnished: property.furnished || false,
        parkingSpaces: Number(property.parkingSpaces) || 0,
        constructionYear: Number(property.constructionYear),
        energyRating: property.energyRating || 'B',
        virtual_tour_url: property.virtual_tour_url || '',
        is_premium: property.is_premium || false
      };

      // Update property in Firebase
      await PropertyService.updateProperty(id, updateData, images);
      
      console.log('Property updated successfully');
      toast.success('Property updated successfully!');
      navigate('/dashboard?tab=listings');
    } catch (error) {
      console.error('Error updating property:', error);
      toast.error('Failed to update property listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files);
      setImages(prev => [...prev, ...newImages]);
      
      // Create preview URLs
      const newImageUrls = newImages.map(file => URL.createObjectURL(file));
      setImagePreviewUrls(prev => [...prev, ...newImageUrls]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const addAmenity = () => {
    if (amenity.trim() && property.amenities) {
      setProperty(prev => ({
        ...prev,
        amenities: [...(prev.amenities || []), amenity.trim()]
      }));
      setAmenity('');
    }
  };

  const removeAmenity = (index: number) => {
    if (property.amenities) {
      setProperty(prev => ({
        ...prev,
        amenities: prev.amenities?.filter((_, i) => i !== index)
      }));
    }
  };

  const addFeature = () => {
    if (feature.trim() && property.features) {
      setProperty(prev => ({
        ...prev,
        features: [...(prev.features || []), feature.trim()]
      }));
      setFeature('');
    }
  };

  const removeFeature = (index: number) => {
    if (property.features) {
      setProperty(prev => ({
        ...prev,
        features: prev.features?.filter((_, i) => i !== index)
      }));
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <p className="text-gray-500 mb-4">Please login to edit properties</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-8"
        >
          <h1 className="text-3xl font-bold mb-8">Edit Your Property</h1>
          
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Basic Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Property Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={property.title || ''}
                    onChange={(e) => setProperty(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Property Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={property.type}
                    onChange={(e) => setProperty(prev => ({ ...prev, type: e.target.value as Property['type'] }))}
                  >
                    {propertyTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  value={property.description || ''}
                  onChange={(e) => setProperty(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Location</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <LocationAutocomplete
                    value={property.location || ''}
                    onChange={handleLocationChange}
                    placeholder="Enter city, town, or area"
                    required={true}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    District <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={property.district || ''}
                    onChange={(e) => setProperty(prev => ({ ...prev, district: e.target.value }))}
                  >
                    <option value="">Select District</option>
                    {keralaDistricts.map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Property Details */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Property Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bedrooms {property.type !== 'land' && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={property.bedrooms || ''}
                    onChange={(e) => setProperty(prev => ({ ...prev, bedrooms: Number(e.target.value) }))}
                    required={property.type !== 'land'}
                    disabled={property.type === 'land'}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bathrooms {property.type !== 'land' && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={property.bathrooms || ''}
                    onChange={(e) => setProperty(prev => ({ ...prev, bathrooms: Number(e.target.value) }))}
                    required={property.type !== 'land'}
                    disabled={property.type === 'land'}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Area (sq.ft) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={property.area || ''}
                    onChange={(e) => setProperty(prev => ({ ...prev, area: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Land Area <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={property.landArea || ''}
                    onChange={(e) => setProperty(prev => ({ ...prev, landArea: Number(e.target.value) }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={property.landAreaUnit || 'cent'}
                    onChange={(e) => setProperty(prev => ({ ...prev, landAreaUnit: e.target.value as 'cent' | 'acre' }))}
                  >
                    <option value="cent">Cent</option>
                    <option value="acre">Acre</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={property.price || ''}
                    onChange={(e) => setProperty(prev => ({ ...prev, price: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            {/* Amenities */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Amenities</h2>
              
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Add amenity"
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  value={amenity}
                  onChange={(e) => setAmenity(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAmenity())}
                />
                <button
                  type="button"
                  onClick={addAmenity}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {property.amenities?.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => removeAmenity(index)}
                      className="text-emerald-700 hover:text-emerald-900"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Features</h2>
              
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Add feature"
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  value={feature}
                  onChange={(e) => setFeature(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                />
                <button
                  type="button"
                  onClick={addFeature}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {property.features?.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="text-emerald-700 hover:text-emerald-900"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Images */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Property Images</h2>
              
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8">
                <div className="flex flex-col items-center justify-center">
                  <Upload className="w-12 h-12 text-gray-400 mb-4" />
                  <p className="text-gray-700 mb-2">Drag and drop your images here</p>
                  <p className="text-gray-500 text-sm mb-4">or</p>
                  <label className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer">
                    Browse Files
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
              </div>

              {imagePreviewUrls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                  {imagePreviewUrls.map((url, index) => (
                    <div key={index} className="relative">
                      <img
                        src={url}
                        alt={`Property ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-white rounded-full p-1 shadow-md"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition-colors flex justify-center items-center"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Update Property'
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

export default EditProperty; 