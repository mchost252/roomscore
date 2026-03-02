# Complete Message Flow Diagram

## 1. SEND BUTTON VISIBILITY FLOW

```
┌─────────────────────────────────────────────────────────────┐
│                  MessageInput Component                      │
│                 (mobile/components/messaging/)               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
                  ┌──────────────────┐
                  │  User types text │
                  └──────────────────┘
                            │
                            ↓
                  ┌──────────────────────────┐
                  │ handleChangeText()       │ (Line 55)
                  │ setText(val)             │
                  └──────────────────────────┘
                            │
                            ↓
                  ┌──────────────────────────┐
                  │ hasText = text.trim().   │ (Line 34)
                  │    length > 0            │
                  └──────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
         NO TEXT (false)            HAS TEXT (true)
              │                           │
              ↓                           ↓
    ┌──────────────────┐        ┌──────────────────┐
    │ sendScale = 0    │        │ sendScale = 1    │
    │ Button scale:    │        │ Button scale:    │
    │   0.4, opacity 0 │        │   1.0, opacity 1 │
    │ Button HIDDEN    │        │ Button VISIBLE   │
    └──────────────────┘        └──────────────────┘
              │                           │
              │                           ↓
              │                  User taps send button
              │                           │
              │                           ↓
              │                  ┌──────────────────┐
              │                  │ handleSend()     │ (Line 44)
              │                  │ onSend(msg)      │
              │                  └──────────────────┘
              │                           │
              └─────────────┬─────────────┘
                            ↓
                  ┌──────────────────┐
                  │ setText('')      │ (Line 48)
                  │ Clear input      │
                  └──────────────────┘
                            │
                            ↓
                  ┌──────────────────┐
                  │ hasText = false  │
                  │ sendScale → 0    │
                  │ Button HIDDEN    │
                  └──────────────────┘
```

---

## 2. MESSAGE SENDING FLOW (OPTIMISTIC UPDATES)

