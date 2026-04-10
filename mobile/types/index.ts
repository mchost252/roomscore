/**
 * KRIOS Mobile - TypeScript Interfaces
 * 
 * Local-first data architecture with Supabase sync
 * Following the "Tactical Minimalist" UI specification
 */

// ============================================================================
// ROOM TYPES
// ============================================================================

export interface RoomDetail {
  id: string;
  name: string;
  description?: string;
  doom_clock_expiry: string; // ISO 8601 timestamp
  retention_days: number;
  user_role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'SPECTATOR';
  group_aura: number;
  member_count: number;
  active_task_count: number;
  join_code?: string;
  is_public: boolean;
  require_approval: boolean;
  created_at: string;
  updated_at: string;
  owner_id: string;
}

export interface RoomMember {
  id: string;
  user_id: string;
  room_id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  aura_level: 'BRONZE' | 'SILVER' | 'GOLD';
  heat_state: boolean;
  joined_at: string;
  user?: UserProfile;
}

export interface UserProfile {
  id: string;
  username: string;
  avatar_url?: string;
  /** Alias used by some screens — prefer `avatar_url` when syncing from API */
  avatar?: string;
  aura_level: 'BRONZE' | 'SILVER' | 'GOLD';
  heat_state: boolean;
  weekly_points: number;
  bio?: string;
  email?: string;
  createdAt?: string;
  timezone?: string;
  totalTasksCompleted?: number;
  streak?: number;
  longestStreak?: number;
  /** In-memory only — sockets may read when attached by auth layer */
  token?: string;
}

// ============================================================================
// TASK TYPES
// ============================================================================

export interface RoomTask {
  id: string;
  room_id: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  deadline: string;
  points: number;
  participants: string[]; // user IDs
  viewer_ids: string[]; // user IDs (spectators)
  heat_level: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  days_of_week?: number[]; // 0-6 for custom tasks
  task_type: 'DAILY' | 'WEEKLY' | 'CUSTOM';
}

// Task with enhanced local state
export interface EnhancedRoomTask extends RoomTask {
  local_status: 'accepted' | 'spectator' | 'pending';
  is_participating: boolean;
  roomId: string; // camelCase alias for room_id
}

// ============================================================================
// TIMELINE / PROOF TYPES
// ============================================================================

export interface TaskNode {
  id: string;
  task_id: string;
  type: 'MESSAGE' | 'PROOF' | 'SYSTEM_ALERT';
  author_id: string;
  content_text?: string;
  media_url?: string;
  blur_hash?: string;
  thumbnail_url?: string;
  status: 'PENDING' | 'GHOST_APPROVED' | 'VOUCHED' | 'REJECTED';
  vouch_count: number;
  created_at: string;
  updated_at: string;
  author?: UserProfile;
}

export interface ProofMedia {
  id: string;
  node_id: string;
  media_url: string;
  thumbnail_url: string;
  blur_hash: string;
  aspect_ratio: number;
  width: number;
  height: number;
  created_at: string;
}

export type VerificationStatus = 'PENDING' | 'GHOST_APPROVED' | 'VOUCHED' | 'REJECTED';

// ============================================================================
// SYNC TYPES
// ============================================================================

export interface SyncTimestamp {
  room_id: string;
  tasks_updated_at: string;
  nodes_updated_at: string;
  members_updated_at: string;
}

export interface DeltaSyncRequest {
  room_id: string;
  last_sync: string; // ISO timestamp
}

export interface DeltaSyncResponse {
  tasks: RoomTask[];
  nodes: TaskNode[];
  members: RoomMember[];
  deleted_task_ids: string[];
  deleted_node_ids: string[];
  server_timestamp: string;
}

// ============================================================================
// JANITOR TYPES
// ============================================================================

export interface JanitorStats {
  deleted_messages: number;
  deleted_tasks: number;
  deleted_media: number;
  freed_bytes: number;
  last_run: string;
}

export interface DataRetentionPolicy {
  message_retention_days: number;
  task_retention_days: number;
  media_retention_days: number;
  auto_cleanup_enabled: boolean;
}

// ============================================================================
// GAMIFICATION TYPES
// ============================================================================

export type AuraLevel = 'BRONZE' | 'SILVER' | 'GOLD';

export interface VouchEvent {
  id: string;
  node_id: string;
  voucher_id: string;
  author_id: string;
  weight: number;
  created_at: string;
}

export interface WeeklySprint {
  id?: string;
  user_id: string;
  room_id: string;
  week_start: string;
  points: number;
  tasks_completed: number;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface ThemeColors {
  // Dark Mode (Stealth)
  dark: {
    background: string;
    surface: string;
    accent_cyan: string;
    accent_violet: string;
    border: string;
    text_primary: string;
    text_secondary: string;
    text_tertiary: string;
    success: string;
    warning: string;
    error: string;
  };
  // Light Mode (Clean)
  light: {
    background: string;
    surface: string;
    accent_navy: string;
    accent_emerald: string;
    border: string;
    text_primary: string;
    text_secondary: string;
    text_tertiary: string;
    success: string;
    warning: string;
    error: string;
  };
}

export interface FlipHeaderState {
  isFlipped: boolean;
  missionControl: {
    roomName: string;
    memberCount: number;
    activeTaskCount: number;
    doomProgress: number; // 0-1
    isDoomWarning: boolean;
  };
  strategyDeck: {
    currentDay: number;
    days: { label: string; isToday: boolean }[];
    groupCompletion: number;
    personalContribution: number;
  };
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateRoomInput {
  name: string;
  description?: string;
  retention_days: number;
  is_public?: boolean;
  require_approval?: boolean;
  max_members?: number;
  duration_weeks?: number;
}

export interface CreateTaskInput {
  room_id: string;
  title: string;
  description?: string;
  task_type: 'DAILY' | 'WEEKLY' | 'CUSTOM';
  days_of_week?: number[];
  points: number;
  deadline?: string;
}

export interface CreateProofInput {
  task_id: string;
  content_text?: string;
  media_url?: string;
  blur_hash?: string;
  thumbnail_url?: string;
}

export interface VouchInput {
  node_id: string;
  author_id: string;
}

// ============================================================================
// AUTH TYPES
// ============================================================================

export type User = UserProfile;

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

// ============================================================================
// ENHANCED ROOM TYPES
// ============================================================================

export interface EnhancedRoom {
  id: string;
  name: string;
  description?: string;
  joinCode: string;
  isPrivate: boolean;
  isPublic?: boolean;
  maxMembers: number;
  chatRetentionDays: number;
  isPremium: boolean;
  streak: number;
  ownerId: string;
  isActive: boolean;
  requireApproval?: boolean;
  createdAt: string;
  updatedAt: string;
  doomClockExpiry?: string;
  userRole?: string;
  groupAura?: number;
  onlineCount?: number;
  weeklyPoints?: number;
  members?: RoomMember[];
  tasks?: RoomTask[];
}

export interface UserAura {
  userId: string;
  auraScore: number;
  voteWeight: number;
  level: AuraLevel;
}

export interface TaskProof {
  id: string;
  taskId: string;
  userId: string;
  imageUrl: string;
  submittedAt: number;
  status: 'pending' | 'approved' | 'rejected';
  challengeExpiresAt: number;
}

