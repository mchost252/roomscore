import { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export default function useNotifications() {
  const { user } = useAuth();
  const { on, off } = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUnread = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.unreadCount || 0);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    fetchUnread();
  }, [user, fetchUnread]);

  useEffect(() => {
    if (!user) return;

    const handleCount = (payload) => {
      if (typeof payload?.unreadCount === 'number') {
        setUnreadCount(payload.unreadCount);
      }
    };

    on('notification:unreadCount', handleCount);

    // Optional: when new notification arrives without count payload
    const handleNew = () => {
      // Fallback: refetch to stay accurate
      fetchUnread();
    };
    on('notification:new', handleNew);

    return () => {
      off('notification:unreadCount', handleCount);
      off('notification:new', handleNew);
    };
  }, [user, on, off, fetchUnread]);

  return { unreadCount, loading, error, refreshUnread: fetchUnread };
}
