# Friend Deletion Flow - Complete Source Code Analysis

## Overview
This document contains the complete friend deletion/unfriend flow across web frontend, backend routes, and socket events. Mobile should implement the same pattern.

---

## 1. FRONTEND: MessagesPage.jsx - Friend Deletion

### Key Handler: `handleRemoveFriend()` (Lines 301-320)

```jsx
const handleRemoveFriend = async () => {
  const fid = getReliableFriendId();
  if (!fid) return;
  handleCloseMenu();

  try {
    // API CALL: DELETE /friends/:friendId
    await api.delete(`/friends/${fid}`);
    
    // Remove conversation locally
    setConversations(prev => prev.filter(c => getUserId(c.friend) !== fid));
    
    // Clear state
    setMessages([]);
    setSelectedFriend(null);
    
    // Clear cache
    sessionStorage.removeItem(`messages_${fid}`);
    
    // Navigate back
    navigate('/messages');
  } catch (err) {
    console.error('Error removing friend:', err);
  }
};
```

**What this does:**
1. Gets reliable friend ID (from URL param or selectedFriend)
2. Calls `DELETE /friends/:friendId` API endpoint
3. On success:
   - Removes friend from conversations list
   - Clears messages UI
   - Clears selectedFriend state
   - Removes session cache for that friend's messages
   - Navigates back to /messages

### Socket Event Handler: `handleFriendRemoved()` (Lines 239-250)

```jsx
const handleFriendRemoved = ({ friendId }) => {
  // If the current chat was removed, exit the chat
  if (getUserId(selectedFriend) === friendId) {
    setMessages([]);
    setSelectedFriend(null);
    if (isMobile) navigate('/messages');
  }
  // Remove from conversations
  setConversations(prev => prev.filter(c => getUserId(c.friend) !== friendId));
};

socket.on('friend:removed', handleFriendRemoved);
```

**What this does:**
- Listens for `friend:removed` socket event (sent by backend when other user unfriends)
- If currently viewing that friend's chat, clears messages and returns to conversations
- Removes friend from conversations list for UI update
- On mobile, navigates back to /messages

### UI Integration: Menu Options (Lines 698-723)

```jsx
<Menu anchorEl={menuAnchorEl} open={menuOpen} onClose={handleCloseMenu}>
  <MenuItem
    onClick={() => {
      if (window.confirm('Clear chat history? This cannot be undone.')) {
        handleClearChat();
      } else {
        handleCloseMenu();
      }
    }}
  >
    <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
    Clear chat history
  </MenuItem>
  <MenuItem
    onClick={() => {
      if (window.confirm('Remove this friend? This will also clear your chat history.')) {
        handleRemoveFriend();
      } else {
        handleCloseMenu();
      }
    }}
  >
    <ListItemIcon><PersonRemove fontSize="small" /></ListItemIcon>
    Remove user
  </MenuItem>
</Menu>
```

**Confirmation dialogs:**
- "Clear chat history? This cannot be undone."
- "Remove this friend? This will also clear your chat history."

---

## 2. BACKEND: friends.js - Unfriend Endpoint

### Route: DELETE /api/friends/:friendId (Lines 215-257)

**Duplicate routes detected** - There are TWO delete routes defined (lines 215 and 382). The first one (lines 215-257) is the primary and includes both friendship deletion AND chat clearing.

```javascript
// @route   DELETE /api/friends/:friendId
// @desc    Remove a friend (unfriend). Also clears DM history.
// @access  Private
router.delete('/:friendId', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;

    // 1. Find friendship
    const friendship = await prisma.friend.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { fromUserId: userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: userId }
        ]
      }
    });

    if (!friendship) {
      return res.status(404).json({ success: false, message: 'Friendship not found' });
    }

    // 2. Delete the friendship
    await prisma.friend.delete({ where: { id: friendship.id } });

    // 3. Clear direct message history between users
    await prisma.directMessage.deleteMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: userId }
        ]
      }
    });

    // 4. Emit socket events so both users update UI
    const io = req.app.get('io');
    if (io) {
      // Notify the current user
      io.to(`user:${userId}`).emit('friend:removed', { friendId });
      
      // Notify the friend (pass current user's ID so they know who removed them)
      io.to(`user:${friendId}`).emit('friend:removed', { friendId: userId });
    }

    res.json({ success: true, message: 'Friend removed' });
  } catch (error) {
    next(error);
  }
});
```

**Key actions:**
1. **Verify friendship exists** - Must be "accepted" status
2. **Delete friendship record** from Friend table
3. **Hard delete all direct messages** between the two users (no soft delete, completely removes messages)
4. **Emit socket events to both users:**
   - To removing user: `friend:removed` with `friendId` (friend being removed)
   - To other user: `friend:removed` with `friendId: userId` (the user who removed them)

