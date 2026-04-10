import api from './api';
import { getRoomDb, setRoomLastSync, getRoomLastSync } from '../db/roomDb';
import { RoomDetail, RoomTask } from '../types/room';

export const RoomSyncEngine = {
  /**
   * Fetch all rooms (My Rooms) and update SQLite
   */
  async syncMyRooms(): Promise<RoomDetail[]> {
    try {
      const db = await getRoomDb();
      // Instantly load from local DB
      const localRooms = await db.getAllAsync('SELECT * FROM rooms ORDER BY updatedAt DESC') as RoomDetail[];
      
      // Fetch from API in background (Delta-Sync)
      api.get('/rooms').then(async (res) => {
        if (res.data?.success && res.data.rooms) {
          for (const room of res.data.rooms) {
            const mappedRoom: RoomDetail = {
              id: room._id,
              name: room.name,
              description: room.description || '',
              joinCode: room.joinCode || '',
              isPrivate: !room.isPublic,
              maxMembers: room.maxMembers || 20,
              chatRetentionDays: room.chatRetentionDays || 3,
              isPremium: !!room.isPremium,
              streak: 0,
              ownerId: room.ownerId?._id || room.ownerId || '',
              isActive: true,
              createdAt: room.createdAt || new Date().toISOString(),
              updatedAt: room.updatedAt || new Date().toISOString(),
            };
            
            // Upsert into SQLite
            await db.runAsync(
              `INSERT OR REPLACE INTO rooms (id, name, description, joinCode, isPrivate, maxMembers, chatRetentionDays, isPremium, streak, ownerId, isActive, createdAt, updatedAt) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                mappedRoom.id, mappedRoom.name, mappedRoom.description, mappedRoom.joinCode,
                mappedRoom.isPrivate ? 1 : 0, mappedRoom.maxMembers, mappedRoom.chatRetentionDays,
                mappedRoom.isPremium ? 1 : 0, mappedRoom.streak, mappedRoom.ownerId,
                mappedRoom.isActive ? 1 : 0, mappedRoom.createdAt, mappedRoom.updatedAt
              ]
            );
          }
        }
      }).catch(console.error);

      return localRooms;
    } catch (e) {
      console.error('Failed to sync rooms', e);
      return [];
    }
  },

  /**
   * Create a new room and update SQLite immediately
   */
  async createRoom(payload: any): Promise<RoomDetail> {
    const res = await api.post('/rooms', payload);
    const room = res.data.room;
    
    const newRoom: RoomDetail = {
      id: room._id,
      name: room.name,
      description: room.description || '',
      joinCode: room.joinCode || '',
      isPrivate: !room.isPublic,
      maxMembers: room.maxMembers || 20,
      chatRetentionDays: room.chatRetentionDays || 3,
      isPremium: !!room.isPremium,
      streak: 0,
      ownerId: room.ownerId?._id || room.ownerId || '',
      isActive: true,
      createdAt: room.createdAt || new Date().toISOString(),
      updatedAt: room.updatedAt || new Date().toISOString(),
    };

    const db = await getRoomDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO rooms (id, name, description, joinCode, isPrivate, maxMembers, chatRetentionDays, isPremium, streak, ownerId, isActive, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newRoom.id, newRoom.name, newRoom.description, newRoom.joinCode,
        newRoom.isPrivate ? 1 : 0, newRoom.maxMembers, newRoom.chatRetentionDays,
        newRoom.isPremium ? 1 : 0, newRoom.streak, newRoom.ownerId,
        newRoom.isActive ? 1 : 0, newRoom.createdAt, newRoom.updatedAt
      ]
    );

    return newRoom;
  },

  /**
   * Join an existing room via code
   */
  async joinRoom(joinCode: string): Promise<{ success: boolean; pending?: boolean; room?: any; message?: string }> {
    try {
      const res = await api.post('/rooms/join', { joinCode: joinCode.trim().toUpperCase() });
      return res.data;
    } catch (e: any) {
      throw new Error(e.response?.data?.message || 'Failed to join room');
    }
  },

  /**
   * Create a task for a room
   */
  async createTask(roomId: string, payload: any): Promise<RoomTask> {
    const res = await api.post(`/rooms/${roomId}/tasks`, payload);
    const task = res.data.task; // Assuming backend returns { task: {...} } or we create optimistic
    
    const mappedTask: RoomTask = {
      id: task?._id || `temp_${Date.now()}`,
      roomId,
      title: payload.title,
      description: payload.description || '',
      taskType: payload.taskType || payload.frequency,
      daysOfWeek: payload.daysOfWeek?.join(',') || '',
      points: payload.points || 10,
      isActive: true,
      createdAt: new Date().toISOString(),
      status: 'accepted'
    };

    const db = await getRoomDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO room_tasks (id, roomId, title, description, taskType, points, isActive, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mappedTask.id, mappedTask.roomId, mappedTask.title, mappedTask.description || '', 
        mappedTask.taskType, mappedTask.points, 1, mappedTask.createdAt
      ]
    );

    return mappedTask;
  }
};
