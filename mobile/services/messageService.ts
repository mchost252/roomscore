import api from './api';
import sqliteService, { LocalDirectMessage, LocalConversation } from './sqliteService';
import syncEngine from './syncEngine';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  // Batching for read receipts
  private readReceiptBatch: Set<string> = new Set();
  private readReceiptTimeout: ReturnType<typeof setTimeout> | null = null;
  // Debounce for conversations fetch
  private conversationsFetchPromise: Promise<void> | null = null;
  private lastConversationsFetch = 0;
  private readonly CONVERSATIONS_FETCH_COOLDOWN = 5000; // 5 seconds

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

        // Determine the actual friend's ID and username (might be sender or recipient)
        const isFromMe = senderId === this.currentUserId;
        const friendId = isFromMe ? recipientId : senderId;
        const friendUsername = isFromMe 
          ? (data.recipient?.username || 'User') 
          : (data.sender?.username || 'User');

        // Ensure conversation exists for the friend
        await this.ensureConversation(
          friendId,
          friendUsername,
          null,
          content,
          localMsg.created_at,
          !isFromMe, // Only increment unread if we didn't send it
        );

        // Update memory cache
        if (this.currentUserId) {
          const memKey = `${this.currentUserId}:${friendId}`;
          const existing = this.memoryMessageCache.get(memKey) || [];
          this.memoryMessageCache.set(memKey, [...existing, localMsg]);
        }

        // Update conversations list in background (don't block)
        this.fetchAndMergeConversations().catch(() => {});
        
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
        // Web fallback: keep memory cache in sync
        this.memoryConversationCache = this.memoryConversationCache.map(c =>
          c.friend_id === data.userId ? { ...c, is_online: data.isOnline ? 1 : 0 } : c
        );
        this.emit('online_status', data);
      })
    );

    // Bulk online users
    this.unsubscribers.push(
      syncEngine.on('users:online', (userIds: string[]) => {
        const setIds = new Set(userIds);
        this.memoryConversationCache = this.memoryConversationCache.map(c => ({
          ...c,
          is_online: setIds.has(c.friend_id) ? 1 : 0,
        }));
        this.emit('online_users', userIds);
      })
    );

    // ─── Friend Request Events ──────────────────────────────
    // Received a friend request from someone
    this.unsubscribers.push(
      syncEngine.on('friend:request', async (data: { request: any; requester: any; message?: string }) => {
        const requesterId = data.requester?._id || data.requester?.id;
        const username = data.requester?.username || 'User';
        const requestId = data.request?._id || data.request?.id;
        const messageContent = data.message || 'Sent you a message request';

        // Create/update conversation as incoming request
        await this.ensureConversation(
          requesterId, username, null,
          messageContent, Date.now(),
          true, 'pending_received', requestId,
        );

        this.friendshipCache.set(requesterId, { isFriend: false, requestId, requestStatus: 'pending_received' });
        this.emit('message_request', { friendId: requesterId, username, requestId, message: messageContent });
        this.emit('conversations_updated');
      })
    );

    // We sent a friend request (confirmation from server)
    this.unsubscribers.push(
      syncEngine.on('friend:request_sent', async (data: { request: any; recipientId: string; recipientUsername: string }) => {
        const recipientId = data.recipientId;
        const requestId = data.request?._id || data.request?.id;
        
        // Update conversation to show pending_sent status
        this.friendshipCache.set(recipientId, { isFriend: false, requestId, requestStatus: 'pending_sent' });
        await this.ensureConversation(
          recipientId, data.recipientUsername, null,
          'Waiting for acceptance...', Date.now(),
          false, 'pending_sent', requestId,
        );
        
        this.emit('conversations_updated');
      })
    );

    // Friend request accepted — can now send queued messages
    this.unsubscribers.push(
      syncEngine.on('friend:accepted', async (data: { friend: any }) => {
        const friendId = data.friend?._id || data.friend?.id;
        const username = data.friend?.username || 'User';
        if (!friendId) return;

        this.friendshipCache.set(friendId, { isFriend: true, requestStatus: 'accepted' });
        await sqliteService.updateConversationRequestStatus(friendId, 'none');
        
        // Also update memory cache
        const memIndex = this.memoryConversationCache.findIndex(c => c.friend_id === friendId);
        if (memIndex >= 0) {
          this.memoryConversationCache[memIndex].request_status = 'accepted';
          this.memoryConversationCache[memIndex].username = username;
        }

        // Flush any queued messages for this friend
        this.flushQueueForFriend(friendId).catch(() => {});
        this.emit('request_accepted', friendId);
        this.emit('conversations_updated');
      })
    );

    // Friend removed (received from socket when someone deletes us)
    this.unsubscribers.push(
      syncEngine.on('friend:removed', async (data: { friendId: string }) => {
        const { friendId } = data;
        
        // Remove friendship from cache
        this.friendshipCache.delete(friendId);
        
        // Don't delete the entire conversation on the receiver's end, just update status and clear messages
        if (this.currentUserId) {
          // Clear messages from SQLite
          await sqliteService.deleteConversationMessages(this.currentUserId, friendId);
          // Clear memory message cache
          this.memoryMessageCache.delete(`${this.currentUserId}:${friendId}`);
        }

        // Update the conversation status to 'removed' instead of deleting it
        const convs = await this.getConversations();
        const conv = convs.find(c => c.friend_id === friendId);
        if (conv) {
          await this.ensureConversation(
            friendId,
            conv.username,
            conv.avatar,
            '', // Clear last message preview
            Date.now(),
            false,
            'removed',
            null
          );
        }
        
        // Notify UI
        this.emit('friend_removed', friendId);
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
    
    // Determine status - default to pending_sent if not provided and not already a friend
    const finalStatus = requestStatus !== undefined 
      ? requestStatus 
      : (existing?.request_status || 'none');

    if (existing) {
      const updatedConv = {
        ...existing,
        username: username || existing.username,
        avatar: avatar || existing.avatar,
        last_message: lastMessage,
        last_message_at: timestamp,
        unread_count: incrementUnread ? existing.unread_count + 1 : existing.unread_count,
        updated_at: timestamp,
        request_status: finalStatus,
        request_id: requestId !== undefined ? requestId : existing.request_id,
      };
      await sqliteService.saveConversation(updatedConv);
      
      // Also update memory cache (web support)
      const memIndex = this.memoryConversationCache.findIndex(c => c.friend_id === friendId);
      if (memIndex >= 0) {
        this.memoryConversationCache[memIndex] = updatedConv;
      } else {
        this.memoryConversationCache.push(updatedConv);
      }
      if (this.currentUserId) {
        AsyncStorage.setItem(`web_conv_cache_${this.currentUserId}`, JSON.stringify(this.memoryConversationCache)).catch(()=>{});
      }
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

    // Also update memory cache (web support)
    this.memoryConversationCache.push(newConv);
    if (this.currentUserId) {
      AsyncStorage.setItem(`web_conv_cache_${this.currentUserId}`, JSON.stringify(this.memoryConversationCache)).catch(()=>{});
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
  async sendFriendRequest(recipientId: string, content?: string): Promise<{ success: boolean; requestId?: string; error?: string }> {
    try {
      const response = await api.post('/friends/request', { recipientId, message: content });
      if (response.data.success) {
        const requestId = response.data.friendRequest?._id || response.data.friendRequest?.id;
        this.friendshipCache.set(recipientId, { isFriend: false, requestId, requestStatus: 'pending_sent' });
        return { success: true, requestId };
      }
      return { success: false, error: response.data.message };
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to send request';
      if (msg.includes('Already friends')) {
        this.friendshipCache.set(recipientId, { isFriend: true, requestStatus: 'accepted' });
        return { success: true };
      }
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
        
        const memIndex = this.memoryConversationCache.findIndex(c => c.friend_id === friendId);
        if (memIndex >= 0) {
          this.memoryConversationCache[memIndex].request_status = 'none';
        }
        
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
        this.memoryConversationCache = this.memoryConversationCache.filter(c => c.friend_id !== friendId);
        this.emit('conversations_updated');
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
    this.memoryConversationCache = this.memoryConversationCache.filter(c => c.friend_id !== friendId);
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

    // 2. Check friendship status and set pending status IMMEDIATELY if not friends
    const friendship = await this.checkFriendship(friendId);
    const isPending = !friendship.isFriend && friendship.requestStatus !== 'accepted';
    
    // 2. Ensure conversation exists locally IMMEDIATELY with correct pending status
    await this.ensureConversation(
      friendId, 
      friendUsername, 
      friendAvatar, 
      content, 
      now, 
      false,
      isPending ? 'pending_sent' : 'accepted'  // Set pending immediately if not friends
    );

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
    replyTo?: { id: string; text: string }
  ) {
    let friendship = this.friendshipCache.get(friendId);
    if (!friendship) {
      friendship = await this.checkFriendship(friendId);
    }

    // If not friends, send a friend request FIRST with the message attached
    if (!friendship.isFriend && friendship.requestStatus !== 'accepted') {
      const reqResult = await this.sendFriendRequest(friendId, content);
      if (reqResult.success) {
        // Re-read from cache — sendFriendRequest may have set isFriend=true (Already friends case)
        friendship = this.friendshipCache.get(friendId) || friendship;

        // Update conversation to show pending status immediately
        if (!friendship.isFriend) {
          // Get conversation from cache for username
          const convs = await sqliteService.getConversations();
          const conv = convs.find(c => c.friend_id === friendId);
          const memConv = this.memoryConversationCache.find(c => c.friend_id === friendId);
          const username = conv?.username || memConv?.username || 'User';
          
          await this.ensureConversation(friendId, username, null, content, localMsg.created_at, false, 'pending_sent', reqResult.requestId || undefined);
          this.emit('conversations_updated');
        }
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
          
          // Also update memory cache
          const memKey = `${this.currentUserId}:${friendId}`;
          const cached = this.memoryMessageCache.get(memKey) || [];
          const updated = cached.map(m => m.local_id === localMsg.local_id ? { ...m, id: serverId, synced: 1 } : m);
          this.memoryMessageCache.set(memKey, updated);

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

  // ─── Get Messages (cache-first for instant load, background sync) ───────
  async getMessages(friendId: string, before?: number): Promise<LocalDirectMessage[]> {
    if (!this.currentUserId) return [];

    // Check friendship early: if not accepted, return empty (avoid 403 spam)
    const friendship = this.friendshipCache.get(friendId);
    if (friendship && !friendship.isFriend && friendship.requestStatus !== 'accepted') {
      return [];
    }

    // Try cache FIRST - check both SQLite AND memory cache (web uses memory)
    const memKey = `${this.currentUserId}:${friendId}`;
    const cachedSQLite = await sqliteService.getDirectMessages(this.currentUserId, friendId, 50, before);
    const cachedMemory = this.memoryMessageCache.get(memKey) || [];
    
    // Use whichever cache has data
    const cached = cachedSQLite.length > 0 ? cachedSQLite : cachedMemory;
    
    // If we have cache, return it immediately and sync in background
    if (cached.length > 0) {
      this.fetchAndMergeMessages(friendId).catch(() => {});
      return cached;
    }

    // No cache: await server fetch (first load only)
    try {
      await this.fetchAndMergeMessages(friendId);
    } catch {}

    // Return whatever we got from server (stored in memory cache)
    return this.memoryMessageCache.get(memKey) || [];
  }


  private fetchMessagesPromises = new Map<string, Promise<void>>();

  private async fetchAndMergeMessages(friendId: string): Promise<void> {
    // Check friendship — but don't skip if cache is empty (may not be loaded yet)
    const friendship = this.friendshipCache.get(friendId);
    if (friendship && !friendship.isFriend && friendship.requestStatus !== 'accepted') return;

    // Deduplicate concurrent fetch requests for the same friend
    if (this.fetchMessagesPromises.has(friendId)) {
      return this.fetchMessagesPromises.get(friendId);
    }

    const promise = (async () => {
      try {
        // Delta Sync: get last message ID from local DB to fetch only new messages
        let lastId: string | undefined;
        if (this.currentUserId) {
          const localMessages = await sqliteService.getDirectMessages(this.currentUserId, friendId, 1);
          if (localMessages.length > 0) {
            lastId = localMessages[localMessages.length - 1].id;
          }
        }

        const response = await api.get(`/direct-messages/${friendId}`, {
          params: lastId ? { last_id: lastId } : undefined,
        });
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
          
          // MERGE with existing messages instead of replacing (fixes disappearing messages)
          if (this.currentUserId) {
            const memKey = `${this.currentUserId}:${friendId}`;
            const existing = this.memoryMessageCache.get(memKey) || [];
            // Get IDs of existing messages to avoid duplicates
            const existingIds = new Set(existing.map(m => m.id));
            // Keep all existing messages, add only new ones that aren't duplicates
            const merged = [...existing];
            for (const msg of memMessages) {
              if (!existingIds.has(msg.id)) {
                merged.push(msg);
              }
            }
            // Sort by timestamp
            merged.sort((a, b) => a.created_at - b.created_at);
            this.memoryMessageCache.set(memKey, merged);
          }
          this.emit('messages_synced', friendId);
        }
      } catch (err: any) {
        if (err.response?.status === 403) {
          // Expected when checking a non-friend (e.g. before sending a request)
          // Do not log a scary error
        } else {
          console.log('fetchAndMergeMessages error:', err.message);
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

  // ─── Conversations (cache-first) ───────────────────────
  // In-memory conversation cache for web (SQLite is no-op on web)
  private memoryConversationCache: LocalConversation[] = [];
  private hasLoadedConversations = false;

  async getConversations(): Promise<LocalConversation[]> {
    // Try SQLite first (native) — returns [] on web
    const cached = await sqliteService.getConversations();
    if (cached.length > 0) {
      this.memoryConversationCache = cached;
      this.hasLoadedConversations = true;
      // Background sync with debounce
      this.fetchAndMergeConversationsDebounced();
      return cached;
    }
    
    // Web fallback: if memory cache has data, OR if we have already loaded and know it's empty
    if (this.memoryConversationCache.length > 0 || this.hasLoadedConversations) {
      this.fetchAndMergeConversationsDebounced();
      return this.memoryConversationCache;
    }

    // Web fallback: check AsyncStorage for persisted web cache
    if (this.currentUserId) {
      try {
        const stored = await AsyncStorage.getItem(`web_conv_cache_${this.currentUserId}`);
        if (stored) {
          this.memoryConversationCache = JSON.parse(stored);
          this.hasLoadedConversations = true;
          this.fetchAndMergeConversationsDebounced();
          return this.memoryConversationCache;
        }
      } catch (e) {}
    }
    
    // First load: await server fetch
    await this.fetchAndMergeConversations().catch(() => {});
    return this.memoryConversationCache;
  }

  private fetchAndMergeConversationsDebounced(): void {
    const now = Date.now();
    if (now - this.lastConversationsFetch < this.CONVERSATIONS_FETCH_COOLDOWN) return;
    
    this.lastConversationsFetch = now;
    this.fetchAndMergeConversations().catch(() => {});
  }

  async fetchAndMergeConversations(): Promise<void> {
    if (this.conversationsFetchPromise) return this.conversationsFetchPromise;

    this.conversationsFetchPromise = (async () => {
      try {
        const response = await api.get('/direct-messages/conversations');
        if (response.data.success && response.data.conversations) {
          const freshConvs: LocalConversation[] = [];
          const seenFriendIds = new Set<string>();
          for (const conv of response.data.conversations as any[]) {
            const friendId = conv.friend?.id || conv.friend?._id;
            if (!friendId || seenFriendIds.has(friendId)) {
              console.log('[Conversations] Skipping duplicate:', friendId, conv.requestStatus);
              continue;
            }
            seenFriendIds.add(friendId);

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
              // Use server-provided request status to ensure correctness
              request_status: conv.requestStatus || existing?.request_status || 'none',
              request_id: conv.requestId || existing?.request_id || null,
            };
            await sqliteService.saveConversation(localConv);
            freshConvs.push(localConv);
          }
          
          // Clean up: remove any stale conversations not in the fresh list
          const freshFriendIds = freshConvs.map(c => c.friend_id);
          const existingConvs = await sqliteService.getConversations();
          for (const oldConv of existingConvs) {
            if (!freshFriendIds.includes(oldConv.friend_id)) {
              // Only delete if it's an old pending request that's no longer valid
              if (oldConv.request_status?.startsWith('pending_')) {
                await sqliteService.deleteConversation(oldConv.friend_id);
              }
            }
          }
          
          // Update memory cache (web fallback)
          this.memoryConversationCache = freshConvs;
          if (this.currentUserId) {
            AsyncStorage.setItem(`web_conv_cache_${this.currentUserId}`, JSON.stringify(freshConvs)).catch(()=>{});
          }
          this.hasLoadedConversations = true;
          this.emit('conversations_updated');
        }
      } catch {}
    })();

    try {
      await this.conversationsFetchPromise;
    } finally {
      this.conversationsFetchPromise = null;
    }
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

  // ─── Mark as Read (Batched) ────────────────────────────
  async markAsRead(friendId: string): Promise<void> {
    // Check if there are actually unread messages to prevent spamming API
    const convs = await this.getConversations();
    const conv = convs.find(c => c.friend_id === friendId);
    
    // If no conversation or already 0 unread, don't do anything
    if (!conv || conv.unread_count === 0) return;

    await sqliteService.clearConversationUnread(friendId);
    
    // Also clear from memory cache
    const memIndex = this.memoryConversationCache.findIndex(c => c.friend_id === friendId);
    if (memIndex >= 0) {
      this.memoryConversationCache[memIndex].unread_count = 0;
    }

    this.emit('conversations_updated');

    // Add to batch queue
    this.readReceiptBatch.add(friendId);

    // Cancel existing timeout
    if (this.readReceiptTimeout) {
      clearTimeout(this.readReceiptTimeout);
    }

    // Send batch after 2 seconds (collect multiple reads)
    this.readReceiptTimeout = setTimeout(() => {
      this.flushReadReceipts();
    }, 2000);
  }

  private async flushReadReceipts(): Promise<void> {
    const batch = Array.from(this.readReceiptBatch);
    this.readReceiptBatch.clear();

    if (batch.length === 0) return;

    // Send batched read receipts in parallel
    await Promise.allSettled(
      batch.map(friendId => 
        api.put(`/direct-messages/read/${friendId}`).catch(() => {})
      )
    );
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
  private lastTypingEmit = 0;
  emitTyping(recipientId: string, isTyping: boolean): void {
    // Debounce typing events - only emit if different from last state or after 3 seconds
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

  // ─── Unread Count ──────────────────────────────────────
  async getUnreadCount(): Promise<number> {
    const convs = await this.getConversations();
    // Sum standard unread messages + count any pending_received requests as unread
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
    if (this.readReceiptTimeout) clearTimeout(this.readReceiptTimeout);
    this.readReceiptBatch.clear();
    this.isInitialized = false;
    this.currentUserId = null;
  }
}

export default new MessageService();
