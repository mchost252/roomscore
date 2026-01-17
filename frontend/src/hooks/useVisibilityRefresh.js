import { useEffect, useRef } from 'react';

/**
 * Hook to refresh data when page becomes visible again
 * Similar to how WhatsApp refreshes data when you return to the app
 * 
 * @param {Function} onRefresh - Function to call when page becomes visible
 * @param {number} minInterval - Minimum interval between refreshes (ms), default 30s
 */
export const useVisibilityRefresh = (onRefresh, minInterval = 30000) => {
  const lastRefreshTime = useRef(Date.now());
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip on first render - let the component's own mount logic handle initial load
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const timeSinceLastRefresh = now - lastRefreshTime.current;
        
        // Only refresh if enough time has passed
        if (timeSinceLastRefresh >= minInterval) {
          console.log('👁️ Page became visible, refreshing data...');
          lastRefreshTime.current = now;
          onRefresh();
        }
      }
    };

    // Also handle app foreground event (for mobile/Capacitor)
    const handleForeground = () => {
      const now = Date.now();
      const timeSinceLastRefresh = now - lastRefreshTime.current;
      
      if (timeSinceLastRefresh >= minInterval) {
        console.log('📱 App came to foreground, refreshing data...');
        lastRefreshTime.current = now;
        onRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('app:foreground', handleForeground);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('app:foreground', handleForeground);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [onRefresh, minInterval]);

  // Method to manually update last refresh time (call after successful data load)
  const markRefreshed = () => {
    lastRefreshTime.current = Date.now();
  };

  return { markRefreshed };
};

export default useVisibilityRefresh;
