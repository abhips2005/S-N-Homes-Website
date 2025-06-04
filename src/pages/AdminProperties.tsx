import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit, Trash2, Eye, Search, Filter, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { Property } from '../types';

const AdminProperties: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // In a real app, this would be an API call to fetch properties
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      // Mock data - Replace with API call
      const mockProperties: Property[] = [
        {
          id: 'KE-123456-789',
          title: 'Luxury Villa in Kochi',
          description: 'Beautiful 4BHK villa with modern amenities.',
          type: 'residential',
          location: 'Kochi',
          district: 'Ernakulam',
          price: 15000000,
          area: 2500,
          bedrooms: 4,
          bathrooms: 3,
          images: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'],
          status: 'available',
          landArea: 10,
          landAreaUnit: 'cent',
          features: [],
          amenities: [],
          user_id: 'user1',
          created_at: '2023-01-15',
          is_premium: true,
          furnished: true,
          views: 150,
          coordinates: { latitude: 9.9312, longitude: 76.2673 },
          nearbyPlaces: []
        },
        {
          id: 'KE-654321-987',
          title: 'Modern Apartment in Trivandrum',
          description: 'Spacious 3BHK apartment with great amenities.',
          type: 'flat',
          location: 'Trivandrum',
          district: 'Thiruvananthapuram',
          price: 8500000,
          area: 1800,
          bedrooms: 3,
          bathrooms: 2,
          images: ['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'],
          status: 'sold',
          landArea: 0,
          landAreaUnit: 'cent',
          features: [],
          amenities: [],
          user_id: 'user2',
          created_at: '2023-02-20',
          is_premium: false,
          furnished: true,
          views: 85,
          coordinates: { latitude: 8.5241, longitude: 76.9366 },
          nearbyPlaces: []
        }
      ];
      
      setProperties(mockProperties);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredProperties = properties.filter(property => 
    property.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedStatus === 'all' || property.status === selectedStatus)
  );

  const handleAddProperty = () => {
    navigate('/add-property');
  };

  const handleViewProperty = (id: string) => {
    navigate(`/property/${id}`);
  };

  const handleEditProperty = (id: string) => {
    navigate(`/edit-property/${id}`);
  };

  const handleDeleteProperty = (id: string) => {
    if (window.confirm('Are you sure you want to delete this property?')) {
      // In a real app, this would be an API call to delete the property
      console.log('Deleting property:', id);
      
      // Update local state
      setProperties(prev => prev.filter(p => p.id !== id));
      toast.success('Property deleted successfully');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Manage Properties</h1>
          <button 
            onClick={handleAddProperty}
            className="bg-emerald-600 text-white px-6 py-2 rounded-xl hover:bg-emerald-700 flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Property</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search properties..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="sold">Sold</option>
                <option value="rented">Rented</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center p-8">
              <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {filteredProperties.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No properties found matching your criteria
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Property
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProperties.map((property) => (
                      <tr key={property.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <img
                              src={property.images[0]}
                              alt={property.title}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{property.title}</div>
                              <div className="text-sm text-gray-500">ID: {property.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {property.location}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ₹{(property.price / 100000).toFixed(2)} Lakhs
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            property.status === 'available' ? 'bg-green-100 text-green-800' :
                            property.status === 'sold' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {property.status.charAt(0).toUpperCase() + property.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex space-x-3">
                            <button 
                              onClick={() => handleViewProperty(property.id)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleEditProperty(property.id)}
                              className="text-emerald-600 hover:text-emerald-800"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteProperty(property.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminProperties;
