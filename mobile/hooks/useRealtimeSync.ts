import { useEffect, useCallback } from 'react';
import syncEngine from '../services/syncEngine';

/**
 * Hook to subscribe to real-time sync events
 * 
 * Usage in Rooms screen:
 * ```
 * useRealtimeSync('room:task:created', (task) => {
 *   setTasks(prev => [...prev, task]);
 * });
 * ```
 */
export function useRealtimeSync(eventType: string, handler: (data: any) => void) {
  useEffect(() => {
    const unsubscribe = syncEngine.on(eventType, handler);
    return unsubscribe;
  }, [eventType, handler]);
}

/**
 * Hook to queue optimistic changes for syncing
 * 
 * Usage:
 * ```
 * const queueSync = useOptimisticSync();
 * 
 * const handleCompleteTask = async (taskId) => {
 *   // Update UI immediately
 *   setTasks(prev => prev.map(t => t.id === taskId ? {...t, completed: true} : t));
 *   
 *   // Queue for background sync
 *   await queueSync({
 *     entityType: 'task',
 *     entityId: taskId.toString(),
 *     action: 'update',
 *     data: { completed: true }
 *   });
 * };
 * ```
 */
export function useOptimisticSync() {
  return useCallback(async (item: {
    entityType: 'task' | 'room' | 'thread_message' | 'appreciation';
    entityId: string;
    action: 'create' | 'update' | 'delete';
    data: any;
  }) => {
    await syncEngine.queueChange(item);
  }, []);
}

/**
 * Hook to get sync status
 */
export function useSyncStatus() {
  return syncEngine.getStatus();
}
