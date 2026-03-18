// User types
export interface User {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  timezone: string;
  onboardingCompleted: boolean;
  streak: number;
  longestStreak: number;
  totalTasksCompleted: number;
  createdAt: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  refreshToken: string;
  user: User;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errors?: Array<{ field: string; message: string }>;
}

// Room types
export interface RoomMember {
  _id: string;
  id: string;
  userId: {
    _id: string;
    id: string;
    username: string;
    avatar: string | null;
  };
  role: 'owner' | 'member';
  points: number;
  status: 'active' | 'pending';
  joinedAt: string;
}

export interface RoomTask {
  _id: string;
  id: string;
  roomId: string;
  title: string;
  description: string | null;
  taskType: 'daily' | 'weekly' | 'custom';
  daysOfWeek: number[];
  points: number;
  isActive: boolean;
  isCompleted?: boolean;
  createdAt: string;
}

export interface Room {
  _id: string;
  id: string;
  name: string;
  description: string | null;
  joinCode: string;
  isPrivate: boolean;
  isPublic: boolean;
  requireApproval: boolean;
  maxMembers: number;
  chatRetentionDays: number;
  isPremium: boolean;
  premiumActivatedAt: string | null;
  streak: number;
  ownerId: string;
  owner: {
    _id: string;
    id: string;
    username: string;
  };
  members: RoomMember[];
  tasks: RoomTask[];
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PendingMember {
  _id: string;
  userId: {
    _id: string;
    id: string;
    username: string;
    avatar: string | null;
    email?: string;
  };
  requestedAt: string;
}

export interface LeaderboardEntry {
  _id: string;
  userId: string;
  user: {
    _id: string;
    id: string;
    username: string;
    avatar: string | null;
  };
  points: number;
  role: string;
}

export interface ChatMessage {
  _id: string;
  id: string;
  roomId: string;
  message: string;
  content: string;
  messageType: string;
  type: 'user' | 'system';
  status: string;
  userId: {
    _id: string;
    id: string;
    username: string;
    avatar: string | null;
  } | null;
  replyTo: {
    _id: string;
    message: string;
  } | null;
  createdAt: string;
}

// Task types (add more as needed)
export interface Task {
  id: string;
  title: string;
  completed: boolean;
}

// ═══════════════════════════════════════════════════════════
// ROOM UI ENHANCEMENT TYPES
// ═══════════════════════════════════════════════════════════

// Aura system for reputation/vote weight
export type AuraLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface UserAura {
  userId: string;
  aura: AuraLevel;
  auraScore: number; // 0-100
  voteWeight: number; // Determined by aura level
}

// Task proof for Ghost Approval system
export type ProofStatus = 'pending' | 'approved' | 'challenged' | 'auto_approved';

export interface TaskProof {
  id: string;
  taskId: string;
  userId: string;
  imageUrl: string;
  submittedAt: number;
  status: ProofStatus;
  challengeExpiresAt: number; // 12 hours after auto-approval
  reviewedBy?: string;
  reviewedAt?: number;
}

// Task participant status
export type TaskParticipantStatus = 'accepted' | 'spectator' | 'completed';

// Extended RoomTask with UI enhancement fields
export interface EnhancedRoomTask {
  id: string;
  roomId: string;
  title: string;
  description: string | null;
  status: TaskParticipantStatus;
  deadline: number;
  points: number;
  participants: string[]; // user IDs of accepted participants
  viewerIds: string[]; // user IDs of spectators
  proof?: TaskProof;
  heatLevel: number; // 0-100, triggers heat color shift at 80%
  createdAt: number;
  updatedAt: number;
}

// Weekly Sprint for gamification
export interface WeeklySprint {
  id: string;
  startDate: number;
  endDate: number; // Reset every Sunday
  points: number;
  rank?: number;
  badges: SprintBadge[];
}

export interface SprintBadge {
  id: string;
  name: string;
  icon: string;
  earnedAt: number;
  defenseExpiry: number; // 7 days to defend
  isDecayed: boolean;
}

// Room with enhancement fields
export interface EnhancedRoom {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  createdAt: number;
  expiresAt: number; // Doom Clock target
  isPremium: boolean;
  memberCount: number;
  taskCount: number;
  // UI state
  isFlipped: boolean;
}

// System message for room timeline
export interface RoomSystemMessage {
  id: string;
  type: 'deadline_changed' | 'member_joined' | 'member_left' | 'task_completed' | 'points_awarded' | 'justice_review';
  content: string;
  createdAt: number;
  metadata?: Record<string, any>;
}

// Memory Wall pinned image
export interface PinnedImage {
  id: string;
  taskId: string;
  imageUrl: string;
  thumbnailUrl: string;
  uploadedBy: string;
  uploadedAt: number;
}

// Challenge for Ghost Approval
export interface TaskChallenge {
  id: string;
  proofId: string;
  challengedBy: string;
  challengedAt: number;
  reason: string;
  status: 'active' | 'resolved' | 'overturned';
  resolvedBy?: string;
  resolvedAt?: number;
  resolution?: string;
}

// Task Activity types for Subway Timeline
export type TaskActivityType =
  | 'task_created'
  | 'task_joined'
  | 'task_left'
  | 'task_completed'
  | 'milestone_reached'
  | 'challenge_started'
  | 'challenge_failed'
  | 'challenge_succeeded'
  | 'point_earned'
  | 'comment_added'
  | 'attachment_added'
  | 'mention'
  | 'reminder'
  | 'deadline_approaching'
  | 'user_banned';

// Task Activity for timeline visualization
export interface TaskActivity {
  id: string;
  taskId: string;
  type: TaskActivityType;
  userId: string;
  userName: string;
  userAvatar?: string;
  description: string;
  timestamp: Date;
  pointsEarned?: number;
  attachmentUrl?: string;
  commentCount?: number;
  metadata?: Record<string, any>;
}
