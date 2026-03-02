# Krios Mobile App - Batch Implementation Plan

## Overview

This document details the 13 batches (47 improvements) implemented for the Krios AI-powered mobile productivity app using React Native / Expo Router.

---

## Batch 1: Toast & Undo System

### Goal
Implement a toast notification system with undo functionality for task actions.

### Implementation Details

**State Management:**
- Used `useRef` instead of `useState` for toast undo to avoid stale closure issues
- `toastUndoRef` stores the undo function reference

**Key Functions:**
```typescript
const toastUndoRef = useRef<(() => Promise<void> | void) | null>(null);

const showToast = (message: string, undoAction?: () => Promise<void> | void) => {
  toastUndoRef.current = undoAction || null;
  setToastMessage(message);
  // Animate in
  Animated.spring(toastAnim, {
    toValue: 1,
    useNativeDriver: true,
    tension: 80,
    friction: 10,
  }).start();
  // Auto-dismiss after 4 seconds
  toastTimerRef.current = setTimeout(() => {
    dismissToast();
  }, 4000);
};

const handleToastUndo = async () => {
  if (toastUndoRef.current && typeof toastUndoRef.current === 'function') {
    await toastUndoRef.current();
  }
  dismissToast();
};
```

**Features:**
- Animated toast appear/disappear
- Undo button for reversible actions
- Auto-dismiss after 4 seconds
- Used for: task completion, task deletion, task creation, task snooze

---

## Batch 2: Suggestion Cards

### Goal
Display AI-suggested tasks as interactive cards within the chat.

### Implementation Details

**Message Type Extension:**
```typescript
interface Message {
  id: number;
  text: string;
  isUser: boolean;
  isSuggestion?: boolean;
  suggestionData?: {
    title: string;
    priority?: 'high' | 'medium' | 'low';
    reason?: string;
    dueDate?: string;
  };
  timestamp?: number;
}
```

**UI Components:**
- Suggestion badge with 💡 icon
- Title with priority indicator (color-coded: red/yellow/green)
- Reason text explaining why the task was suggested
- Action buttons: Accept, Adjust, Skip

**Handlers:**
- `handleAcceptSuggestion()` - Creates the suggested task
- `handleSkipSuggestion()` - Dismisses with AI follow-up

---

## Batch 3: Task Inline Actions

### Goal
Allow users to perform actions on tasks directly within the task list.

### Implementation Details

**Actions Implemented:**
1. `handleSnoozeTask(taskId, minutes)` - Snooze task with preset durations
2. `handleDeleteTask(taskId)` - Delete with undo support
3. `handleCompleteTask(taskId)` - Mark complete with undo support

**Snooze Dropdown:**
- Animated chip-style dropdown
- Duration options: 15 min, 30 min, 1 hour, Tomorrow, Next Week
- Uses `snoozeTaskId` state to track which task is being snoozed
- Applied `width: '100%'` and proper border styling to fix layout issues

**Removed:**
- Redundant expanded section (consolidated into inline actions)

---

## Batch 4: Mood Chips

### Goal
Allow users to select their current mood, which affects AI responses and UI theming.

### Implementation Details

**Mood Configuration:**
```typescript
const MOOD_CHIPS = [
  { key: 'calm', label: 'Calm', icon: 'leaf-outline', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)', gradient: ['#10b981', '#059669'] },
  { key: 'focused', label: 'Focused', icon: 'eye-outline', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', gradient: ['#3b82f6', '#2563eb'] },
  { key: 'light', label: 'Light', icon: 'sunny-outline', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', gradient: ['#f59e0b', '#d97706'] },
  { key: 'overwhelmed', label: 'Overwhelmed', icon: 'cloud-outline', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', gradient: ['#ef4444', '#dc2626'] },
  { key: 'motivated', label: 'Motivated', icon: 'flame-outline', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)', gradient: ['#8b5cf6', '#7c3aed'] },
];
```

**Helper Functions:**
```typescript
const getMoodColor = (moodKey: string | null): string => {
  const mood = MOOD_CHIPS.find(m => m.key === moodKey);
  return mood?.color || '#7c3aed';
};

const getMoodGradient = (moodKey: string | null): string[] => {
  const mood = MOOD_CHIPS.find(m => m.key === moodKey);
  return mood?.gradient || ['#6366f1', '#8b5cf6', '#a855f7'];
};
```

**Features:**
- Horizontal scrollable mood chips
- Animated selection with spring animation
- Color-coded background and border when selected
- Mood indicator dot
- Context text explaining mood affects AI responses

---

## Batch 5: Smart Greeting

