# Mobile React Native Codebase - Comprehensive Summary

## Overview
This is a KRIOS personal task management and AI assistant app built with React Native/Expo. It implements a **PHASE 1 & 2 hybrid architecture** with optimistic local-first storage and background sync capabilities.

---

## 1. SERVICES LAYER (`mobile/services/`)

### 1.1 **aiTaskParser.ts** ✅ FULLY IMPLEMENTED
**Purpose**: NLP parser that converts natural language input into structured task intents

**Key Features**:
- **Intent Detection**: Identifies 6 actions from user text
  - `create`: "add task by tomorrow"
  - `list`: "show my tasks"
  - `complete`: "mark done"
  - `priority`: "what should i focus on"
  - `motivate`: inspirational quotes
  - `unknown`: fallback
  
- **Task Creation Parser**: Extracts from natural language:
  - Title extraction (removes modifiers)
  - Due dates (relative like "tomorrow", "Friday"; absolute like "12/25")
  - Priority detection (urgent/high, low, medium)
  - Task type (daily, weekly, one-time)
  - Suggestion vs direct creation decision

- **Smart Features**:
  - 8 motivational quotes (randomized)
  - Productivity tips and task analysis
  - Quick command handling ("tips", "analysis", "suggest")
  - Task completion matching by title
  - Date formatting (e.g., "tomorrow" → ISO string)

**Status**: Feature-complete, production-ready

---

### 1.2 **aiBehaviorEngine.ts** ❌ EMPTY/STUB
**Purpose**: Track user behavior patterns for AI recommendations

**Currently**: Only stub/placeholder. Expected to implement:
- Task creation tracking
- Completion tracking
- Mood/energy level tracking
- Usage pattern analytics
- Behavior-based suggestions

**Status**: NOT IMPLEMENTED - Ready for development

---

### 1.3 **suggestionEngine.ts** ❌ EMPTY/STUB
**Purpose**: Generate smart task suggestions based on patterns

**Expected to implement**:
- Pattern-based task suggestions
- Context-aware recommendations
- Productivity optimization suggestions

**Status**: NOT IMPLEMENTED - Placeholder file

---

### 1.4 **taskService.ts** ✅ FULLY IMPLEMENTED
**Purpose**: Core task CRUD operations with offline-first local storage

**Data Model** (`PersonalTask`):
```typescript
{
  id: string (local_${timestamp}_${random})
  userId: string
  title: string
  description?: string
  taskType: 'daily' | 'weekly' | 'one-time'
  isCompleted: boolean
  completedAt?: string
  dueDate?: string (ISO)
  createdAt: string
  updatedAt: string
  priority?: 'high' | 'medium' | 'low'
  bucket?: 'today' | 'week' | 'someday' | 'inbox'
  localOnly?: boolean (client-side flag)
  pendingDelete?: boolean (soft delete)
}
```

**Core Operations**:
- `createTask()`: Create locally + add to sync queue
- `updateTask()`: Update locally + queue sync
- `deleteTask()`: Soft delete (mark `pendingDelete`)
- `completeTask()`: Mark complete + queue sync
- `uncompleteTask()`: Reopen task

**Sync Queue System**:
- Maintains queue of pending actions: create, update, delete, complete
- Queued items stored in AsyncStorage
- `syncTasks()`: Currently disabled (backend integration pending)

**Task Queries**:
- `getTodayTasks()`: Tasks due today or with daily frequency
- `getUpcomingTasks()`: Future tasks sorted by due date
- `getOngoingTasks()`: All incomplete tasks
- `getTopPriorityTasks()`: Weighted scoring system
  - Weight: high=3, medium=2, low=1
  - Overdue: +10, today: +5, within 2 days: +2

**Storage**: AsyncStorage (local JSON)
**Status**: ✅ Complete, but backend sync disabled

---

### 1.5 **threadService.ts** ✅ FULLY IMPLEMENTED
**Purpose**: Persistent conversation threads for individual tasks

**Architecture**: PHASE 1 & 2 hybrid
- **Memory cache** (instant access)
- **SQLite** (production - PHASE 2)
- **AsyncStorage fallback** (if SQLite unavailable)

