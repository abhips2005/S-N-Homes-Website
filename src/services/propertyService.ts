import { supabase } from '../supabase-config';
import type { Property } from '../types';
import { cacheService } from './cacheService';

const PROPERTIES_TABLE   = 'properties';
const PROPERTY_IMAGES_BUCKET = 'property-images';

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
  lastDoc?: null; // Supabase uses offset/range; lastDoc kept for interface compat
}

// ─── DB row ↔ TypeScript Property mapper ─────────────────────────────────────

function rowToProperty(row: Record<string, unknown>): Property {
  return {
    id:                   row.id as string,
    title:                (row.title as string) || '',
    description:          (row.description as string) || '',
    price:                Number(row.price) || 0,
    type:                 (row.property_type as Property['type']) || 'land',
    propertyListingType:  row.property_listing_type as Property['propertyListingType'],
    location:             (row.location as string) || '',
    district:             (row.district as string) || '',
    bedrooms:             row.bedrooms !== null ? Number(row.bedrooms) : undefined,
    bathrooms:            row.bathrooms !== null ? Number(row.bathrooms) : undefined,
    area:                 Number(row.area) || 0,
    landArea:             Number(row.land_area) || 0,
    landAreaUnit:         (row.land_area_unit as Property['landAreaUnit']) || 'cent',
    images:               (row.images as string[]) || [],
    features:             (row.features as string[]) || [],
    user_id:              (row.user_id as string) || '',
    created_at:           row.created_at as string,
    is_premium:           Boolean(row.is_premium),
    status:               (row.status as Property['status']) || 'available',
    virtual_tour_url:     row.virtual_tour_url as string | undefined,
    amenities:            (row.amenities as string[]) || [],
    nearbyPlaces:         (row.nearby_places as Property['nearbyPlaces']) || [],
    constructionYear:     row.construction_year !== null ? Number(row.construction_year) : undefined,
    lastRenovated:        row.last_renovated as string | undefined,
    parkingSpaces:        row.parking_spaces !== null ? Number(row.parking_spaces) : undefined,
    furnished:            (row.furnished as Property['furnished']) || 'Not Applicable',
    views:                Number(row.views) || 0,
    coordinates:          (row.coordinates as Property['coordinates']) || { latitude: 0, longitude: 0 },
  };
}

function propertyToRow(p: Omit<Property, 'id' | 'created_at' | 'views'>): Record<string, unknown> {
  return {
    title:                p.title,
    description:          p.description,
    price:                p.price,
    property_type:        p.type,
    property_listing_type: p.propertyListingType ?? null,
    location:             p.location,
    district:             p.district,
    bedrooms:             p.bedrooms ?? null,
    bathrooms:            p.bathrooms ?? null,
    area:                 p.area,
    land_area:            p.landArea,
    land_area_unit:       p.landAreaUnit || 'cent',
    images:               p.images || [],
    features:             p.features || [],
    amenities:            p.amenities || [],
    nearby_places:        p.nearbyPlaces || [],
    furnished:            p.furnished || 'Not Applicable',
    virtual_tour_url:     p.virtual_tour_url ?? null,
    construction_year:    p.constructionYear ?? null,
    last_renovated:       p.lastRenovated ?? null,
    parking_spaces:       p.parkingSpaces ?? null,
    is_premium:           p.is_premium || false,
    status:               p.status || 'available',
    user_id:              p.user_id,
    coordinates:          p.coordinates ?? null,
  };
}

// ─── Property CRUD ────────────────────────────────────────────────────────────

export class PropertyService {

