import { create } from 'zustand';

export interface Room {
  id: string;
  name: string;
  description: string;
  joinCode: string;
  isPrivate: boolean;
  maxMembers: number;
  chatRetentionDays: number;
  isPremium: boolean;
  streak: number;
  ownerId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  coverImage?: string;
}

export interface RoomTask {
  id: string;
  roomId: string;
  title: string;
  description: string;
  taskType: string;
  daysOfWeek: string;
  points: number;
  isActive: boolean;
  createdAt: string;
  status: 'accepted' | 'pending' | 'completed';
  completedBy?: string[];
}

interface RoomState {
  rooms: Room[];
  activeRoom: Room | null;
  activeRoomTasks: RoomTask[];

  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  updateRoom: (roomId: string, patch: Partial<Room>) => void;
  removeRoom: (roomId: string) => void;
  setActiveRoom: (room: Room | null) => void;
  setRoomTasks: (tasks: RoomTask[]) => void;
  updateTask: (taskId: string, patch: Partial<RoomTask>) => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  activeRoom: null,
  activeRoomTasks: [],

  setRooms: (rooms) => set({ rooms }),

  addRoom: (room) => {
    const current = get().rooms;
    if (current.some((r) => r.id === room.id)) return;
    set({ rooms: [...current, room] });
  },

  updateRoom: (roomId, patch) => {
    set({
      rooms: get().rooms.map((r) =>
        r.id === roomId ? { ...r, ...patch } : r
      ),
    });
    // Also update activeRoom if it matches
    if (get().activeRoom?.id === roomId) {
      set({ activeRoom: { ...get().activeRoom!, ...patch } });
    }
  },

  removeRoom: (roomId) => {
    set({
      rooms: get().rooms.filter((r) => r.id !== roomId),
    });
    if (get().activeRoom?.id === roomId) {
      set({ activeRoom: null });
    }
  },

  setActiveRoom: (room) => set({ activeRoom: room }),

  setRoomTasks: (tasks) => set({ activeRoomTasks: tasks }),

  updateTask: (taskId, patch) => {
    set({
      activeRoomTasks: get().activeRoomTasks.map((t) =>
        t.id === taskId ? { ...t, ...patch } : t
      ),
    });
  },
}));
