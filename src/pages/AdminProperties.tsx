import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit, Trash2, Eye, Search, Filter, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PropertyService } from '../services/propertyService';
import { UserService } from '../services/userService';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Property, User } from '../types';

interface PropertyWithOwner extends Property {
  owner?: {
    name: string;
    phone: string;
  };
}

const AdminProperties: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [properties, setProperties] = useState<PropertyWithOwner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      setLoading(true);
      
      // Load all properties from database
      const allProperties = await PropertyService.getAllAvailableProperties(1000);
      
      // Get all users to map owner information
      const allUsers = await UserService.getAllUsers();
      const userMap = new Map<string, User>();
      allUsers.forEach(user => userMap.set(user.id, user));
      
      // Combine properties with owner information
      const propertiesWithOwners: PropertyWithOwner[] = allProperties.map(property => ({
        ...property,
        owner: userMap.get(property.user_id) ? {
          name: userMap.get(property.user_id)!.name,
          phone: userMap.get(property.user_id)!.phone
        } : undefined
      }));
      
      setProperties(propertiesWithOwners);
      
    } catch (error) {
      console.error('Error loading properties:', error);
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

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

  const handleDeleteProperty = async (id: string) => {
    const property = properties.find(p => p.id === id);
    if (!property) return;

    if (window.confirm(`Are you sure you want to delete "${property.title}"? This action cannot be undone.`)) {
      try {
        await PropertyService.deleteProperty(id);
        setProperties(prev => prev.filter(p => p.id !== id));
        toast.success('Property deleted successfully');
      } catch (error) {
        console.error('Error deleting property:', error);
        toast.error('Failed to delete property');
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'sold':
        return 'bg-red-100 text-red-800';
      case 'rented':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manage Properties</h1>
            <p className="text-gray-600 mt-2">Total: {properties.length} properties</p>
          </div>
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
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center p-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              {filteredProperties.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {searchTerm || selectedStatus !== 'all' 
                    ? 'No properties found matching your criteria'
                    : 'No properties available'
                  }
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Property
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Owner
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
                        Views
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProperties.map((property) => (
                      <motion.tr 
                        key={property.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <img
                              src={property.images[0] || 'https://via.placeholder.com/400x300?text=No+Image'}
                              alt={property.title}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 max-w-[200px] truncate">
                                {property.title}
                              </div>
                              <div className="text-sm text-gray-500">ID: {property.id}</div>
                              {property.is_premium && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                                  Premium
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {property.owner ? (
                            <div>
                              <div className="font-medium text-gray-900">{property.owner.name}</div>
                              <div className="text-gray-500">{property.owner.phone}</div>
                            </div>
                          ) : (
                            <div className="text-gray-400">No owner info</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>
                            <div className="font-medium">{property.location}</div>
                            <div className="text-gray-400">{property.district}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          ₹{(property.price / 100000).toFixed(2)} Lakhs
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(property.status)}`}>
                            {property.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {property.views || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleViewProperty(property.id)}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50"
                              title="View Property"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditProperty(property.id)}
                              className="text-green-600 hover:text-green-900 p-1 rounded-full hover:bg-green-50"
                              title="Edit Property"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProperty(property.id)}
                              className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50"
                              title="Delete Property"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
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