  // Create a new property
  static async createProperty(
    propertyData: Omit<Property, 'id' | 'created_at' | 'views'>,
    imageFiles: File[]
  ): Promise<string> {
    try {
      console.log('Creating property with data:', propertyData);

      const imageUrls = await this.uploadPropertyImages(imageFiles);
      console.log('Images uploaded:', imageUrls.length);

      const row = {
        ...propertyToRow(propertyData),
        images: imageUrls,
        views: 0,
        status: 'available',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from(PROPERTIES_TABLE)
        .insert(row)
        .select('id')
        .single();

      if (error) throw new Error(error.message);
      console.log('Property created with ID:', data.id);
      cacheService.invalidateOnChange('property_create');
      return data.id as string;
    } catch (error) {
      console.error('Error creating property:', error);
      throw new Error(`Failed to create property: ${(error as Error).message || 'Unknown error'}`);
    }
  }

  // Get property by ID
  static async getPropertyById(id: string): Promise<Property | null> {
    try {
      return await cacheService.getOrFetch(
        `property_${id}`,
        async () => {
          const { data, error } = await supabase
            .from(PROPERTIES_TABLE)
            .select('*')
            .eq('id', id)
            .single();

          if (error) {
            if (error.code === 'PGRST116') return null; // not found
            throw new Error(error.message);
          }
          return data ? rowToProperty(data as Record<string, unknown>) : null;
        },
        2 * 60 * 1000
      );
    } catch (error) {
      console.error('Error getting property:', error);
      throw new Error('Failed to get property');
    }
  }

  // Update property
  static async updateProperty(id: string, updates: Partial<Property>, newImageFiles?: File[]): Promise<void> {
    try {
      // Map camelCase TS fields → snake_case DB columns for the fields that changed
      const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.title !== undefined)              dbUpdates.title = updates.title;
      if (updates.description !== undefined)        dbUpdates.description = updates.description;
      if (updates.price !== undefined)              dbUpdates.price = updates.price;
      if (updates.type !== undefined)               dbUpdates.property_type = updates.type;
      if (updates.propertyListingType !== undefined) dbUpdates.property_listing_type = updates.propertyListingType;
      if (updates.location !== undefined)           dbUpdates.location = updates.location;
      if (updates.district !== undefined)           dbUpdates.district = updates.district;
      if (updates.bedrooms !== undefined)           dbUpdates.bedrooms = updates.bedrooms;
      if (updates.bathrooms !== undefined)          dbUpdates.bathrooms = updates.bathrooms;
      if (updates.area !== undefined)               dbUpdates.area = updates.area;
      if (updates.landArea !== undefined)           dbUpdates.land_area = updates.landArea;
      if (updates.landAreaUnit !== undefined)       dbUpdates.land_area_unit = updates.landAreaUnit;
      if (updates.features !== undefined)           dbUpdates.features = updates.features;
      if (updates.amenities !== undefined)          dbUpdates.amenities = updates.amenities;
      if (updates.furnished !== undefined)          dbUpdates.furnished = updates.furnished;
      if (updates.status !== undefined)             dbUpdates.status = updates.status;
      if (updates.is_premium !== undefined)         dbUpdates.is_premium = updates.is_premium;
      if (updates.nearbyPlaces !== undefined)       dbUpdates.nearby_places = updates.nearbyPlaces;
      if (updates.constructionYear !== undefined)   dbUpdates.construction_year = updates.constructionYear;
      if (updates.lastRenovated !== undefined)      dbUpdates.last_renovated = updates.lastRenovated;
      if (updates.parkingSpaces !== undefined)      dbUpdates.parking_spaces = updates.parkingSpaces;
      if (updates.virtual_tour_url !== undefined)   dbUpdates.virtual_tour_url = updates.virtual_tour_url;
      if (updates.coordinates !== undefined)        dbUpdates.coordinates = updates.coordinates;

      if (newImageFiles && newImageFiles.length > 0) {
        const newUrls = await this.uploadPropertyImages(newImageFiles);
        dbUpdates.images = [...(updates.images || []), ...newUrls];
      } else if (updates.images !== undefined) {
        dbUpdates.images = updates.images;
      }

      const { error } = await supabase.from(PROPERTIES_TABLE).update(dbUpdates).eq('id', id);
      if (error) throw new Error(error.message);
      console.log('Property updated successfully');
      cacheService.invalidateOnChange('property_update', id);
    } catch (error) {
      console.error('Error updating property:', error);
      throw new Error('Failed to update property');
    }
  }

  // Delete property
  static async deleteProperty(id: string): Promise<void> {
    try {
      const property = await this.getPropertyById(id);
      if (property?.images?.length) {
        await this.deletePropertyImages(property.images);
      }

      const { error } = await supabase.from(PROPERTIES_TABLE).delete().eq('id', id);
      if (error) throw new Error(error.message);
      console.log('Property deleted successfully');
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
    sortBy = 'created_at'
  ): Promise<{ properties: Property[]; lastDoc: null }> {
    try {
      let q = supabase.from(PROPERTIES_TABLE).select('*');

      // Apply server-side filters
      q = q.eq('status', filters.status || 'available');
      if (filters.type)                q = q.eq('property_type', filters.type);
      if (filters.district)            q = q.eq('district', filters.district);
      if (filters.propertyListingType) q = q.eq('property_listing_type', filters.propertyListingType);
      if (filters.minPrice)            q = q.gte('price', filters.minPrice);
      if (filters.maxPrice)            q = q.lte('price', filters.maxPrice);
      if (filters.bedrooms)            q = q.gte('bedrooms', filters.bedrooms);
      if (filters.minArea)             q = q.gte('area', filters.minArea);
      if (filters.maxArea)             q = q.lte('area', filters.maxArea);

      // Location: partial text match via ilike
      if (filters.location) {
        q = q.ilike('location', `%${filters.location}%`);
      }

      // Sorting
      if (sortBy === 'price-asc')  q = q.order('price', { ascending: true });
      else if (sortBy === 'price-desc') q = q.order('price', { ascending: false });
      else q = q.order('created_at', { ascending: false });

      q = q.limit(pagination.limitCount || 100);

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      let properties = (data ?? []).map(r => rowToProperty(r as Record<string, unknown>));

      // Furnished filter (client-side, as it's a text field with multiple values)
      if (filters.furnished !== undefined) {
        properties = properties.filter(p =>
          filters.furnished
            ? p.furnished === 'Yes' || p.furnished === 'Semi Furnished'
            : p.furnished === 'No' || p.furnished === 'Not Applicable'
        );
      }

      return { properties: properties.slice(0, pagination.limitCount || 12), lastDoc: null };
    } catch (error) {
      console.error('Error getting properties:', error);
      throw new Error(`Failed to get properties: ${(error as Error).message || 'Unknown error'}`);
    }
  }

  // Get properties by user ID
  static async getPropertiesByUser(userId: string): Promise<Property[]> {
    try {
      return await cacheService.getOrFetch(
        `user_properties_${userId}`,
        async () => {
          const { data, error } = await supabase
            .from(PROPERTIES_TABLE)
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100);

          if (error) throw new Error(error.message);
          return (data ?? []).map(r => rowToProperty(r as Record<string, unknown>));
        },
        3 * 60 * 1000
      );
    } catch (error) {
      console.error('Error getting user properties:', error);
      throw new Error(`Failed to get user properties: ${(error as Error).message || 'Unknown error'}`);
    }
  }