**Data Model** (`ThreadMessage`):
```typescript
{
  id: string (msg_${timestamp}_${random})
  taskId: number
  text: string
  sender: 'user' | 'ai' | 'system'
  timestamp: Date
  metadata?: {
    aiGenerated?: boolean
    suggestions?: string[]
    action?: 'created' | 'updated' | 'completed'
  }
}
```

**Key Methods**:
- `getThread(taskId)`: Fetch messages (instant from cache, then SQLite)
- `addMessage()`: Optimistic add to cache + async persist
- `clearThread(taskId)`: Delete all messages for task
- `getAllThreads()`: Retrieve all threads (for SQLite migration)
- `clearCache()`: Memory management

**Features**:
- Automatic SQLite initialization on service load
- Data migration from AsyncStorage → SQLite
- Fallback chain: Memory → SQLite → AsyncStorage
- Background persistence (non-blocking)

**Status**: ✅ Complete, SQLite integration in place

---

### 1.6 **sqliteService.ts** ✅ FULLY IMPLEMENTED
**Purpose**: Local SQLite database for production-grade offline storage

**Database**: `krios.db` with 3 tables:

#### Table: `thread_messages`
```sql
CREATE TABLE thread_messages (
  id TEXT PRIMARY KEY
  task_id INTEGER NOT NULL
  text TEXT NOT NULL
  sender TEXT NOT NULL
  timestamp INTEGER (epoch ms)
  metadata TEXT (JSON)
  synced INTEGER (0/1)
  created_at INTEGER DEFAULT (now)
)
-- Indexes: task_id, timestamp
```

