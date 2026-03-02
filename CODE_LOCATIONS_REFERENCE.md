# Code Locations Reference - Complete Messaging Implementation

## Quick Reference: Where Each Behavior Is Implemented

---

## 1. SEND BUTTON VISIBILITY

### File: `mobile/components/messaging/MessageInput.tsx`

**Lines 34-38: Button only shows when text exists**
```typescript
const hasText = text.trim().length > 0;  // Line 34

useEffect(() => {
  sendScale.value = withSpring(hasText ? 1 : 0, SPRING);  // Animate to 0 or 1
}, [hasText]);  // Line 38
```

**Lines 66-69: Animation interpolation (0.4 scale to 1.0 scale)**
```typescript
const sendAnimStyle = useAnimatedStyle(() => ({
  transform: [{ scale: interpolate(sendScale.value, [0, 1], [0.4, 1], Extrapolation.CLAMP) }],
  opacity: sendScale.value,  // Also animates opacity from 0 to 1
}));
```

**Lines 136-137: Button disabled if no text**
```typescript
disabled={!hasText || disabled}  // Only enabled when hasText=true AND not disabled
```

**Why it happens:**
- `sendScale` starts at 0 (hidden)
- When user types first character, `hasText` becomes `true`
- `useEffect` triggers, animates `sendScale` from 0 to 1
- Scale interpolation: 0→0.4, 1→1.0 (0 means scale 0.4, 1 means scale 1.0)
- Opacity also goes 0→1
- Result: Button scales up and fades in smoothly

**Timeline:**
```
Keystroke → hasText=true → useEffect → withSpring() → scale 0→1 → Button appears
```

---

## 2. OPTIMISTIC MESSAGE UPDATES

### File: `mobile/services/messageService.ts`

**Lines 380-424: sendMessage() - Fast Local Save**
```typescript
async sendMessage(
  friendId: string,
  content: string,
  friendUsername: string,
  friendAvatar: string | null,
  replyTo?: { id: string; text: string },
): Promise<LocalDirectMessage> {
  // ✅ Step 1: Create local message immediately
  const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();

  const localMsg: LocalDirectMessage = {
    id: localId,
    local_id: localId,
    from_user_id: this.currentUserId,      // Current user
    to_user_id: friendId,                  // Recipient
    content,
    status: 'sending',                     // ← Shows "sending" status
    reply_to_id: replyTo?.id || null,
    reply_to_text: replyTo?.text || null,
    created_at: now,
    synced: 0,                             // ← Not synced yet
  };

  // ✅ Step 2: Save to SQLite IMMEDIATELY
  await sqliteService.saveDirectMessage(localMsg);  // <1ms

  // ✅ Step 3: Update conversation locally
  await this.ensureConversation(friendId, friendUsername, friendAvatar, content, now, false);

  // ✅ Step 4: Notify UI right away (SYNCHRONOUS EMIT)
  this.emit('message_sent', localMsg);              // ← UI updates NOW
  this.emit('conversations_updated');

  // ✅ Step 5: Send to server in BACKGROUND (fire-and-forget)
  this.sendToServer(localMsg, friendId, content, replyTo).catch(() => {});  // ← NOT awaited

  return localMsg;
}
```

**Key insight:** Lines 417-421 show that `sendToServer()` is NOT awaited. This means:
- UI doesn't wait for server response
- Message appears instantly
- Server sync happens in background

