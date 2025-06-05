import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Home as HomeIcon, Building2, Map, Phone, Sparkles, Shield, IndianRupee } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import AIRecommendationButton from '../components/AIRecommendationButton';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { PropertyService } from '../services/propertyService';
import type { Property } from '../types';

function Home() {
  const navigate = useNavigate();
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  const [searchParams, setSearchParams] = useState({
    location: '',
    type: '',
    priceRange: '',
  });

  const [availableProperties, setAvailableProperties] = useState<Property[]>([]);

  // Load available properties for AI recommendations
  useEffect(() => {
    const loadProperties = async () => {
      try {
        console.log('Loading properties for Home page AI recommendations...');
        const properties = await PropertyService.getAllAvailableProperties(50); // Get 50 properties for better recommendations
        console.log('Properties loaded successfully for Home page:', properties.length);
        setAvailableProperties(properties);
      } catch (error) {
        console.error('Error loading properties for Home page:', error);
        // Don't show error to user, just log it
        setAvailableProperties([]);
      }
    };

    loadProperties();
  }, []);

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const stats = [
    { number: '1000+', label: 'Properties Listed' },
    { number: '500+', label: 'Happy Customers' },
    { number: '50+', label: 'Cities Covered' },
    { number: '100%', label: 'Verified Listings' },
  ];

  const testimonials = [
    {
      name: 'Rajesh Kumar',
      role: 'Property Owner',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fit=crop&w=150&h=150',
      text: 'S N Homes helped me sell my property within a month. Their AI-powered platform brought the right buyers to me.',
    },
    {
      name: 'Priya Menon',
      role: 'Home Buyer',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?fit=crop&w=150&h=150',
      text: 'The virtual tours saved me so much time. I could shortlist properties from abroad before making my final decision.',
    },
  ];

  const handleSearch = () => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    navigate(`/properties?${params.toString()}`);
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <div 
        className="relative h-[80vh] bg-cover bg-center"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1582407947304-fd86f028f716?ixlib=rb-1.2.1&auto=format&fit=crop&w=2000&q=80")'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/70" />
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="relative max-w-7xl mx-auto px-4 h-full flex flex-col justify-center items-center text-center"
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Discover Your Dream Home in
            <span className="text-emerald-400"> God's Own Country</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-3xl">
            Experience the future of real estate with AI-powered recommendations and virtual tours
          </p>
          
          {/* Advanced Search Bar */}
          <div className="w-full max-w-4xl bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Location</label>
                <LocationAutocomplete
                  value={searchParams.location}
                  onChange={(location) => setSearchParams(prev => ({ ...prev, location }))}
                  placeholder="Enter city or district"
                  className="bg-white/50 backdrop-blur-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Property Type</label>
                <select
                  className="w-full p-3 border border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  value={searchParams.type}
                  onChange={(e) => setSearchParams(prev => ({ ...prev, type: e.target.value }))}
                >
                  <option value="">All Types</option>
                  <option value="house">House</option>
                  <option value="flat">Apartment</option>
                  <option value="land">Land</option>
                  <option value="villa">Villa</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Price Range</label>
                <select
                  className="w-full p-3 border border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  value={searchParams.priceRange}
                  onChange={(e) => setSearchParams(prev => ({ ...prev, priceRange: e.target.value }))}
                >
                  <option value="">Any Price</option>
                  <option value="0-2500000">Under ₹25 Lakhs</option>
                  <option value="2500000-5000000">₹25-50 Lakhs</option>
                  <option value="5000000-10000000">₹50 Lakhs-1 Crore</option>
                  <option value="10000000+">Above 1 Crore</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <button 
                onClick={handleSearch} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl flex items-center justify-center transform transition hover:scale-105"
              >
                <Search className="w-5 h-5 mr-2" />
                Search Properties
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Stats Section */}
      <div className="bg-emerald-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <h3 className="text-4xl font-bold text-emerald-400 mb-2">{stat.number}</h3>
                <p className="text-white/80">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div ref={ref} className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">Why Choose S N Homes?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Experience the perfect blend of traditional values and cutting-edge technology
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow"
            >
              <div className="bg-emerald-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">AI-Powered Matching</h3>
              <p className="text-gray-600">
                Our advanced AI algorithm learns your preferences to suggest properties that perfectly match your needs
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow"
            >
              <div className="bg-emerald-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Verified Properties</h3>
              <p className="text-gray-600">
                Every property undergoes thorough verification by our expert team for your peace of mind
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow"
            >
              <div className="bg-emerald-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                <IndianRupee className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Best Value</h3>
              <p className="text-gray-600">
                Transparent pricing and the best commission rates in the market
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16">What Our Clients Say</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: index * 0.2 }}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="flex items-center mb-6">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-16 h-16 rounded-full mr-4"
                  />
                  <div>
                    <h4 className="text-xl font-semibold">{testimonial.name}</h4>
                    <p className="text-gray-600">{testimonial.role}</p>
                  </div>
                </div>
                <p className="text-gray-700 italic">"{testimonial.text}"</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          >
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to List Your Property?
            </h2>
            <p className="text-white/90 text-xl mb-8 max-w-2xl mx-auto">
              Join thousands of property owners who trust S N Homes to find the right buyers
            </p>
            <Link
              to="/add-property"
              className="inline-block bg-white text-emerald-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-emerald-50 transition-colors transform hover:scale-105"
            >
              List Your Property
            </Link>
          </motion.div>
        </div>
      </div>

      <AIRecommendationButton properties={availableProperties} />
    </div>
  );
}

export default Home;