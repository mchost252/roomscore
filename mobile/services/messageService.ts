import api from './api';
import sqliteService, { LocalDirectMessage, LocalConversation } from './sqliteService';
import syncEngine from './syncEngine';
import NetInfo from '@react-native-community/netinfo';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface ServerMessage {
  id: string;
  _id: string;
  content: string;
  message: string;
  fromUserId: string;
  toUserId: string;
  sender: { id: string; _id: string; username: string };
  recipient: { id: string; _id: string; username: string };
  isRead: boolean;
  replyTo: { _id: string; message: string } | null;
  replyToId: string | null;
  replyToText: string | null;
  createdAt: string;
}

export interface FriendUser {
  id: string;
  username: string;
  avatar: string | null;
  isFriend?: boolean;
  requestStatus?: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
  requestId?: string | null;
}

export interface MessageRequest {
  id: string;
  friendId: string;
  username: string;
  avatar: string | null;
  lastMessage: string;
  createdAt: number;
}

// Status promotion order — status can only move forward, never backwards
const STATUS_ORDER: Record<string, number> = {
  failed: -1,
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

function shouldPromote(current: string, next: string): boolean {
  const cur = STATUS_ORDER[current] ?? 0;
  const nxt = STATUS_ORDER[next] ?? 0;
  // 'failed' is special — only 'sending' can become 'failed'
  if (next === 'failed') return current === 'sending';
  return nxt > cur;
}

// ═══════════════════════════════════════════════════════════
// MessageService — Offline-First, SQLite-Only, WhatsApp-Style
// ═══════════════════════════════════════════════════════════

class MessageService {
  // ─── Event Bus ─────────────────────────────────────────
  private listeners = new Map<string, Set<Function>>();

  on(event: string, handler: Function): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => { this.listeners.get(event)?.delete(handler); };
  }

  off(event: string, handler: Function): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, data?: any): void {
    console.log(`[MsgService] Emitting event: ${event}`, data ? 'with data' : '');
    this.listeners.get(event)?.forEach(h => {
      try { h(data); } catch (e) { console.warn(`[MsgService] Event handler error (${event}):`, e); }
    });
  }

  // ─── State ─────────────────────────────────────────────
  private isInitialized = false;
  private currentUserId: string | null = null;
  private unsubscribers: (() => void)[] = [];
  private deletedByMe = new Set<string>(); // Track friends user has deleted (initiated)

  // Friendship cache — avoids API calls for every message send
  private friendshipCache = new Map<string, { isFriend: boolean; requestId?: string; requestStatus: string }>();

  // Typing debounce
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastTypingEmit = 0;

  // Read receipt batching
  private readReceiptBatch = new Set<string>();
  private readReceiptTimeout: ReturnType<typeof setTimeout> | null = null;

  // Conversations fetch debounce
  private conversationsFetchPromise: Promise<void> | null = null;
  private lastConversationsFetch = 0;
  private readonly CONVERSATIONS_FETCH_COOLDOWN = 5000;

  // Delta sync dedup
  private fetchMessagesPromises = new Map<string, Promise<void>>();

  // ═══════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════

  async initialize(userId: string): Promise<void> {
    if (this.isInitialized && this.currentUserId === userId) return;
    this.currentUserId = userId;
    this.setupSocketListeners();
    this.isInitialized = true;

    // Load friendship cache so sendMessage can check inline
    try {
      await this.loadFriendshipCache();
    } catch (err) {
      console.warn('[MsgService] Failed to load friendship cache:', err);
    }
    // Flush any queued offline messages
    try {
      await this.flushQueue();
    } catch (err) {
      console.warn('[MsgService] Failed to flush offline queue:', err);
    }
    console.log('[MsgService] Initialized for user:', userId);
  }

  disconnect(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.listeners.clear();
    this.friendshipCache.clear();
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    if (this.readReceiptTimeout) {
      clearTimeout(this.readReceiptTimeout);
      this.readReceiptTimeout = null;
    }
    this.readReceiptBatch.clear();
    this.fetchMessagesPromises.clear();
    this.conversationsFetchPromise = null;
    this.isInitialized = false;
    this.currentUserId = null;
    console.log('[MsgService] Disconnected and cleaned up');
  }

  // ═══════════════════════════════════════════════════════════
  // Socket Listeners — consolidated, using targeted events
  // ═══════════════════════════════════════════════════════════

  private setupSocketListeners(): void {
    // Clear old listeners
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    // ── New incoming message ──────────────────────────────
    this.unsubscribers.push(
      syncEngine.on('new_direct_message', async (data: ServerMessage) => {
        console.log('[MsgService] Socket event: new_direct_message received', data);
        const senderId = data.fromUserId || data.sender?._id || data.sender?.id;
        const recipientId = data.toUserId || data.recipient?._id || data.recipient?.id;
        const content = data.content || data.message;

        const localMsg: LocalDirectMessage = {
          id: data.id || data._id,
          local_id: data.id || data._id,
          from_user_id: senderId,
          to_user_id: recipientId,
          content,
          status: 'delivered',
          reply_to_id: data.replyToId || data.replyTo?._id || null,
          reply_to_text: data.replyToText || data.replyTo?.message || null,
          created_at: new Date(data.createdAt).getTime(),
          synced: 1,
        };

        await sqliteService.saveDirectMessage(localMsg);

        // Determine friend context
        const isFromMe = senderId === this.currentUserId;
        const friendId = isFromMe ? recipientId : senderId;
        const friendUsername = isFromMe
          ? (data.recipient?.username || 'User')
          : (data.sender?.username || 'User');

        // Ensure conversation exists
        await this.ensureConversation(
          friendId, friendUsername, null, content, localMsg.created_at,
          !isFromMe, // increment unread only for incoming
        );

        // Emit targeted event
        this.emit('message:new', localMsg);
        this.emit('conversation:list');

        // Confirm delivery to sender
        syncEngine.emit('dm:confirm_delivery', {
          senderId,
          messageIds: [localMsg.id],
        });
      })
    );

    // ── Typing indicator ─────────────────────────────────
    this.unsubscribers.push(
      syncEngine.on('dm:typing', (data: { userId: string; username: string; isTyping: boolean }) => {
        this.emit('typing:changed', data);
      })
    );

    // ── Read receipts (friend read my messages) ──────────
    this.unsubscribers.push(
      syncEngine.on('dm:read', async (data: { readBy: string; readAt: string }) => {
        if (this.currentUserId) {
          // Mark MY messages TO this friend as 'read' (status promotion)
          await sqliteService.markMyMessagesReadBy(this.currentUserId, data.readBy);
        }
        this.emit('message:status', { type: 'read', friendId: data.readBy });
      })
    );

    // ── Delivery confirmations ───────────────────────────
    this.unsubscribers.push(
      syncEngine.on('dm:delivered', async (data: { messageIds: string[]; deliveredAt: string }) => {
        for (const id of data.messageIds) {
          await sqliteService.promoteMessageStatus(id, 'delivered', 1);
        }
        this.emit('message:status', { type: 'delivered', messageIds: data.messageIds });
      })
    );

    // ── User online/offline ──────────────────────────────
    this.unsubscribers.push(
      syncEngine.on('user:status', (data: { userId: string; isOnline: boolean }) => {
        sqliteService.updateConversationOnline(data.userId, data.isOnline).catch((err) => {
          console.warn('[MsgService] updateConversationOnline failed:', err);
        });
        this.emit('presence:changed', data);
      })
    );

    // ── Bulk online users ────────────────────────────────
    this.unsubscribers.push(
      syncEngine.on('users:online', (userIds: string[]) => {
        this.emit('presence:bulk', userIds);
      })
    );

    // ── Friend request received ──────────────────────────
    this.unsubscribers.push(
      syncEngine.on('friend:request', async (data: { request: any; requester: any; message?: string }) => {
        console.log('[MsgService] Socket event: friend:request received', data);
        const requesterId = data.requester?._id || data.requester?.id;
        const username = data.requester?.username || 'User';
        const requestId = data.request?._id || data.request?.id;
        const messageContent = data.message || 'Sent you a message request';

        await this.ensureConversation(
          requesterId, username, null, messageContent, Date.now(),
          true, 'pending_received', requestId,
        );

        this.friendshipCache.set(requesterId, { isFriend: false, requestId, requestStatus: 'pending_received' });
        this.emit('message_request', { friendId: requesterId, username, requestId, message: messageContent });
        this.emit('conversation:list');
      })
    );

    // ── Friend request sent confirmation ─────────────────
    this.unsubscribers.push(
      syncEngine.on('friend:request_sent', async (data: { request: any; recipientId: string; recipientUsername: string }) => {
        console.log('[MsgService] Socket event: friend:request_sent received', data);
        const recipientId = data.recipientId;
        const requestId = data.request?._id || data.request?.id;

        this.friendshipCache.set(recipientId, { isFriend: false, requestId, requestStatus: 'pending_sent' });
        await this.ensureConversation(
          recipientId, data.recipientUsername, null,
          'Waiting for acceptance...', Date.now(),
          false, 'pending_sent', requestId,
        );

        this.emit('conversation:list');
      })
    );

    // ── Friend request accepted ──────────────────────────
    this.unsubscribers.push(
      syncEngine.on('friend:accepted', async (data: { friend: any }) => {
        const friendId = data.friend?._id || data.friend?.id;
        const username = data.friend?.username || 'User';
        if (!friendId) return;

        this.friendshipCache.set(friendId, { isFriend: true, requestStatus: 'accepted' });
        await sqliteService.updateConversationRequestStatus(friendId, 'none');

        // Flush any queued messages for this friend
        this.flushQueueForFriend(friendId).catch((err) => {
          console.warn('[MsgService] flushQueueForFriend failed:', err);
        });
        this.emit('request_accepted', friendId);
        this.emit('conversation:list');
      })
    );

    // ── Friend removed (someone unfriended us) ──────────
    this.unsubscribers.push(
      syncEngine.on('friend:removed', async (data: { friendId: string; removedBy?: string }) => {
        const { friendId } = data;
        const removedBy = data.removedBy; // Who initiated the removal
        
        console.log('[MsgService] friend:removed event:', { friendId, removedBy, currentUserId: this.currentUserId });

        this.friendshipCache.delete(friendId);

        // Determine if I initiated the removal by comparing removedBy with currentUserId
        // If removedBy equals my ID, I was the one who removed them
        const iInitiated = removedBy === this.currentUserId;
        console.log('[MsgService] friend:removed - iInitiated:', iInitiated);

        if (iInitiated) {
          // I removed them - clear my local history (WhatsApp style: initiator loses history)
          console.log('[MsgService] Deleting my messages (I initiated removal)');
          // Track that I deleted this friend so sync doesn't re-create
          this.deletedByMe.add(friendId);
          await sqliteService.deleteConversationMessages(this.currentUserId!, friendId);
          await sqliteService.deleteConversation(friendId);
        } else {
          // They removed me - keep history but mark as 'removed'
          console.log('[MsgService] Keeping messages, marking as removed (they removed me)');
          const convs = await sqliteService.getConversations();
          const conv = convs.find(c => c.friend_id === friendId);
          if (conv) {
            await this.ensureConversation(
              friendId, conv.username, conv.avatar,
              conv.last_message || 'This conversation is no longer available', 
              conv.last_message_at || Date.now(), 
              false, 'removed', null,
            );
          }
        }

        // Notify UI
        this.emit('friend_removed', { friendId, initiatedByMe: iInitiated });
        this.emit('conversation:list');
      })
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Conversation Persistence
  // ═══════════════════════════════════════════════════════════

  private async ensureConversation(
    friendId: string,
    username: string,
    avatar: string | null,
    lastMessage: string,
    timestamp: number,
    incrementUnread: boolean,
    requestStatus?: string,
    requestId?: string | null,
  ): Promise<void> {
    const convs = await sqliteService.getConversations();
    const existing = convs.find(c => c.friend_id === friendId);

    const finalStatus = requestStatus !== undefined
      ? requestStatus
      : (existing?.request_status || 'none');

    if (existing) {
      const updatedConv: LocalConversation = {
        ...existing,
        username: username || existing.username,
        avatar: avatar || existing.avatar,
        last_message: lastMessage,
        last_message_at: timestamp,
        unread_count: incrementUnread ? existing.unread_count + 1 : existing.unread_count,
        updated_at: timestamp,
        request_status: finalStatus,
        request_id: requestId !== undefined ? (requestId ?? null) : existing.request_id,
      };
      await sqliteService.saveConversation(updatedConv);
      return;
    }

    // Create new conversation
    const newConv: LocalConversation = {
      friend_id: friendId,
      username,
      avatar,
      last_message: lastMessage,
      last_message_at: timestamp,
      unread_count: incrementUnread ? 1 : 0,
      is_online: 0,
      updated_at: timestamp,
      request_status: finalStatus,
      request_id: requestId || null,
    };
    await sqliteService.saveConversation(newConv);
  }

  // ═══════════════════════════════════════════════════════════
  // Friendship
  // ═══════════════════════════════════════════════════════════

  private async loadFriendshipCache(): Promise<void> {
    try {
      const friends = await this.getFriends();
      for (const f of friends) {
        this.friendshipCache.set(f.id, {
          isFriend: f.requestStatus === 'accepted' || f.isFriend === true,
          requestId: f.requestId || undefined,
          requestStatus: f.requestStatus || 'accepted',
        });
      }
    } catch {}
  }

  async checkFriendship(friendId: string): Promise<{ isFriend: boolean; requestStatus: string; requestId?: string }> {
    // Check cache first (fast path)
    const cached = this.friendshipCache.get(friendId);
    if (cached) return cached;

    // Fall back to server
    try {
      const friends = await this.getFriends();
      const friend = friends.find(f => f.id === friendId);
      if (friend && (friend.isFriend || friend.requestStatus === 'accepted')) {
        const result = { isFriend: true, requestStatus: 'accepted' as string };
        this.friendshipCache.set(friendId, result);
        return result;
      }

      // Check pending requests
      const [sentRes, receivedRes] = await Promise.all([
        api.get('/friends/requests/sent').catch(() => ({ data: { requests: [] } })),
        api.get('/friends/requests').catch(() => ({ data: { requests: [] } })),
      ]);

      const sent = (sentRes.data.requests || []).find((r: any) => (r.recipientId || r.toUserId) === friendId);
      if (sent) {
        const result = { isFriend: false, requestStatus: 'pending_sent', requestId: sent._id || sent.id };
        this.friendshipCache.set(friendId, result);
        return result;
      }

      const received = (receivedRes.data.requests || []).find((r: any) => {
        const reqId = r.requester?._id || r.requester?.id || r.fromUserId;
        return reqId === friendId;
      });
      if (received) {
        const result = { isFriend: false, requestStatus: 'pending_received', requestId: received._id || received.id };
        this.friendshipCache.set(friendId, result);
        return result;
      }

      const result = { isFriend: false, requestStatus: 'none' as string };
      this.friendshipCache.set(friendId, result);
      return result;
    } catch {
      return { isFriend: false, requestStatus: 'none' };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Send Message — Offline-First + WhatsApp-style Requests
  // ═══════════════════════════════════════════════════════════

  async sendMessage(
    friendId: string,
    content: string,
    friendUsername: string,
    friendAvatar: string | null,
    replyTo?: { id: string; text: string },
  ): Promise<LocalDirectMessage> {
    if (!this.currentUserId) throw new Error('MessageService not initialized');
    
    // Validate message content
    if (!content || !content.trim()) {
      throw new Error('Message content cannot be empty');
    }

    const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    // 1. Write to SQLite IMMEDIATELY (optimistic)
    const localMsg: LocalDirectMessage = {
      id: localId,
      local_id: localId,
      from_user_id: this.currentUserId,
      to_user_id: friendId,
      content,
      status: 'sending',
      reply_to_id: replyTo?.id || null,
      reply_to_text: replyTo?.text || null,
      created_at: now,
      synced: 0,
    };

    await sqliteService.saveDirectMessage(localMsg);

    // 2. Check friendship and set conversation status
    const friendship = await this.checkFriendship(friendId);
    const isPending = !friendship.isFriend && friendship.requestStatus !== 'accepted';

    await this.ensureConversation(
      friendId, friendUsername, friendAvatar, content, now, false,
      isPending ? 'pending_sent' : undefined,
    );

    // 3. Notify UI immediately
    this.emit('message:new', localMsg);
    this.emit('conversation:list');

    // 4. Send to server in background (don't block UI)
    this.sendToServer(localMsg, friendId, content, replyTo).catch((err) => {
      console.warn('[MsgService] sendToServer failed:', err);
    });

    return localMsg;
  }

  private async sendToServer(
    localMsg: LocalDirectMessage,
    friendId: string,
    content: string,
    replyTo?: { id: string; text: string },
  ): Promise<void> {
    try {
      const response = await api.post(`/direct-messages/${friendId}`, {
        message: content,
        replyTo: replyTo?.id || undefined,
      });

      if (response.data.success) {
        const srv = response.data.message;
        const serverId = srv.id || srv._id;
        await sqliteService.updateMessageId(localMsg.local_id, serverId);
        this.emit('message:status', { type: 'synced', localId: localMsg.local_id, serverId });
      }
    } catch (error: any) {
      const status = error?.response?.status;
      const code = error?.response?.data?.code;

      if (status === 403 && code === 'PENDING_LIMIT') {
        await sqliteService.promoteMessageStatus(localMsg.local_id, 'failed');
        this.emit('pending_limit_reached', { friendId });
        this.emit('message:status', { type: 'failed', localId: localMsg.local_id });
        return;
      }

      if (status === 403 && code === 'WAITING_FOR_YOU_TO_ACCEPT') {
        await sqliteService.promoteMessageStatus(localMsg.local_id, 'failed');
        this.emit('request_required_before_reply', { friendId });
        this.emit('message:status', { type: 'failed', localId: localMsg.local_id });
        return;
      }

      await sqliteService.promoteMessageStatus(localMsg.local_id, 'failed');
      this.emit('message:status', { type: 'failed', localId: localMsg.local_id });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Retry Failed Message
  // ═══════════════════════════════════════════════════════════

  async retryMessage(localId: string, friendId: string, content: string, replyToId?: string | null): Promise<void> {
    await sqliteService.updateMessageStatus(localId, 'sending');
    this.emit('message:status', { type: 'retry', localId });

    try {
      const response = await api.post(`/direct-messages/${friendId}`, {
        message: content,
        replyTo: replyToId || undefined,
      });

      if (response.data.success) {
        const srv = response.data.message;
        const serverId = srv.id || srv._id;
        await sqliteService.updateMessageId(localId, serverId);
        this.emit('message:status', { type: 'synced', localId, serverId });
      }
    } catch {
      await sqliteService.promoteMessageStatus(localId, 'failed');
      this.emit('message:status', { type: 'failed', localId });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Get Messages — Cache-first, Background Delta Sync
  // ═══════════════════════════════════════════════════════════

  async getMessages(friendId: string, before?: number, opts?: { skipSync?: boolean }): Promise<LocalDirectMessage[]> {
    if (!this.currentUserId) return [];

    // Skip if we've deleted this friend - don't fetch from server
    if (this.deletedByMe.has(friendId)) {
      console.log('[MsgService] Skipping message fetch for deleted friend:', friendId);
      return [];
    }

    // ALWAYS read from SQLite first — never block on network
    const cached = await sqliteService.getDirectMessages(this.currentUserId, friendId, 50, before);

    // Background delta sync only when not paginating and not explicitly skipped
    if (!before && !opts?.skipSync) {
      this.fetchAndMergeMessages(friendId).catch((err) => {
        console.warn('[MsgService] fetchAndMergeMessages failed:', err);
      });
    }

    return cached;
  }

  private async fetchAndMergeMessages(friendId: string): Promise<void> {
    // Dedup concurrent fetches for the same friend
    if (this.fetchMessagesPromises.has(friendId)) {
      return this.fetchMessagesPromises.get(friendId);
    }

    const promise = (async () => {
      try {
        // Find newest synced server message ID for delta cursor
        let lastId: string | undefined;
        if (this.currentUserId) {
          const localMessages = await sqliteService.getDirectMessages(this.currentUserId, friendId, 20);
          const lastServerMsg = [...localMessages]
            .reverse()
            .find(m => m.synced === 1 && !!m.id && !String(m.id).startsWith('local_'));
          if (lastServerMsg?.id) lastId = lastServerMsg.id;
        }

        const response = await api.get(`/direct-messages/${friendId}`, {
          params: lastId ? { last_id: lastId } : undefined,
        });

        if (response.data.success && response.data.messages) {
          let hasNewMessages = false;

          for (const msg of response.data.messages) {
            const fromId = msg.sender?._id || msg.fromUserId;
            const toId = msg.recipient?._id || msg.toUserId;

            // Determine status with promotion: if server says 'sent' but we already have 'read', keep 'read'
            const serverStatus: string = msg.isRead ? 'read' : 'sent';

            const localMsg: LocalDirectMessage = {
              id: msg.id || msg._id,
              local_id: msg.id || msg._id,
              from_user_id: fromId,
              to_user_id: toId,
              content: msg.content || msg.message,
              status: serverStatus as any,
              reply_to_id: msg.replyToId || msg.replyTo?._id || null,
              reply_to_text: msg.replyToText || msg.replyTo?.message || null,
              created_at: new Date(msg.createdAt).getTime(),
              synced: 1,
            };

            // saveDirectMessage uses INSERT OR REPLACE — but we need promotion semantics.
            // Check if the message already exists locally with a higher status.
            if (this.currentUserId) {
              const existingMessages = await sqliteService.getDirectMessages(this.currentUserId, friendId, 200);
              const existing = existingMessages.find(m => m.id === localMsg.id);
              if (existing) {
                // Only update if the new status is a promotion
                if (shouldPromote(existing.status, localMsg.status)) {
                  await sqliteService.promoteMessageStatus(localMsg.id, localMsg.status, 1);
                }
                // Skip saving the full message (would overwrite other fields)
                continue;
              }
            }

            await sqliteService.saveDirectMessage(localMsg);
            hasNewMessages = true;
          }

          if (hasNewMessages) {
            this.emit('messages_synced', friendId);
          }
        }
      } catch (err: any) {
        if (err.response?.status !== 403) {
          console.log('[MsgService] fetchAndMerge error:', err.message);
        }
      }
    })();

    this.fetchMessagesPromises.set(friendId, promise);
    try {
      await promise;
    } finally {
      this.fetchMessagesPromises.delete(friendId);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Conversations — SQLite-first, Background Server Sync
  // ═══════════════════════════════════════════════════════════

  async getConversations(): Promise<LocalConversation[]> {
    // SQLite is the single source of truth
    const cached = await sqliteService.getConversations();
    console.log('[MsgService] getConversations: returning', cached.length, 'cached conversations');

    // Background sync from server (debounced)
    this.fetchAndMergeConversationsDebounced();

    return cached;
  }

  private fetchAndMergeConversationsDebounced(): void {
    const now = Date.now();
    if (now - this.lastConversationsFetch < this.CONVERSATIONS_FETCH_COOLDOWN) {
      console.log('[MsgService] Debouncing conversation fetch, cooldown active');
      return;
    }
    this.lastConversationsFetch = now;
    console.log('[MsgService] Starting conversation fetch...');
    this.fetchAndMergeConversations().catch((err) => {
      console.warn('[MsgService] fetchAndMergeConversations failed:', err);
    });
  }

  async fetchAndMergeConversations(): Promise<void> {
    if (this.conversationsFetchPromise) return this.conversationsFetchPromise;

    this.conversationsFetchPromise = (async () => {
      try {
        console.log('[MsgService] Fetching conversations from server...');
        const response = await api.get('/direct-messages/conversations');
        console.log('[MsgService] Conversations response:', response.data);
        
        if (response.data.success && response.data.conversations) {
          const seenFriendIds = new Set<string>();

          for (const conv of response.data.conversations as any[]) {
            const friendId = conv.friend?.id || conv.friend?._id;
            if (!friendId || seenFriendIds.has(friendId)) continue;
            
            // Skip if I deleted this friend - don't re-create conversation
            if (this.deletedByMe.has(friendId)) {
              console.log('[MsgService] Skipping sync for deleted friend:', friendId);
              seenFriendIds.add(friendId);
              continue;
            }
            
            seenFriendIds.add(friendId);

            // Check existing local conversation for data we want to preserve
            const existing = (await sqliteService.getConversations()).find(c => c.friend_id === friendId);

            const localConv: LocalConversation = {
              friend_id: friendId,
              username: conv.friend.username,
              avatar: conv.friend.avatar || null,
              last_message: conv.lastMessage?.content || conv.lastMessage?.message || '',
              last_message_at: conv.lastMessage ? new Date(conv.lastMessage.createdAt).getTime() : 0,
              unread_count: conv.unreadCount || 0,
              is_online: existing?.is_online || 0, // Preserve local presence data
              updated_at: Date.now(),
              request_status: conv.requestStatus || existing?.request_status || 'none',
              request_id: conv.requestId || existing?.request_id || null,
            };
            await sqliteService.saveConversation(localConv);
          }

          // Clean up stale pending conversations not in server response
          const freshFriendIds = Array.from(seenFriendIds);
          const existingConvs = await sqliteService.getConversations();
          for (const oldConv of existingConvs) {
            if (!freshFriendIds.includes(oldConv.friend_id)) {
              if (oldConv.request_status?.startsWith('pending_')) {
                await sqliteService.deleteConversation(oldConv.friend_id);
              }
            }
          }

          console.log('[MsgService] Conversations synced, count:', seenFriendIds.size);
          this.emit('conversation:list');
        } else {
          console.log('[MsgService] No conversations in server response or success=false');
        }
      } catch (err: any) {
        console.error('[MsgService] fetchAndMergeConversations failed:', err?.message || err);
      }
    })();

    try {
      await this.conversationsFetchPromise;
    } finally {
      this.conversationsFetchPromise = null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Mark as Read — Batched, Idempotent, Permanent
  // ═══════════════════════════════════════════════════════════

  async markAsRead(friendId: string): Promise<void> {
    // Check if there are actually unread messages
    const convs = await sqliteService.getConversations();
    const conv = convs.find(c => c.friend_id === friendId);

    // If no conversation or already 0 unread, skip entirely
    if (!conv || conv.unread_count === 0) return;

    // Clear unread in SQLite immediately (permanent)
    await sqliteService.clearConversationUnread(friendId);

    // Mark all messages from friend as read locally (permanent — never downgraded)
    if (this.currentUserId) {
      await sqliteService.markMessagesReadFrom(friendId, this.currentUserId);
    }

    this.emit('conversation:list');

    // Batch the server-side read receipt
    this.readReceiptBatch.add(friendId);
    if (this.readReceiptTimeout) clearTimeout(this.readReceiptTimeout);
    this.readReceiptTimeout = setTimeout(() => {
      this.flushReadReceipts();
    }, 2000);
  }

  private async flushReadReceipts(): Promise<void> {
    const batch = Array.from(this.readReceiptBatch);
    this.readReceiptBatch.clear();
    if (batch.length === 0) return;

    await Promise.allSettled(
      batch.map(friendId =>
        api.put(`/direct-messages/read/${friendId}`).catch((err) => {
          console.warn('[MsgService] flushReadReceipts failed for', friendId, err);
        })
      )
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Friend Request Actions
  // ═══════════════════════════════════════════════════════════

  async sendFriendRequest(recipientId: string, content?: string): Promise<{ success: boolean; requestId?: string; error?: string }> {
    try {
      const response = await api.post('/friends/request', { recipientId, message: content });
      if (response.data.success) {
        const requestId = response.data.friendRequest?._id || response.data.friendRequest?.id;
        this.friendshipCache.set(recipientId, { isFriend: false, requestId, requestStatus: 'pending_sent' });
        // Clear from deleted list so sync will work properly
        this.deletedByMe.delete(recipientId);
        
        // Create local conversation immediately (pending_sent status)
        await this.ensureConversation(
          recipientId, 
          'User', // Will be updated when server responds
          null, 
          'Waiting for acceptance...', 
          Date.now(), 
          false, 
          'pending_sent', 
          requestId
        );
        this.emit('conversation:list');
        
        return { success: true, requestId };
      }
      return { success: false, error: response.data.message };
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to send request';
      if (msg.includes('Already friends')) {
        this.friendshipCache.set(recipientId, { isFriend: true, requestStatus: 'accepted' });
        // Create conversation as accepted
        await this.ensureConversation(
          recipientId, 
          'User', 
          null, 
          '', 
          Date.now(), 
          false, 
          'accepted'
        );
        this.emit('conversation:list');
        return { success: true };
      }
      if (msg.includes('already sent') || msg.includes('already exists')) {
        return { success: true };
      }
      return { success: false, error: msg };
    }
  }

  async acceptRequest(requestId: string, friendId: string): Promise<boolean> {
    try {
      const res = await api.put(`/friends/accept/${requestId}`);
      if (res.data.success) {
        this.friendshipCache.set(friendId, { isFriend: true, requestStatus: 'accepted' });
        await sqliteService.updateConversationRequestStatus(friendId, 'none');
        this.emit('conversation:list');
        return true;
      }
      return false;
    } catch { return false; }
  }

  async declineRequest(requestId: string, friendId: string): Promise<boolean> {
    try {
      const res = await api.put(`/friends/reject/${requestId}`);
      if (res.data.success) {
        this.friendshipCache.delete(friendId);
        await sqliteService.deleteConversation(friendId);
        if (this.currentUserId) {
          await sqliteService.deleteConversationMessages(this.currentUserId, friendId);
        }
        this.emit('conversation:list');
        return true;
      }
      return false;
    } catch { return false; }
  }

  async blockUser(friendId: string): Promise<boolean> {
    const convs = await sqliteService.getConversations();
    const conv = convs.find(c => c.friend_id === friendId);
    if (conv?.request_id) {
      await this.declineRequest(conv.request_id, friendId);
    }
    await sqliteService.deleteConversation(friendId);
    if (this.currentUserId) {
      await sqliteService.deleteConversationMessages(this.currentUserId, friendId);
    }
    this.friendshipCache.delete(friendId);
    this.emit('conversation:list');
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // Delete / Unfriend
  // ═══════════════════════════════════════════════════════════

  async deleteFriend(friendId: string): Promise<boolean> {
    try {
      await api.delete(`/friends/${friendId}`);
    } catch (err) {
      const status = (err as any)?.response?.status;
      if (status && status !== 404) {
        console.warn('[MsgService] Backend unfriend failed:', err);
      }
    }
    // Clear local data for this friend (initiator clears their side)
    await sqliteService.deleteConversation(friendId);
    if (this.currentUserId) {
      await sqliteService.deleteConversationMessages(this.currentUserId, friendId);
    }
    this.friendshipCache.delete(friendId);
    this.emit('conversation:list');
    this.emit('friend_removed', { friendId, initiatedByMe: true });
    return true;
  }

  async deleteConversation(friendId: string): Promise<void> {
    if (!this.currentUserId) return;
    await sqliteService.deleteConversationMessages(this.currentUserId, friendId);
    await sqliteService.deleteConversation(friendId);
    this.emit('conversation:list');

    try {
      await api.delete(`/direct-messages/${friendId}`);
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════
  // Message Requests
  // ═══════════════════════════════════════════════════════════

  async getMessageRequests(): Promise<MessageRequest[]> {
    const convs = await sqliteService.getConversations();
    return convs
      .filter(c => c.request_status === 'pending_received')
      .map(c => ({
        id: c.request_id || c.friend_id,
        friendId: c.friend_id,
        username: c.username,
        avatar: c.avatar,
        lastMessage: c.last_message,
        createdAt: c.last_message_at,
      }));
  }

  // ═══════════════════════════════════════════════════════════
  // Typing Indicator
  // ═══════════════════════════════════════════════════════════

  emitTyping(recipientId: string, isTyping: boolean): void {
    const now = Date.now();
    if (isTyping && now - this.lastTypingEmit < 3000) return;
    this.lastTypingEmit = now;

    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    syncEngine.emit('dm:typing', { recipientId, isTyping });
    if (isTyping) {
      this.typingTimeout = setTimeout(() => {
        syncEngine.emit('dm:typing', { recipientId, isTyping: false });
      }, 4000);
    }
  }

  // Public method to notify conversation list updates
  notifyConversationUpdate(): void {
    this.emit('conversation:list');
  }

  // ═══════════════════════════════════════════════════════════
  // Unread Count
  // ═══════════════════════════════════════════════════════════

  async getUnreadCount(): Promise<number> {
    const convs = await sqliteService.getConversations();
    return convs.reduce((sum, c) => {
      const isPendingReq = c.request_status === 'pending_received' ? 1 : 0;
      return sum + c.unread_count + isPendingReq;
    }, 0);
  }

  async getServerUnreadCount(): Promise<number> {
    try {
      const r = await api.get('/direct-messages/unread-count');
      return r.data.success ? r.data.unreadCount : 0;
    } catch { return 0; }
  }

  // ═══════════════════════════════════════════════════════════
  // Presence
  // ═══════════════════════════════════════════════════════════

  requestOnlineSnapshot(): void {
    // Request fresh online users list via syncEngine
    console.log('[MsgService] requestOnlineSnapshot called');
    try {
      const sync = syncEngine as any;
      if (sync.refreshOnlineUsers) {
        console.log('[MsgService] Calling syncEngine.refreshOnlineUsers');
        sync.refreshOnlineUsers();
      } else {
        console.log('[MsgService] refreshOnlineUsers not found on syncEngine');
      }
    } catch (err) {
      console.warn('[MsgService] requestOnlineSnapshot failed:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Friends / Search
  // ═══════════════════════════════════════════════════════════

  async getFriends(): Promise<FriendUser[]> {
    try {
      const response = await api.get('/friends');
      if (response.data.success) {
        const raw = response.data.friends || response.data.data || [];
        return raw.map((f: any) => ({
          id: f._id || f.id,
          username: f.username,
          avatar: f.avatar || null,
          isFriend: true,
          requestStatus: 'accepted' as const,
        }));
      }
      return [];
    } catch { return []; }
  }

  async searchUsers(query: string): Promise<FriendUser[]> {
    if (!query.trim() || query.trim().length < 2) return [];
    try {
      const response = await api.get('/friends/search', { params: { query } });
      if (response.data.success) {
        const users = (response.data.users || []).map((u: any) => ({
          id: u._id || u.id,
          username: u.username,
          avatar: u.avatar || null,
        }));

        // Enrich with friendship status from cache
        return users.map((u: FriendUser) => {
          const cached = this.friendshipCache.get(u.id);
          return {
            ...u,
            isFriend: cached?.isFriend || false,
            requestStatus: cached?.requestStatus || 'none',
            requestId: cached?.requestId || null,
          };
        });
      }
      return [];
    } catch { return []; }
  }

  // ═══════════════════════════════════════════════════════════
  // Offline Queue Flush
  // ═══════════════════════════════════════════════════════════

  async flushQueue(): Promise<void> {
    const pending = await sqliteService.getUnsyncedMessages();
    if (pending.length === 0) return;

    const net = await NetInfo.fetch();
    if (!net.isConnected) return;

    for (const msg of pending) {
      const friendship = this.friendshipCache.get(msg.to_user_id);
      if (!friendship?.isFriend) continue;

      try {
        const response = await api.post(`/direct-messages/${msg.to_user_id}`, {
          message: msg.content,
          replyTo: msg.reply_to_id || undefined,
        });

        if (response.data.success) {
          const srv = response.data.message;
          const serverId = srv.id || srv._id;
          await sqliteService.updateMessageId(msg.local_id, serverId);
          this.emit('message:status', { type: 'synced', localId: msg.local_id, serverId });
        }
      } catch {
        await sqliteService.promoteMessageStatus(msg.local_id, 'failed');
      }
    }
    this.emit('conversation:list');
  }

  private async flushQueueForFriend(friendId: string): Promise<void> {
    const pending = await sqliteService.getUnsyncedMessages();
    const forFriend = pending.filter(m => m.to_user_id === friendId);
    if (forFriend.length === 0) return;

    for (const msg of forFriend) {
      try {
        const response = await api.post(`/direct-messages/${friendId}`, {
          message: msg.content,
          replyTo: msg.reply_to_id || undefined,
        });

        if (response.data.success) {
          const srv = response.data.message;
          const serverId = srv.id || srv._id;
          await sqliteService.updateMessageId(msg.local_id, serverId);
          this.emit('message:status', { type: 'synced', localId: msg.local_id, serverId });
        }
      } catch {
        await sqliteService.promoteMessageStatus(msg.local_id, 'failed');
      }
    }
    this.emit('conversation:list');
  }
}

export default new MessageService();
