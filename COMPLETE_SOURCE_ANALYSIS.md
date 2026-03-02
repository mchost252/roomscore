# Complete Source Code Analysis: Typing & Online Status

## 1. mobile/app/(home)/chat.tsx — COMPLETE (651 lines)

**Key Sections:**
- **Lines 49-55**: State management for typing/online status
  ```tsx
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  ```

- **Lines 201-211**: Real-time listeners for typing & online status
  ```tsx
  // Typing listener (line 202-204)
  messageService.on('typing', (data: { userId: string; isTyping: boolean }) => {
    if (data.userId === friendId) setIsTyping(data.isTyping);
  });

  // Online status listener (line 207-210)
  messageService.on('online_status', (data: { userId: string; isOnline: boolean }) => {
    if (data.userId === friendId) setIsOnline(data.isOnline);
  });
  ```

- **Lines 395-397**: Display of typing indicator in header
  ```tsx
  <Text style={[styles.headerStatus, { color: isOnline ? '#22c55e' : subtextColor }]}>
    {isTyping ? 'typing...' : isOnline ? 'online' : 'offline'}
  </Text>
  ```

- **Lines 281-283**: Typing emission on user input
  ```tsx
  const handleTyping = useCallback((typing: boolean) => {
    messageService.emitTyping(friendId, typing);
  }, [friendId]);
  ```

---

## 2. mobile/components/messaging/MessageInput.tsx — COMPLETE (219 lines)

**Key Sections:**
- **Lines 28-32**: State management for typing
  ```tsx
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const sendScale = useSharedValue(0);
  const replyHeight = useSharedValue(0);
  const typingRef = useRef(false);
  ```

- **Lines 56-65**: Typing change handler — THIS IS WHERE TYPING STATUS CHANGES
  ```tsx
  const handleChangeText = useCallback((val: string) => {
    setText(val);
    if (val.trim().length > 0 && !typingRef.current) {
      typingRef.current = true;
      onTyping?.(true);  // ← Sends isTyping: true to messageService
    } else if (val.trim().length === 0 && typingRef.current) {
      typingRef.current = false;
      onTyping?.(false);  // ← Sends isTyping: false when text is cleared
    }
  }, [onTyping]);
  ```

- **Lines 45-54**: Send button handler
  ```tsx
  const handleSend = useCallback(() => {
    const msg = text.trim();
    if (!msg) return;
    onSend(msg);
    setText('');
    if (typingRef.current) {
      typingRef.current = false;
      onTyping?.(false);  // ← Clears typing when message sent
    }
  }, [text, onSend, onTyping]);
  ```

**CRITICAL ISSUE**: The component only calls `onTyping(false)` when:
1. User clears the input (deletes all text)
2. User sends the message
- **It does NOT have a timeout to auto-stop typing after inactivity**

---

## 3. mobile/context/SocketContext.tsx — FILE DOES NOT EXIST

**Status**: This file is not in the workspace. The mobile app does not use a SocketContext.
- The workspace only has: `AuthContext.tsx` and `ThemeContext.tsx`
- Online status tracking happens via `messageService` and `syncEngine` (socket wrapper)

---

## 4. mobile/services/messageService.ts — COMPLETE (812 lines)

### Typing Indicator Logic (Lines 663-672)

```typescript
// ─── Typing Indicator ─────────────────────────────────
emitTyping(recipientId: string, isTyping: boolean): void {
  if (this.typingTimeout) clearTimeout(this.typingTimeout);
  syncEngine.emit('dm:typing', { recipientId, isTyping });
  if (isTyping) {
    this.typingTimeout = setTimeout(() => {
      syncEngine.emit('dm:typing', { recipientId, isTyping: false });
    }, 3000);  // ← 3 second AUTO-TIMEOUT
  }
}
```

**Key Finding**: Typing automatically stops after **3000ms (3 seconds)**, even if user is still typing.

### Online Status Tracking (Lines 157-170)

```typescript
// User online/offline (line 158-163)
this.unsubscribers.push(
  syncEngine.on('user:status', (data: { userId: string; isOnline: boolean }) => {
    sqliteService.updateConversationOnline(data.userId, data.isOnline).catch(() => {});
    this.emit('online_status', data);
  })
);

// Bulk online users (line 166-170)
this.unsubscribers.push(
  syncEngine.on('users:online', (userIds: string[]) => {
    this.emit('online_users', userIds);
  })
);
```

**How Online Status Works**:
1. Receives `user:status` events from `syncEngine` (socket)
2. Updates SQLite conversation record via `updateConversationOnline()`
3. Emits `online_status` event for chat screen to listen to
4. Also broadcasts bulk online user lists via `users:online` event