```
┌──────────────────────────────────────────────────────────────────────────┐
│           User presses Send Button in MessageInput                        │
│                                                                           │
│  onSend(text) → chat.tsx handleSend() → messageService.sendMessage()    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
                    ┌───────────────────────────────┐
                    │ [IMMEDIATE - 0ms]             │
                    │ Create local message object   │
                    │ • id = "local_[timestamp]"    │
                    │ • status = 'sending'          │
                    │ • synced = 0                  │
                    │ • from_user_id = current user │
                    │ • to_user_id = friend        │
                    └───────────────────────────────┘
                                    │
                                    ↓
                    ┌───────────────────────────────┐
                    │ [IMMEDIATE - <1ms]            │
                    │ sqliteService.saveDirectMsg() │
                    │ INSERT to SQLite               │
                    │ (or memory cache on web)       │
                    └───────────────────────────────┘
                                    │
                    ┌───────────────┴──────────────┐
                    │                              │
         ┌──────────↓─────────┐      ┌────────────↓─────────────┐
         │  Native (iOS/And)  │      │  Web (Browser)           │
         │  Save to SQLite DB │      │  Save to Memory Cache     │
         │  ✅ Persistent     │      │  ⚠️ Lost on refresh      │
         └────────────────────┘      └──────────────────────────┘
                                    │
                                    ↓
                    ┌───────────────────────────────┐
                    │ [IMMEDIATE - 0ms]             │
                    │ emit('message_sent', msg)     │
                    │ Trigger UI re-render          │
                    └───────────────────────────────┘
                                    │
                                    ↓
         ┌──────────────────────────────────────────────┐
         │  [UI UPDATES INSTANTLY]                      │
         │                                              │
         │  chat.tsx receives 'message_sent' event      │
         │  ↓                                           │
         │  setMessages(prev => [...prev, newMsg])      │
         │  ↓                                           │
         │  FlatList re-renders                         │
         │  ↓                                           │
         │  Message appears in chat with "sending" icon │
         │  ↓                                           │
         │  Input field clears                          │
         │  ↓                                           │
         │  Typing indicator stops                      │
         │  ↓                                           │
         │  Button animates out                         │
         └──────────────────────────────────────────────┘
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         │                                                      │
         │  [FIRE AND FORGET - BACKGROUND]                     │
         │  this.sendToServer(localMsg, ...).catch(() => {})   │
         │  Does NOT block UI or await                         │
         │                                                      │
         │  ↓                                                   │
         │  ┌──────────────────────────────────────────────┐  │
         │  │ [10-100ms]                                   │  │
         │  │ Check friendship status                      │  │
         │  │ - Check cache first                          │  │
         │  │ - If not cached: fetch from server           │  │
         │  └──────────────────────────────────────────────┘  │
         │  ↓                                                   │
         │  ┌──────────────────────────────────────────────┐  │
         │  │ If NOT friends:                              │  │
         │  │ [100-500ms]                                  │  │
         │  │ api.post('/friends/request', ...)            │  │
         │  │ Send friend request first                    │  │
         │  │                                              │  │
         │  │ Updates conversation:                        │  │
         │  │ request_status = 'pending_sent'              │  │
         │  │ request_id = [server request ID]             │  │
         │  └──────────────────────────────────────────────┘  │
         │  ↓                                                   │
         │  ┌──────────────────────────────────────────────┐  │
         │  │ [100-500ms NETWORK]                          │  │
         │  │ api.post('/direct-messages/{friendId}',      │  │
         │  │   { message: content, replyTo: ... })        │  │
         │  │                                              │  │
         │  │ Server response:                             │  │
         │  │ { success: true, message: { id, ... } }      │  │
         │  └──────────────────────────────────────────────┘  │
         │  ↓                                                   │
         │  ┌──────────────────────────────────────────────┐  │
         │  │ [<1ms]                                       │  │
         │  │ sqliteService.updateMessageId(               │  │
         │  │   localId='local_XXX',                       │  │
         │  │   serverId='507f1...'                        │  │
         │  │ )                                            │  │
         │  │                                              │  │
         │  │ Also: UPDATE status='sent', synced=1         │  │
         │  └──────────────────────────────────────────────┘  │
         │  ↓                                                   │
         │  ┌──────────────────────────────────────────────┐  │
         │  │ [0ms]                                        │  │
         │  │ emit('message_synced', {                     │  │
         │  │   localId: 'local_XXX',                      │  │
         │  │   serverId: '507f1...'                       │  │
         │  │ })                                           │  │
         │  └──────────────────────────────────────────────┘  │
         │  ↓                                                   │
         │  [UI UPDATES AGAIN]                                 │
         │  chat.tsx receives 'message_synced' event           │
         │  ↓                                                   │
         │  setMessages(prev =>                                │
         │    prev.map(m =>                                    │
         │      m.local_id === localId                         │
         │        ? { ...m, id: serverId, status: 'sent' }     │
         │        : m                                          │
         │    )                                                │
         │  )                                                  │
         │  ↓                                                   │
         │  Message updates: "sending" → "sent" ✅             │
         │                                                      │
         └──────────────────────────────────────────────────────┘
```

---

## 3. MESSAGE PERSISTENCE LAYERS