**Lines 426-484: sendToServer() - Background Server Sync**
```typescript
private async sendToServer(
  localMsg: LocalDirectMessage,
  friendId: string,
  content: string,
  replyTo?: { id: string; text: string },
): Promise<void> {
  // Check if online first
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return;  // If offline, just return, don't error

  // Check friendship status (might do server call)
  let friendship = await this.checkFriendship(friendId);  // 10-100ms

  // If not friends, send friend request first
  if (!friendship.isFriend && friendship.requestStatus !== 'pending_sent') {
    const reqResult = await this.sendFriendRequest(friendId);  // 100-500ms
    if (!reqResult.success) {
      await sqliteService.updateMessageStatus(localMsg.local_id, 'failed');
      this.emit('message_failed', localMsg.local_id);
      return;
    }
    friendship = this.friendshipCache.get(friendId) || friendship;
    if (!friendship.isFriend && reqResult.requestId) {
      await sqliteService.updateConversationRequestStatus(friendId, 'pending_sent', reqResult.requestId);
      this.emit('conversations_updated');
    }
  }

  // Now send the actual message
  if (friendship.isFriend || friendship.requestStatus === 'accepted') {
    try {
      // ← THIS is what takes 200-1000ms (network)
      const response = await api.post(`/direct-messages/${friendId}`, {
        message: content,
        replyTo: replyTo?.id || undefined,
      });

      if (response.data.success) {
        const srv = response.data.message;
        const serverId = srv.id || srv._id;
        
        // Update local message with real server ID
        await sqliteService.updateMessageId(localMsg.local_id, serverId);  // <1ms
        
        // Notify UI to update message (status: sending → sent)
        this.emit('message_synced', { localId: localMsg.local_id, serverId });
      }
    } catch (error: any) {
      // Handle 403 (not friends yet) vs other errors
      if (error.response?.status === 403) {
        await sqliteService.updateMessageStatus(localMsg.local_id, 'sending');
      } else {
        await sqliteService.updateMessageStatus(localMsg.local_id, 'failed');
        this.emit('message_failed', localMsg.local_id);
      }
    }
  }
  // If pending_sent, message stays in 'sending' state until friend accepts
}
```

**Timeline breakdown:**
```
T=0ms:   User taps send → sendMessage() called
T=1ms:   Save to SQLite
T=2ms:   emit('message_sent') → UI renders message
T=5ms:   sendToServer() fired in background (non-blocking)
         ↓
T=10ms:  checkFriendship() completes
T=20ms:  (if needed) Send friend request
T=600ms: Network request to /direct-messages/{id}
T=700ms: Server response received
T=701ms: updateMessageId(local_id, serverId)
T=702ms: emit('message_synced') → UI updates status
T=704ms: Message status changes from "sending" to "sent"

← UI never blocked, user sees message at T=2ms ✅
← Final status update happens at T=704ms (not noticeable to user)
```

**Is it truly optimistic?**
- ✅ YES: Message appears instantly
- ✅ YES: Message saved to disk immediately
- ❌ PARTIAL: Status shows "sending" until server confirms, not "sent" immediately
- ❌ PARTIAL: If server rejects (403, etc), message marked "failed" (rare case)

---

## 3. MESSAGE PERSISTENCE (LOCAL STORAGE)

### File: `mobile/services/sqliteService.ts`

**Lines 207-216: Save message to SQLite**
```typescript
async saveDirectMessage(msg: LocalDirectMessage): Promise<void> {
  if (!this.db) return;  // Skip on web (no SQLite)
  
  await this.db.runAsync(
    `INSERT OR REPLACE INTO direct_messages
     (id, local_id, from_user_id, to_user_id, content, status, 
      reply_to_id, reply_to_text, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [msg.id, msg.local_id, msg.from_user_id, msg.to_user_id, msg.content,
     msg.status, msg.reply_to_id, msg.reply_to_text, msg.created_at, msg.synced]
  );
}
```

**Key points:**
- `INSERT OR REPLACE` = Insert if new, update if exists
- `if (!this.db) return;` = Silently skips on web (no error)
- Uses prepared statements (safe from SQL injection)
- All 10 fields stored including `synced` flag

**Lines 218-233: Retrieve messages from SQLite**
```typescript
async getDirectMessages(
  userId: string,
  friendId: string,
  limit = 50,
  before?: number
): Promise<LocalDirectMessage[]> {
  if (!this.db) return [];  // Returns empty array on web
  
  // Query both directions: from→to AND to→from
  const query = before
    ? `SELECT * FROM direct_messages
       WHERE ((from_user_id = ? AND to_user_id = ?) 
            OR (from_user_id = ? AND to_user_id = ?))
       AND created_at < ?
       ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM direct_messages
       WHERE ((from_user_id = ? AND to_user_id = ?) 
            OR (from_user_id = ? AND to_user_id = ?))
       ORDER BY created_at DESC LIMIT ?`;
  
  const params = before
    ? [userId, friendId, friendId, userId, before, limit]
    : [userId, friendId, friendId, userId, limit];
  
  const rows = await this.db.getAllAsync(query, params) as any[];
  return rows.reverse();  // ← Reverse to sort chronologically (oldest first)
}
```

**Lines 235-239: Get unsynced messages**
```typescript
async getUnsyncedMessages(): Promise<LocalDirectMessage[]> {
  if (!this.db) return [];
  
  return this.db.getAllAsync(
    `SELECT * FROM direct_messages WHERE synced = 0 AND status = 'sending' ORDER BY created_at ASC`
  ) as Promise<LocalDirectMessage[]>;
}
```

**Lines 257-263: Update message with server ID**
```typescript
async updateMessageId(localId: string, serverId: string): Promise<void> {
  if (!this.db) return;
  
  await this.db.runAsync(
    'UPDATE direct_messages SET id = ?, synced = 1, status = ? WHERE local_id = ?',
    [serverId, 'sent', localId]  // ← Updates id, synced flag, and status
  );
}
```

**Schema (Lines 122-140):**
```typescript
CREATE TABLE IF NOT EXISTS direct_messages (
  id TEXT PRIMARY KEY,                    // Server ID (empty until synced)
  local_id TEXT,                          // Client ID (always present)
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'sending',          // 'sending', 'sent', 'delivered', 'read', 'failed'
  reply_to_id TEXT,
  reply_to_text TEXT,
  created_at INTEGER NOT NULL,            // Timestamp in milliseconds
  synced INTEGER DEFAULT 0                // 0=not synced, 1=synced
);

