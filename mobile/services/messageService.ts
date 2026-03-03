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

// ═══════════════════════════════════════════════════════════
// MessageService — Offline-First + Message Request Flow
// ═══════════════════════════════════════════════════════════

class MessageService {
  private listeners = new Map<string, Set<Function>>();
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private isInitialized = false;
  private currentUserId: string | null = null;
  private unsubscribers: (() => void)[] = [];
  // Track friendship status in-memory for fast lookups
  private friendshipCache = new Map<string, { isFriend: boolean; requestId?: string; requestStatus: string }>();
  private memoryMessageCache = new Map<string, LocalDirectMessage[]>(); // web/offline fallback

  // ─── Lifecycle ───────────────────────────────────────────
  async initialize(userId: string): Promise<void> {
    if (this.isInitialized && this.currentUserId === userId) return;
    this.currentUserId = userId;
    this.setupSocketListeners();
    this.isInitialized = true;

    // Await friendship cache so getMessages() can sync correctly
    await this.loadFriendshipCache().catch(() => {});
    // Flush any queued offline messages
    this.flushQueue().catch(() => {});
  }

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

  private setupSocketListeners(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    // New message received
    this.unsubscribers.push(
      syncEngine.on('new_direct_message', async (data: ServerMessage) => {
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

        // Ensure conversation exists for the sender
        await this.ensureConversation(
          senderId,
          data.sender?.username || 'User',
          null,
          content,
          localMsg.created_at,
          true,
        );

        this.emit('message', localMsg);
        this.emit('conversations_updated');

        // Confirm delivery
        syncEngine.emit('dm:confirm_delivery', {
          senderId,
          messageIds: [localMsg.id],
        });
      })
    );

    // Typing
    this.unsubscribers.push(
      syncEngine.on('dm:typing', (data: { userId: string; username: string; isTyping: boolean }) => {
        this.emit('typing', data);
      })
    );

    // Read receipts
    this.unsubscribers.push(
      syncEngine.on('dm:read', async (data: { readBy: string; readAt: string }) => {
        if (this.currentUserId) {
          await sqliteService.markMessagesReadFrom(this.currentUserId, data.readBy);
        }
        this.emit('read', data);
      })
    );

    // Delivery confirmations
    this.unsubscribers.push(
      syncEngine.on('dm:delivered', async (data: { messageIds: string[]; deliveredAt: string }) => {
        for (const id of data.messageIds) {
          await sqliteService.updateMessageStatus(id, 'delivered', 1);
        }
        this.emit('delivered', data);
      })
    );

    // User online/offline
    this.unsubscribers.push(
      syncEngine.on('user:status', (data: { userId: string; isOnline: boolean }) => {
        sqliteService.updateConversationOnline(data.userId, data.isOnline).catch(() => {});
        this.emit('online_status', data);
      })
    );

    // Bulk online users
    this.unsubscribers.push(
      syncEngine.on('users:online', (userIds: string[]) => {
        this.emit('online_users', userIds);
      })
    );

    // ─── Friend Request Events ──────────────────────────────
    // Received a friend request from someone
    this.unsubscribers.push(
      syncEngine.on('friend:request', async (data: { request: any; requester: any }) => {
        const requesterId = data.requester?._id || data.requester?.id;
        const username = data.requester?.username || 'User';
        const requestId = data.request?._id || data.request?.id;

        // Create/update conversation as incoming request
        await this.ensureConversation(
          requesterId, username, null,
          'Sent you a message request', Date.now(),
          true, 'pending_received', requestId,
        );

        this.friendshipCache.set(requesterId, { isFriend: false, requestId, requestStatus: 'pending_received' });
        this.emit('message_request', { friendId: requesterId, username, requestId });
        this.emit('conversations_updated');
      })
    );

    // Friend request accepted — can now send queued messages
    this.unsubscribers.push(
      syncEngine.on('friend:accepted', async (data: { friend: any }) => {
        const friendId = data.friend?._id || data.friend?.id;
        if (!friendId) return;

        this.friendshipCache.set(friendId, { isFriend: true, requestStatus: 'accepted' });
        await sqliteService.updateConversationRequestStatus(friendId, 'none');

        // Flush any queued messages for this friend
        this.flushQueueForFriend(friendId).catch(() => {});
        this.emit('request_accepted', friendId);
        this.emit('conversations_updated');
      })
    );

    // Friend removed
    this.unsubscribers.push(
      syncEngine.on('friend:removed', async (data: { friendId: string }) => {
        this.friendshipCache.delete(data.friendId);
        this.emit('friend_removed', data.friendId);
        this.emit('conversations_updated');
      })
    );
  }