### Goal
Display contextual, time-aware greetings that change based on time of day and day of week.

### Implementation Details

**Greeting Functions:**
```typescript
const getTimeEmoji = () => {
  const hour = new Date().getHours();
  if (hour < 6) return '🌙';
  if (hour < 12) return '🌅';
  if (hour < 17) return '☀️';
  if (hour < 21) return '🌆';
  return '🌙';
};

const getGreeting = () => {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[day];

  if (hour >= 5 && hour < 12) {
    if (day === 1) return 'Fresh Monday morning';
    if (day === 5) return 'Happy Friday morning';
    return `Good ${dayName} morning`;
  }
  if (hour >= 12 && hour < 17) {
    if (day === 5) return 'Happy Friday afternoon';
    return `Good ${dayName} afternoon`;
  }
  if (hour >= 17 && hour < 21) {
    if (day === 5) return 'Happy Friday evening';
    return `Good ${dayName} evening`;
  }
  return `Good ${dayName} night`;
};

const getLeadLine = () => {
  const hour = new Date().getHours();
  const totalTasks = upcomingTasks.length + ongoingTasks.length;

  if (selectedMood === 'overwhelmed') {
    return "Let's break things down into manageable pieces";
  }
  if (selectedMood === 'motivated') {
    return "Perfect time to crush your goals!";
  }
  if (selectedMood === 'calm') {
    return "Let's ease into the day smoothly";
  }

  if (hour < 12) {
    if (totalTasks === 0) return "Ready to plan your day?";
    if (totalTasks <= 3) return "Light day ahead - you've got this";
    return `${totalTasks} tasks waiting - let's prioritize`;
  }
  if (hour < 17) {
    const completedToday = tasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()).length;
    if (completedToday > 0) return `${completedToday} tasks completed - keep the momentum!`;
    return "Time to make progress on your priorities";
  }
  if (hour < 21) {
    return "Wrapping up the day - what's left to finish?";
  }
  return "Time to rest and recharge for tomorrow";
};
```

---

## Batch 6: Up Next Preview Card

### Goal
Show a preview of the next upcoming task below the calendar.

### Implementation Details

**Features:**
- Shows first upcoming task with due date
- Color-coded priority dot
- "+N" badge showing additional tasks count
- Tap to expand task list (navigate to tasks view)

**UI Elements:**
- "UP NEXT" label with primary color
- Task title (truncated to 1 line)
- Due date or "No due date"
- Badge for extra tasks

---

## Batch 7: Context-Aware Prompt Chips

### Goal
Provide dynamic quick-prompt options based on current mood and task context.

### Implementation Details

```typescript
const getPromptChips = () => {
  const totalTasks = upcomingTasks.length + ongoingTasks.length;
  
  if (selectedMood === 'overwhelmed') {
    return [
      { label: 'Simplify my day', icon: 'sparkles-outline' },
      { label: 'What matters most', icon: 'flag-outline' },
      { label: 'Clear my mind', icon: 'trash-outline' },
    ];
  }
  if (selectedMood === 'motivated') {
    return [
      { label: 'Add a challenge', icon: 'trophy-outline' },
      { label: 'Push my limits', icon: 'fitness-outline' },
      { label: 'Track progress', icon: 'analytics-outline' },
    ];
  }
  if (selectedMood === 'calm') {
    return [
      { label: 'Gentle reminder', icon: 'leaf-outline' },
      { label: 'Easy tasks only', icon: 'cafe-outline' },
      { label: 'Take it slow', icon: 'time-outline' },
    ];
  }
  
  if (totalTasks > 10) {
    return [
      { label: 'What\'s urgent?', icon: 'alert-circle-outline' },
      { label: 'Delegate some', icon: 'people-outline' },
      { label: 'Reschedule', icon: 'calendar-outline' },
    ];
  }
  
  if (totalTasks === 0) {
    return [
      { label: 'Plan my day', icon: 'sunny-outline' },
      { label: 'Add a task', icon: 'add-circle-outline' },
      { label: 'Motivate me', icon: 'sparkles-outline' },
    ];
  }
  
  return [
    { label: 'What\'s next?', icon: 'list-outline' },
    { label: 'Quick task', icon: 'flash-outline' },
    { label: 'Help me focus', icon: 'eye-outline' },
  ];
};
```

---

## Batch 8: Focus Mode Enhancements

### Goal
Enhance the focus mode with better visual feedback and current task tracking.

### Implementation Details

**Features:**
- "FOCUSING ON" badge when timer is running
- Shows current task title during focus session
- Icon changes from bulb to flame when active
- Duration picker (15, 25, 45, 60 minutes)
- Timer controls: Start, Pause, Reset

**UI States:**
- Inactive: "Focus Mode" with bulb icon
- Active: "Deep Focus" with flame icon + current task

---

## Batch 9: Task Creation Modal (Bottom Sheet)

### Goal
Create a modal for adding new tasks with bucket options and additional details.

### Implementation Details

**Bucket Chips:**
```typescript
const BUCKET_CHIPS = [
  { key: 'today', label: 'Today', icon: 'today-outline' },
  { key: 'tomorrow', label: 'Tomorrow', icon: 'calendar-outline' },
  { key: 'thisWeek', label: 'This Week', icon: 'calendar-number-outline' },
  { key: 'backlog', label: 'Backlog', icon: 'file-tray-outline' },
];
```

**Modal Features:**
- Slide-up animation using `Animated` API
- Handle bar for dragging indication
- Task title input with auto-focus
- Bucket selection chips
- "More options" collapsible section with:
  - Description (multiline)
  - Priority (high/medium/low)
- Create button

**Later Changed To:**
- Centered modal (instead of bottom sheet) for better cross-platform support

---

## Batch 10: Third Glow Orb (Teal)

### Goal
Add a third decorative glow orb at the bottom-right of the screen.

### Implementation Details

**Orb Configuration:**
```typescript
// Positioned at bottom-right
glowOrb3: {
  position: 'absolute',
  bottom: -140,
  right: -80,
  width: 260,
  height: 260,
  borderRadius: 130,
  backgroundColor: 'rgba(20, 184, 166, 0.06)',
},
glowOrb3Dark: {
  backgroundColor: 'rgba(20, 184, 166, 0.10)',
},
```

**Animation:**
- Drift animation using `Animated.loop()`
- Different duration from other orbs (10s vs 8s/12s)
- Moves in opposite direction for visual interest

---

## Batch 11: Navigation & K Button Enhancements

### Goal
Improve navigation UI and the central K button with animations.

### Implementation Details

**Circular Navigation:**
- 5 items arranged in a circle: Home, Rooms, Settings, Profile, Close
- Labels below each icon
- Animated scale and rotation on open
- Improved visibility for dark mode:
  - Background opacity increased (0.25 → 0.40)
  - Added border
  - Added shadow

**Drawer Navigation:**
- User header with avatar, username, email
- Current mood chip displayed
- Standard list of navigation items

**K Button Pulse Animation:**
```typescript
const kButtonPulse = useRef(new Animated.Value(1)).current;
const kButtonGlow = useRef(new Animated.Value(0.3)).current;