**IMPORTANT DIFFERENCES from chat clearing:**
- Chat clearing (DELETE /direct-messages/:friendId) uses SOFT DELETE (adds user to deletedFor array)
- Friend deletion (DELETE /friends/:friendId) uses HARD DELETE (permanently removes all messages)

---

## 3. BACKEND: directMessages.js - Chat Clearing Endpoint

### Route: DELETE /api/direct-messages/:friendId (Lines 257-328)

This is called separately when user chooses "Clear chat history" WITHOUT removing friend.

```javascript
// @route   DELETE /api/direct-messages/:friendId
// @desc    Clear direct message history with a specific friend (soft delete for current user only)
// @access  Private
router.delete('/:friendId', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;

    // Verify friendship exists
    const friendship = await prisma.friend.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { fromUserId: userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: userId }
        ]
      }
    });

    if (!friendship) {
      return res.status(403).json({ success: false, message: 'Not friends with this user' });
    }

    // Soft delete: Add current user to deletedFor array instead of hard deleting
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: userId }
        ]
      },
      select: { id: true, deletedFor: true }
    });

    let updatedCount = 0;
    let permanentlyDeletedCount = 0;
    
    for (const msg of messages) {
      if (!msg.deletedFor.includes(userId)) {
        // Check if the other user has already deleted this message
        const otherUserId = msg.deletedFor.length > 0 ? msg.deletedFor[0] : null;
        const bothDeleted = otherUserId && (otherUserId === friendId || msg.deletedFor.includes(friendId));
        
        if (bothDeleted || msg.deletedFor.includes(friendId)) {
          // Both users have now deleted - permanently remove from database
          await prisma.directMessage.delete({
            where: { id: msg.id }
          });
          permanentlyDeletedCount++;
        } else {
          // Only this user is deleting - add to deletedFor array
          await prisma.directMessage.update({
            where: { id: msg.id },
            data: {
              deletedFor: { push: userId }
            }
          });
          updatedCount++;
        }
      }
    }

    logger.info(`User ${userId} cleared chat with ${friendId}: ${updatedCount} soft-deleted, ${permanentlyDeletedCount} permanently deleted`);
    res.json({ 
      success: true, 
      deleted: updatedCount + permanentlyDeletedCount, 
      message: 'Chat history cleared for you' 
    });
  } catch (error) {
    next(error);
  }
});
```

**Key behavior:**
- Uses SOFT DELETE (adds userId to deletedFor array)
- If OTHER user already deleted the message, it's HARD DELETED instead
- Messages are only shown to users who haven't deleted them
- When unfriending, this happens AUTOMATICALLY via friends.js (hard delete)

---

## 4. BACKEND: Socket Events

### Socket Event: `friend:removed` (No dedicated handler in socketHandler.js)

**NOTE:** The socketHandler.js file does NOT contain any dedicated `friend:removed` event listener. It only EMITS this event (from friends.js route handler).

The emission happens in `friends.js` lines 246-251:

```javascript
// Emit socket events so both users update UI
const io = req.app.get('io');
if (io) {
  io.to(`user:${userId}`).emit('friend:removed', { friendId });
  io.to(`user:${friendId}`).emit('friend:removed', { friendId: userId });
}
```

**Event structure:**
- **Channel:** `user:${userId}` (personal user room)
- **Event name:** `friend:removed`
- **Payload:** `{ friendId: string }`
  - For the user who removed: `friendId` = friend being removed
  - For the friend being removed: `friendId` = user who removed them

**Listeners registered on frontend** (MessagesPage.jsx lines 250):
```javascript
socket.on('friend:removed', handleFriendRemoved);
```

---

## 5. Database Schema Impact

### Friendship Deletion
- **Table:** `Friend`
- **Action:** Record is DELETED (hard delete)

### Message Deletion (on unfriend)
- **Table:** `DirectMessage`
- **Action:** ALL messages between users are DELETED (hard delete)
- **Note:** If user first cleared chat (soft delete) and then unfriends, soft-deleted messages are also hard-deleted

### Message Deletion (chat clear only)
- **Table:** `DirectMessage`
- **Field:** `deletedFor` (array field)
- **Action:** Current userId is added to deletedFor array (soft delete)
- **Hard delete:** Only occurs when BOTH users have deleted the message

---

## 6. Complete Flow Diagram

### Scenario 1: User Removes Friend (handleRemoveFriend)