  // ─── Ensure Conversation Exists (core persistence fix) ──
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

    if (existing) {
      await sqliteService.saveConversation({
        ...existing,
        username: username || existing.username,
        avatar: avatar || existing.avatar,
        last_message: lastMessage,
        last_message_at: timestamp,
        unread_count: incrementUnread ? existing.unread_count + 1 : existing.unread_count,
        updated_at: timestamp,
        request_status: requestStatus !== undefined ? requestStatus : existing.request_status,
        request_id: requestId !== undefined ? requestId : existing.request_id,
      });
    } else {
      await sqliteService.saveConversation({
        friend_id: friendId,
        username,
        avatar,
        last_message: lastMessage,
        last_message_at: timestamp,
        unread_count: incrementUnread ? 1 : 0,
        is_online: 0,
        updated_at: timestamp,
        request_status: requestStatus || 'none',
        request_id: requestId || null,
      });
    }
  }

  // ─── Check Friendship ──────────────────────────────────
  async checkFriendship(friendId: string): Promise<{ isFriend: boolean; requestStatus: string; requestId?: string }> {
    // Check cache first
    const cached = this.friendshipCache.get(friendId);
    if (cached) return cached;

    // Check server
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

  // ─── Send Friend Request ───────────────────────────────
  async sendFriendRequest(recipientId: string): Promise<{ success: boolean; requestId?: string; error?: string }> {
    try {
      const response = await api.post('/friends/request', { recipientId });
      if (response.data.success) {
        const requestId = response.data.friendRequest?._id || response.data.friendRequest?.id;
        this.friendshipCache.set(recipientId, { isFriend: false, requestId, requestStatus: 'pending_sent' });
        return { success: true, requestId };
      }
      return { success: false, error: response.data.message };
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to send request';
      // "Already friends" means we can just send the message
      if (msg.includes('Already friends')) {
        this.friendshipCache.set(recipientId, { isFriend: true, requestStatus: 'accepted' });
        return { success: true };
      }
      // "already sent" is also fine
      if (msg.includes('already sent') || msg.includes('already exists')) {
        return { success: true };
      }
      return { success: false, error: msg };
    }
  }

  // ─── Accept / Decline / Block ─────────────────────────
  async acceptRequest(requestId: string, friendId: string): Promise<boolean> {
    try {
      const res = await api.put(`/friends/accept/${requestId}`);
      if (res.data.success) {
        this.friendshipCache.set(friendId, { isFriend: true, requestStatus: 'accepted' });
        await sqliteService.updateConversationRequestStatus(friendId, 'none');
        this.emit('conversations_updated');
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
        this.emit('conversations_updated');
        return true;
      }
      return false;
    } catch { return false; }
  }

  async blockUser(friendId: string): Promise<boolean> {
    // For now, decline + remove from local
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
    this.emit('conversations_updated');
    return true;
  }

  // ── Delete/Unfriend ─────────────────────────────────────
  async deleteFriend(friendId: string): Promise<boolean> {
    try {
      await api.delete(`/friends/${friendId}`);
    } catch (err) {
      console.warn('[MessageService] Backend unfriend failed:', err);
    }
    await sqliteService.deleteConversation(friendId);
    if (this.currentUserId) {
      await sqliteService.deleteConversationMessages(this.currentUserId, friendId);
    }
    this.friendshipCache.delete(friendId);
    this.memoryConversationCache = this.memoryConversationCache.filter(c => c.friend_id !== friendId);
    const memKey = `${this.currentUserId}:${friendId}`;
    this.memoryMessageCache.delete(memKey);
    this.emit('conversations_updated');
    this.emit('friend_removed', friendId);
    return true;
  }

  // ─── Send Message (Offline-First + Auto Friend Request) ─
  async sendMessage(
    friendId: string,
    content: string,
    friendUsername: string,
    friendAvatar: string | null,
    replyTo?: { id: string; text: string },
  ): Promise<LocalDirectMessage> {
    if (!this.currentUserId) throw new Error('MessageService not initialized');

    const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    // 1. Save message locally IMMEDIATELY (optimistic)
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

    // Also update memory cache for web fallback
    const memKey = `${this.currentUserId}:${friendId}`;
    const existing = this.memoryMessageCache.get(memKey) || [];
    this.memoryMessageCache.set(memKey, [...existing, localMsg]);

    // 2. Ensure conversation exists locally IMMEDIATELY
    await this.ensureConversation(friendId, friendUsername, friendAvatar, content, now, false);

    // 3. Notify UI right away
    this.emit('message_sent', localMsg);
    this.emit('conversations_updated');

    // 4. Send to server in background (don't await — keep UI fast)
    this.sendToServer(localMsg, friendId, content, replyTo).catch(() => {});

    return localMsg;
  }

  private async sendToServer(
    localMsg: LocalDirectMessage,
    friendId: string,
    content: string,
    replyTo?: { id: string; text: string },
  ): Promise<void> {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return; // Will be flushed later

    // Check friendship status
    let friendship = await this.checkFriendship(friendId);

    if (!friendship.isFriend && friendship.requestStatus !== 'pending_sent') {
      // Auto-send friend request first
      const reqResult = await this.sendFriendRequest(friendId);
      if (!reqResult.success) {
        if (reqResult.error && !reqResult.error.includes('Already friends')) {
          await sqliteService.updateMessageStatus(localMsg.local_id, 'failed');
          this.emit('message_failed', localMsg.local_id);
          return;
        }
      }

      // Re-read from cache — sendFriendRequest may have set isFriend=true (Already friends case)
      friendship = this.friendshipCache.get(friendId) || friendship;

      // Update conversation to show pending status
      if (!friendship.isFriend && reqResult.requestId) {
        await sqliteService.updateConversationRequestStatus(friendId, 'pending_sent', reqResult.requestId);
        this.emit('conversations_updated');
      }
    }

    // If we're friends, send the message to server
    if (friendship.isFriend || friendship.requestStatus === 'accepted') {
      try {
        const response = await api.post(`/direct-messages/${friendId}`, {
          message: content,
          replyTo: replyTo?.id || undefined,
        });

        if (response.data.success) {
          const srv = response.data.message;
          const serverId = srv.id || srv._id;
          await sqliteService.updateMessageId(localMsg.local_id, serverId);
          this.emit('message_synced', { localId: localMsg.local_id, serverId });
        }
      } catch (error: any) {
        // 403 = not friends yet, mark as queued (will be sent when accepted)
        if (error.response?.status === 403) {
          await sqliteService.updateMessageStatus(localMsg.local_id, 'sending');
        } else {
          await sqliteService.updateMessageStatus(localMsg.local_id, 'failed');
          this.emit('message_failed', localMsg.local_id);
        }
      }
    }
    // If pending_sent, message stays in 'sending' state, will flush when accepted
  }

  // ─── Retry Failed Message ──────────────────────────────
  async retryMessage(localId: string, friendId: string, content: string, replyToId?: string | null): Promise<void> {
    await sqliteService.updateMessageStatus(localId, 'sending');
    this.emit('message_retry', localId);

    try {
      const response = await api.post(`/direct-messages/${friendId}`, {
        message: content,
        replyTo: replyToId || undefined,
      });

      if (response.data.success) {
        const srv = response.data.message;
        const serverId = srv.id || srv._id;
        await sqliteService.updateMessageId(localId, serverId);
        this.emit('message_synced', { localId, serverId });
      }
    } catch (error) {
      await sqliteService.updateMessageStatus(localId, 'failed');
      this.emit('message_failed', localId);
    }
  }

  // ─── Get Messages (server-first, with cache fallback) ───────
  async getMessages(friendId: string, before?: number): Promise<LocalDirectMessage[]> {
    if (!this.currentUserId) return [];

    // Fetch from server and merge into SQLite (or memory cache on web)
    try {
      await this.fetchAndMergeMessages(friendId);
    } catch {}

    // Try SQLite (native) — returns [] on web
    const cached = await sqliteService.getDirectMessages(this.currentUserId, friendId, 50, before);
    if (cached.length > 0) return cached;

    // Web fallback: return in-memory cache built during fetchAndMergeMessages
    const memKey = `${this.currentUserId}:${friendId}`;
    return this.memoryMessageCache.get(memKey) || [];
  }

  private async fetchAndMergeMessages(friendId: string): Promise<void> {
    // Check friendship — but don't skip if cache is empty (may not be loaded yet)
    const friendship = this.friendshipCache.get(friendId);
    if (friendship && !friendship.isFriend && friendship.requestStatus !== 'accepted') return;

    try {
      const response = await api.get(`/direct-messages/${friendId}`);
      if (response.data.success && response.data.messages) {
        const memMessages: LocalDirectMessage[] = [];
        for (const msg of response.data.messages) {
          // Backend returns: sender._id, recipient._id, isRead (not fromUserId/toUserId)
          const fromId = msg.sender?._id || msg.fromUserId;
          const toId = msg.recipient?._id || msg.toUserId;

          const localMsg: LocalDirectMessage = {
            id: msg.id || msg._id,
            local_id: msg.id || msg._id,
            from_user_id: fromId,
            to_user_id: toId,
            content: msg.content || msg.message,
            status: msg.isRead ? 'read' : 'sent',
            reply_to_id: msg.replyToId || msg.replyTo?._id || null,
            reply_to_text: msg.replyToText || msg.replyTo?.message || null,
            created_at: new Date(msg.createdAt).getTime(),
            synced: 1,
          };
          await sqliteService.saveDirectMessage(localMsg);
          memMessages.push(localMsg);
        }
        // Store in memory cache for web/offline fallback (SQLite is no-op on web)
        if (this.currentUserId) {
          const memKey = `${this.currentUserId}:${friendId}`;
          this.memoryMessageCache.set(memKey, memMessages);
        }
        this.emit('messages_synced', friendId);
      }
    } catch (err) {
      console.log('fetchAndMergeMessages error:', err);
    }
  }

  // ─── Conversations (cache-first) ───────────────────────
  // In-memory conversation cache for web (SQLite is no-op on web)
  private memoryConversationCache: LocalConversation[] = [];

  async getConversations(): Promise<LocalConversation[]> {
    // Try SQLite first (native) — returns [] on web
    const cached = await sqliteService.getConversations();
    if (cached.length > 0) {
      this.memoryConversationCache = cached;
      // Background sync
      this.fetchAndMergeConversations().catch(() => {});
      return cached;
    }
    // Web fallback: if memory cache has data return it, else await server fetch
    if (this.memoryConversationCache.length > 0) {
      this.fetchAndMergeConversations().catch(() => {});
      return this.memoryConversationCache;
    }
    // First load: await server fetch
    await this.fetchAndMergeConversations().catch(() => {});
    return this.memoryConversationCache;
  }

  async fetchAndMergeConversations(): Promise<void> {
    try {
      const response = await api.get('/direct-messages/conversations');
      if (response.data.success && response.data.conversations) {
        const freshConvs: LocalConversation[] = [];
        for (const conv of response.data.conversations as any[]) {
          const friendId = conv.friend?.id || conv.friend?._id;
          if (!friendId) continue;

          // Check if we already have a local conversation
          const existing = (await sqliteService.getConversations()).find(c => c.friend_id === friendId)
            || this.memoryConversationCache.find(c => c.friend_id === friendId);

          const localConv: LocalConversation = {
            friend_id: friendId,
            username: conv.friend.username,
            avatar: conv.friend.avatar || null,
            last_message: conv.lastMessage?.content || conv.lastMessage?.message || '',
            last_message_at: conv.lastMessage ? new Date(conv.lastMessage.createdAt).getTime() : 0,
            unread_count: conv.unreadCount || 0,
            is_online: existing?.is_online || 0,
            updated_at: Date.now(),
            request_status: existing?.request_status || 'none',
            request_id: existing?.request_id || null,
          };
          await sqliteService.saveConversation(localConv);
          freshConvs.push(localConv);
        }
        // Update memory cache (web fallback)
        this.memoryConversationCache = freshConvs;
        this.emit('conversations_updated');
      }
    } catch {}
  }

  // ─── Get Message Requests (incoming) ───────────────────
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

  // ─── Mark as Read ──────────────────────────────────────
  async markAsRead(friendId: string): Promise<void> {
    await sqliteService.clearConversationUnread(friendId);
    this.emit('conversations_updated');

    try {
      await api.put(`/direct-messages/read/${friendId}`);
    } catch {}
  }

  // ─── Delete Conversation ───────────────────────────────
  async deleteConversation(friendId: string): Promise<void> {
    if (!this.currentUserId) return;
    await sqliteService.deleteConversationMessages(this.currentUserId, friendId);
    await sqliteService.deleteConversation(friendId);
    this.emit('conversations_updated');

    try {
      await api.delete(`/direct-messages/${friendId}`);
    } catch {}
  }

  // ─── Typing Indicator ─────────────────────────────────
  emitTyping(recipientId: string, isTyping: boolean): void {
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    syncEngine.emit('dm:typing', { recipientId, isTyping });
    if (isTyping) {
      this.typingTimeout = setTimeout(() => {
        syncEngine.emit('dm:typing', { recipientId, isTyping: false });
      }, 5000);
    }
  }

  // ─── Unread Count ──────────────────────────────────────
  async getUnreadCount(): Promise<number> {
    return sqliteService.getTotalUnreadCount();
  }

  async getServerUnreadCount(): Promise<number> {
    try {
      const r = await api.get('/direct-messages/unread-count');
      return r.data.success ? r.data.unreadCount : 0;
    } catch { return 0; }
  }

  // ─── Friends / Search ──────────────────────────────────
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

  // ─── Flush Offline Queue ───────────────────────────────
  async flushQueue(): Promise<void> {
    const pending = await sqliteService.getUnsyncedMessages();
    if (pending.length === 0) return;

    const net = await NetInfo.fetch();
    if (!net.isConnected) return;

    for (const msg of pending) {
      const friendship = this.friendshipCache.get(msg.to_user_id);
      // Only flush if we're friends
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
          this.emit('message_synced', { localId: msg.local_id, serverId });
        }
      } catch {
        await sqliteService.updateMessageStatus(msg.local_id, 'failed');
      }
    }
    this.emit('conversations_updated');
  }

  // Flush only messages queued for a specific friend (called when friendship accepted)
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
          this.emit('message_synced', { localId: msg.local_id, serverId });
        }
      } catch {
        await sqliteService.updateMessageStatus(msg.local_id, 'failed');
      }
    }
    this.emit('conversations_updated');
  }

  // ─── Event Bus ─────────────────────────────────────────
  on(event: string, handler: Function): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => { this.listeners.get(event)?.delete(handler); };
  }

  private emit(event: string, data?: any): void {
    this.listeners.get(event)?.forEach(h => h(data));
  }

  // ─── Cleanup ───────────────────────────────────────────
  disconnect(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.listeners.clear();
    this.friendshipCache.clear();
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.isInitialized = false;
    this.currentUserId = null;
  }
}

export default new MessageService();
