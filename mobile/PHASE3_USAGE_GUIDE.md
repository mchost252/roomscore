# Phase 3: Real-Time Sync Usage Guide

## Overview

Phase 3 implements **WhatsApp-style real-time synchronization** with:
- ✅ WebSocket for instant updates
- ✅ Offline queue (changes sync when back online)
- ✅ Optimistic UI (instant feedback)
- ✅ Automatic reconnection

---

## How to Use in Rooms Screen

### 1. Subscribe to Real-Time Events

```typescript
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

export default function RoomsScreen() {
  const [rooms, setRooms] = useState([]);
  
  // Listen for new tasks in rooms
  useRealtimeSync('room:task:created', (data) => {
    const { roomId, task } = data;
    setRooms(prev => prev.map(room => 
      room.id === roomId 
        ? { ...room, tasks: [...room.tasks, task] }
        : room
    ));
  });
  
  // Listen for task updates
  useRealtimeSync('room:task:updated', (data) => {
    const { roomId, taskId, updates } = data;
    setRooms(prev => prev.map(room => 
      room.id === roomId 
        ? {
            ...room,
            tasks: room.tasks.map(t => 
              t.id === taskId ? { ...t, ...updates } : t
            )
          }
        : room
    ));
  });
  
  // Listen for room updates
  useRealtimeSync('room:updated', (data) => {
    const { roomId, updates } = data;
    setRooms(prev => prev.map(room => 
      room.id === roomId ? { ...room, ...updates } : room
    ));
  });
  
  return (
    // Your UI
  );
}
```

---

### 2. Optimistic Updates with Sync Queue

```typescript
import { useOptimisticSync } from '../../hooks/useRealtimeSync';

export default function RoomsScreen() {
  const queueSync = useOptimisticSync();
  
  const handleCompleteTask = async (roomId, taskId) => {
    // 1. Update UI immediately (optimistic)
    setRooms(prev => prev.map(room => 
      room.id === roomId 
        ? {
            ...room,
            tasks: room.tasks.map(t => 
              t.id === taskId ? { ...t, completed: true } : t
            )
          }
        : room
    ));
    
    // 2. Queue for background sync
    await queueSync({
      entityType: 'task',
      entityId: taskId.toString(),
      action: 'update',
      data: { 
        roomId,
        completed: true,
        completedAt: new Date().toISOString()
      }
    });
    
    // 3. If online, syncs immediately
    // 4. If offline, queues and syncs when back online
  };
  
  return (
    <Button onPress={() => handleCompleteTask(room.id, task.id)}>
      Complete
    </Button>
  );
}
```

---

### 3. Show Sync Status (Optional)

```typescript
import { useSyncStatus } from '../../hooks/useRealtimeSync';

export default function RoomsScreen() {
  const syncStatus = useSyncStatus();
  
  return (
    <View>
      {!syncStatus.online && (
        <Text style={styles.offlineBanner}>
          📡 Offline - Changes will sync when you're back online
        </Text>
      )}
      
      {syncStatus.queueLength > 0 && (
        <Text style={styles.syncingBanner}>
          🔄 Syncing {syncStatus.queueLength} changes...
        </Text>
      )}
      
      {/* Rest of UI */}
    </View>
  );
}
```

---

## Available Real-Time Events

### Room Events
- `room:updated` - Room settings changed
- `room:task:created` - New task added to room
- `room:task:updated` - Task in room updated
- `room:task:deleted` - Task deleted from room

### Task Events
- `task:updated` - Personal task updated
- `task:completed` - Task marked complete

### Thread Events
- `thread:message` - New message in task thread

### Appreciation Events
- `appreciation:received` - Someone sent you appreciation

---

## Backend Requirements

The backend needs to emit these WebSocket events. Example (Node.js + Socket.IO):

```javascript
// When a room task is created
io.to(`room:${roomId}`).emit('room:task:created', {
  roomId,
  task,
  createdBy: userId
});

// When a task is updated
io.to(`user:${userId}`).emit('task:updated', {
  taskId,
  updates
});
```

---

## How It Works

### Online Mode
1. User makes change → UI updates instantly (optimistic)
2. Change sent via WebSocket to server
3. Server broadcasts to all room members
4. Other users see update in real-time

### Offline Mode
1. User makes change → UI updates instantly
2. Change saved to local sync queue
3. When back online → queue processes automatically
4. Changes sync to server
5. Server broadcasts to others

### Conflict Resolution
- **Last-write-wins** with timestamps
- Server timestamp is source of truth
- If conflict detected, local change is overwritten by server

---

## Testing

1. **Test Offline Sync:**
   - Turn off WiFi
   - Complete a task
   - Turn WiFi back on
   - Check task synced to server

2. **Test Real-Time Updates:**
   - Open room on two devices
   - Add task on Device 1
   - See it appear instantly on Device 2

3. **Test Reconnection:**
   - Force close app with pending changes
   - Reopen app
   - Check changes sync automatically

---

## Next Steps

1. Update backend to emit WebSocket events
2. Add sync indicators to UI
3. Test multi-user scenarios
4. Add conflict resolution UI (if needed)
