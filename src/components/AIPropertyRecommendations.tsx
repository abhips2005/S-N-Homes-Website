import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Home, Bed, Bath, MapPin, ArrowRight } from 'lucide-react';
import type { Property, AIRecommendation } from '../types';
import { aiRecommendationService } from '../services/AIRecommendationService';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface Props {
  properties: Property[];
  isOpen: boolean;
  onClose: () => void;
}

const AIPropertyRecommendations: React.FC<Props> = ({ properties, isOpen, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [showResults, setShowResults] = useState(false);
  
  // Form state
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedBedrooms, setSelectedBedrooms] = useState<number[]>([]);
  const [selectedBathrooms, setSelectedBathrooms] = useState<number[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  
  // Available options (derived from properties)
  const availableTypes = [...new Set(properties.map(p => p.type))];
  const availableBedrooms = [...new Set(properties.filter(p => p.bedrooms).map(p => p.bedrooms as number))].sort((a, b) => a - b);
  const availableBathrooms = [...new Set(properties.filter(p => p.bathrooms).map(p => p.bathrooms as number))].sort((a, b) => a - b);
  const availableDistricts = [...new Set(properties.map(p => p.district))].sort();

  // Handle checkbox changes
  const handleTypeChange = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };

  const handleBedroomChange = (bedrooms: number) => {
    setSelectedBedrooms(prev => 
      prev.includes(bedrooms) 
        ? prev.filter(b => b !== bedrooms) 
        : [...prev, bedrooms]
    );
  };

  const handleBathroomChange = (bathrooms: number) => {
    setSelectedBathrooms(prev => 
      prev.includes(bathrooms) 
        ? prev.filter(b => b !== bathrooms) 
        : [...prev, bathrooms]
    );
  };

  const handleDistrictChange = (district: string) => {
    setSelectedDistricts(prev => 
      prev.includes(district) 
        ? prev.filter(d => d !== district) 
        : [...prev, district]
    );
  };

  // Handle next step
  const handleNextStep = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      handleGetRecommendations();
    }
  };

  // Handle back step
  const handleBackStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setShowResults(false);
      setSelectedTypes([]);
      setSelectedBedrooms([]);
      setSelectedBathrooms([]);
      setSelectedDistricts([]);
      setRecommendations([]);
    }
  }, [isOpen]);

  const handleGetRecommendations = async () => {
    if (!user) {
      toast.error('Please login to get personalized recommendations');
      onClose();
      navigate('/login');
      return;
    }
    
    setLoading(true);

    try {
      // Filter properties based on selections
      let filteredProperties = [...properties];
      
      if (selectedTypes.length > 0) {
        filteredProperties = filteredProperties.filter(p => selectedTypes.includes(p.type));
      }
      
      if (selectedBedrooms.length > 0) {
        filteredProperties = filteredProperties.filter(p => p.bedrooms && selectedBedrooms.includes(p.bedrooms));
      }
      
      if (selectedBathrooms.length > 0) {
        filteredProperties = filteredProperties.filter(p => p.bathrooms && selectedBathrooms.includes(p.bathrooms));
      }
      
      if (selectedDistricts.length > 0) {
        filteredProperties = filteredProperties.filter(p => selectedDistricts.includes(p.district));
      }

      // Get AI recommendations from filtered properties
      const recs = await aiRecommendationService.getRecommendations(user, filteredProperties);
      setRecommendations(recs);
      setShowResults(true);
    } catch (error) {
      console.error('Error getting recommendations:', error);
      toast.error('Failed to get recommendations');
    } finally {
      setLoading(false);
    }
  };

  // Handle property click
  const handlePropertyClick = (propertyId: string) => {
    navigate(`/property/${propertyId}`);
    onClose();
  };

  if (!isOpen) return null;

  // Map property types to human-readable labels
  const propertyTypeLabels: Record<string, string> = {
    'residential': 'Residential',
    'commercial': 'Commercial',
    'flat': 'Flat',
    'villa': 'Villa',
    'land': 'Land'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5" />
                <h2 className="text-xl font-semibold">Find Your Perfect Property</h2>
              </div>
              <button onClick={onClose} className="text-white hover:text-emerald-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {!showResults ? (
                <>
                  {/* Progress indicator */}
                  <div className="flex justify-between mb-8">
                    {[1, 2, 3, 4].map((s) => (
                      <div
                        key={s}
                        className={`w-1/4 h-1 ${
                          s <= step ? 'bg-emerald-600' : 'bg-gray-200'
                        } ${s > 1 ? 'ml-1' : ''}`}
                      />
                    ))}
                  </div>

                  {/* Step 1: Property Type */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 mb-4">
                        <Home className="w-6 h-6 text-emerald-600" />
                        <h3 className="text-lg font-semibold">Property Type</h3>
                      </div>
                      <p className="text-gray-600 mb-4">
                        What type of property are you looking for?
                      </p>
                      <div className="space-y-2">
                        {availableTypes.map((type) => (
                          <label
                            key={type}
                            className="flex items-center space-x-3 p-3 border rounded-xl hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTypes.includes(type)}
                              onChange={() => handleTypeChange(type)}
                              className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                            />
                            <span>{propertyTypeLabels[type] || type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 2: Bedrooms */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 mb-4">
                        <Bed className="w-6 h-6 text-emerald-600" />
                        <h3 className="text-lg font-semibold">Bedrooms</h3>
                      </div>
                      <p className="text-gray-600 mb-4">
                        How many bedrooms do you need?
                      </p>
                      <div className="space-y-2">
                        {availableBedrooms.map((bedrooms) => (
                          <label
                            key={bedrooms}
                            className="flex items-center space-x-3 p-3 border rounded-xl hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedBedrooms.includes(bedrooms)}
                              onChange={() => handleBedroomChange(bedrooms)}
                              className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                            />
                            <span>{bedrooms} {bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 3: Bathrooms */}
                  {step === 3 && (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 mb-4">
                        <Bath className="w-6 h-6 text-emerald-600" />
                        <h3 className="text-lg font-semibold">Bathrooms</h3>
                      </div>
                      <p className="text-gray-600 mb-4">
                        How many bathrooms do you prefer?
                      </p>
                      <div className="space-y-2">
                        {availableBathrooms.map((bathrooms) => (
                          <label
                            key={bathrooms}
                            className="flex items-center space-x-3 p-3 border rounded-xl hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedBathrooms.includes(bathrooms)}
                              onChange={() => handleBathroomChange(bathrooms)}
                              className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                            />
                            <span>{bathrooms} {bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 4: District */}
                  {step === 4 && (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 mb-4">
                        <MapPin className="w-6 h-6 text-emerald-600" />
                        <h3 className="text-lg font-semibold">Preferred District</h3>
                      </div>
                      <p className="text-gray-600 mb-4">
                        Which district(s) are you interested in?
                      </p>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {availableDistricts.map((district) => (
                          <label
                            key={district}
                            className="flex items-center space-x-3 p-3 border rounded-xl hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedDistricts.includes(district)}
                              onChange={() => handleDistrictChange(district)}
                              className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                            />
                            <span>{district}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Navigation buttons */}
                  <div className="flex justify-between mt-8">
                    <button
                      onClick={handleBackStep}
                      disabled={step === 1}
                      className={`px-4 py-2 rounded-xl ${
                        step === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Back
                    </button>
                    <button
                      onClick={handleNextStep}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 flex items-center space-x-2"
                    >
                      <span>{step === 4 ? 'Get Recommendations' : 'Next'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <LoadingSpinner size="lg" />
                      <p className="mt-4 text-gray-600">Finding your perfect property...</p>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-lg font-semibold mb-4">AI Recommended Properties</h3>
                      
                      {recommendations.length > 0 ? (
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {recommendations.map((rec) => {
                            const property = properties.find(p => p.id === rec.propertyId);
                            if (!property) return null;

                            return (
                              <div
                                key={rec.propertyId}
                                className="flex border rounded-xl overflow-hidden hover:shadow-md cursor-pointer transition-shadow"
                                onClick={() => handlePropertyClick(rec.propertyId)}
                              >
                                <div className="w-1/3">
                                  <img
                                    src={property.images[0] || 'https://via.placeholder.com/150'}
                                    alt={property.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="w-2/3 p-4">
                                  <div className="flex justify-between items-start">
                                    <h4 className="font-medium">{property.title}</h4>
                                    <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full">
                                      {Math.round(rec.confidence)}% Match
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {property.location}, {property.district}
                                  </p>
                                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                    {property.bedrooms && (
                                      <span className="flex items-center">
                                        <Bed className="w-4 h-4 mr-1" />
                                        {property.bedrooms}
                                      </span>
                                    )}
                                    {property.bathrooms && (
                                      <span className="flex items-center">
                                        <Bath className="w-4 h-4 mr-1" />
                                        {property.bathrooms}
                                      </span>
                                    )}
                                    <span className="font-medium text-emerald-600">
                                      ₹{(property.price / 100000).toFixed(2)} Lakhs
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-600">No properties match your criteria.</p>
                          <button
                            onClick={() => {
                              setShowResults(false);
                              setStep(1);
                            }}
                            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
                          >
                            Try Different Criteria
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIPropertyRecommendations;
