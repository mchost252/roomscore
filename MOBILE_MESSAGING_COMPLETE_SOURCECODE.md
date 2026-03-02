# Mobile React Native - Complete Messages/DM System Source Code

## Overview
This document contains the complete source code for the mobile React Native messaging/DM system, including screens, services, and reusable components.

---

## 1. SCREENS

### 1.1 `mobile/app/(home)/messages.tsx` - Messages List Screen
**Purpose**: Main messages screen showing conversations and friend list with search capability.

**Key Features**:
- Conversation list with unread badge support
- Online friends carousel at top
- Message requests section (pending incoming requests)
- Search users functionality
- Pull-to-refresh
- Swipe-to-delete conversations
- Dark/light theme support

**Key State**:
- `conversations`: Array of LocalConversation
- `friends`: Array of FriendUser
- `searchMode`: Boolean for search toggle
- `searchQuery`: Search input text
- `messageRequests`: Filtered conversations with pending_received status

**Key Functions**:
- `loadData()`: Initialize messageService and load conversations
- `openChat()`: Navigate to chat screen
- `handleDelete()`: Delete conversation with confirmation
- `toggleSearch()`: Toggle search mode with animation

---

### 1.2 `mobile/app/(home)/chat.tsx` - Chat/DM Screen
**Purpose**: Individual chat screen for messaging with a specific friend.

**Key Features**:
- Real-time message loading and display
- Message request handling (accept/decline/block)
- Reply-to message functionality
- Typing indicators
- Online status detection
- Message status tracking (sending/sent/delivered/read/failed)
- Retry failed messages
- Load older messages (pagination)
- Scroll-to-bottom FAB
- Pending friend request indication

**Key State**:
- `messages`: Array of LocalDirectMessage
- `requestStatus`: 'none' | 'pending_sent' | 'pending_received'
- `requestId`: Nullable request ID
- `replyTo`: Nullable reply message object
- `isTyping`: Boolean for friend typing status
- `isOnline`: Boolean for friend online status

**Key Functions**:
- `handleSend()`: Send message with optional reply
- `handleRetry()`: Retry failed message
- `handleReply()`: Set reply context
- `handleLoadMore()`: Load older messages
- `handleAcceptRequest()`: Accept incoming message request
- `handleDeclineRequest()`: Decline request and go back
- `handleBlockUser()`: Block and remove user

---

## 2. SERVICES

### 2.1 `mobile/services/messageService.ts` - Message Service (Offline-First)
**Purpose**: Core service managing messages, conversations, friendships, and syncing.

**Architecture**: 
- Offline-first with SQLite local storage
- Auto-sync via syncEngine
- Friendship caching for fast lookups
- Event-driven updates via listener pattern

**Key Interfaces**:
```typescript
ServerMessage {
  id, _id, content, message
  fromUserId, toUserId
  sender, recipient { id, _id, username }
  isRead, replyTo, replyToId, replyToText
  createdAt
}

FriendUser {
  id, username, avatar
  isFriend?, requestStatus?, requestId?
}

MessageRequest {
  id, friendId, username, avatar
  lastMessage, createdAt
}
```

**Key Methods**:

**Initialization & Lifecycle**:
- `initialize(userId)`: Init service, load friendship cache
- `setupSocketListeners()`: Register syncEngine listeners
- `disconnect()`: Cleanup and reset

**Messages**:
- `sendMessage()`: Send message (optimistic + background sync)
- `sendToServer()`: Background send with friend request auto-flow
- `getMessages(friendId)`: Get cached + merged messages
- `fetchAndMergeMessages()`: Server-first message fetch
- `retryMessage()`: Retry failed message

**Conversations**:
- `getConversations()`: Get cached conversations
- `fetchAndMergeConversations()`: Sync conversations from server
- `ensureConversation()`: Create or update conversation record

**Friendships**:
- `checkFriendship()`: Check friendship status (cache-first)
- `sendFriendRequest()`: Send friend request
- `acceptRequest()`: Accept incoming request
- `declineRequest()`: Decline request
- `blockUser()`: Block user (decline + remove)

**Status**:
- `markAsRead()`: Mark conversation as read
- `deleteConversation()`: Delete all messages with user
- `getUnreadCount()`: Get total unread count
- `emitTyping()`: Send typing indicator

**Queue Management**:
- `flushQueue()`: Retry all unsent messages
- `flushQueueForFriend()`: Retry messages for specific friend (called when friendship accepted)

**Event System**:
- `on(event, handler)`: Subscribe to events
- Events: `message`, `message_sent`, `message_synced`, `message_failed`, `message_retry`, `typing`, `online_status`, `read`, `delivered`, `conversations_updated`, `message_request`, `request_accepted`, `friend_removed`, `message_requests_updated`

