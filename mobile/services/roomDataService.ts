/**
 * Local-first room orchestration — minimal implementation so RoomContext loads.
 * Extend with SQLite / sync when you wire full delta sync.
 */
import type {
  EnhancedRoom,
  EnhancedRoomTask,
  UserAura,
  WeeklySprint,
} from '../types';

export const AURA_CONFIG = {
  decayPerDay: 0.02,
  boostPerTask: 1,
} as const;

async function initialize(): Promise<void> {
  /* optional: open DB */
}

async function runJanitor(): Promise<void> {}

async function processGhostApprovals(): Promise<string[]> {
  return [];
}

async function getRooms(): Promise<EnhancedRoom[]> {
  return [];
}

async function getTasks(_roomId: string): Promise<EnhancedRoomTask[]> {
  return [];
}

async function joinTask(_taskId: string, _userId: string): Promise<void> {}

async function leaveTask(_taskId: string, _userId: string): Promise<void> {}

async function getAura(_userId: string): Promise<UserAura | null> {
  return null;
}

async function updateAura(userId: string, scoreDelta: number): Promise<UserAura> {
  return {
    userId,
    auraScore: scoreDelta,
    voteWeight: 1,
    level: 'BRONZE',
  };
}

function getCurrentSprintDates(): { start: string; end: string } {
  const d = new Date();
  return { start: d.toISOString(), end: d.toISOString() };
}

async function getOrCreateSprint(userId: string): Promise<WeeklySprint> {
  const now = new Date().toISOString();
  return {
    id: `sprint_${userId}_${now}`,
    user_id: userId,
    room_id: '',
    week_start: now,
    points: 0,
    tasks_completed: 0,
  };
}

async function addSprintPoints(userId: string, points: number): Promise<WeeklySprint> {
  const base = await getOrCreateSprint(userId);
  return { ...base, points: base.points + points };
}

async function createChallenge(
  _proofId: string,
  _userId: string,
  _reason: string
): Promise<void> {}

const roomDataService = {
  initialize,
  runJanitor,
  processGhostApprovals,
  getRooms,
  getTasks,
  joinTask,
  leaveTask,
  getAura,
  updateAura,
  getCurrentSprintDates,
  getOrCreateSprint,
  addSprintPoints,
  createChallenge,
};

export default roomDataService;
