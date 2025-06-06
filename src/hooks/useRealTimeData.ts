import { useEffect, useCallback, useRef } from 'react';
import { cacheService } from '../services/cacheService';

export const useRealTimeData = (
  refreshCallback: () => void,
  dependencies: string[] = []
) => {
  const callbackRef = useRef(refreshCallback);
  callbackRef.current = refreshCallback;

  // Listen for global refresh events
  useEffect(() => {
    const handleRefresh = () => {
      callbackRef.current();
    };

    dependencies.forEach(dep => {
      window.addEventListener(`refresh-${dep}`, handleRefresh);
    });

    return () => {
      dependencies.forEach(dep => {
        window.removeEventListener(`refresh-${dep}`, handleRefresh);
      });
    };
  }, [dependencies]);

  // Listen for page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible, refresh data
        callbackRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Manual refresh function
  const manualRefresh = useCallback(() => {
    callbackRef.current();
  }, []);

  // Force refresh by clearing cache
  const forceRefresh = useCallback(() => {
    dependencies.forEach(dep => {
      cacheService.invalidatePattern(dep);
    });
    callbackRef.current();
  }, [dependencies]);

  return {
    manualRefresh,
    forceRefresh
  };
};

// Specialized hooks for different data types
export const useUserDataRefresh = (refreshCallback: () => void) => {
  return useRealTimeData(refreshCallback, ['user', 'saved']);
};

export const usePropertyDataRefresh = (refreshCallback: () => void) => {
  return useRealTimeData(refreshCallback, ['property', 'properties']);
}; 