#### Table: `tasks`
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY
  title TEXT NOT NULL
  due_date INTEGER (epoch)
  priority TEXT
  bucket TEXT
  is_completed INTEGER (0/1)
  created_at INTEGER
  updated_at INTEGER
  synced INTEGER (0/1)
  local_changes TEXT (JSON)
  UNIQUE(id)
)
-- Indexes: due_date, is_completed
```

#### Table: `sync_queue`
```sql
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT
  entity_type TEXT (e.g., 'task', 'thread')
  entity_id TEXT
  action TEXT ('create'|'update'|'delete')
  data TEXT (JSON)
  created_at INTEGER DEFAULT (now)
)
-- Index: entity_type, entity_id
```

**Key Methods**:
- `initialize()`: Open/create DB + create tables
- `getThreadMessages(taskId)`: Query all messages for task
- `addThreadMessage()`: Insert message
- `deleteThreadMessages(taskId)`: Clean up task messages
- `migrateFromAsyncStorage()`: Data migration from AsyncStorage
- `clearAllData()`: Reset DB (testing)
- `getStats()`: Count rows per table (debugging)

**Status**: ✅ Complete, production-ready

---

## 2. UI LAYER - Screens

### 2.1 **mobile/app/(home)/task-thread.tsx** ✅ FULLY IMPLEMENTED
**Purpose**: Individual task detail screen with message thread

**Features**:
- **Header**: Task title, priority indicator, bucket, completion toggle
- **Thread Display**: Scrollable message history with:
  - User notes (right-aligned, primary color)
  - System events (left-aligned, subtle with icons)
  - Timestamps, date dividers
  - Type badges (note, reminder, snooze, complete)
  
- **Quick Actions**: Chips for common actions
  - "Remind me" → reminder entry
  - "Snooze 30m" → snooze entry
  - "Note" → add note
  
- **Input Area**: 
  - Text input with multiline support (max 500 chars)
  - Send button with state-based styling
  
- **Integration**: 
  - Uses `threadService` for message persistence
  - Auto-scroll to latest message
  - Keyboard handling (iOS/Android)

**Theme Support**: Full dark/light mode with gradient backgrounds

**Status**: ✅ Complete, production-ready

---

### 2.2 **mobile/app/(home)/ai-chat.tsx** ✅ FULLY IMPLEMENTED
**Purpose**: AI assistant chat screen (Krios)

**Features**:
- **Header**: Krios logo, online status indicator, title
- **Message Display**: 
  - User messages (right-aligned, blue)
  - AI messages (left-aligned, white with logo)
  - Typing indicator with animated dots
  
- **Quick Replies** (hardcoded):
  - "How many tasks?"
  - "Add a task"
  - "Start focus"
  - "Motivate me"
  
- **Responses**: Hardcoded AI responses
  - References home screen for task list
  - Motivational messages
  - Focus mode coming soon notice
  
- **Input**: Message bar with send button
  - Keyboard handling
  - Multiline input (500 char max)
  - Return key submits

**Current Limitations**:
- Responses are hardcoded, not using `aiTaskParser`
- No real AI integration yet
- Chat context not persisted

**Status**: ✅ UI Complete, backend integration pending

---

## 3. UI LAYER - Components

### 3.1 **mobile/components/TaskDetailSheet.tsx** ✅ FULLY IMPLEMENTED
**Purpose**: Modal bottom sheet for detailed task editing

**Features**:
- **Bottom Sheet Modal**: Animated slide-up from bottom
  - Drag-to-dismiss gesture
  - Backdrop with tap-to-close
  - Spring animation
  
- **Header Section**:
  - Priority dot + title
  - Metadata chips (bucket, priority)
  - Completion toggle switch
  - Close button
  
- **Thread Display**:
  - Shows task creation event
  - Priority/due date events
  - User notes
  - Completion status
  - Date dividers
  - Timestamps
  
- **Action Chips**:
  - "Add note" → full-screen text input
  - "Remind me" → option selector (5 options)
  - "Snooze" → option selector (5 options)
  - "Priority" → 3-button selector (low/med/high)
  
- **Delete Button**: Destructive action at bottom
  
- **Thread Building**: `buildInitialThread()` function
  - Reconstructs thread from task data
  - Shows creation, priority, due date, notes, completion

**Data**: Uses `TaskItem` = `PersonalTask` + optional tags

**Styling**:
- Full theme support (dark/light)
- Gradient backgrounds
- Glass-morphism effects
- Color-coded priorities

**Status**: ✅ Complete, production-ready

---

### 3.2 **mobile/components/AIChatSheet.tsx** ✅ FULLY IMPLEMENTED
**Purpose**: Modal AI chat interface for task management via conversation

**Features**:
- **Modal Sheet**: 92% screen height, dismissible
  
- **Header**: 
  - Back button
  - Krios avatar + branding
  - Online indicator
  
- **Chat Interface**:
  - Message bubbles (user vs AI)
  - Typing indicator with animated dots
  - FlatList for performance
  - Auto-scroll to latest
  
- **Quick Replies** (Hardcoded):
  - "What are my tasks today?"
  - "Add a task for me"
  - "How am I doing?"
  - "Help me focus"
  
- **Smart Response Handler**: `getKriosResponse()`
  - Task inquiry detection
  - Status/progress queries
  - Task creation from natural language
  - Fallback responses
  
- **Input Bar**:
  - Text input (500 char max)
  - Send button
  - Keyboard handling
  
- **Typing Animation**:
  - Animated dots with staggered timing
  - 300ms up/down cycle, 600ms pause

**Data Model**:
```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  timestamp: Date
  actions?: ChatAction[]
}

interface ChatAction {
  label: string
  icon: string
  onPress: () => void
}
```

**Current Status**:
- ✅ UI complete
- ⚠️ Responses hardcoded
- ⚠️ Not using `aiTaskParser` yet
- ⚠️ No persistence

**Status**: ✅ UI Complete, integration pending

---

## 4. HOOKS (`mobile/hooks/`)

### 4.1 **useSmartSuggestions.ts** ❌ STUB ONLY
**Current Implementation**:
```typescript
- [suggestions, setSuggestions] state (empty)
- [currentSuggestion, setCurrentSuggestion] state (null)
- acceptSuggestion(id) → logs only
- dismissSuggestion(id) → logs only
```

**Expected to implement**:
- Integration with `suggestionEngine.ts`
- Pattern-based recommendation logic
- Suggestion caching/deduplication
- Tracking acceptance/dismissal

**Status**: ❌ Placeholder, needs implementation

---

### 4.2 **useBehaviorTracking.ts** ⚠️ PARTIALLY STUBBED
**Current Implementation**:
```typescript
- useEffect() hook that:
  - Calls aiBehaviorEngine.trackAppOpen() on mount
  - Listens to AppState 'active' events
  
- Callbacks:
  - trackTaskCreated(task)
  - trackTaskCompleted(task)
  - trackMoodSelected(mood)
