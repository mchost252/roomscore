export const NOTIFICATION_TYPES = {
  DIRECT_MESSAGE: 'direct_message',
  FRIEND_REQUEST: 'friend_request',
  FRIEND_REQUEST_ACCEPTED: 'friend_request_accepted',
  ROOM_INVITE: 'room_invite',
  ROOM_JOINED: 'room_joined',
  ROOM_LEFT: 'room_left',
  ROOM_UPDATED: 'room_updated',
  ROOM_TASK_CREATED: 'room_task_created',
  ROOM_TASK_ASSIGNED: 'room_task_assigned',
  TASK_COMPLETED: 'task_completed',
  TASK_PROOF_SUBMITTED: 'task_proof_submitted',
  TASK_APPROVED: 'task_approved',
  REACTION_RECEIVED: 'reaction_received',
  APPRECIATION_RECEIVED: 'appreciation_received',
  NUDGE_RECEIVED: 'nudge_received',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  STREAK_RISK: 'streak_risk',
  TASK_REMINDER: 'task_reminder',
  SYSTEM: 'system',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
export type NotificationPriority = 'low' | 'normal' | 'high';
export type NotificationCategory = 'messages' | 'social' | 'rooms' | 'tasks' | 'achievements' | 'system';

export interface NotificationDeepLink {
  type: NotificationType;
  roomId?: string;
  taskId?: string;
  friendId?: string;
  conversationId?: string;
}

export interface NotificationEvent {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  data: NotificationDeepLink & Record<string, unknown>;
  read: boolean;
  createdAt: string;
  dedupeKey?: string;
}