// Smaller pulse (1.08 scale)
Animated.loop(
  Animated.parallel([
    Animated.sequence([
      Animated.timing(kButtonPulse, {
        toValue: 1.08,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(kButtonPulse, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]),
    Animated.sequence([
      Animated.timing(kButtonGlow, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(kButtonGlow, {
        toValue: 0.3,
        duration: 800,
        useNativeDriver: true,
      }),
    ]),
  ])
).start();
```

**K Button Glow Ring:**
- Animated ring that pulses with the button
- Border color changes based on selected mood
- Shadow color matches mood

**Constellation Stars:**
- 5 small animated dots overlaid on the K logo
- Twinkling effect with staggered animations
- Creates a constellation effect on the K logo

---

## Additional Features Implemented

### Search Functionality (Batch 12)
- `searchQuery` state for filtering
- Search input in tasks toolbar
- Filter tasks by title match
- Highlight matching text
- Empty search state with appropriate message

### Focus Session Stats (Batch 13)
- SVG progress ring around timer
- Celebration overlay on session completion
- Stats persisted to AsyncStorage:
  - Total sessions
  - Total minutes focused
  - Efficiency percentage

---

## Key Implementation Patterns

### State Management
- Used `useRef` for animations and to avoid stale closures
- Persisted theme and nav style via AsyncStorage

### Animations
- Spring animations for natural feel
- Parallel animations for complex effects
- Loop animations for continuous effects

### Cross-Platform Considerations
- Platform-specific positioning (iOS vs Android)
- Centered modal instead of bottom sheet for consistency
- Proper keyboard avoidance

### TypeScript
- Strict mode enabled
- Arrays for LinearGradient colors cast with `as any`
- Proper typing for all components and state

---

## Files Modified

- `app/(home)/index.tsx` - Main home screen (~3,300+ lines)
- `services/taskService.ts` - Task CRUD operations
- `services/aiTaskParser.ts` - AI message parsing

---

*Document generated for Krios v1.0 development*
