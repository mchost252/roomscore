import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../utils/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export default function useNotifications() {
  const { user } = useAuth();
  const { on, off } = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastFetchRef = useRef(0);
  const isFetchingRef = useRef(false);

  // Throttled fetch - minimum 30 seconds between API calls
  const fetchUnread = useCallback(async (force = false) => {
    if (!user) return;
    
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;
    
    // Prevent fetching if we fetched within last 30 seconds (unless forced)
    if (!force && timeSinceLastFetch < 30000) {
      return;
    }
    
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      return;
    }
    
    isFetchingRef.current = true;
    setLoading(true);
    
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.unreadCount || 0);
      setError(null);
      lastFetchRef.current = Date.now();
    } catch (e) {
      // Don't spam errors for rate limits
      if (e.response?.status !== 429) {
        setError(e.message);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    // Initial fetch on mount
    fetchUnread(true);
  }, [user]); // Remove fetchUnread from deps to prevent re-fetching loop

  useEffect(() => {
    if (!user) return;

    const handleCount = (payload) => {
      if (typeof payload?.unreadCount === 'number') {
        setUnreadCount(payload.unreadCount);
        // Update lastFetch since we got fresh data via socket
        lastFetchRef.current = Date.now();
      }
    };

    on('notification:unreadCount', handleCount);

    // When new notification arrives, just increment locally instead of refetching
    const handleNew = (payload) => {
      // Increment count locally - socket gives us real-time updates
      setUnreadCount(prev => prev + 1);
    };
    on('notification:new', handleNew);

    return () => {
      off('notification:unreadCount', handleCount);
      off('notification:new', handleNew);
    };
  }, [user, on, off]);

  // Function to clear count (called after viewing notifications)
  const clearUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return { unreadCount, loading, error, refreshUnread: fetchUnread, clearUnreadCount };
}
