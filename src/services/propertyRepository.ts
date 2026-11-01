/**
 * PropertyRepository — adapter between the CRM and the Supabase
 * property inventory. All CRM code that needs properties must go through here.
 */
import { supabase } from '../supabase-config';
import type { Property } from '../types';

export interface PropertySearchCriteria {
  property_type?: string;
  purpose?: 'buy' | 'rent';
  locations?: string[];
  budget_max?: number;
  budget_min?: number;
  bedrooms_min?: number;
  status?: 'available' | 'sold' | 'rented';
  limit?: number;
}

export interface PropertySearchResult {
  id: string;
  title: string;
  price: number;
  location: string;
  district: string;
  bedrooms?: number;
  area: number;
  landArea: number;
  type: string;
  propertyListingType?: string;
  images: string[];
  status: string;
  canonical_url: string;
}

const APP_BASE_URL = typeof window !== 'undefined'
  ? (import.meta.env.VITE_APP_BASE_URL || window.location.origin)
  : (import.meta.env.VITE_APP_BASE_URL || 'https://snhomes.in');

/** Build the canonical public URL for a property. */
export function buildPropertyUrl(propertyId: string): string {
  return `${APP_BASE_URL}/property/${propertyId}`;
}

function rowToSearchResult(row: Record<string, unknown>): PropertySearchResult {
  return {
    id:               row.id as string,
    title:            (row.title as string) || 'Property',
    price:            Number(row.price) || 0,
    location:         (row.location as string) || '',
    district:         (row.district as string) || '',
    bedrooms:         row.bedrooms !== null ? Number(row.bedrooms) : undefined,
    area:             Number(row.area) || 0,
    landArea:         Number(row.land_area) || 0,
    type:             (row.property_type as string) || '',
    propertyListingType: row.property_listing_type as string | undefined,
    images:           (row.images as string[]) || [],
    status:           (row.status as string) || 'available',
    canonical_url:    buildPropertyUrl(row.id as string),
  };
}

export const PropertyRepository = {
  /** Find a single property by its Supabase UUID. */
  async findById(id: string): Promise<PropertySearchResult | null> {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return rowToSearchResult(data as Record<string, unknown>);
  },

  /** Search available properties matching buyer criteria. */
  async search(criteria: PropertySearchCriteria): Promise<PropertySearchResult[]> {
    const targetStatus = criteria.status || 'available';

    let q = supabase.from('properties').select('*').eq('status', targetStatus);

    if (criteria.property_type) {
      q = q.ilike('property_type', `%${criteria.property_type}%`);
    }
    if (criteria.budget_max !== undefined) {
      q = q.lte('price', criteria.budget_max);
    }
    if (criteria.budget_min !== undefined) {
      q = q.gte('price', criteria.budget_min);
    }
    if (criteria.bedrooms_min !== undefined) {
      q = q.gte('bedrooms', criteria.bedrooms_min);
    }
    if (criteria.purpose === 'rent') {
      q = q.eq('property_listing_type', 'rent');
    } else if (criteria.purpose === 'buy') {
      q = q.neq('property_listing_type', 'rent');
    }

    q = q.order('price', { ascending: true }).limit(200);

    const { data, error } = await q;
    if (error || !data) return [];

    let results = (data as Record<string, unknown>[]).map(rowToSearchResult);

    // Soft constraint: location matching (any in list)
    if (criteria.locations && criteria.locations.length > 0) {
      results = results.filter(p => {
        const loc = p.location.toLowerCase();
        const dist = p.district.toLowerCase();
        return criteria.locations!.some(l => {
          const ll = l.toLowerCase();
          return loc.includes(ll) || dist.includes(ll) || ll.includes(loc) || ll.includes(dist);
        });
      });
    }

    return results.slice(0, criteria.limit || 5);
  },

  /** Get the full Property object (for property management screens). */
  async getFullProperty(id: string): Promise<Property | null> {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    const row = data as Record<string, unknown>;

    return {
      id:                  row.id as string,
      title:               (row.title as string) || '',
      description:         (row.description as string) || '',
      price:               Number(row.price) || 0,
      type:                (row.property_type as Property['type']) || 'land',
      propertyListingType: row.property_listing_type as Property['propertyListingType'],
      location:            (row.location as string) || '',
      district:            (row.district as string) || '',
      bedrooms:            row.bedrooms !== null ? Number(row.bedrooms) : undefined,
      bathrooms:           row.bathrooms !== null ? Number(row.bathrooms) : undefined,
      area:                Number(row.area) || 0,
      landArea:            Number(row.land_area) || 0,
      landAreaUnit:        (row.land_area_unit as Property['landAreaUnit']) || 'cent',
      images:              (row.images as string[]) || [],
      features:            (row.features as string[]) || [],
      amenities:           (row.amenities as string[]) || [],
      nearbyPlaces:        (row.nearby_places as Property['nearbyPlaces']) || [],
      furnished:           (row.furnished as Property['furnished']) || 'Not Applicable',
      status:              (row.status as Property['status']) || 'available',
      is_premium:          Boolean(row.is_premium),
      views:               Number(row.views) || 0,
      user_id:             (row.user_id as string) || '',
      created_at:          row.created_at as string,
      virtual_tour_url:    row.virtual_tour_url as string | undefined,
      constructionYear:    row.construction_year !== null ? Number(row.construction_year) : undefined,
      lastRenovated:       row.last_renovated as string | undefined,
      parkingSpaces:       row.parking_spaces !== null ? Number(row.parking_spaces) : undefined,
      coordinates:         (row.coordinates as Property['coordinates']) || { latitude: 0, longitude: 0 },
    };
  },
};
