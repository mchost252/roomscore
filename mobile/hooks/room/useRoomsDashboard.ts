import { useState, useCallback, useEffect } from 'react';
import { RoomDetail } from '../../types/room';
import { getRoomDb } from '../../db/roomDb';
import { RoomSyncEngine } from '../../services/roomSyncEngine';

export function useRoomsDashboard() {
  const [rooms, setRooms] = useState<RoomDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      // Delta-Sync: Loads instantly from SQLite, then background syncs with API
      const localRooms = await RoomSyncEngine.syncMyRooms();
      setRooms(localRooms || []);
      
      // We could add an event emitter to update rooms again after background sync completes,
      // but for now, the next time this hook mounts or refreshes, they'll get the fresh DB snapshot.
      setTimeout(async () => {
         const db = await getRoomDb();
         const updatedRows = await db.getAllAsync('SELECT * FROM rooms ORDER BY updatedAt DESC') as RoomDetail[];
         setRooms(updatedRows || []);
      }, 1500); // 1.5s later check DB again after background API call
    } catch (e) {
      console.error('Failed to load local rooms', e);
      setRooms([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  return {
    rooms,
    isLoading,
    refreshRooms: fetchRooms
  };
}