**Key Logic**:
- Auto friend request flow: User A messages User B (not friend) → auto-send friend request → messages queued → when User B accepts → queued messages flush
- Friendship cache prevents repeated server calls
- Offline messages saved locally, synced when online
- Message status: `sending` → `sent` → `delivered` → `read` or `failed`

---

### 2.2 `mobile/services/api.ts` - HTTP Client
**Purpose**: Axios instance with auth, token refresh, and retry logic.

**Features**:
- Automatic JWT Bearer token injection
- Token refresh on 401 response
- Automatic retry for network/timeout/5xx errors
- Max 3 retries with exponential backoff
- Secure token storage via secureStorage

**Interceptors**:
- Request: Add Authorization header
- Response: Handle 401 refresh, retry on network errors

---

## 3. COMPONENTS

### 3.1 `mobile/components/messaging/ConversationCard.tsx`
**Purpose**: Reusable card component for each conversation in the list.

**Features**:
- Swipe-to-delete gesture
- Online indicator dot
- Unread badge with count
- Message preview
- Relative time display (now, 5m, 2h, 3d, etc.)
- Pending request indicator (violet accent)
- Avatar with initials fallback

**Props**:
```typescript
{
  conversation: LocalConversation
  isDark: boolean
  onPress: () => void
  onDelete?: () => void
}
```

**Key Logic**:
- `PanResponder` for swipe detection
- Threshold: -80px for delete trigger
- Spring animation for swipe reset

---

### 3.2 `mobile/components/messaging/ChatBubble.tsx`
**Purpose**: Message bubble component with status, reply preview, and interactions.

**Features**:
- Gradient fill for sent messages (indigo→purple→violet)
- Glass/translucent fill for received messages
- Left accent bar on received messages
- Reply preview with border highlight
- Message status icons (sending, sent, delivered, read, failed)
- Timestamp display
- WhatsApp-style sharp bottom corner on sender side
- Long-press for reply
- Tap-to-retry on failed messages

**Props**:
```typescript
{
  message: LocalDirectMessage
  isMine: boolean
  isDark: boolean
  showTimestamp?: boolean
  onRetry?: (msg) => void
  onReply?: (msg) => void
  onLongPress?: (msg) => void
}
```

**Message Status Colors**:
- `sending`: dim white (clock icon)
- `sent`: white (checkmark)
- `delivered`: white (double checkmark)
- `read`: blue (double checkmark)
- `failed`: red (alert icon)

---

### 3.3 `mobile/components/messaging/MessageInput.tsx`
**Purpose**: Text input component with reply preview and send button.

**Features**:
- Multiline text input (max 2000 chars)
- Reply preview bar (animated in/out)
- Send button (animated scale based on text)
- Typing indicator emission
- Disabled state support (for pending requests)
- Gradient send button

**Props**:
```typescript
{
  isDark: boolean
  onSend: (text: string) => void
  onTyping?: (isTyping: boolean) => void
  replyTo?: { id, text, username } | null
  onCancelReply?: () => void
  disabled?: boolean
}
```

**Key Logic**:
- Send button scales from 0 to 1 with spring animation
- Reply bar height animates 0→44px
- Typing events throttled: emits true on first char, false when cleared, auto-reset after 3s

---

### 3.4 `mobile/components/messaging/TypingIndicator.tsx`
**Purpose**: Animated typing indicator (three bouncing dots).

**Features**:
- Three animated dots with staggered pulse
- Smooth fade in/out
- Container scale animation
- Custom colors for dark/light theme

**Props**:
```typescript
{
  isDark: boolean
  visible: boolean
  username?: string
}
```

**Animation**:
- Each dot pulse sequence: 400ms up → 400ms down
- Staggered delays: dot1=0ms, dot2=150ms, dot3=300ms
- Opacity range: 0.4 → 1.0
- Scale range: 1.0 → 1.15

---

### 3.5 `mobile/components/messaging/MessageRequestBanner.tsx`
**Purpose**: Banner shown in chat when receiving an incoming message request.

**Features**:
- Info section with icon and description
- Three action buttons: Accept (gradient), Decline, Block (red)
- Context-aware styling

**Props**:
```typescript
{
  isDark: boolean
  username: string
  onAccept: () => void
  onDecline: () => void
  onBlock: () => void
}
```

---

## 4. DATA STRUCTURES (from sqliteService)

### LocalDirectMessage
```typescript
{
  id: string                    // Server ID when synced
  local_id: string              // Local unique ID
  from_user_id: string
  to_user_id: string
  content: string
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  reply_to_id: string | null
  reply_to_text: string | null
  created_at: number            // Timestamp ms
  synced: 0 | 1                 // 1 = server confirmed
}
```

### LocalConversation
```typescript
{
  friend_id: string
  username: string
  avatar: string | null
  last_message: string
  last_message_at: number       // Timestamp ms
  unread_count: number
  is_online: 0 | 1
  updated_at: number
  request_status: string        // 'none' | 'pending_sent' | 'pending_received'
  request_id: string | null
}
```

---

