import React, { useEffect, useState, useRef } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Badge,
  Divider,
  InputAdornment,
  CircularProgress,
  Popover,
  Tooltip,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  useTheme
} from '@mui/material';
import { Send, ArrowBack, EmojiEmotions, DoneAll, Done, MoreVert, Delete as DeleteIcon, PersonRemove, Close as CloseIcon } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useDeviceType } from '../hooks/useDeviceType';
import { fetchAvatars } from '../hooks/useAvatar';
import UserProfileDialog from '../components/UserProfileDialog';
import useVisibilityRefresh from '../hooks/useVisibilityRefresh';

const MessagesPage = () => {
  const navigate = useNavigate();
  const { friendId } = useParams();
  const { socket, onlineUsers: contextOnlineUsers, isUserOnline, refreshOnlineUsers, connected } = useSocket();
  const { user } = useAuth();
  const { isMobile } = useDeviceType();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [conversations, setConversations] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const menuOpen = Boolean(menuAnchorEl);
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [avatars, setAvatars] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef(null);
  const lastFetchTime = useRef(0);

  const quickEmojis = ['👍', '❤️', '😂', '🔥', '🎉'];

  // Refresh data when user returns to the tab/app
  useVisibilityRefresh(() => {
    loadConversations(true);
  }, 30000); // Minimum 30 seconds between visibility refreshes

  // Sync online users from context
  useEffect(() => {
    if (contextOnlineUsers) {
      setOnlineUsers(contextOnlineUsers);
    }
  }, [contextOnlineUsers]);

  // Request online users on mount and when connected
  useEffect(() => {
    if (connected && refreshOnlineUsers) {
      refreshOnlineUsers();
    }
  }, [connected, refreshOnlineUsers]);

  // Periodically refresh online status (fallback for reliability)
  useEffect(() => {
    if (!refreshOnlineUsers) return;
    
    const interval = setInterval(() => {
      refreshOnlineUsers();
    }, 60000); // Every 60 seconds (reduced from 30s to prevent excessive requests)

    return () => clearInterval(interval);
  }, [refreshOnlineUsers]);

  // Online status indicator component
  const OnlineIndicator = ({ isOnline, size = 12 }) => (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: isOnline ? '#44b700' : 'grey.400',
        border: '2px solid',
        borderColor: 'background.paper',
        position: 'absolute',
        bottom: 0,
        right: 0,
      }}
    />
  );

  useEffect(() => {
    // Load from cache first for instant display
    const cachedConversations = sessionStorage.getItem('conversations_cache');
    let hasCache = false;
    
    if (cachedConversations) {
      try {
        const parsed = JSON.parse(cachedConversations);
        if (Array.isArray(parsed)) {
          setConversations(parsed);
          setConversationsLoaded(true); // Mark as loaded from cache
          hasCache = true;
        }
      } catch (e) {
        console.error('Error parsing cached conversations:', e);
      }
    }
    
    // Always load fresh data on mount (but cache makes it feel instant)
    // If we have cache, treat this as a silent refresh so we don't wipe UI on transient empty responses
    loadConversations(hasCache);
  }, []);

  useEffect(() => {
    if (friendId) {
      loadMessages(friendId);
    }
  }, [friendId]);

  useEffect(() => {
    if (!socket) return;

    const handleNewDirectMessage = (message) => {
      const senderId = getUserId(message.sender);
      const recipientId = getUserId(message.recipient);
      const currentUserId = getUserId(user);
      
      // Confirm delivery to sender (we received it)
      if (senderId !== currentUserId) {
        socket.emit('dm:confirm_delivery', { 
          senderId: senderId, 
          messageIds: [message._id] 
        });
      }
      
      // If we're viewing this conversation, add the message and mark as read
      const selectedFriendId = getUserId(selectedFriend);
      if (selectedFriend && 
          (senderId === selectedFriendId || recipientId === selectedFriendId)) {
        setMessages(prev => [...prev, message]);
        scrollToBottom();
        
        // Mark message as read immediately if from friend and notify sender
        if (senderId === selectedFriendId) {
          socket.emit('dm:read', { 
            senderId: senderId, 
            messageIds: [message._id] 
          });
          // Also call API to persist read status
          api.put(`/direct-messages/read/${senderId}`).catch(() => {});
        }
      }
      
      // Update conversations list in real-time
      setConversations(prev => {
        const friendId = senderId === currentUserId ? recipientId : senderId;
        const existingIdx = prev.findIndex(c => getUserId(c.friend) === friendId);
        
        if (existingIdx >= 0) {
          const updated = [...prev];
          const conv = { ...updated[existingIdx] };
          conv.lastMessage = message;
          // Only increment unread if message is from friend and we're not viewing that chat
          if (senderId !== currentUserId && getUserId(selectedFriend) !== friendId) {
            conv.unreadCount = (conv.unreadCount || 0) + 1;
          }
          updated.splice(existingIdx, 1);
          updated.unshift(conv); // Move to top
          return updated;
        }
        return prev;
      });
    };

    // Handle online status updates
    const handleUserStatus = ({ userId, isOnline }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        if (isOnline) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    };

    // Handle initial online users list
    const handleOnlineUsers = (userIds) => {
      setOnlineUsers(new Set(userIds));
    };

    // Handle read receipts - update message status
    const handleDmRead = ({ readBy, messageIds, readAt }) => {
      const ids = Array.isArray(messageIds) ? messageIds : [];
      setMessages(prev => prev.map(msg => {
        if (ids.includes(msg._id) || (getUserId(msg.recipient) === readBy && !msg.isRead)) {
          return { ...msg, isRead: true, readAt };
        }
        return msg;
      }));
    };

    // Handle message delivered confirmation
    const handleDmDelivered = ({ messageIds }) => {
      const ids = Array.isArray(messageIds) ? messageIds : [];
      setMessages(prev => prev.map(msg => {
        if (ids.includes(msg._id)) {
          return { ...msg, isDelivered: true };
        }
        return msg;
      }));
    };

    socket.on('new_direct_message', handleNewDirectMessage);
    socket.on('user:status', handleUserStatus);
    socket.on('users:online', handleOnlineUsers);
    socket.on('dm:read', handleDmRead);
    socket.on('dm:delivered', handleDmDelivered);

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

    return () => {
      socket.off('new_direct_message', handleNewDirectMessage);
      socket.off('user:status', handleUserStatus);
      socket.off('users:online', handleOnlineUsers);
      socket.off('dm:read', handleDmRead);
      socket.off('dm:delivered', handleDmDelivered);
      socket.off('friend:removed');
    };
  }, [socket, selectedFriend, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleEmojiClick = (emoji) => {
    setNewMessage(prev => prev + emoji);
    setEmojiAnchor(null);
  };

  const handleOpenMenu = (e) => setMenuAnchorEl(e.currentTarget);
  const handleCloseMenu = () => setMenuAnchorEl(null);

  const handleClearChat = async () => {
    const fid = getReliableFriendId();
    if (!fid) return;
    handleCloseMenu();

    try {
      await api.delete(`/direct-messages/${fid}`);
      // Clear UI instantly
      setMessages([]);
      // Update conversations preview
      setConversations(prev => prev.map(c => {
        if (getUserId(c.friend) === fid) {
          return { ...c, lastMessage: null, unreadCount: 0 };
        }
        return c;
      }));
      // Clear cache
      sessionStorage.removeItem(`messages_${fid}`);
    } catch (err) {
      console.error('Error clearing chat:', err);
    }
  };

  const handleRemoveFriend = async () => {
    const fid = getReliableFriendId();
    if (!fid) return;
    handleCloseMenu();

    try {
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

  const loadConversations = async (silentRefresh = false) => {
    // Debounce: prevent multiple rapid calls
    const now = Date.now();
    if (silentRefresh && now - lastFetchTime.current < 2000) {
      console.log('⏳ Skipping conversations fetch - too soon');
      return;
    }
    lastFetchTime.current = now;

    try {
      if (silentRefresh) {
        setIsRefreshing(true);
      }

      const res = await api.get('/direct-messages/conversations', {
        headers: silentRefresh ? {} : { 'x-bypass-cache': 'true' }
      });
      const conversationsData = res.data.conversations || [];

      // IMPORTANT: never wipe existing conversations on silent refresh
      if (silentRefresh && conversationsData.length === 0 && conversations.length > 0) {
        console.warn('⚠️ Silent refresh returned 0 conversations; keeping existing list');
        // Don't retry - just keep showing current data
        return;
      }

      setConversations(conversationsData);
      setConversationsLoaded(true);
      // Cache for instant loading - strip large avatar data
      try {
        const cacheData = conversationsData.map(c => ({
          friend: {
            _id: String(getUserId(c.friend)), // Ensure ID is string for proper serialization
            username: c.friend.username
            // avatar excluded - too large
          },
          lastMessage: c.lastMessage ? {
            message: c.lastMessage.message?.substring(0, 50), // Truncate long messages
            createdAt: c.lastMessage.createdAt
          } : null,
          unreadCount: c.unreadCount
        }));
        sessionStorage.setItem('conversations_cache', JSON.stringify(cacheData));
      } catch (e) {
        sessionStorage.removeItem('conversations_cache');
      }
      
      // Load avatars on-demand after conversations are loaded
      if (conversationsData.length > 0) {
        const userIds = conversationsData.map(c => String(getUserId(c.friend)));
        const avatarMap = await fetchAvatars(userIds);
        const avatarObj = {};
        avatarMap.forEach((avatar, id) => {
          avatarObj[id] = avatar;
        });
        setAvatars(prev => ({ ...prev, ...avatarObj }));
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
      setConversationsLoaded(true); // Still mark as loaded even on error
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadMessages = async (fId) => {
    setMessagesLoading(true);
    try {
      // Load from cache first for instant display
      const cachedMessages = sessionStorage.getItem(`messages_${fId}`);
      if (cachedMessages) {
        try {
          setMessages(JSON.parse(cachedMessages));
        } catch (e) {}
      }
      
      // Find friend info from conversations cache first
      let friendFound = false;
      const cachedConversations = sessionStorage.getItem('conversations_cache');
      if (cachedConversations) {
        try {
          const convs = JSON.parse(cachedConversations);
          const conv = convs.find(c => c.friend._id === fId);
          if (conv) {
            setSelectedFriend(conv.friend);
            friendFound = true;
          }
        } catch (e) {}
      }
      
      // Try friends cache if not in conversations
      if (!friendFound) {
        const cachedFriends = sessionStorage.getItem('friends_cache');
        if (cachedFriends) {
          try {
            const friends = JSON.parse(cachedFriends);
            const friend = friends.find(f => f._id === fId);
            if (friend) {
              setSelectedFriend(friend);
              friendFound = true;
            }
          } catch (e) {}
        }
      }
      
      // If friend still not found, fetch from API first
      if (!friendFound) {
        try {
          const friendsRes = await api.get('/friends');
          const friends = friendsRes.data.friends || [];
          const friend = friends.find(f => f._id === fId);
          if (friend) {
            setSelectedFriend(friend);
            friendFound = true;
            // Update cache - strip avatars
            try {
              const cacheData = friends.map(f => ({
                _id: f._id,
                username: f.username,
                email: f.email,
                totalPoints: f.totalPoints,
                currentStreak: f.currentStreak
              }));
              sessionStorage.setItem('friends_cache', JSON.stringify(cacheData));
            } catch (e) {}
          }
        } catch (e) {
          console.error('Error fetching friends:', e);
        }
      }
      
      // Fetch messages from API
      const res = await api.get(`/direct-messages/${fId}`);
      const messagesData = res.data.messages || [];
      setMessages(messagesData);
      // Cache messages - strip large data and keep only last 20
      try {
        const messagesToCache = messagesData.slice(-20).map(m => ({
          _id: m._id,
          message: m.message,
          createdAt: m.createdAt,
          sender: { _id: m.sender?._id },
          recipient: { _id: m.recipient?._id }
        }));
        sessionStorage.setItem(`messages_${fId}`, JSON.stringify(messagesToCache));
      } catch (e) {
        // Silently fail - caching is optional
      }
      
      // If friend not found in cache, extract from first message
      if (!friendFound && messagesData.length > 0) {
        const firstMsg = messagesData[0];
        const myId = getUserId(user);
        const friendData = getUserId(firstMsg.sender) === myId ? firstMsg.recipient : firstMsg.sender;
        setSelectedFriend(friendData);
      }
      
      // Mark messages as read AFTER they've been loaded and displayed
      // Check if there are any unread messages from the friend
      const currentUserId = getUserId(user);
      const hasUnreadFromFriend = messagesData.some(m => 
        getUserId(m.sender) === fId && getUserId(m.recipient) === currentUserId && !m.isRead
      );
      
      if (hasUnreadFromFriend) {
        // Notify sender via socket that messages were read
        if (socket) {
          const unreadMessageIds = messagesData
            .filter(m => getUserId(m.sender) === fId && !m.isRead)
            .map(m => m._id);
          socket.emit('dm:read', { senderId: fId, messageIds: unreadMessageIds });
        }
        // Persist read status to server (the GET already marked them as read in DB,
        // but we need to emit the socket event to notify the sender)
        api.put(`/direct-messages/read/${fId}`).catch(() => {});
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Normalize IDs across Mongo-style (_id) and Prisma-style (id)
  const getUserId = (u) => u?._id || u?.id || null;
  const getUserName = (u) => u?.username || u?.email || 'Unknown';

  // Validate ID format (support Mongo ObjectId + Prisma cuid/uuid)
  // We only require a non-empty string here because Prisma IDs are not 24-hex.
  const isValidUserId = (id) => typeof id === 'string' && id.trim().length > 0;

  // Get the reliable friend ID - prefer URL param over cached selectedFriend
  const getReliableFriendId = () => {
    // URL param is the primary source
    if (isValidUserId(friendId)) return friendId;
    // Fall back to selectedFriend id
    const sid = getUserId(selectedFriend);
    if (isValidUserId(sid)) return sid;
    return null;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const reliableFriendId = getReliableFriendId();
    if (!reliableFriendId) {
      console.error('Invalid friend ID');
      return;
    }

    const messageText = newMessage.trim();
    const currentReplyTo = replyTo;
    const replyToId = currentReplyTo?._id || null;
    const tempId = `temp_${Date.now()}`;
    
    // Clear input FIRST for instant feel
    setNewMessage('');
    setReplyTo(null);
    
    // Create optimistic message
    const optimisticMessage = {
      _id: tempId,
      message: messageText,
      createdAt: new Date().toISOString(),
      sender: { _id: getUserId(user), id: getUserId(user), username: user.username },
      recipient: { _id: reliableFriendId, id: reliableFriendId },
      replyTo: currentReplyTo ? { _id: replyToId, message: currentReplyTo.message } : null,
      sending: true
    };
    
    // Show message immediately
    setMessages(prev => [...prev, optimisticMessage]);
    
    // Instant scroll (no smooth animation for speed)
    requestAnimationFrame(() => scrollToBottom());
    
    // Fire and forget - don't block UI
    api.post(`/direct-messages/${reliableFriendId}`, {
      message: messageText,
      replyTo: replyToId || undefined
    })
      .then(res => {
        // Update temp ID to real ID (no flicker, keeps position)
        setMessages(prev => prev.map(m => m._id === tempId 
          ? { ...res.data.message, sending: false }
          : m
        ));
      })
      .catch(err => {
        console.error('Error sending message:', err);
        // Mark as failed instead of removing
        setMessages(prev => prev.map(m => m._id === tempId 
          ? { ...m, sending: false, failed: true }
          : m
        ));
        // Could show retry option here
      });
  };

  const handleSelectConversation = (friend) => {
    const fid = getUserId(friend);
    // Clear unread count immediately in UI
    setConversations(prev => prev.map(c => 
      getUserId(c.friend) === fid ? { ...c, unreadCount: 0 } : c
    ));
    
    // NOTE: Don't mark messages as read here - let loadMessages handle it
    // after messages are actually loaded and displayed to the user
    
    if (isMobile) {
      navigate(`/messages/${fid}`);
    } else {
      setSelectedFriend(friend);
      loadMessages(fid);
    }
  };

  const formatTime = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);
    
    // Format time as HH:MM AM/PM
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Today: just show time
    if (diffDays === 0) return timeStr;
    // Yesterday
    if (diffDays === 1) return `Yesterday ${timeStr}`;
    // This week: show day name
    if (diffDays < 7) {
      const dayName = d.toLocaleDateString([], { weekday: 'short' });
      return `${dayName} ${timeStr}`;
    }
    // Older: show date and time
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` ${timeStr}`;
  };

  // Mobile view - show either conversations or selected chat
  if (isMobile) {
    // Show loading or chat when friendId is present
    if (friendId) {
      // Show loading spinner while selectedFriend is being fetched
      if (!selectedFriend) {
        return (
          <Container maxWidth="lg" sx={{ height: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', px: { xs: 2, sm: 3, md: 4 } }}>
            <CircularProgress />
          </Container>
        );
      }
      
      return (
        <>
          <UserProfileDialog 
            open={profileDialogOpen}
            onClose={() => setProfileDialogOpen(false)}
            userId={getUserId(selectedFriend)}
          />
          <Box sx={{ 
            height: '100dvh', // Use dynamic viewport height for mobile keyboard support
            minHeight: '-webkit-fill-available', // iOS Safari fix
            display: 'flex', 
            flexDirection: 'column', 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'background.paper',
            zIndex: 1200, // Increased to be above AppLayout sidebar backdrop (which is drawer zIndex - 1)
            overflow: 'hidden',
            // Ensure this view is fully opaque and covers everything
            isolation: 'isolate',
          }}>
            {/* Chat Header */}
            <Paper elevation={2} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderRadius: 0 }}>
              <IconButton onClick={() => navigate('/messages')}>
                <ArrowBack />
              </IconButton>
              <Box 
                sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, cursor: 'pointer' }}
                onClick={() => setProfileDialogOpen(true)}
              >
                <Box sx={{ position: 'relative' }}>
                  <Avatar
                    src={avatars[getUserId(selectedFriend)] || selectedFriend?.avatar}
                    sx={{ width: 44, height: 44 }}
                  >
                    {getUserName(selectedFriend)?.[0]}
                  </Avatar>
                  <OnlineIndicator isOnline={onlineUsers.has(getUserId(selectedFriend))} size={14} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
                    {getUserName(selectedFriend)}
                  </Typography>
                  <Typography variant="caption" color={onlineUsers.has(getUserId(selectedFriend)) ? 'success.main' : 'text.secondary'}>
                    {onlineUsers.has(getUserId(selectedFriend)) ? 'Online' : 'Offline'}
                  </Typography>
                </Box>
              </Box>

              {/* 3-dot menu */}
              <IconButton onClick={handleOpenMenu}>
                <MoreVert />
              </IconButton>
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
            </Paper>

            {/* Messages */}
            <Box sx={{ 
              flex: 1, 
              overflowY: 'auto', 
              p: 2, 
              bgcolor: 'background.default',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {messagesLoading && messages.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : messages.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No messages yet. Start the conversation!
                  </Typography>
                </Box>
              ) : (
                <>
                  <Box sx={{ flexGrow: 1 }} /> {/* Pushes messages to bottom */}
                  {messages.map((msg, idx) => {
                    // Skip messages with missing sender data
                    const senderRawId = getUserId(msg.sender);
                    if (!senderRawId) return null;
                    const senderId = String(senderRawId);
                    const currentUserId = String(getUserId(user) || '');
                    const isOwn = senderId === currentUserId;
                    // Enable tap-to-reply
                    const handleReply = () => setReplyTo({ _id: msg._id, message: msg.message, sender: msg.sender });
                    return (
                      <Box
                        key={msg._id || idx}
                        sx={{
                          display: 'flex',
                          justifyContent: isOwn ? 'flex-end' : 'flex-start',
                          mb: 0.5,
                          px: 1,
                          animation: msg._id?.startsWith?.('temp_') ? 'slideIn 0.2s ease-out' : 'none',
                          '@keyframes slideIn': {
                            from: { opacity: 0, transform: 'translateY(10px)' },
                            to: { opacity: 1, transform: 'translateY(0)' }
                          }
                        }}
                      >
                        {/* WhatsApp-style bubble with tail */}
                        <Box
                          onClick={handleReply}
                          sx={{
                            position: 'relative',
                            p: '8px 12px',
                            pb: '6px',
                            maxWidth: '80%',
                            bgcolor: isOwn 
                              ? isDark ? '#005c4b' : '#dcf8c6'
                              : isDark ? '#1f2c34' : '#ffffff',
                            color: isDark ? '#e9edef' : '#111b21',
                            borderRadius: isOwn ? '8px 8px 0 8px' : '8px 8px 8px 0',
                            boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
                            cursor: 'pointer',
                            '&::after': {
                              content: '""',
                              position: 'absolute',
                              bottom: 0,
                              width: 0,
                              height: 0,
                              border: '6px solid transparent',
                              ...(isOwn ? {
                                right: '-6px',
                                borderLeftColor: isDark ? '#005c4b' : '#dcf8c6',
                                borderBottom: 'none',
                                borderRight: 'none',
                              } : {
                                left: '-6px',
                                borderRightColor: isDark ? '#1f2c34' : '#ffffff',
                                borderBottom: 'none',
                                borderLeft: 'none',
                              }),
                            },
                          }}
                        >
                          {/* Reply preview if exists */}
                          {msg.replyTo && (
                            <Box sx={{
                              p: 1,
                              mb: 0.5,
                              bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                              borderLeft: '3px solid',
                              borderColor: 'primary.main',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                            }}>
                              <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }} noWrap>
                                {msg.replyTo.message || 'Message'}
                              </Typography>
                            </Box>
                          )}
                          <Typography variant="body2" sx={{ wordBreak: 'break-word', fontSize: '14.2px', lineHeight: 1.4 }}>
                            {msg.message}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, mt: 0.25, float: 'right', ml: 1 }}>
                            <Typography variant="caption" sx={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)', lineHeight: 1 }}>
                              {formatTime(msg.createdAt)}
                            </Typography>
                            {isOwn && (
                              msg.isRead ? (
                                <DoneAll sx={{ fontSize: 14, color: '#53bdeb' }} />
                              ) : msg.isDelivered || !msg._id?.startsWith?.('temp_') ? (
                                <DoneAll sx={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)' }} />
                              ) : (
                                <Done sx={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)' }} />
                              )
                            )}
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </>
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Reply Bar */}
            {replyTo && (
              <Box sx={{
                px: 2,
                py: 1,
                bgcolor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
                borderTop: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}>
                <Box sx={{
                  flex: 1,
                  pl: 1.5,
                  borderLeft: '3px solid',
                  borderColor: 'primary.main',
                }}>
                  <Typography variant="caption" color="primary" fontWeight={600}>
                    Replying to {replyTo.sender?.username || 'message'}
                  </Typography>
                  <Typography variant="body2" noWrap sx={{ opacity: 0.7, fontSize: '0.8rem' }}>
                    {replyTo.message}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => setReplyTo(null)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            )}

            {/* Message Input */}
            <Paper 
              component="form" 
              onSubmit={handleSendMessage} 
              elevation={3}
              sx={{ 
                p: 1.5, 
                borderRadius: 0,
                borderTop: replyTo ? 'none' : '1px solid',
                borderColor: 'divider',
                flexShrink: 0, // Prevent shrinking
                pb: 'env(safe-area-inset-bottom, 12px)' // Account for iOS safe area
              }}
            >
              <TextField
                fullWidth
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '24px',
                    bgcolor: 'background.default'
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <IconButton size="small" onClick={(e) => setEmojiAnchor(e.currentTarget)}>
                        <EmojiEmotions />
                      </IconButton>
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton 
                        type="submit" 
                        disabled={!newMessage.trim()}
                        color="primary"
                        sx={{ 
                          bgcolor: newMessage.trim() ? 'primary.main' : 'transparent',
                          color: newMessage.trim() ? 'primary.contrastText' : 'text.disabled',
                          '&:hover': {
                            bgcolor: newMessage.trim() ? 'primary.dark' : 'transparent'
                          },
                          width: 36,
                          height: 36
                        }}
                      >
                        <Send fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Paper>
          </Box>
          
          {/* Emoji Picker Popover */}
          <Popover
            open={Boolean(emojiAnchor)}
            anchorEl={emojiAnchor}
            onClose={() => setEmojiAnchor(null)}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
          >
            <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
              {quickEmojis.map((emoji) => (
                <Tooltip key={emoji} title={emoji}>
                  <IconButton onClick={() => handleEmojiClick(emoji)} sx={{ fontSize: '1.5rem' }}>
                    {emoji}
                  </IconButton>
                </Tooltip>
              ))}
            </Box>
          </Popover>
        </>
      );
    }

    // Conversations list for mobile
    return (
      <>
        <UserProfileDialog 
          open={profileDialogOpen}
          onClose={() => setProfileDialogOpen(false)}
          userId={getUserId(selectedFriend)}
        />
        <Container maxWidth="lg" sx={{ mt: isMobile ? 2 : 4, mb: isMobile ? 10 : 4, px: { xs: 2, sm: 3, md: 4 } }}>
        <Paper>
          <Box sx={{ p: 2 }}>
            <Typography variant="h5" fontWeight="bold">
              Messages
            </Typography>
          </Box>
          <Divider />
          {!conversationsLoaded ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : conversations.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                No conversations yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Add friends to start messaging
              </Typography>
              <Button variant="contained" onClick={() => navigate('/friends')}>
                Go to Friends
              </Button>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {conversations.map((conv, idx) => (
                <React.Fragment key={getUserId(conv.friend)}>
                  {idx > 0 && <Divider />}
                  <ListItem button onClick={() => handleSelectConversation(conv.friend)}>
                    <ListItemAvatar>
                      <Badge badgeContent={conv.unreadCount} color="error">
                        <Box sx={{ position: 'relative' }}>
                          <Avatar src={avatars[getUserId(conv.friend)] || conv.friend.avatar}>{getUserName(conv.friend)?.[0]}</Avatar>
                          <OnlineIndicator isOnline={onlineUsers.has(getUserId(conv.friend))} />
                        </Box>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={getUserName(conv.friend)}
                      secondary={
                        conv.lastMessage ? (
                          <Typography variant="body2" noWrap>
                            {conv.lastMessage.message}
                          </Typography>
                        ) : 'No messages yet'
                      }
                    />
                    {conv.lastMessage && (
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(conv.lastMessage.createdAt)}
                      </Typography>
                    )}
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </Paper>
      </Container>
      </>
    );
  }

  // Desktop view - split screen
  return (
    <>
      <UserProfileDialog 
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        userId={getUserId(selectedFriend)}
      />
      <Container maxWidth="lg" sx={{ mt: 2, mb: 2, height: 'calc(100vh - 100px)' }}>
      <Paper sx={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
        {/* Conversations List */}
        <Box sx={{ width: 320, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight="bold">
              Messages
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {!conversationsLoaded ? (
              <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
                <CircularProgress size={30} />
              </Box>
            ) : conversations.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  No conversations yet
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Add friends to start messaging
                </Typography>
                <Button variant="contained" size="small" onClick={() => navigate('/friends')}>
                  Go to Friends
                </Button>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {conversations.map((conv) => (
                  <ListItem
                    key={getUserId(conv.friend)}
                    button
                    selected={getUserId(selectedFriend) === getUserId(conv.friend)}
                    onClick={() => handleSelectConversation(conv.friend)}
                  >
                    <ListItemAvatar>
                      <Badge badgeContent={conv.unreadCount} color="error">
                        <Box sx={{ position: 'relative' }}>
                          <Avatar src={avatars[getUserId(conv.friend)] || conv.friend.avatar}>{getUserName(conv.friend)?.[0]}</Avatar>
                          <OnlineIndicator isOnline={onlineUsers.has(getUserId(conv.friend))} />
                        </Box>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={getUserName(conv.friend)}
                      secondary={
                        conv.lastMessage ? (
                          <Typography variant="body2" noWrap>
                            {conv.lastMessage.message}
                          </Typography>
                        ) : 'No messages yet'
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Box>

        {/* Chat Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedFriend ? (
            <>
              {/* Chat Header */}
              <Box 
                sx={{ 
                  p: 2, 
                  borderBottom: 1, 
                  borderColor: 'divider', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
                onClick={() => setProfileDialogOpen(true)}
              >
                <Box sx={{ position: 'relative' }}>
                  <Avatar src={avatars[getUserId(selectedFriend)] || selectedFriend?.avatar}>{getUserName(selectedFriend)?.[0]}</Avatar>
                  <OnlineIndicator isOnline={onlineUsers.has(getUserId(selectedFriend))} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
                    {getUserName(selectedFriend)}
                  </Typography>
                  <Typography variant="caption" color={onlineUsers.has(getUserId(selectedFriend)) ? 'success.main' : 'text.secondary'}>
                    {onlineUsers.has(getUserId(selectedFriend)) ? 'Online' : 'Offline'}
                  </Typography>
                </Box>
              </Box>

              {/* Messages */}
              <Box sx={{ 
                flex: 1, 
                overflowY: 'auto', 
                p: 2, 
                bgcolor: 'background.default',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {messagesLoading && messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No messages yet. Start the conversation!
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ flexGrow: 1 }} /> {/* Pushes messages to bottom */}
                    {messages.map((msg, idx) => {
                      // Skip messages with missing sender data
                      const senderRawId = getUserId(msg.sender);
                      if (!senderRawId) return null;
                      const senderId = String(senderRawId);
                      const currentUserId = String(getUserId(user) || '');
                      const isOwn = senderId === currentUserId;
                      const handleReplyDesktop = () => setReplyTo({ _id: msg._id, message: msg.message, sender: msg.sender });
                      return (
                        <Box
                          key={msg._id || idx}
                          sx={{
                            display: 'flex',
                            justifyContent: isOwn ? 'flex-end' : 'flex-start',
                            mb: 0.5,
                            px: 1,
                            animation: msg._id?.startsWith?.('temp_') ? 'slideIn 0.2s ease-out' : 'none',
                            '@keyframes slideIn': {
                              from: { opacity: 0, transform: 'translateY(10px)' },
                              to: { opacity: 1, transform: 'translateY(0)' }
                            }
                          }}
                        >
                          {/* WhatsApp-style bubble with tail */}
                          <Box
                            onClick={handleReplyDesktop}
                            sx={{
                              position: 'relative',
                              p: '8px 12px',
                              pb: '6px',
                              maxWidth: '60%',
                              bgcolor: isOwn 
                                ? isDark ? '#005c4b' : '#dcf8c6'
                                : isDark ? '#1f2c34' : '#ffffff',
                              color: isDark ? '#e9edef' : '#111b21',
                              borderRadius: isOwn ? '8px 8px 0 8px' : '8px 8px 8px 0',
                              boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
                              cursor: 'pointer',
                              '&::after': {
                                content: '""',
                                position: 'absolute',
                                bottom: 0,
                                width: 0,
                                height: 0,
                                border: '6px solid transparent',
                                ...(isOwn ? {
                                  right: '-6px',
                                  borderLeftColor: isDark ? '#005c4b' : '#dcf8c6',
                                  borderBottom: 'none',
                                  borderRight: 'none',
                                } : {
                                  left: '-6px',
                                  borderRightColor: isDark ? '#1f2c34' : '#ffffff',
                                  borderBottom: 'none',
                                  borderLeft: 'none',
                                }),
                              },
                              '&:hover': {
                                filter: 'brightness(0.97)',
                              },
                            }}
                          >
                            {/* Reply preview if exists */}
                            {msg.replyTo && (
                              <Box sx={{
                                p: 1,
                                mb: 0.5,
                                bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                                borderLeft: '3px solid',
                                borderColor: 'primary.main',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                              }}>
                                <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }} noWrap>
                                  {msg.replyTo.message || 'Message'}
                                </Typography>
                              </Box>
                            )}
                            <Typography variant="body2" sx={{ wordBreak: 'break-word', fontSize: '14.2px', lineHeight: 1.4 }}>
                              {msg.message}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, mt: 0.25, float: 'right', ml: 1 }}>
                              <Typography variant="caption" sx={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)', lineHeight: 1 }}>
                                {formatTime(msg.createdAt)}
                              </Typography>
                              {isOwn && (
                                msg.isRead ? (
                                  <DoneAll sx={{ fontSize: 14, color: '#53bdeb' }} />
                                ) : msg.isDelivered || !msg._id?.startsWith?.('temp_') ? (
                                  <DoneAll sx={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)' }} />
                                ) : (
                                  <Done sx={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)' }} />
                                )
                              )}
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}
                  </>
                )}
                <div ref={messagesEndRef} />
              </Box>

              {/* Reply Bar - Desktop */}
              {replyTo && (
                <Box sx={{
                  px: 2,
                  py: 1,
                  bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)',
                  borderTop: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}>
                  <Box sx={{
                    flex: 1,
                    pl: 1.5,
                    borderLeft: '3px solid',
                    borderColor: 'primary.main',
                  }}>
                    <Typography variant="caption" color="primary" fontWeight={600}>
                      Replying to {replyTo.sender?.username || 'message'}
                    </Typography>
                    <Typography variant="body2" noWrap sx={{ opacity: 0.7, fontSize: '0.8rem' }}>
                      {replyTo.message}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setReplyTo(null)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}

              {/* Message Input */}
              <Box 
                component="form" 
                onSubmit={handleSendMessage} 
                sx={{ 
                  p: 2, 
                  borderTop: replyTo ? 0 : 1, 
                  borderColor: 'divider',
                  bgcolor: 'background.paper'
                }}
              >
                <TextField
                  fullWidth
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '24px',
                      bgcolor: 'background.default'
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <IconButton size="small" onClick={(e) => setEmojiAnchor(e.currentTarget)}>
                          <EmojiEmotions />
                        </IconButton>
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton 
                          type="submit" 
                          disabled={!newMessage.trim()}
                          color="primary"
                          sx={{ 
                            bgcolor: newMessage.trim() ? 'primary.main' : 'transparent',
                            color: newMessage.trim() ? 'primary.contrastText' : 'text.disabled',
                            '&:hover': {
                              bgcolor: newMessage.trim() ? 'primary.dark' : 'transparent'
                            },
                            width: 36,
                            height: 36
                          }}
                        >
                          <Send fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Box>
            </>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Typography variant="body1" color="text.secondary">
                Select a conversation to start messaging
              </Typography>
            </Box>
          )}
        </Box>

        {/* 3-dot menu */}
        <IconButton onClick={handleOpenMenu}>
          <MoreVert />
        </IconButton>
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
      </Paper>
      </Container>
    </>
  );
};

export default MessagesPage;
