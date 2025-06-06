interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheInvalidationRules {
  [key: string]: string[]; // When key changes, invalidate these cache keys
}

class CacheService {
  private cache = new Map<string, CacheItem<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly FRESH_DATA_TTL = 30 * 1000; // 30 seconds for frequently changing data
  
  // Define which cache keys should be invalidated when certain data changes
  private invalidationRules: CacheInvalidationRules = {
    'user_properties': ['user_properties_*', 'all_properties_*', 'recent_properties'],
    'property_create': ['user_properties_*', 'all_properties_*', 'recent_properties'],
    'property_update': ['user_properties_*', 'all_properties_*', 'recent_properties', 'property_*'],
    'property_delete': ['user_properties_*', 'all_properties_*', 'recent_properties', 'property_*'],
    'saved_properties': ['saved_properties_*'],
    'user_update': ['user_profile_*', 'saved_properties_*']
  };

  /**
   * Get data from cache if valid, otherwise return null
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // Check if cache has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    console.log(`Cache HIT: ${key}`);
    return item.data;
  }

  /**
   * Store data in cache with TTL
   */
  set<T>(key: string, data: T, customTTL?: number): void {
    const ttl = customTTL || this.DEFAULT_TTL;
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    
    console.log(`Cache SET: ${key} (TTL: ${ttl/1000}s)`);
  }

  /**
   * Execute function and cache result
   */
  async getOrFetch<T>(
    key: string, 
    fetchFn: () => Promise<T>, 
    customTTL?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    console.log(`Cache MISS: ${key} - Fetching from API`);
    
    // Fetch from API and cache the result
    const data = await fetchFn();
    this.set(key, data, customTTL);
    
    return data;
  }

  /**
   * Invalidate specific cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    console.log(`Cache INVALIDATED: ${key}`);
  }

  /**
   * Invalidate multiple cache keys based on pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      console.log(`Cache INVALIDATED (pattern): ${key}`);
    });
  }

  /**
   * Invalidate cache based on data change type
   */
  invalidateOnChange(changeType: string, entityId?: string): void {
    const patterns = this.invalidationRules[changeType] || [];
    
    patterns.forEach(pattern => {
      if (pattern.includes('*') && entityId) {
        // Replace * with entity ID for specific invalidation
        const specificPattern = pattern.replace('*', entityId);
        this.invalidate(specificPattern);
      } else {
        this.invalidatePattern(pattern);
      }
    });
    
    console.log(`Cache invalidation triggered for: ${changeType}`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    console.log('Cache CLEARED completely');
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Cleanup expired cache entries
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    this.cache.forEach((item, key) => {
      if (now - item.timestamp > item.ttl) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => {
      this.cache.delete(key);
    });
    
    if (expiredKeys.length > 0) {
      console.log(`Cache cleanup: removed ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Force refresh cache for a specific key
   */
  async refresh<T>(key: string, fetchFn: () => Promise<T>, customTTL?: number): Promise<T> {
    this.invalidate(key);
    return this.getOrFetch(key, fetchFn, customTTL);
  }

  /**
   * Global cache refresh - invalidates all user-specific data
   */
  refreshUserData(userId: string): void {
    const userPatterns = [
      `user_properties_${userId}`,
      `saved_properties_${userId}*`,
      `user_profile_${userId}`
    ];
    
    userPatterns.forEach(pattern => {
      this.invalidatePattern(pattern);
    });
    
    console.log(`User data cache refreshed for: ${userId}`);
  }

  /**
   * Global cache refresh - invalidates all property-related data
   */
  refreshPropertyData(): void {
    const propertyPatterns = [
      'all_properties_*',
      'user_properties_*',
      'property_*'
    ];
    
    propertyPatterns.forEach(pattern => {
      this.invalidatePattern(pattern);
    });
    
    console.log('Property data cache refreshed globally');
  }
}

// Create singleton instance
export const cacheService = new CacheService();

// Setup automatic cleanup every 5 minutes
setInterval(() => {
  cacheService.cleanup();
}, 5 * 60 * 1000);

export default cacheService; 