```
┌─────────────────────────────────────────────────────────────────┐
│                        NATIVE APP (iOS/Android)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              SQLite Database (krios.db)                  │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ Table: direct_messages                             │  │  │
│  │  │                                                    │  │  │
│  │  │ Columns:                                           │  │  │
│  │  │ • id (TEXT PRIMARY KEY) - Server ID               │  │  │
│  │  │ • local_id (TEXT) - Client ID before sync         │  │  │
│  │  │ • from_user_id (TEXT) - Sender                    │  │  │
│  │  │ • to_user_id (TEXT) - Recipient                   │  │  │
│  │  │ • content (TEXT) - Message text                   │  │  │
│  │  │ • status (TEXT) - 'sending'|'sent'|'delivered'|.. │  │  │
│  │  │ • reply_to_id (TEXT) - Parent message ID          │  │  │
│  │  │ • reply_to_text (TEXT) - Parent message text      │  │  │
│  │  │ • created_at (INTEGER) - Timestamp (ms)           │  │  │
│  │  │ • synced (INTEGER) - 0=not synced, 1=synced       │  │  │
│  │  │                                                    │  │  │
│  │  │ Indices: (fast lookups)                            │  │  │
│  │  │ • idx_dm_from (from_user_id)                       │  │  │
│  │  │ • idx_dm_to (to_user_id)                           │  │  │
│  │  │ • idx_dm_created (created_at)                      │  │  │
│  │  │ • idx_dm_synced (synced)                           │  │  │
│  │  │ • idx_dm_local_id (local_id)                       │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                       ↕️ (Read/Write)                      │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ Table: conversations                              │  │  │
│  │  │                                                    │  │  │
│  │  │ • friend_id (TEXT PRIMARY KEY)                    │  │  │
│  │  │ • username, avatar                                │  │  │
│  │  │ • last_message, last_message_at                   │  │  │
│  │  │ • unread_count                                    │  │  │
│  │  │ • is_online (0/1)                                 │  │  │
│  │  │ • updated_at (timestamp)                          │  │  │
│  │  │ • request_status ('none'|'pending_sent'|..)       │  │  │
│  │  │ • request_id                                      │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       WEB APP (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⚠️ NO SQLite (expo-sqlite doesn't work on web)               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          In-Memory Message Cache (JavaScript)           │  │
│  │          (messageService.ts line 55)                    │  │
│  │                                                          │  │
│  │  private memoryMessageCache:                            │  │
│  │    Map<string, LocalDirectMessage[]>                    │  │
│  │                                                          │  │
│  │  Key format: "${userId}:${friendId}"                   │  │
│  │  Value: Array of messages for that conversation         │  │
│  │                                                          │  │
│  │  ❌ Lost on page refresh                               │  │
│  │  ✅ Works while app is open                            │  │
│  │  ✅ Updated in real-time                               │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ↕️ (Fallback to this on getMessages() if SQLite returns []) │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │      Backend API (Always Available as Last Resort)      │  │
│  │                                                          │  │
│  │  api.get('/direct-messages/{friendId}')                 │  │
│  │  Fetches from server and rebuilds memory cache          │  │
│  │  (fetchAndMergeMessages, line 527)                      │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. PERSISTENCE AND SYNC STATUS TRACKING

```
┌─────────────────────────────────────────────────────────────────┐
│           Message Lifecycle in Database                         │
└─────────────────────────────────────────────────────────────────┘

STAGE 1: USER SENDS MESSAGE
┌─────────────────────────────────┐
│ INSERT into direct_messages      │
│ id: "local_1234567890_abc"       │ ← Temporary client ID
│ local_id: "local_1234567890_abc" │
│ status: "sending"                │ ← Shows as "sending" in UI
│ synced: 0                        │ ← Not yet synced
│ created_at: 1704067200000        │ ← Current timestamp
└─────────────────────────────────┘
         ↓
    [BACKGROUND: Send to Server]
         ↓
STAGE 2: SERVER CONFIRMS RECEIPT
┌─────────────────────────────────┐
│ UPDATE direct_messages           │
│ WHERE local_id = "local_..."     │
│                                  │
│ SET:                             │
│ id: "507f1f77bcf86cd799439011"   │ ← Real server ID from response
│ status: "sent"                   │ ← Shows as "sent" in UI
│ synced: 1                        │ ← Marked as synced
└─────────────────────────────────┘
         ↓
    [Socket: Delivery Confirmation]
         ↓
STAGE 3: FRIEND RECEIVES & READS
┌─────────────────────────────────┐
│ UPDATE direct_messages           │
│ WHERE id = "507f1f77bcf86..."    │
│                                  │
│ SET:                             │
│ status: "delivered"              │ ← Friend got it
│                ↓ (after reading)  │
│ status: "read"                   │ ← Friend read it
└─────────────────────────────────┘

