/**
 * RoomContext - Room State Management
 * Local-first architecture with Delta-Sync strategy
 * 
 * Provides:
 * - Room data from local cache (instant loads)
 * - Service initialization (SQLite/MMKV)
 * - Janitor cleanup on foreground
 * - Ghost Approval processing
 * - Weekly Sprint state
 * - User Aura state
 */

import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import roomDataService, { AURA_CONFIG } from '../services/roomDataService';
import { 
  EnhancedRoom, 
  EnhancedRoomTask, 
  UserAura, 
  WeeklySprint, 
  AuraLevel,
  TaskProof,
} from '../types';
import { useAuth } from './AuthContext';

// State types
interface RoomState {
  initialized: boolean;
  rooms: EnhancedRoom[];
  currentRoom: EnhancedRoom | null;
  tasks: Map<string, EnhancedRoomTask[]>;
  auras: Map<string, UserAura>;
  sprints: Map<string, WeeklySprint>;
  proofs: Map<string, TaskProof[]>;
  loading: boolean;
}

type RoomAction =
  | { type: 'INIT_COMPLETE' }
  | { type: 'SET_ROOMS'; payload: EnhancedRoom[] }
  | { type: 'SET_CURRENT_ROOM'; payload: EnhancedRoom | null }
  | { type: 'SET_TASKS'; payload: { roomId: string; tasks: EnhancedRoomTask[] } }
  | { type: 'UPDATE_TASK'; payload: EnhancedRoomTask }
  | { type: 'SET_AURA'; payload: UserAura }
  | { type: 'SET_SPRINT'; payload: WeeklySprint }
  | { type: 'ADD_PROOF'; payload: { taskId: string; proof: TaskProof } }
  | { type: 'UPDATE_PROOF'; payload: TaskProof };

const initialState: RoomState = {
  initialized: false,
  rooms: [],
  currentRoom: null,
  tasks: new Map(),
  auras: new Map(),
  sprints: new Map(),
  proofs: new Map(),
  loading: true,
};

function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case 'INIT_COMPLETE':
      return { ...state, initialized: true, loading: false };
    
    case 'SET_ROOMS':
      return { ...state, rooms: action.payload };
    
    case 'SET_CURRENT_ROOM':
      return { ...state, currentRoom: action.payload };
    
    case 'SET_TASKS': {
      const newTasks = new Map(state.tasks);
      newTasks.set(action.payload.roomId, action.payload.tasks);
      return { ...state, tasks: newTasks };
    }
    
    case 'UPDATE_TASK': {
      const newTasks = new Map(state.tasks);
      const rid = action.payload.room_id ?? action.payload.roomId;
      if (!rid) return state;
      const roomTasks = newTasks.get(rid) || [];
      const index = roomTasks.findIndex(t => t.id === action.payload.id);
      if (index >= 0) {
        roomTasks[index] = action.payload;
      } else {
        roomTasks.push(action.payload);
      }
      newTasks.set(rid, [...roomTasks]);
      return { ...state, tasks: newTasks };
    }
    
    case 'SET_AURA': {
      const newAuras = new Map(state.auras);
      newAuras.set(action.payload.userId, action.payload);
      return { ...state, auras: newAuras };
    }
    
    case 'SET_SPRINT': {
      const newSprints = new Map(state.sprints);
      const sprint = action.payload;
      const key =
        sprint.id ||
        `sprint_${sprint.user_id}_${sprint.week_start}`;
      newSprints.set(key, { ...sprint, id: key });
      return { ...state, sprints: newSprints };
    }
    
    case 'ADD_PROOF': {
      const newProofs = new Map(state.proofs);
      const taskProofs = newProofs.get(action.payload.taskId) || [];
      newProofs.set(action.payload.taskId, [...taskProofs, action.payload.proof]);
      return { ...state, proofs: newProofs };
    }
    
    case 'UPDATE_PROOF': {
      const newProofs = new Map(state.proofs);
      for (const [taskId, proofs] of newProofs) {
        const index = proofs.findIndex(p => p.id === action.payload.id);
        if (index >= 0) {
          proofs[index] = action.payload;
          newProofs.set(taskId, [...proofs]);
          break;
        }
      }
      return { ...state, proofs: newProofs };
    }
    
    default:
      return state;
  }
}

