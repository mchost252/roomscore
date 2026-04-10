import { useState, useEffect } from 'react';
import { RoomGhostStatus } from '../../types/room';

const GHOST_APPROVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Calculates time remaining until ghost approval based on creation date.
 */
export const useGhostTimer = (createdAt: string, initialStatus: RoomGhostStatus) => {
  const [status, setStatus] = useState<RoomGhostStatus>(initialStatus);
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    // If already resolved, no timer needed
    if (initialStatus !== 'PENDING') {
      setStatus(initialStatus);
      setTimeLeft('');
      return;
    }

    const createdTime = new Date(createdAt).getTime();

    const updateTimer = () => {
      const elapsed = Date.now() - createdTime;
      const remaining = GHOST_APPROVAL_MS - elapsed;

      if (remaining <= 0) {
        setStatus('GHOST_APPROVED');
        setTimeLeft('');
        return;
      }

      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      setTimeLeft(`${hours}h ${minutes}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [createdAt, initialStatus]);

  return { status, timeLeft };
};