FAILURE CASE:
┌─────────────────────────────────┐
│ Network error or server returns  │
│ error status (e.g., 403)         │
│                                  │
│ UPDATE direct_messages           │
│ WHERE local_id = "local_..."     │
│                                  │
│ SET:                             │
│ status: "failed"                 │ ← Shows error in UI
│                                  │ ← User can tap retry
└─────────────────────────────────┘
```

---

## 5. DATA RETRIEVAL FLOW

```
┌───────────────────────────────────────────────────┐
│  User opens chat with friendId="abc123"           │
│  chat.tsx useEffect triggers                      │
└───────────────────────────────────────────────────┘
                    ↓
    ┌───────────────────────────────────┐
    │ messageService.initialize(userId)  │
    │ • Setup socket listeners           │
    │ • Load friendship cache            │
    │ • Flush offline queue              │
    └───────────────────────────────────┘
                    ↓
    ┌───────────────────────────────────┐
    │ getMessages(friendId)              │ (line 510)
    │                                   │
    │ 1. Try server sync (async, no-wait)
    │    await fetchAndMergeMessages()   │
    │    ↓                              │
    │    api.get('/direct-messages/{id}')
    │    ↓                              │
    │    Save all to SQLite              │
    │                                   │
    │ 2. Try SQLite                      │
    │    sqliteService.getDirectMessages
    │    (userId, friendId, 50)          │
    │    ↓                              │
    │    [NATIVE] Returns array from DB  │
    │    [WEB] Returns []                │
    │                                   │
    │ 3. Fallback to memory cache        │
    │    if SQLite returns []            │
    │    memoryMessageCache.get(key)     │
    │                                   │
    └───────────────────────────────────┘
                    ↓
    ┌───────────────────────────────────┐
    │ Return messages to UI              │
    │ setMessages(cachedOrFreshMessages) │
    │                                   │
    │ FlatList renders messages          │
    │ with ChatBubble components         │
    └───────────────────────────────────┘
```

---

## 6. SEND BUTTON STATE MACHINE

```
INITIAL STATE
    │
    └─→ [IDLE - No text]
        • Button hidden (scale 0)
        • Button disabled: true
        • No send action possible
        │
        └─→ User types 'H'
            │
            └─→ [READY - Has text]
                • Button visible (scale 1)
                • Button enabled: true
                • Can send on press
                │
                ├─→ User taps send button
                │   │
                │   └─→ handleSend()
                │       • Execute onSend(text)
                │       • Clear text: setText('')
                │       • Stop typing indicator
                │
                │   └─→ [IDLE - No text] (back to start)
                │
                └─→ User continues typing 'Hello'
                    • Button remains visible
                    • Can send anytime
```

---

## KEY TIMING METRICS

```
┌──────────────────────────────────────────────────────────┐
│ OPERATION                          TIME      BLOCKING?   │
├──────────────────────────────────────────────────────────┤
│ Save to SQLite                     <1ms      No (promise)│
│ Emit message_sent event            0ms       No          │
│ UI re-render (FlatList)            16-33ms   No          │
│ Check friendship (cache)           <1ms      No          │
│ Check friendship (server)          50-200ms  No          │
│ Send friend request                100-500ms No          │
│ Network send to server             200-1000ms No         │
│ Server response received           100-500ms No          │
│ Update message status (SQLite)     <1ms      No          │
│ Emit message_synced event          0ms       No          │
│ UI re-render (status update)       16-33ms   No          │
├──────────────────────────────────────────────────────────┤
│ TOTAL TIME (perceived)             500-2000ms (not user) │
│ TOTAL TIME (blocks input)          0ms       ✅ INSTANT  │
└──────────────────────────────────────────────────────────┘
```

---

## OFFLINE HANDLING

```
┌─────────────────────────────────────────────┐
│ User sends message while OFFLINE            │
└─────────────────────────────────────────────┘
        ↓
    [All steps happen the same way]
    Message saved to SQLite ✅
    Message appears in UI ✅
    emit('message_sent') fires ✅
    ↓
    sendToServer() checks:
    const netState = await NetInfo.fetch()
    if (!netState.isConnected) return;
    ↓
    [Returns early - does NOT attempt server send]
    Message stays in 'sending' status
    ↓
    ┌──────────────────────────────┐
    │ Later: User gets back online │
    └──────────────────────────────┘
    ↓
    messageService.flushQueue() runs
    (triggered when connection restored)
    ↓
    Finds all messages where:
    synced = 0 AND status = 'sending'
    ↓
    Resends them to server
    ↓
    Status updates to 'sent'

❌ PROBLEM: No visual "offline" badge
   Message just stays "sending" forever
   until flushQueue() runs
```