```

**Current Status**:
- ✅ Hook structure in place
- ❌ `aiBehaviorEngine` is stubbed (no-op functions)
- ❌ No actual tracking implementation

**Expected Integration**:
- Will call real `aiBehaviorEngine` methods
- Track timestamps, task properties, mood
- Aggregate patterns for recommendations

**Status**: ⚠️ Structure ready, engine missing

---

## 5. CONTEXT & AUTH (`mobile/context/`)

### 5.1 **AuthContext.tsx** ✅ MOSTLY IMPLEMENTED
**Purpose**: Authentication state management with session persistence

**Features Implemented**:

#### Session Persistence (PHASE 1):
- **Secure Storage Keys**:
  - `TOKEN_KEY`: JWT access token
  - `REFRESH_TOKEN_KEY`: Refresh token
  - `cached_user`: Full user object (JSON)
  
- **Optimistic Loading**:
  1. `checkAuthStatus()` checks for token
  2. If token exists, load `cached_user` immediately (instant UI)
  3. Fetch fresh profile in background
  4. Update cache if fresh data available
  
- **Fallback on Auth Error** (401):
  - Clear cache
  - Logout user
  - Don't retry (fast failure)

#### Authentication Methods:
- **`login(email, password)`**:
  - Sends timezone with request
  - Stores token + refresh token + cached user
  - Initializes sync engine (PHASE 3)
  - Detailed error messages (network, timeout, auth, server)
  
- **`signup(name, email, password)`**:
  - Alias for `register(email, password, name)`
  
- **`register(email, password, username)`**:
  - Similar to login
  - Includes timezone
  - Error handling for validation, network
  
- **`logout()`**:
  - Calls logout API endpoint
  - Clears token, refresh token, cache
  - Disconnects sync engine (PHASE 3)
  - Sets user to null
  
- **`updateProfile(updates)`**:
  - PUT request to `/auth/profile`
  - Updates local state

#### Error Handling:
- Network errors with helpful messages
- Timeout detection (20s timeout for login)
- 401 → authentication failure
- 429 → rate limit
- 500 → server error
- Graceful degradation (uses cache if fresh load fails)

#### PHASE 3 Integration:
- Comments reference sync engine initialization/disconnection
- `await syncEngine.initialize(userId, token)` on login
- `syncEngine.disconnect()` on logout

**Timezone Handling**:
- `getUserTimezone()` via `Intl.DateTimeFormat`
- Sent with auth requests for proper scheduling

**Status**: 
- ✅ Session persistence complete
- ✅ Authentication flow solid
- ✅ Error handling comprehensive
- ⚠️ Sync engine calls exist but PHASE 3 not fully implemented

---

## 6. IMPLEMENTATION STATUS MATRIX

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| **Services** |
| AI Task Parser | `aiTaskParser.ts` | ✅ Complete | NLP parser ready for production |
| AI Behavior Engine | `aiBehaviorEngine.ts` | ❌ Empty | Stub placeholder |
| Suggestion Engine | `suggestionEngine.ts` | ❌ Empty | Stub placeholder |
| Task Service | `taskService.ts` | ✅ Complete | Local + sync queue ready |
| Thread Service | `threadService.ts` | ✅ Complete | Memory + SQLite hybrid |
| SQLite Service | `sqliteService.ts` | ✅ Complete | Full schema + migration |
| **Screens** |
| Task Thread | `task-thread.tsx` | ✅ Complete | Full UI + integration |
| AI Chat | `ai-chat.tsx` | ✅ UI Complete | Backend pending |
| **Components** |
| Task Detail Sheet | `TaskDetailSheet.tsx` | ✅ Complete | Full modal with actions |
| AI Chat Sheet | `AIChatSheet.tsx` | ✅ UI Complete | Backend pending |
| **Hooks** |
| useSmartSuggestions | `useSmartSuggestions.ts` | ❌ Stub | Placeholder only |
| useBehaviorTracking | `useBehaviorTracking.ts` | ⚠️ Partial | Structure ready, engine missing |
| **Context** |
| AuthContext | `AuthContext.tsx` | ✅ Mostly Complete | PHASE 3 pending |

---

## 7. WHAT'S MISSING / NOT IMPLEMENTED

### Critical Gaps:

1. **AI Behavior Engine** (`aiBehaviorEngine.ts`)
   - No pattern tracking
   - No recommendations generation
   - No mood tracking
   
2. **Suggestion Engine** (`suggestionEngine.ts`)
   - No implementation at all
   
3. **useSmartSuggestions Hook**
   - Non-functional placeholder
   
4. **Backend Sync** (`taskService.syncTasks()`)
   - Currently disabled
   - Comment: "Backend sync disabled - using offline-first approach"
   - API endpoints not integrated
   
5. **Chat Integration**
   - `ai-chat.tsx` doesn't use `aiTaskParser`
   - Hardcoded responses instead of NLP
   - No persistence of conversation history
   
6. **Real-time Sync Engine** (PHASE 3)
   - References exist in AuthContext
   - `syncEngine` imported but not shown
   - Appears to be stubbed/minimal
   
7. **Notification Service**
   - Exists as file but not examined
   - Used for reminders/snooze?
   
8. **Task Type Handling**
   - Daily/weekly recurrence logic missing
   - No recurring task management UI

---

## 8. DATA FLOW SUMMARY

### Task Creation Flow:
```
User Input (AI Chat or UI)
  ↓