## 5. KEY FLOWS

### Send Message Flow
1. User types and presses send
2. `handleSend()` calls `messageService.sendMessage()`
3. Message saved locally with `status: 'sending'`
4. Conversation auto-created/updated
5. UI updates immediately (optimistic)
6. Background: `sendToServer()` executes:
   - Check friendship status (cache)
   - If not friends: auto-send friend request
   - If friends/already sent request: POST to `/direct-messages/{friendId}`
   - On success: update ID and status → `synced: 1`
   - On 403: leave as `sending` (will flush when request accepted)
   - On error: set to `failed` (user can retry)

### Receive Message Flow
1. `syncEngine` emits `new_direct_message` event
2. `messageService` listener:
   - Save to SQLite
   - Ensure conversation exists
   - Update unread count
   - Emit `message` event
   - Emit `conversations_updated`
3. ChatScreen listener updates messages array
4. MessagesScreen listener updates conversations

### Message Request Flow (Accept)
1. User A messages User B (not friends)
2. Friend request auto-sent via `sendFriendRequest()`
3. User B receives `friend:request` event
4. Conversation created with `request_status: 'pending_received'`
5. User B sees MessageRequestBanner in chat
6. User B clicks Accept → `handleAcceptRequest()`
7. POST to `/friends/accept/{requestId}`
8. `friend:accepted` event received
9. `request_status` updated to `none`
10. `flushQueueForFriend()` sends queued messages
11. Banner disappears, messages appear normally

### Offline Message Handling
1. User sends message while offline
2. Message saved locally with `synced: 0`
3. When connection restored: `flushQueue()` triggers
4. Retries all unsent messages
5. Updates status/ID on success

---

## 6. INTEGRATION POINTS

### With Main Home Screen (`index.tsx`)
- Unread message count badge shown in header
- `messageService.initialize()` called
- Listener for `conversations_updated` event
- Badge updates via `getUnreadCount()`

### With Authentication (`AuthContext`)
- User ID required for messageService init
- Token from secure storage injected into API calls

### With Theme (`ThemeContext`)
- All components respect isDark theme
- Color palette: indigo (#6366f1), violet (#8b5cf6)
- Light variants for light mode

### With Navigation (`expo-router`)
- Messages screen: `/(home)/messages`
- Chat screen: `/(home)/chat?friendId=X&username=Y&avatar=Z`
- Back navigation from chat returns to messages

---

## 7. STYLING PHILOSOPHY

**Glass Morphism**:
- Subtle transparent backgrounds: `rgba(30,30,50,0.7)`
- Hairline borders with low opacity
- Backdrop blur effect (via gradient layers)

**Gradients**:
- Primary: Indigo → Purple (#6366f1 → #7c3aed)
- Accent: Purple → Violet (#7c3aed → #8b5cf6)
- Secondary: Indigo → Violet (#6366f1 → #8b5cf6)

**Animations**:
- Spring (mass: 0.35-0.5, damping: 14-18, stiffness: 280-300)
- Timing (200-400ms for transitions)
- Reanimated 2 for smooth performance

**Dark Mode**:
- Background: #080810 → #f8f9ff (light)
- Surface: rgba(30,30,50,0.7) → rgba(255,255,255,0.75)
- Text: #f1f5f9 → #1e293b
- Subtle: rgba(255,255,255,0.5) → rgba(0,0,0,0.45)

---

## 8. IMPORTANT NOTES

1. **Offline-First**: All operations work offline and sync when connection restored
2. **Auto Friend Requests**: Sending message to non-friend auto-creates request
3. **Message Requests**: Incoming requests show as pending_received conversations
4. **Typing Indicators**: Auto-reset after 3s of no input
5. **Unread Tracking**: Marked read automatically when viewing chat, synced to server
6. **Swipe Gestures**: Conversations have swipe-to-delete on iOS/Android
7. **Reply System**: Messages can quote/reply to previous messages
8. **Status Persistence**: Message status icons show delivery/read receipts
9. **Request Cache**: Friendship status cached in memory for fast lookups
10. **Queue Flush**: Failed/queued messages auto-retry on connection restore

---

## 9. FILE SUMMARY

| File | Lines | Purpose |
|------|-------|---------|
| `messages.tsx` | 601 | Messages list screen |
| `chat.tsx` | 637 | Chat/DM screen |
| `messageService.ts` | 775 | Core messaging service |
| `api.ts` | 106 | HTTP client |
| `ConversationCard.tsx` | 317 | Conversation list item |
| `ChatBubble.tsx` | 252 | Message bubble component |
| `MessageInput.tsx` | 218 | Text input component |
| `TypingIndicator.tsx` | 120 | Typing indicator animation |
| `MessageRequestBanner.tsx` | 156 | Message request UI |
| **Total** | **3,182** | Complete system |

---

**Generated**: Comprehensive source code documentation for mobile messaging/DM system in React Native with Expo Router.
