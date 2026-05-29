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