  // Search properties by text
  static async searchProperties(searchTerm: string): Promise<Property[]> {
    try {
      const term = `%${searchTerm}%`;
      const { data, error } = await supabase
        .from(PROPERTIES_TABLE)
        .select('*')
        .eq('status', 'available')
        .or(`title.ilike.${term},description.ilike.${term},location.ilike.${term},district.ilike.${term}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw new Error(error.message);
      return (data ?? []).map(r => rowToProperty(r as Record<string, unknown>));
    } catch (error) {
      console.error('Error searching properties:', error);
      throw new Error('Failed to search properties');
    }
  }

  // Increment property views
  static async incrementViews(propertyId: string): Promise<void> {
    try {
      await supabase.rpc('increment_property_views', { property_id: propertyId });
    } catch (error) {
      console.error('Error incrementing views:', error);
      // Non-critical — don't throw
    }
  }

  // Get all available properties
  static async getAllAvailableProperties(limitCount = 20): Promise<Property[]> {
    try {
      return await cacheService.getOrFetch(
        `all_properties_${limitCount}`,
        async () => {
          const { data, error } = await supabase
            .from(PROPERTIES_TABLE)
            .select('*')
            .eq('status', 'available')
            .order('created_at', { ascending: false })
            .limit(limitCount);

          if (error) throw new Error(error.message);
          return (data ?? []).map(r => rowToProperty(r as Record<string, unknown>));
        },
        2 * 60 * 1000
      );
    } catch (error) {
      console.error('Error getting available properties:', error);
      throw new Error(`Failed to get available properties: ${(error as Error).message || 'Unknown error'}`);
    }
  }

  // Get property statistics
  static async getPropertyStats(userId?: string): Promise<{
    total: number; available: number; sold: number; rented: number; totalViews: number;
  }> {
    try {
      let q = supabase.from(PROPERTIES_TABLE).select('status, views');
      if (userId) q = q.eq('user_id', userId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);

      const stats = { total: 0, available: 0, sold: 0, rented: 0, totalViews: 0 };
      for (const row of data ?? []) {
        stats.total++;
        stats.totalViews += Number(row.views) || 0;
        if (row.status === 'available') stats.available++;
        else if (row.status === 'sold') stats.sold++;
        else if (row.status === 'rented') stats.rented++;
      }
      return stats;
    } catch (error) {
      console.error('Error getting property stats:', error);
      throw new Error('Failed to get property statistics');
    }
  }

  // ── Upload property images to Supabase Storage ─────────────────────────────
  private static async uploadPropertyImages(files: File[]): Promise<string[]> {
    if (files.length === 0) return [];
    console.log(`Uploading ${files.length} images to Supabase Storage...`);

    const uploadPromises = files.map(async (file, index) => {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${timestamp}_${index}_${safeName}`;

      const { error } = await supabase.storage
        .from(PROPERTY_IMAGES_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (error) throw new Error(`Image upload failed: ${error.message}`);

      const { data: publicData } = supabase.storage
        .from(PROPERTY_IMAGES_BUCKET)
        .getPublicUrl(path);

      console.log(`Image ${index + 1} uploaded:`, publicData.publicUrl);
      return publicData.publicUrl;
    });

    return Promise.all(uploadPromises);
  }

  // ── Delete property images from Supabase Storage ──────────────────────────
  private static async deletePropertyImages(imageUrls: string[]): Promise<void> {
    // Extract path from public URL (everything after /property-images/)
    const paths = imageUrls
      .map(url => {
        const match = url.match(/property-images\/(.+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];

    if (paths.length === 0) return;

    const { error } = await supabase.storage.from(PROPERTY_IMAGES_BUCKET).remove(paths);
    if (error) console.warn('Error deleting images:', error.message);
  }
}