### Typing Event Handler (Lines 130-135)

```typescript
// Typing (line 130-135)
this.unsubscribers.push(
  syncEngine.on('dm:typing', (data: { userId: string; username: string; isTyping: boolean }) => {
    this.emit('typing', data);
  })
);
```

**Simply relays incoming typing events** from socket to UI listeners.

---

## ROOT CAUSES IDENTIFIED

### Why Typing Stops After 1.5s (Actually 3s)

**Issue**: User reports "typing stops after 1.5s" but code shows 3000ms timeout in `messageService.emitTyping()`.

**Flow**:
1. User types → `MessageInput.handleChangeText()` calls `onTyping(true)`
2. This calls `messageService.emitTyping(friendId, true)`
3. Message service emits `dm:typing: { recipientId, isTyping: true }` to socket
4. **Sets a timeout to emit `isTyping: false` after 3000ms (line 669-670)**
5. Unless user sends message or clears input (lines 45-54), typing will auto-stop after 3 seconds

**Why 1.5s instead of 3s?**
- Could be backend re-broadcasting timeout
- Could be mobile app's network latency + server-side timeout
- Could be typing indicator visibility being debounced elsewhere

**Fix Needed**: 
- Remove or extend the 3000ms timeout in `emitTyping()`
- OR send continuous typing heartbeats every ~2 seconds while user actively types
- OR implement idle detection (only emit false after 3s of no keyboard input)

### Why Online Status is Wrong

**Potential Issues**:

1. **Missing initial online status fetch** - When chat opens, no request for current friend's online status
2. **Socket connection not established** - If `syncEngine` isn't connected, no `user:status` events arrive
3. **Stale cached status** - `sqliteService.updateConversationOnline()` updates DB, but chat screen reads from socket event, not DB
4. **No manual status check** - Chat screen doesn't call `messageService.checkOnlineStatus()` on mount
5. **Race condition** - Online status listener registered (line 207-210) fires before initial status loaded

**Evidence**:
- Line 207-210: Listener only updates if `data.userId === friendId`
- No initialization call to fetch current online status
- Line 159-161: Status only emitted if socket sends it

---

## How Message Delivery Works ("Ticks")

### Read Receipts (Double Ticks) - Lines 177-189

```typescript
unsubs.push(
  messageService.on('read', (data: { readBy: string }) => {
    if (data.readBy === friendId) {
      setMessages(prev =>
        prev.map(m =>
          m.from_user_id === user?.id && m.to_user_id === friendId
            ? { ...m, status: 'read' as const }
            : m
        )
      );
    }
  })
);
```

- When recipient reads message, backend sends `read` event
- Chat updates message status to `'read'` (shown as double blue tick in `ChatBubble`)

### Delivered Receipt (Single Tick) - Lines 191-199

```typescript
unsubs.push(
  messageService.on('delivered', (data: { messageIds: string[] }) => {
    setMessages(prev =>
      prev.map(m =>
        data.messageIds.includes(m.id) ? { ...m, status: 'delivered' as const } : m
      )
    );
  })
);
```

- When backend confirms message delivery, sends `delivered` event
- Chat updates message status to `'delivered'` (shown as single gray tick)

### Message Status Progression

From `messageService.ts`:
1. **'sending'** (line 399) - Message created locally, sent to server in background
2. **'delivered'** (line 100) - Server confirmed receipt
3. **'read'** (line 547) - Recipient opened the message
4. **'failed'** (line 443, 478) - Send failed, needs retry
5. **'sent'** - Intermediate state (used in message fetching)

---

## Summary Table

| Component | File | Key Finding |
|-----------|------|------------|
| **Typing Indicator** | `messageService.ts:665-672` | **3-second auto-timeout** — stops typing even if user still typing |
| **Typing Display** | `chat.tsx:202-204` | Correctly listens to `typing` event from messageService |
| **Typing Input** | `MessageInput.tsx:56-65` | Only stops typing when text cleared or message sent |
| **Online Status** | `messageService.ts:158-162` | Listens to socket events but **no initial status fetch** |
| **Online Display** | `chat.tsx:207-210` | Correctly displays based on received events |
| **Message Ticks** | `chat.tsx:177-199` | Single tick = delivered, double tick = read |
| **SocketContext** | — | **DOES NOT EXIST** — use `syncEngine` instead |

---

## Architecture Notes

- **No dedicated SocketContext**: Uses `syncEngine` (found in `services/syncEngine.ts`)
- **Event-driven**: All real-time updates via `messageService.on()` listeners
- **Offline-first**: SQLite caching with background server sync
- **Web support**: In-memory fallback when SQLite unavailable
