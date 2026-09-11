/**
 * Socket.io Event Types
 *
 * Defines ALL socket events (client → server EMIT, server → client LISTEN)
 * for type-safe socket communication.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// EMIT EVENTS (Client → Server)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ClientToServerEvents {
  // ─── Messages ─────────────────────────────────────────────────────────────
  'message:send': (data: {
    conversationId: string;
    text: string;
    replyToId?: string;
    type?: 'text' | 'voice' | 'image' | 'file' | 'location' | 'contact';
    mediaUrl?: string;
  }) => void;

  'message:react': (data: {
    messageId: string;
    emoji: string;
    conversationId: string;
  }) => void;

  'message:reply': (data: {
    messageId: string;
    replyToId: string;
    text: string;
  }) => void;

  'message:seen': (data: {
    conversationId: string;
    messageIds: string[];
  }) => void;

  // ─── Typing ───────────────────────────────────────────────────────────────
  'typing:start': (data: { conversationId: string }) => void;
  'typing:stop': (data: { conversationId: string }) => void;

  // ─── Rooms ────────────────────────────────────────────────────────────────
  'room:join': (roomId: string) => void;
  'room:leave': (roomId: string) => void;

  // ─── Tasks ────────────────────────────────────────────────────────────────
  'task:complete': (data: { taskId: string; roomId: string }) => void;

  // ─── Threads ──────────────────────────────────────────────────────────────
  'thread:send': (data: {
    threadId: string;
    taskId: string;
    text: string;
    roomId: string;
  }) => void;

  // ─── DM Delivery Confirmation ─────────────────────────────────────────────
  'dm:confirm_delivery': (data: { messageIds: string[] }) => void;
  'dm:typing': (data: { recipientId: string; isTyping: boolean }) => void;
  'dm:subscribe': (userId: string) => void;
  'dm:unsubscribe': (userId: string) => void;

  // ─── User Status ──────────────────────────────────────────────────────────
  'users:getOnline': () => void;

  // ─── Friends ──────────────────────────────────────────────────────────────
  'friend:request': (data: { recipientId: string }) => void;
  'friend:accept': (data: { requestId: string }) => void;
  'friend:remove': (data: { friendId: string }) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LISTEN EVENTS (Server → Client)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ServerToClientEvents {
  // ─── Messages ─────────────────────────────────────────────────────────────
  'message:new': (data: {
    id: string;
    conversationId: string;
    text: string;
    senderId: string;
    senderName: string;
    timestamp: string;
    replyTo?: { id: string; text: string; senderName: string };
    type?: string;
    mediaUrl?: string;
  }) => void;

  'message:reaction': (data: {
    messageId: string;
    conversationId: string;
    emoji: string;
    userId: string;
    action: 'added' | 'removed';
  }) => void;

  'message:status': (data: {
    messageId: string;
    conversationId: string;
    status: 'sent' | 'delivered' | 'seen';
  }) => void;

  // ─── Typing ───────────────────────────────────────────────────────────────
  'typing:update': (data: {
    conversationId: string;
    userId: string;
    username: string;
    isTyping: boolean;
  }) => void;

  // ─── Direct Messages ──────────────────────────────────────────────────────
  'new_direct_message': (data: {
    id: string;
    from_user_id: string;
    to_user_id: string;
    content: string;
    created_at: string;
    local_id?: string;
  }) => void;

  'dm:typing': (data: {
    userId: string;
    username: string;
    isTyping: boolean;
  }) => void;

  'dm:read': (data: {
    readBy: string;
    readAt: string;
    messageIds?: string[];
  }) => void;

  'dm:delivered': (data: {
    messageIds: string[];
    deliveredAt: string;
  }) => void;

  // ─── User Status ──────────────────────────────────────────────────────────
  'user:online': (data: { userId: string; isOnline: boolean }) => void;
  'user:status': (data: { userId: string; isOnline: boolean }) => void;
  'users:online': (userIds: string[]) => void;

  // ─── Room Events ──────────────────────────────────────────────────────────
  'room:created': (data: any) => void;
  'room:updated': (data: any) => void;
  'room:deleted': (data: any) => void;
  'room:expired': (data: any) => void;
  'room:joinApproved': (data: any) => void;
  'room:joinRejected': (data: any) => void;
  'room:joinRequest': (data: any) => void;
  'room:activity': (data: any) => void;
  'room:premiumUpdated': (data: any) => void;

  // ─── Member Events ────────────────────────────────────────────────────────
  'member:joined': (data: any) => void;
  'member:left': (data: any) => void;
  'member:kicked': (data: any) => void;

  // ─── Task Events ──────────────────────────────────────────────────────────
  'task:created': (data: any) => void;
  'task:updated': (data: any) => void;
  'task:deleted': (data: any) => void;
  'task:completed': (data: any) => void;
  'task:uncompleted': (data: any) => void;
  'task:joined': (data: any) => void;
  'task:left': (data: any) => void;
  'task:assigned': (data: any) => void;
  'task:assignment_updated': (data: any) => void;

  // ─── Room Task Events (scoped to room) ────────────────────────────────────
  'room:task:created': (data: any) => void;
  'room:task:updated': (data: any) => void;
  'room:task:deleted': (data: any) => void;

  // ─── Personal Task Events (cross-device) ──────────────────────────────────
  'personal_task:created': (data: any) => void;
  'personal_task:updated': (data: any) => void;
  'personal_task:deleted': (data: any) => void;

  // ─── Thread Events ────────────────────────────────────────────────────────
  'thread:message': (data: any) => void;
  'thread:node_created': (data: any) => void;
  'thread:node_updated': (data: any) => void;

  // ─── Appreciation Events ──────────────────────────────────────────────────
  'appreciation:received': (data: any) => void;

  // ─── Friend Events ────────────────────────────────────────────────────────
  'friend:request': (data: {
    request: any;
    requester: any;
    message?: string;
  }) => void;
  'friend:request_sent': (data: {
    request: any;
    recipientId: string;
    recipientUsername: string;
  }) => void;
  'friend:accepted': (data: { friend: any }) => void;
  'friend:removed': (data: { friendId: string; removedBy?: string }) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT CATEGORIES (for filtering/grouping)
// ═══════════════════════════════════════════════════════════════════════════════

export const SOCKET_EVENT_CATEGORIES = {
  MESSAGE: 'message' as const,
  TYPING: 'typing' as const,
  ROOM: 'room' as const,
  TASK: 'task' as const,
  THREAD: 'thread' as const,
  USER: 'user' as const,
  FRIEND: 'friend' as const,
  DM: 'dm' as const,
  APPRECIATION: 'appreciation' as const,
} as const;