// Context types
interface RoomContextType {
  state: RoomState;
  // Room operations
  loadRooms: () => Promise<void>;
  setCurrentRoom: (room: EnhancedRoom | null) => void;
  // Task operations
  loadTasks: (roomId: string) => Promise<void>;
  joinTask: (taskId: string, userId: string) => Promise<void>;
  leaveTask: (taskId: string, userId: string) => Promise<void>;
  // Proof operations
  submitProof: (taskId: string, userId: string, imageUrl: string) => Promise<TaskProof>;
  challengeProof: (proofId: string, userId: string, reason: string) => Promise<void>;
  // Aura operations
  getAura: (userId: string) => Promise<UserAura | null>;
  updateAura: (userId: string, scoreDelta: number) => Promise<UserAura>;
  // Sprint operations
  getSprint: (userId: string) => Promise<WeeklySprint>;
  addSprintPoints: (userId: string, points: number) => Promise<WeeklySprint>;
  // Service operations
  processGhostApprovals: () => Promise<string[]>;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(roomReducer, initialState);
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);

  // Initialize service and run Janitor
  useEffect(() => {
    const init = async () => {
      try {
        await roomDataService.initialize();
        dispatch({ type: 'INIT_COMPLETE' });
        
        // Run Janitor cleanup
        await roomDataService.runJanitor();
        
        // Process any pending ghost approvals
        await roomDataService.processGhostApprovals();
        
        // Load initial rooms from cache
        const rooms = await roomDataService.getRooms();
        dispatch({ type: 'SET_ROOMS', payload: rooms });
      } catch (error) {
        console.error('[RoomContext] Init error:', error);
        dispatch({ type: 'INIT_COMPLETE' });
      }
    };
    
    init();
  }, []);

  // Handle app foreground for Janitor + Ghost Approval
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (appState.current === 'background' && nextAppState === 'active') {
        // App came to foreground - run cleanup
        try {
          await roomDataService.runJanitor();
          const autoApproved = await roomDataService.processGhostApprovals();
          if (autoApproved.length > 0) {
            console.log(`[RoomContext] Auto-approved ${autoApproved.length} proofs on foreground`);
          }
        } catch (error) {
          console.error('[RoomContext] Foreground cleanup error:', error);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Room operations
  const loadRooms = useCallback(async () => {
    const rooms = await roomDataService.getRooms();
    dispatch({ type: 'SET_ROOMS', payload: rooms });
  }, []);

  const setCurrentRoom = useCallback((room: EnhancedRoom | null) => {
    dispatch({ type: 'SET_CURRENT_ROOM', payload: room });
  }, []);

  // Task operations
  const loadTasks = useCallback(async (roomId: string) => {
    const tasks = await roomDataService.getTasks(roomId);
    dispatch({ type: 'SET_TASKS', payload: { roomId, tasks } });
  }, []);

  const joinTask = useCallback(async (taskId: string, userId: string) => {
    await roomDataService.joinTask(taskId, userId);
    // Refresh task state would be triggered by reloading
  }, []);

  const leaveTask = useCallback(async (taskId: string, userId: string) => {
    await roomDataService.leaveTask(taskId, userId);
  }, []);

  // Proof operations
  const submitProof = useCallback(async (taskId: string, userId: string, imageUrl: string): Promise<TaskProof> => {
    const proof: TaskProof = {
      id: `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      userId,
      imageUrl,
      submittedAt: Date.now(),
      status: 'pending',
      challengeExpiresAt: 0,
    };
    
    dispatch({ type: 'ADD_PROOF', payload: { taskId, proof } });
    return proof;
  }, []);

  const challengeProof = useCallback(async (proofId: string, userId: string, reason: string) => {
    await roomDataService.createChallenge(proofId, userId, reason);
  }, []);

  // Aura operations
  const getAura = useCallback(async (userId: string): Promise<UserAura | null> => {
    // Check local state first
    if (state.auras.has(userId)) {
      return state.auras.get(userId)!;
    }
    // Fetch from service
    const aura = await roomDataService.getAura(userId);
    if (aura) {
      dispatch({ type: 'SET_AURA', payload: aura });
    }
    return aura;
  }, [state.auras]);

  const updateAura = useCallback(async (userId: string, scoreDelta: number): Promise<UserAura> => {
    const aura = await roomDataService.updateAura(userId, scoreDelta);
    dispatch({ type: 'SET_AURA', payload: aura });
    return aura;
  }, []);

  // Sprint operations
  const getSprint = useCallback(async (userId: string): Promise<WeeklySprint> => {
    // Check local state first
    const sprintDates = roomDataService.getCurrentSprintDates();
    const sprintId = `sprint_${userId}_${sprintDates.start}`;
    
    if (state.sprints.has(sprintId)) {
      return state.sprints.get(sprintId)!;
    }
    
    const sprint = await roomDataService.getOrCreateSprint(userId);
    dispatch({ type: 'SET_SPRINT', payload: sprint });
    return sprint;
  }, [state.sprints]);

  const addSprintPoints = useCallback(async (userId: string, points: number): Promise<WeeklySprint> => {
    const sprint = await roomDataService.addSprintPoints(userId, points);
    dispatch({ type: 'SET_SPRINT', payload: sprint });
    return sprint;
  }, []);

  // Service operations
  const processGhostApprovals = useCallback(async (): Promise<string[]> => {
    return roomDataService.processGhostApprovals();
  }, []);

  const value: RoomContextType = {
    state,
    loadRooms,
    setCurrentRoom,
    loadTasks,
    joinTask,
    leaveTask,
    submitProof,
    challengeProof,
    getAura,
    updateAura,
    getSprint,
    addSprintPoints,
    processGhostApprovals,
  };

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
}

// Aura helper hook
export function useAura(userId: string | undefined) {
  const { getAura, updateAura } = useRoom();
  const [aura, setAura] = React.useState<UserAura | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!userId) return;
    
    const fetchAura = async () => {
      setLoading(true);
      try {
        const result = await getAura(userId);
        setAura(result);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAura();
  }, [userId, getAura]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const result = await getAura(userId);
    setAura(result);
  }, [userId, getAura]);

  return { aura, loading, refresh, updateAura };
}

// Sprint helper hook
export function useSprint(userId: string | undefined) {
  const { getSprint, addSprintPoints } = useRoom();
  const [sprint, setSprint] = React.useState<WeeklySprint | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!userId) return;
    
    const fetchSprint = async () => {
      setLoading(true);
      try {
        const result = await getSprint(userId);
        setSprint(result);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSprint();
  }, [userId, getSprint]);

  const addPoints = useCallback(async (points: number) => {
    if (!userId) return;
    const result = await addSprintPoints(userId, points);
    setSprint(result);
  }, [userId, addSprintPoints]);

  return { sprint, loading, addPoints };
}

export default RoomContext;
