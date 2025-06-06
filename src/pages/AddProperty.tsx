import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Plus, Minus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import type { Property } from '../types';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { PropertyService } from '../services/propertyService';
import { NotificationService } from '../services/NotificationService';
import imageCompression from 'browser-image-compression';

function AddProperty() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  // Form state
  const [property, setProperty] = useState<Partial<Property>>({
    type: 'residential',
    propertyListingType: 'buy',
    amenities: [],
    features: [],
    furnished: 'No',
    landAreaUnit: 'cent',
    parkingSpaces: 0,
    nearbyPlaces: []
  });

  // Form fields
  const [amenity, setAmenity] = useState('');
  const [feature, setFeature] = useState('');
  const [nearbyPlace, setNearbyPlace] = useState('');

  // Furnished options
  const furnishedOptions = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
    { value: 'Semi Furnished', label: 'Semi Furnished' },
    { value: 'Not Applicable', label: 'Not Applicable' }
  ];

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

  // Property listing types
  const propertyListingTypes = [
    { value: 'buy', label: 'For Sale' },
    { value: 'rent', label: 'For Rent' },
    { value: 'lease', label: 'For Lease' }
  ];

  // Add new location handler for the OSM component
  const handleLocationChange = (location: string) => {
    setProperty(prev => ({ ...prev, location }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please login to create a property');
      return;
    }

    // More explicit validation for required fields
    const requiredFields = [
      { field: 'title', value: property.title, label: 'Property Title' },
      { field: 'type', value: property.type, label: 'Property Type' },
      { field: 'propertyListingType', value: property.propertyListingType, label: 'Listing Type' },
      { field: 'description', value: property.description, label: 'Description' },
      { field: 'location', value: property.location, label: 'Location' },
      { field: 'district', value: property.district, label: 'District' },
      { field: 'price', value: property.price, label: 'Price' },
      { field: 'landArea', value: property.landArea, label: 'Land Area' },
      { field: 'landAreaUnit', value: property.landAreaUnit, label: 'Unit' },
      { field: 'furnished', value: property.furnished, label: 'Furnished Status' }
    ];

    // Add area requirement only for non-land properties
    if (property.type !== 'land') {
      requiredFields.push({ field: 'area', value: property.area, label: 'Total Area' });
    }
    
    // Validate bedrooms, bathrooms, and construction year only if property type is not land
    if (property.type !== 'land') {
      requiredFields.push(
        { field: 'bedrooms', value: property.bedrooms, label: 'Bedrooms' },
        { field: 'bathrooms', value: property.bathrooms, label: 'Bathrooms' },
        { field: 'constructionYear', value: property.constructionYear, label: 'Built Year' }
      );
    }
    
    // Check each field
    for (const { field, value, label } of requiredFields) {
      if (value === undefined || value === null || value === '') {
        toast.error(`Please fill the ${label} field`);
        return;
      }
    }
    
    // Validate numeric fields are positive
    if ((property.price && property.price <= 0) ||
        (property.type !== 'land' && property.area && property.area <= 0) ||
        (property.landArea && property.landArea <= 0) ||
        (property.type !== 'land' && property.bedrooms && property.bedrooms <= 0) ||
        (property.type !== 'land' && property.bathrooms && property.bathrooms <= 0)) {
      toast.error('Numeric values must be greater than zero');
      return;
    }

    // Validate at least one image
    if (images.length === 0) {
      toast.error('Please upload at least one property image');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the property data for Firebase
      const propertyData: Omit<Property, 'id' | 'created_at' | 'views'> = {
        title: property.title || '',
        description: property.description || '',
        price: property.price || 0,
        type: property.type as any || 'residential',
        propertyListingType: (property.propertyListingType as any) || 'buy',
        location: property.location || '',
        district: property.district || '',
        bedrooms: property.bedrooms || 0,
        bathrooms: property.bathrooms || 0,
        area: property.type !== 'land' ? (property.area || 0) : 0,
        landArea: property.landArea || 0,
        landAreaUnit: property.landAreaUnit || 'cent',
        images: [], // Will be filled by the service
        features: property.features || [],
        amenities: property.amenities || [],
        user_id: user.id,
        is_premium: false,
        status: 'available',
        furnished: property.furnished || 'No',
        coordinates: {
          latitude: 10.8505, // Default Kerala coordinates
          longitude: 76.2711
        },
        nearbyPlaces: property.nearbyPlaces || [],
        constructionYear: property.constructionYear || new Date().getFullYear(),
        parkingSpaces: property.parkingSpaces || 0
      };

      // Create property with images
      const propertyId = await PropertyService.createProperty(propertyData, images);
      
      // Trigger automatic notifications for new property
      try {
        const fullPropertyData = {
          ...propertyData,
          id: propertyId
        };
        await NotificationService.notifyNewProperty(fullPropertyData);
      } catch (error) {
        console.warn('Error sending new property notifications:', error);
      }
      
      toast.success(`Property listed successfully! Property ID: KE-${propertyId.slice(-6)}`);
      navigate('/dashboard?tab=listings');
    } catch (error) {
      console.error('Error creating property:', error);
      toast.error('Failed to create property listing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files);
      
      // Validate file types
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const invalidFiles = newImages.filter(file => !validTypes.includes(file.type));
      
      if (invalidFiles.length > 0) {
        toast.error('Please upload only JPEG, PNG, or WebP images');
        return;
      }
      
      // Limit total images to 5
      if (images.length + newImages.length > 5) {
        toast.error('Maximum 5 images allowed');
        return;
      }
      
              try {
          toast.loading('Processing images...', { id: 'processing' });
          
          // Compression options
          const options = {
            maxSizeMB: 0.5, // 500KB
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            fileType: 'image/jpeg' as const,
            quality: 0.8
          };
          
          // Compress all images
          const compressedImages = await Promise.all(
            newImages.map(async (file) => {
              try {
                const compressedFile = await imageCompression(file, options);
                
                // Create a new File object with the original name but compressed data
                return new File([compressedFile], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
              } catch (error) {
                console.error('Error processing image:', file.name, error);
                toast.error(`Failed to process ${file.name}`);
                return null;
              }
            })
          );
          
          // Filter out failed compressions
          const validCompressedImages = compressedImages.filter(img => img !== null) as File[];
          
          if (validCompressedImages.length > 0) {
            setImages(prev => [...prev, ...validCompressedImages]);
            
            // Create preview URLs
            const newImageUrls = validCompressedImages.map(file => URL.createObjectURL(file));
            setImagePreviewUrls(prev => [...prev, ...newImageUrls]);
            
            toast.success(`${validCompressedImages.length} image(s) added successfully!`, { id: 'processing' });
          } else {
            toast.error('Failed to process any images', { id: 'processing' });
          }
          
        } catch (error) {
          console.error('Error during image processing:', error);
          toast.error('Failed to process images. Please try again.', { id: 'processing' });
        }
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviewUrls(prev => {
      // Revoke the URL to prevent memory leaks
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
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

  const addNearbyPlace = () => {
    if (!nearbyPlace.trim()) return;
    
    const newPlace = {
      name: nearbyPlace.trim(),
      type: 'other' as const,
      distance: 0
    };
    
    setProperty(prev => ({
      ...prev,
      nearbyPlaces: [...(prev.nearbyPlaces || []), newPlace]
    }));
    setNearbyPlace('');
  };

  const removeNearbyPlace = (index: number) => {
    setProperty(prev => ({
      ...prev,
      nearbyPlaces: prev.nearbyPlaces?.filter((_, i) => i !== index) || []
    }));
  };

  // Clean up preview URLs when component unmounts
  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Please Login</h2>
            <p className="text-gray-600 mb-6">
              You need to be logged in to list a property.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
            >
              Login
            </button>
          </div>
        </div>
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
          <h1 className="text-3xl font-bold mb-8">List Your Property</h1>
          
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Listing Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={property.propertyListingType}
                    onChange={(e) => setProperty(prev => ({ ...prev, propertyListingType: e.target.value as Property['propertyListingType'] }))}
                  >
                    {propertyListingTypes.map(listingType => (
                      <option key={listingType.value} value={listingType.value}>{listingType.label}</option>
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
                
                {property.type !== 'land' && (
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
                )}
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
                    onChange={(e) => setProperty(prev => ({ ...prev, landAreaUnit: e.target.value }))}
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

              {/* Additional Property Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Built Year {property.type !== 'land' && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={property.constructionYear || ''}
                    onChange={(e) => setProperty(prev => ({ ...prev, constructionYear: Number(e.target.value) }))}
                    required={property.type !== 'land'}
                    disabled={property.type === 'land'}
                    placeholder="e.g., 2020"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Furnished Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={property.furnished || 'No'}
                    onChange={(e) => setProperty(prev => ({ ...prev, furnished: e.target.value }))}
                  >
                    {furnishedOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parking Available <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    value={property.parkingSpaces ? 'yes' : 'no'}
                    onChange={(e) => setProperty(prev => ({ ...prev, parkingSpaces: e.target.value === 'yes' ? 1 : 0 }))}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
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

            {/* Nearby Places */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Nearby Places</h2>
              <p className="text-sm text-gray-600">Add important nearby locations like schools, hospitals, shopping centers, etc.</p>
              
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="e.g., ABC School, XYZ Hospital, Main Market"
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  value={nearbyPlace}
                  onChange={(e) => setNearbyPlace(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addNearbyPlace())}
                />
                <button
                  type="button"
                  onClick={addNearbyPlace}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {property.nearbyPlaces?.map((place, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full"
                  >
                    <span>{place.name}</span>
                    <button
                      type="button"
                      onClick={() => removeNearbyPlace(index)}
                      className="text-blue-700 hover:text-blue-900"
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
                  <p className="text-xs text-gray-500 mt-3">
                    Maximum 5 images • JPEG, PNG, WebP accepted
                  </p>
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
                'List Property'
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

export default AddProperty;