CREATE INDEX IF NOT EXISTS idx_dm_from ON direct_messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_dm_to ON direct_messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_dm_created ON direct_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_dm_synced ON direct_messages(synced);
CREATE INDEX IF NOT EXISTS idx_dm_local_id ON direct_messages(local_id);
```

**Persistence Summary:**
- ✅ NATIVE (iOS/Android): Uses expo-sqlite, persistent across app closes
- ⚠️ WEB (Browser): Uses in-memory Map, lost on page refresh
- ✅ Fallback: Always has backend API as last resort
- ✅ Messages saved IMMEDIATELY on send (not when synced)

---

## 4. MESSAGE SYNC STATUS UPDATES

### File: `mobile/services/messageService.ts`

**Lines 142-151: Listen for message_synced event**
```typescript
// In setupSocketListeners() - lines 142-151
unsubs.push(
  messageService.on('message_synced', ({ localId, serverId }: { localId: string; serverId: string }) => {
    setMessages(prev =>
      prev.map(m =>
        m.local_id === localId || m.id === localId
          ? { ...m, id: serverId, status: 'sent' as const, synced: 1 }
          : m
      )
    );
  })
);
```

**In chat.tsx (lines 130-139):**
```typescript
// When message is sent, add it to the list
unsubs.push(
  messageService.on('message_sent', (msg: LocalDirectMessage) => {
    if (msg.to_user_id === friendId) {
      setMessages(prev => {
        if (prev.some(m => m.local_id === msg.local_id)) return prev;
        return [...prev, msg];  // ← Add new message with status='sending'
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  })
);
```

**Status progression:**
```
1. 'sending' (local, status field in SQLite)
   ↓ (when message added to list)
2. 'sent' (after server accepts and updates message ID)
   ↓ (when friend receives on their device)
3. 'delivered' (friend's device confirms receipt)
   ↓ (when friend reads the message)
4. 'read' (friend opened the chat and read it)
```

---

## 5. OFFLINE INDICATOR (MISSING)

### File: `mobile/app/(home)/chat.tsx`

**Lines 395-397: Online status shown in header**
```typescript
<Text style={[styles.headerStatus, { color: isOnline ? '✅ #22c55e' : subtextColor }]}>
  {isTyping ? 'typing...' : isOnline ? 'online' : 'offline'}
</Text>
```

**Problem:** This shows FRIEND's online status, not message status.

**What's missing:** ChatBubble component needs to show message status. Currently:
```typescript
// In chat.tsx line 339-346, messages are rendered with:
<ChatBubble
  message={item}                    // ← item has status field
  isMine={item.from_user_id === user?.id}
  isDark={isDark}
  onRetry={handleRetry}             // ← Can retry failed messages
  onReply={handleReply}
/>
```

**Message has status field but it's NOT displayed in ChatBubble:**
```typescript
// Available in message object:
message.status  // 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
message.synced  // 0 or 1
```

**To fix, ChatBubble should show:**
```typescript
{message.status === 'sending' && <Spinner />}
{message.status === 'sent' && <Icon name="checkmark" />}
{message.status === 'delivered' && <Icon name="checkmark-double" />}
{message.status === 'read' && <Icon name="checkmark-double" color="blue" />}
{message.status === 'failed' && <Icon name="alert-circle" color="red" />}
```

---

## 6. OFFLINE QUEUE FLUSHING

### File: `mobile/services/messageService.ts`

**Lines 731-760: flushQueue() - Resend unsynced messages**
```typescript
async flushQueue(): Promise<void> {
  const pending = await sqliteService.getUnsyncedMessages();  // ← Find all synced=0
  if (pending.length === 0) return;

  const net = await NetInfo.fetch();
  if (!net.isConnected) return;  // ← Don't send if still offline

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
```

**Lines 763-786: flushQueueForFriend() - Called when friend request accepted**
```typescript
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
```

**Triggered when:**
- Line 67: `initialize()` calls `this.flushQueue()` on app startup
- Line 203: Friend request accepted triggers `this.flushQueueForFriend(friendId)`

---

## 7. MEMORY CACHE FALLBACK (FOR WEB)

### File: `mobile/services/messageService.ts`

**Line 55: In-memory message cache**
```typescript
private memoryMessageCache = new Map<string, LocalDirectMessage[]>();  // web/offline fallback
```

**Lines 408-411: Store in memory cache on send**
```typescript
// Also update memory cache for web fallback
const memKey = `${this.currentUserId}:${friendId}`;
const existing = this.memoryMessageCache.get(memKey) || [];
this.memoryMessageCache.set(memKey, [...existing, localMsg]);
```

**Lines 519-525: Fallback to memory cache in getMessages()**
```typescript
async getMessages(friendId: string, before?: number): Promise<LocalDirectMessage[]> {
  if (!this.currentUserId) return [];

  // 1. Fetch from server in background
  try {
    await this.fetchAndMergeMessages(friendId);
  } catch {}

  // 2. Try SQLite (native) — returns [] on web
  const cached = await sqliteService.getDirectMessages(this.currentUserId, friendId, 50, before);
  if (cached.length > 0) return cached;

  // 3. Web fallback: return in-memory cache
  const memKey = `${this.currentUserId}:${friendId}`;
  return this.memoryMessageCache.get(memKey) || [];
}
```

**Lines 556-560: Store fetched messages in memory cache**
```typescript
// Store in memory cache for web/offline fallback (SQLite is no-op on web)
if (this.currentUserId) {
  const memKey = `${this.currentUserId}:${friendId}`;
  this.memoryMessageCache.set(memKey, memMessages);
}
```

---

## SUMMARY: Call Chain

```
User sends message:
┌─────────────────────────────────────────────────────────────┐
│ chat.tsx handleSend(text)                          (Line 246)│
│   ↓                                                          │
│ messageService.sendMessage(friendId, text, ...)   (Line 248)│
│   ↓                                                          │
│ messageService.ts sendMessage()                    (Line 380)│
│   ├─→ sqliteService.saveDirectMessage()            (Line 406)│
│   ├─→ ensureConversation()                         (Line 414)│
│   ├─→ emit('message_sent')                         (Line 417)│
│   └─→ sendToServer() [background, fire-and-forget](Line 421)│
│       │                                                      │
│       └─→ checkFriendship()                        (Line 436)│
│       └─→ sendFriendRequest() [if needed]          (Line 440)│
│       └─→ api.post('/direct-messages/{id}')        (Line 462)│
│       └─→ sqliteService.updateMessageId()          (Line 470)│
│       └─→ emit('message_synced')                   (Line 471)│
│                                                              │
│ chat.tsx receives events:                                   │
│   ├─→ 'message_sent' → setMessages() [INSTANT]  (Line 130) │
│   └─→ 'message_synced' → update status            (Line 142)│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## FILES TO MODIFY FOR IMPROVEMENTS

### To Add Offline Badge to Messages:
1. **mobile/components/messaging/ChatBubble.tsx** - Add status icon rendering
2. **mobile/app/(home)/chat.tsx** - Could add offline banner

### To Improve Send Button UX:
1. **mobile/components/messaging/MessageInput.tsx** - Already good, maybe adjust spring animation

### To Show Network Status:
1. **mobile/app/(home)/chat.tsx** - Add NetInfo listener at top of screen
2. **mobile/components/messaging/MessageInput.tsx** - Could disable input when offline

### To Improve Delivery Feedback:
1. **mobile/components/messaging/ChatBubble.tsx** - Show delivery status icons
2. Add visual checkmarks: ✓ (sent), ✓✓ (delivered), ✓✓ (blue, read)
