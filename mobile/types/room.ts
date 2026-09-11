export type RoomRole = 'owner' | 'admin' | 'member' | 'pending';
export type RoomTaskStatus = 'accepted' | 'spectator' | 'completed';
export type RoomTaskNodeType = 'MESSAGE' | 'PROOF' | 'SYSTEM_ALERT' | 'DAY_DIVIDER' | 'UNREAD_DIVIDER';
export type RoomGhostStatus = 'PENDING' | 'GHOST_APPROVED' | 'VOUCHED' | 'REJECTED';
export type AuraTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface RoomDetail {
  id: string;
  name: string;
  description?: string;
  joinCode: string;
  isPrivate: boolean;
  isPublic?: boolean;         // Derived from isPrivate for UI convenience
  maxMembers: number;
  chatRetentionDays: number;
  isPremium: boolean;
  streak: number;
  ownerId: string;
  isActive: boolean;
  requireApproval?: boolean;  // Whether join requests need approval
  showJoinCode?: boolean;     // Whether to show join code to all members
  createdAt: string;
  updatedAt: string;
  endDate?: string;           // Room expiry date
  coverImage?: string | null; // Room banner image URL
  roomDp?: string | null;     // Room display picture / avatar image URL
  // Design spec additions
  doomClockExpiry?: string;   // ISO timestamp — 5-day cycle end
  userRole?: RoomRole;        // Current user's role in this room
  groupAura?: number;         // Aggregate room aura score
  onlineCount?: number;       // Members currently active
  weeklyPoints?: number;      // Sprint points (resets Sunday midnight)
  // Relations (populated when fetching room details)
  members?: RoomMember[];
  tasks?: RoomTask[];
}

export type RoomMemberRole = 'owner' | 'admin' | 'member';

export interface RoomMember {
  id: string;
  userId?: string;            // The actual user ID (for matching currentUser)
  username: string;
  avatar?: string;
  isOnline: boolean;
  aura: AuraTier;
  hasHeat: boolean;           // 3+ tasks in 24h
  role?: RoomMemberRole;      // owner | admin | member
}

export interface TaskCompletion {
  id: string;
  taskId?: string;
  userId?: string;
  completedAt?: string;
  user?: { username: string; avatar?: string };
}

export interface RoomTask {
  id: string;
  roomId: string;
  title: string;
  description?: string;
  taskType: 'daily' | 'custom' | 'one-time' | string;
  daysOfWeek?: string | number[];
  allDay?: boolean;
  points: number;
  isActive: boolean;
  hasThread?: boolean;         // Owner opt-in: social thread enabled
  isCompleted?: boolean;      // Whether current user has completed this task
  createdAt: string;
  createdBy?: string;         // User ID of the task creator
  status?: RoomTaskStatus;    // UI injected state
  heatLevel?: number;         // UI injected state
  progress?: number;          // 0-100 completion percentage
  dueDate?: string;           // Display string e.g. "Due in 2h"
  participants?: RoomMember[];
  isJoined?: boolean;         // Whether current user has joined
  hasUnreadMessages?: boolean; // WhatsApp style badge indicator
  /** Populated from API `completedBy` for UI */
  completions?: TaskCompletion[];
}

/** Alias for screens that use generic "Task" */
export type Task = RoomTask;

/** Alias for room detail / list screens */
export type Room = RoomDetail;

export interface RoomTaskNode {
  id: string;
  _id?: string;
  clientReferenceId?: string;
  roomId: string;
  taskId?: string;
  userId?: string;
  type: RoomTaskNodeType;
  content?: string;
  caption?: string;            // User caption for images
  status: RoomGhostStatus;
  vouchCount: number;
  mediaUrl?: string;
  blurHash?: string;
  heatLevel: number;
  createdAt: string;
  updatedAt: string;
  isVouchedByMe?: boolean;    // Whether current user vouched
  isPinned?: boolean;         // Wall pinning by owner
  user?: {
    id: string;
    username: string;
    avatar?: string;
  };
  replyToId?: string | null;
  replyToText?: string | null;
  replyToUsername?: string | null;
}

export interface RoomUserAura {
  userId: string;
  auraScore: number;
  voteWeight: number;
  level: AuraTier;
}