```
Frontend (MessagesPage.jsx)
  ↓
User clicks "Remove user" menu
  ↓
Confirmation dialog: "Remove this friend? This will also clear your chat history."
  ↓
handleRemoveFriend() executes
  ↓
DELETE /api/friends/:friendId (API call)
  ↓
Backend (friends.js DELETE route)
  ├─ Find friendship (status: 'accepted')
  ├─ DELETE from Friend table
  ├─ DELETE ALL from DirectMessage table
  └─ Emit socket events
      ├─ to user:${userId} → friend:removed { friendId }
      └─ to user:${friendId} → friend:removed { friendId: userId }
  ↓
Response: { success: true, message: 'Friend removed' }
  ↓
Frontend receives success
  ├─ Remove from conversations list
  ├─ Clear messages state
  ├─ Clear selectedFriend
  ├─ Remove session cache
  └─ Navigate to /messages

Other user receives friend:removed socket event
  ↓
handleFriendRemoved() executes
  ├─ Clear messages if viewing that chat
  ├─ Clear selectedFriend
  ├─ Remove from conversations list
  └─ Navigate to /messages (mobile only)
```

### Scenario 2: User Clears Chat Only (handleClearChat)

```
Frontend (MessagesPage.jsx)
  ↓
User clicks "Clear chat history" menu
  ↓
Confirmation dialog: "Clear chat history? This cannot be undone."
  ↓
handleClearChat() executes
  ↓
DELETE /api/direct-messages/:friendId (API call)
  ↓
Backend (directMessages.js DELETE route)
  ├─ Find friendship (verify exists)
  ├─ Loop through all messages between users
  ├─ For each message:
  │  ├─ If friend already deleted → Hard delete
  │  └─ If friend didn't delete → Soft delete (add to deletedFor)
  └─ Return count of deleted messages
  ↓
Response: { success: true, deleted: N, message: 'Chat history cleared for you' }
  ↓
Frontend receives success
  ├─ Clear messages state
  ├─ Update conversations to remove lastMessage
  ├─ Set unreadCount to 0
  └─ Remove session cache

NOTE: No socket events emitted to other user (they still see the chat)
```

---

## 7. Key Implementation Details for Mobile

### What to implement:

1. **Menu with two options:**
   - "Clear chat history" → DELETE /direct-messages/:friendId
   - "Remove user" → DELETE /friends/:friendId

2. **Confirmation dialogs:**
   - "Clear chat history? This cannot be undone."
   - "Remove this friend? This will also clear your chat history."

3. **API calls:**
   ```
   DELETE /api/friends/:friendId
   DELETE /api/direct-messages/:friendId
   ```

4. **Socket event listeners:**
   ```
   socket.on('friend:removed', ({ friendId }) => {
     // If currently viewing that chat, exit
     // Remove from conversations list
   })
   ```

5. **State cleanup on unfriend:**
   - Remove from conversations list
   - Clear messages
   - Clear selectedFriend
   - Clear any cached data
   - Navigate back to conversations list

6. **Frontend response handler:**
   - Both API calls should clear chat UI immediately
   - Only /friends endpoint should also remove from friends list
   - Only /friends endpoint should also trigger socket event handling

### Important notes:

- **Hard vs Soft delete:**
  - Chat clear = soft delete (user to deletedFor array)
  - Unfriend = hard delete (all messages permanently removed)
  
- **Socket events:**
  - Only emitted on /friends/:friendId DELETE
  - Not emitted on /direct-messages/:friendId DELETE
  - Both users get notified of unfriend via socket
  
- **Cache clearing:**
  - Always clear session/local storage for that friend's messages
  - Always clear that friend from conversations cache
  
- **User feedback:**
  - Use confirmation dialogs before deletion (window.confirm equivalent on mobile)
  - Show error if deletion fails
  - Optionally show success toast/snackbar

---

## 8. URL Paths & IDs

All endpoints use the **friend's ID** (not message IDs):
- `DELETE /api/friends/:friendId` ← friend's user ID
- `DELETE /api/direct-messages/:friendId` ← friend's user ID
- Socket event payload: `{ friendId: string }` ← friend's user ID

ID normalization on frontend:
```javascript
const getUserId = (u) => u?._id || u?.id || null;
```

Supports both MongoDB `_id` and Prisma `id` fields.

---

## Summary

The complete unfriend/friend deletion flow:
1. User clicks menu → chooses "Remove user"
2. Confirmation dialog appears
3. `handleRemoveFriend()` calls `DELETE /friends/:friendId`
4. Backend deletes friendship + all messages (hard delete)
5. Backend emits `friend:removed` socket events to both users
6. Frontend clears conversations, messages, state
7. Frontend navigates back to /messages
8. Other user receives socket event and updates their UI

Mobile should replicate this exact pattern.
