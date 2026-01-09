import { useState, useEffect } from 'react';
import api from '../utils/api';

// Cache avatars in memory to avoid repeated API calls
const avatarCache = new Map();

/**
 * Hook to load user avatar on-demand
 * @param {string} userId - The user ID to fetch avatar for
 * @returns {{ avatar: string|null, loading: boolean }}
 */
export const useAvatar = (userId) => {
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    // Check cache first
    if (avatarCache.has(userId)) {
      setAvatar(avatarCache.get(userId));
      return;
    }

    const fetchAvatar = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/auth/avatar/${userId}`);
        const avatarData = res.data.avatar || null;
        avatarCache.set(userId, avatarData);
        setAvatar(avatarData);
      } catch (err) {
        // Silently fail - avatar is optional
        avatarCache.set(userId, null);
        setAvatar(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAvatar();
  }, [userId]);

  return { avatar, loading };
};

/**
 * Batch fetch avatars for multiple users
 * @param {string[]} userIds - Array of user IDs
 * @returns {Promise<Map<string, string|null>>} Map of userId to avatar
 */
export const fetchAvatars = async (userIds) => {
  const uncachedIds = userIds.filter(id => !avatarCache.has(id));
  
  // Fetch uncached avatars in parallel (limit to 5 concurrent requests)
  const batchSize = 5;
  for (let i = 0; i < uncachedIds.length; i += batchSize) {
    const batch = uncachedIds.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (userId) => {
        try {
          const res = await api.get(`/auth/avatar/${userId}`);
          avatarCache.set(userId, res.data.avatar || null);
        } catch {
          avatarCache.set(userId, null);
        }
      })
    );
  }

  // Return all requested avatars from cache
  const result = new Map();
  userIds.forEach(id => {
    result.set(id, avatarCache.get(id) || null);
  });
  return result;
};

/**
 * Get avatar from cache (synchronous)
 * @param {string} userId 
 * @returns {string|null}
 */
export const getCachedAvatar = (userId) => {
  return avatarCache.get(userId) || null;
};

/**
 * Clear avatar cache
 */
export const clearAvatarCache = () => {
  avatarCache.clear();
};

export default useAvatar;
