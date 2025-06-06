import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheService } from '../services/cacheService';

interface UseLazyDataOptions<T> {
  cacheKey: string;
  fetchFn: () => Promise<T>;
  cacheTTL?: number;
  dependencies?: any[];
  immediate?: boolean; // Whether to load immediately or wait for trigger
}

interface UseLazyDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  invalidateCache: () => void;
}

export function useLazyData<T>({
  cacheKey,
  fetchFn,
  cacheTTL,
  dependencies = [],
  immediate = true
}: UseLazyDataOptions<T>): UseLazyDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const loadingRef = useRef(false);
  const dataLoadedRef = useRef(false);

  const loadData = useCallback(async () => {
    if (loadingRef.current) return;

    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      const result = await cacheService.getOrFetch(cacheKey, fetchFn, cacheTTL);
      setData(result);
      dataLoadedRef.current = true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error(`Error loading data for key ${cacheKey}:`, error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [cacheKey, fetchFn, cacheTTL]);

  const reload = useCallback(async () => {
    dataLoadedRef.current = false;
    await loadData();
  }, [loadData]);

  const invalidateCache = useCallback(() => {
    cacheService.invalidate(cacheKey);
    dataLoadedRef.current = false;
  }, [cacheKey]);

  // Load data on mount or when dependencies change
  useEffect(() => {
    if (immediate && !dataLoadedRef.current) {
      loadData();
    }
  }, [loadData, immediate, ...dependencies]);

  // Reset loaded state when dependencies change
  useEffect(() => {
    dataLoadedRef.current = false;
  }, dependencies);

  return {
    data,
    loading,
    error,
    reload,
    invalidateCache
  };
}

// Specialized hook for property data
export function usePropertyData(propertyId: string) {
  return useLazyData({
    cacheKey: `property_${propertyId}`,
    fetchFn: async () => {
      const { PropertyService } = await import('../services/propertyService');
      return PropertyService.getPropertyById(propertyId);
    },
    cacheTTL: 2 * 60 * 1000, // 2 minutes
    dependencies: [propertyId]
  });
}

// Specialized hook for user properties
export function useUserProperties(userId: string) {
  return useLazyData({
    cacheKey: `user_properties_${userId}`,
    fetchFn: async () => {
      const { PropertyService } = await import('../services/propertyService');
      return PropertyService.getPropertiesByUser(userId);
    },
    cacheTTL: 3 * 60 * 1000, // 3 minutes
    dependencies: [userId]
  });
}

// Specialized hook for available properties
export function useAvailableProperties(limit: number = 20) {
  return useLazyData({
    cacheKey: `all_properties_${limit}`,
    fetchFn: async () => {
      const { PropertyService } = await import('../services/propertyService');
      return PropertyService.getAllAvailableProperties(limit);
    },
    cacheTTL: 2 * 60 * 1000, // 2 minutes
    dependencies: [limit]
  });
}

export default useLazyData; 