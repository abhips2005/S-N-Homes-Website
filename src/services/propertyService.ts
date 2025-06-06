import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { db, storage } from '../firebase-config';
import type { Property } from '../types';
import { cacheService } from './cacheService';

export interface PropertyFilters {
  location?: string;
  district?: string;
  type?: string;
  propertyListingType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  minArea?: number;
  maxArea?: number;
  furnished?: boolean;
  status?: 'available' | 'sold' | 'rented';
}

export interface PaginationOptions {
  limitCount?: number;
  lastDoc?: QueryDocumentSnapshot<DocumentData>;
}

// Collections
const PROPERTIES_COLLECTION = 'properties';
const PROPERTY_IMAGES_PATH = 'property-images';

// Property CRUD Operations
export class PropertyService {
  
  // Create a new property
  static async createProperty(propertyData: Omit<Property, 'id' | 'created_at' | 'views'>, imageFiles: File[]): Promise<string> {
    try {
      console.log('Creating property with data:', propertyData);
      console.log('Number of image files:', imageFiles.length);
      
      // Upload images first
      const imageUrls = await this.uploadPropertyImages(imageFiles);
      console.log('Images uploaded successfully:', imageUrls);
      
      // Generate property ID
      const propertyId = `KE-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
      
      const newProperty: Omit<Property, 'id'> = {
        ...propertyData,
        images: imageUrls,
        created_at: serverTimestamp() as any,
        views: 0,
        status: 'available'
      };

      console.log('Attempting to create property document:', newProperty);
      const docRef =       await addDoc(collection(db, PROPERTIES_COLLECTION), newProperty);
      console.log('Property created with ID:', docRef.id);
      
      // Invalidate relevant caches
      cacheService.invalidateOnChange('property_create');
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating property:', error);
      console.error('Error details:', {
        code: (error as any)?.code,
        message: (error as any)?.message,
        stack: (error as any)?.stack
      });
      throw new Error(`Failed to create property: ${(error as any)?.message || 'Unknown error'}`);
    }
  }

  // Get property by ID
  static async getPropertyById(id: string): Promise<Property | null> {
    try {
      return await cacheService.getOrFetch(
        `property_${id}`,
        async () => {
          const docRef = doc(db, PROPERTIES_COLLECTION, id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              ...data,
              created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
            } as Property;
          }
          return null;
        },
        2 * 60 * 1000 // 2 minutes cache for individual properties
      );
    } catch (error) {
      console.error('Error getting property:', error);
      throw new Error('Failed to get property');
    }
  }

  // Update property
  static async updateProperty(id: string, updates: Partial<Property>, newImageFiles?: File[]): Promise<void> {
    try {
      const docRef = doc(db, PROPERTIES_COLLECTION, id);
      
      let updateData = { ...updates };
      
      // Handle new images if provided
      if (newImageFiles && newImageFiles.length > 0) {
        const newImageUrls = await this.uploadPropertyImages(newImageFiles);
        updateData.images = [...(updates.images || []), ...newImageUrls];
      }
      
      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof Property] === undefined) {
          delete updateData[key as keyof Property];
        }
      });

      await updateDoc(docRef, updateData);
      console.log('Property updated successfully');
      
      // Invalidate relevant caches
      cacheService.invalidateOnChange('property_update', id);
    } catch (error) {
      console.error('Error updating property:', error);
      throw new Error('Failed to update property');
    }
  }

  // Delete property
  static async deleteProperty(id: string): Promise<void> {
    try {
      // First get the property to access image URLs
      const property = await this.getPropertyById(id);
      
      if (property?.images) {
        // Delete all associated images
        await this.deletePropertyImages(property.images);
      }
      
      // Delete the document
      const docRef = doc(db, PROPERTIES_COLLECTION, id);
      await deleteDoc(docRef);
      console.log('Property deleted successfully');
      
      // Invalidate relevant caches
      cacheService.invalidateOnChange('property_delete', id);
    } catch (error) {
      console.error('Error deleting property:', error);
      throw new Error('Failed to delete property');
    }
  }

  // Get properties with filters and pagination
  static async getProperties(
    filters: PropertyFilters = {},
    pagination: PaginationOptions = {},
    sortBy: string = 'created_at'
  ): Promise<{ properties: Property[], lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
    try {
      console.log('Getting properties with filters:', filters);
      console.log('Pagination options:', pagination);
      console.log('Sort by:', sortBy);
      
      // Use ultra-simple query to get all properties and filter client-side
      // This avoids any Firestore index issues
      const q = query(
        collection(db, PROPERTIES_COLLECTION),
        limit(100) // Get more to account for filtering
      );

      console.log('Executing ultra-simple query for filtering...');
      const querySnapshot = await getDocs(q);
      console.log('Query executed successfully. Documents found:', querySnapshot.size);
      
      const allProperties: Property[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        allProperties.push({
          id: doc.id,
          ...data,
          created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
        } as Property);
      });

      // Apply all filters client-side
      let filteredProperties = allProperties;
      
      // Filter by status (default to available)
      if (filters.status) {
        filteredProperties = filteredProperties.filter(p => p.status === filters.status);
      } else {
        filteredProperties = filteredProperties.filter(p => p.status === 'available');
      }
      
      // Filter by type
      if (filters.type) {
        filteredProperties = filteredProperties.filter(p => p.type === filters.type);
      }
      
      // Filter by district
      if (filters.district) {
        filteredProperties = filteredProperties.filter(p => p.district === filters.district);
      }
      
      // Filter by property listing type
      if (filters.propertyListingType) {
        filteredProperties = filteredProperties.filter(p => p.propertyListingType === filters.propertyListingType);
      }
      
      // Filter by location (partial match)
      if (filters.location) {
        filteredProperties = filteredProperties.filter(p => 
          p.location?.toLowerCase().includes(filters.location!.toLowerCase())
        );
      }
      
      // Filter by bedrooms
      if (filters.bedrooms) {
        filteredProperties = filteredProperties.filter(p => p.bedrooms && p.bedrooms >= filters.bedrooms!);
      }
      
      // Filter by price range
      if (filters.minPrice) {
        filteredProperties = filteredProperties.filter(p => p.price >= filters.minPrice!);
      }
      
      if (filters.maxPrice) {
        filteredProperties = filteredProperties.filter(p => p.price <= filters.maxPrice!);
      }
      
      // Filter by area
      if (filters.minArea) {
        filteredProperties = filteredProperties.filter(p => p.area >= filters.minArea!);
      }
      
      if (filters.maxArea) {
        filteredProperties = filteredProperties.filter(p => p.area <= filters.maxArea!);
      }
      
      // Filter by furnished
      if (filters.furnished !== undefined) {
        filteredProperties = filteredProperties.filter(p => {
          if (filters.furnished === true) {
            return p.furnished === 'Yes' || p.furnished === 'Semi Furnished';
          } else {
            return p.furnished === 'No' || p.furnished === 'Not Applicable';
          }
        });
      }

      // Apply sorting client-side
      filteredProperties.sort((a, b) => {
        if (sortBy === 'price-asc') {
          return a.price - b.price;
        } else if (sortBy === 'price-desc') {
          return b.price - a.price;
        } else {
          // Sort by created_at (default)
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA; // Descending order (newest first)
        }
      });

      // Apply pagination client-side
      const startIndex = pagination.lastDoc ? 0 : 0; // For simplicity, reset pagination for now
      const limitCount = pagination.limitCount || 12;
      const paginatedProperties = filteredProperties.slice(startIndex, startIndex + limitCount);

      console.log('Final filtered and sorted properties count:', paginatedProperties.length);
      console.log('Total filtered properties before pagination:', filteredProperties.length);
      
      return { 
        properties: paginatedProperties, 
        lastDoc: null // Simplified pagination for now
      };
    } catch (error) {
      console.error('Error getting properties:', error);
      console.error('Error details:', {
        code: (error as any)?.code,
        message: (error as any)?.message,
        stack: (error as any)?.stack
      });
      throw new Error(`Failed to get properties: ${(error as any)?.message || 'Unknown error'}`);
    }
  }

  // Get properties by user ID
  static async getPropertiesByUser(userId: string): Promise<Property[]> {
    try {
      return await cacheService.getOrFetch(
        `user_properties_${userId}`,
        async () => {
          console.log('Getting properties for user:', userId);
          
          // Use simple query to get all properties, then filter client-side
          // This avoids needing composite indexes
          const q = query(
            collection(db, PROPERTIES_COLLECTION),
            limit(100) // Get more to account for filtering
          );
          
          const querySnapshot = await getDocs(q);
          console.log('Query executed successfully. Documents found:', querySnapshot.size);
          
          const allProperties: Property[] = [];

          querySnapshot.forEach((doc) => {
            const data = doc.data();
            allProperties.push({
              id: doc.id,
              ...data,
              created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
            } as Property);
          });

          // Filter by user ID client-side
          const userProperties = allProperties.filter(property => property.user_id === userId);
          
          // Sort by creation date client-side
          userProperties.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA; // Descending order (newest first)
          });

          console.log('User properties found:', userProperties.length);
          return userProperties;
        },
        3 * 60 * 1000 // 3 minutes cache for user properties
      );
    } catch (error) {
      console.error('Error getting user properties:', error);
      console.error('Error details:', {
        code: (error as any)?.code,
        message: (error as any)?.message,
        stack: (error as any)?.stack
      });
      throw new Error(`Failed to get user properties: ${(error as any)?.message || 'Unknown error'}`);
    }
  }

  // Search properties by text
  static async searchProperties(searchTerm: string): Promise<Property[]> {
    try {
      // For text search, we'll get all properties and filter client-side
      // In production, consider using Algolia or Elasticsearch for better search
      const { properties } = await this.getProperties();
      
      const searchTermLower = searchTerm.toLowerCase();
      return properties.filter(property =>
        property.title?.toLowerCase().includes(searchTermLower) ||
        property.description?.toLowerCase().includes(searchTermLower) ||
        property.location?.toLowerCase().includes(searchTermLower) ||
        property.district?.toLowerCase().includes(searchTermLower)
      );
    } catch (error) {
      console.error('Error searching properties:', error);
      throw new Error('Failed to search properties');
    }
  }

  // Increment property views
  static async incrementViews(propertyId: string): Promise<void> {
    try {
      const docRef = doc(db, PROPERTIES_COLLECTION, propertyId);
      await updateDoc(docRef, {
        views: increment(1)
      });
    } catch (error) {
      console.error('Error incrementing views:', error);
      // Don't throw error for view increment failures
    }
  }

  // Upload property images to Firebase Storage
  private static async uploadPropertyImages(files: File[]): Promise<string[]> {
    console.log(`Uploading ${files.length} images to Firebase Storage...`);
    
    const uploadPromises = files.map(async (file, index) => {
      try {
        console.log(`Uploading image ${index + 1}/${files.length}: ${file.name}`);
        const timestamp = Date.now();
        const fileName = `${timestamp}-${file.name}`;
        const storageRef = ref(storage, `${PROPERTY_IMAGES_PATH}/${fileName}`);
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log(`Image ${index + 1} uploaded successfully:`, downloadURL);
        return downloadURL;
      } catch (error) {
        console.error(`Error uploading image ${index + 1}:`, error);
        throw error;
      }
    });

    return Promise.all(uploadPromises);
  }

  // Delete property images from Firebase Storage
  private static async deletePropertyImages(imageUrls: string[]): Promise<void> {
    const deletePromises = imageUrls.map(async (url) => {
      try {
        const imageRef = ref(storage, url);
        await deleteObject(imageRef);
      } catch (error) {
        console.warn('Error deleting image:', url, error);
        // Continue with other deletions even if one fails
      }
    });

    await Promise.allSettled(deletePromises);
  }

  // Get property statistics for dashboard
  static async getPropertyStats(userId?: string): Promise<{
    total: number;
    available: number;
    sold: number;
    rented: number;
    totalViews: number;
  }> {
    try {
      console.log('Getting property stats for user:', userId || 'all users');
      
      // Use simple query to get all properties, then filter client-side
      const q = query(
        collection(db, PROPERTIES_COLLECTION),
        limit(500) // Get more for stats calculation
      );
      
      const querySnapshot = await getDocs(q);
      console.log('Stats query executed successfully. Documents found:', querySnapshot.size);
      
      const stats = {
        total: 0,
        available: 0,
        sold: 0,
        rented: 0,
        totalViews: 0
      };
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Filter by user if specified
        if (userId && data.user_id !== userId) {
          return; // Skip this property
        }
        
        stats.total++;
        stats.totalViews += data.views || 0;
        
        switch (data.status) {
          case 'available':
            stats.available++;
            break;
          case 'sold':
            stats.sold++;
            break;
          case 'rented':
            stats.rented++;
            break;
        }
      });
      
      console.log('Property stats calculated:', stats);
      return stats;
    } catch (error) {
      console.error('Error getting property stats:', error);
      throw new Error('Failed to get property statistics');
    }
  }

  // Get all available properties (simple query)
  static async getAllAvailableProperties(limitCount: number = 20): Promise<Property[]> {
    try {
      return await cacheService.getOrFetch(
        `all_properties_${limitCount}`,
        async () => {
          console.log('Getting all available properties...');
          
          // Ultra-simple query - just get all documents without complex filtering
          const q = query(
            collection(db, PROPERTIES_COLLECTION),
            limit(limitCount)
          );

          const querySnapshot = await getDocs(q);
          console.log('Ultra-simple query executed successfully. Documents found:', querySnapshot.size);
          
          const properties: Property[] = [];

          querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Filter available properties on client side
            if (data.status === 'available') {
              properties.push({
                id: doc.id,
                ...data,
                created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
              } as Property);
            }
          });

          // Sort by creation date on client side
          properties.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA; // Descending order (newest first)
          });

          console.log('Available properties loaded:', properties.length);
          return properties;
        },
        2 * 60 * 1000 // 2 minutes cache for available properties list
      );
    } catch (error) {
      console.error('Error getting available properties:', error);
      throw new Error(`Failed to get available properties: ${(error as any)?.message || 'Unknown error'}`);
    }
  }
}