AITaskParser.parseMessage() → TaskIntent
  ↓
taskService.createTask()
  ↓
Add to AsyncStorage + Sync Queue
  ↓
Try syncTasks() (currently disabled)
```

### Task Thread Flow:
```
Task Detail Sheet Opens
  ↓
threadService.getThread(taskId)
  ↓
Check Memory Cache → SQLite → AsyncStorage
  ↓
Display messages
  ↓
User adds note
  ↓
threadService.addMessage() (optimistic update)
  ↓
Persist to SQLite/AsyncStorage in background
```

### Authentication Flow:
```
App Launch
  ↓
AuthContext.checkAuthStatus()
  ↓
Check for TOKEN_KEY
  ↓
Load cached_user immediately (instant UI)
  ↓
Fetch fresh profile in background
  ↓
Update cache if successful
```

---

## 9. TECHNOLOGY STACK

- **Framework**: React Native + Expo
- **State Management**: React Context (Auth)
- **Local Storage**: 
  - AsyncStorage (tasks, sync queue)
  - Secure Storage (tokens, cache)
  - SQLite (production DB)
- **UI Components**: 
  - React Native built-ins
  - Expo Router (navigation)
  - Expo Linear Gradient
  - Expo Vector Icons (Ionicons)
- **Animations**: React Native Animated API
- **HTTP**: Axios
- **Type Safety**: TypeScript

---

## 10. RECOMMENDATIONS FOR NEXT PHASE

1. **Implement AI Behavior Engine**
   - Track task creation patterns
   - Monitor completion rates
   - Collect mood data

2. **Implement Suggestion Engine**
   - Use behavior patterns
   - Generate context-aware suggestions
   - A/B test suggestion formats

3. **Connect AI Chat to Parser**
   - Replace hardcoded responses in `ai-chat.tsx`
   - Use `aiTaskParser` for all inputs
   - Persist conversation history

4. **Enable Backend Sync**
   - Uncomment and test `taskService.syncTasks()`
   - Implement conflict resolution
   - Add retry logic

5. **Implement Real-time Sync** (PHASE 3)
   - Complete `syncEngine` implementation
   - WebSocket for live updates
   - Multi-device sync

6. **Add Recurring Tasks**
   - Implement daily/weekly execution logic
   - UI for recurrence configuration

7. **Implement Reminders/Notifications**
   - Use `notificationService`
   - Push notifications
   - Snooze functionality

8. **Complete Behavior Analytics**
   - Hook `useBehaviorTracking` into real engine
   - Generate insights dashboard

---

## CONCLUSION

The mobile codebase is **well-structured** with a solid foundation:
- ✅ Core task management: functional
- ✅ Local storage: robust (AsyncStorage + SQLite hybrid)
- ✅ UI layer: feature-rich with great UX
- ✅ Authentication: secure with session persistence
- ❌ AI features: mostly stubbed (parser exists, behavior/suggestion engines missing)
- ❌ Backend sync: disabled, needs integration
- ⚠️ Chat integration: UI exists, backend pending

The architecture follows **PHASE 1 & 2** patterns with offline-first design and optimistic updates. PHASE 3 (real-time sync) is partially referenced but not fully implemented.
