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
  const seenNotificationIdsRef = useRef(new Set());

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
      const res = await api.get('/notifications/unread-summary');
      setUnreadCount(typeof res.data?.counts?.total === 'number' ? res.data.counts.total : 0);
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

  // Refetch when page becomes visible (user returns to tab/app)
  useEffect(() => {
    if (!user) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Force refetch when user returns to the app
        fetchUnread(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, fetchUnread]);

  useEffect(() => {
    if (!user) return;

    const handleCount = (payload) => {
      if (typeof payload?.total === 'number') {
        setUnreadCount(payload.total);
        lastFetchRef.current = Date.now();
      } else if (typeof payload?.unreadCount === 'number') {
        setUnreadCount(payload.unreadCount);
        // Update lastFetch since we got fresh data via socket
        lastFetchRef.current = Date.now();
      }
    };

    on('notification:unreadCount', handleCount);
    on('notification:counts', handleCount);

    // When new notification arrives, just increment locally instead of refetching
    const handleNew = (payload) => {
      const notification = payload?.notification;
      const id = notification?._id || notification?.id;
      if (id && seenNotificationIdsRef.current.has(id)) return;
      if (id) seenNotificationIdsRef.current.add(id);
      setUnreadCount(prev => prev + 1);
    };
    on('notification:new', handleNew);

    return () => {
      off('notification:unreadCount', handleCount);
      off('notification:counts', handleCount);
      off('notification:new', handleNew);
    };
  }, [user, on, off]);

  // Function to clear count (called after viewing notifications)
  const clearUnreadCount = useCallback(() => {
    setUnreadCount(0);
    // Update lastFetch to prevent immediate refetch from overriding
    lastFetchRef.current = Date.now();
  }, []);

  return { unreadCount, loading, error, refreshUnread: fetchUnread, clearUnreadCount };
}
