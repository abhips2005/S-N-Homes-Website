export interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  type: 'residential' | 'commercial' | 'flat' | 'villa' | 'land';
  propertyListingType?: 'buy' | 'rent' | 'lease';
  location: string;
  district: string;
  bedrooms?: number;
  bathrooms?: number;
  area: number;
  landArea: number;
  landAreaUnit: 'cent' | 'acre';
  images: string[];
  features: string[];
  user_id: string;
  created_at: string;
  is_premium: boolean;
  status: 'available' | 'sold' | 'rented';
  virtual_tour_url?: string;
  amenities: string[];
  nearbyPlaces: NearbyPlace[];
  constructionYear?: number;
  lastRenovated?: string;
  parkingSpaces?: number;
  furnished: 'Yes' | 'No' | 'Semi Furnished' | 'Not Applicable';
  views: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface NearbyPlace {
  name: string;
  type: 'school' | 'hospital' | 'shopping' | 'transport' | 'restaurant' | 'other';
  distance: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'user' | 'admin' | 'agent';
  created_at: string;
  avatar_url?: string;
  verified: boolean;
  preferences?: {
    propertyTypes: string[];
    locations: string[];
    priceRange: {
      min: number;
      max: number;
    };
    notifications: boolean;
    preferredLocation: string;
  };
  savedProperties: string[];
  viewingHistory: string[];
}

export interface PropertySearch {
  location?: string;
  type?: string;
  propertyListingType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  amenities?: string[];
  furnished?: boolean;
  sortBy?: 'price' | 'date' | 'popularity';
  page?: number;
  limit?: number;
}

export interface AIRecommendation {
  propertyId: string;
  score: number;
  matchingCriteria: string[];
  confidence: number;
  reasons: string[];
}

export interface UserBehavior {
  propertyId: string;
  propertyType: string;
  action: 'view' | 'save' | 'contact';
  timestamp: Date;
  priceRange: [number, number];
  location: string;
}