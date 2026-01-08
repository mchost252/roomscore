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
  Button
} from '@mui/material';
import { Send, ArrowBack, EmojiEmotions, DoneAll, Done } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useDeviceType } from '../hooks/useDeviceType';
import UserProfileDialog from '../components/UserProfileDialog';

const MessagesPage = () => {
  const navigate = useNavigate();
  const { friendId } = useParams();
  const { socket } = useSocket();
  const { user } = useAuth();
  const { isMobile } = useDeviceType();
  const [conversations, setConversations] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const messagesEndRef = useRef(null);

  const quickEmojis = ['👍', '❤️', '😂', '🔥', '🎉'];

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
    loadConversations();
  }, []);

  useEffect(() => {
    if (friendId) {
      loadMessages(friendId);
    }
  }, [friendId]);

  useEffect(() => {
    if (!socket) return;

    const handleNewDirectMessage = (message) => {
      const senderId = message.sender._id;
      const recipientId = message.recipient._id;
      const currentUserId = user?._id || user?.id;
      
      // Confirm delivery to sender (we received it)
      if (senderId !== currentUserId) {
        socket.emit('dm:confirm_delivery', { 
          senderId: senderId, 
          messageIds: [message._id] 
        });
      }
      
      // If we're viewing this conversation, add the message and mark as read
      if (selectedFriend && 
          (senderId === selectedFriend._id || recipientId === selectedFriend._id)) {
        setMessages(prev => [...prev, message]);
        scrollToBottom();
        
        // Mark message as read immediately if from friend and notify sender
        if (senderId === selectedFriend._id) {
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
        const existingIdx = prev.findIndex(c => c.friend._id === friendId);
        
        if (existingIdx >= 0) {
          const updated = [...prev];
          const conv = { ...updated[existingIdx] };
          conv.lastMessage = message;
          // Only increment unread if message is from friend and we're not viewing that chat
          if (senderId !== currentUserId && selectedFriend?._id !== friendId) {
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
      setMessages(prev => prev.map(msg => {
        if (messageIds.includes(msg._id) || (msg.recipient?._id === readBy && !msg.isRead)) {
          return { ...msg, isRead: true, readAt };
        }
        return msg;
      }));
    };

    // Handle message delivered confirmation
    const handleDmDelivered = ({ messageIds }) => {
      setMessages(prev => prev.map(msg => {
        if (messageIds.includes(msg._id)) {
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

    return () => {
      socket.off('new_direct_message', handleNewDirectMessage);
      socket.off('user:status', handleUserStatus);
      socket.off('users:online', handleOnlineUsers);
      socket.off('dm:read', handleDmRead);
      socket.off('dm:delivered', handleDmDelivered);
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

  const loadConversations = async () => {
    try {
      const res = await api.get('/direct-messages/conversations');
      const conversationsData = res.data.conversations || [];
      setConversations(conversationsData);
      setConversationsLoaded(true);
      // Cache for instant loading - strip large avatar data
      try {
        const cacheData = conversationsData.map(c => ({
          friend: {
            _id: c.friend._id,
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
    } catch (err) {
      console.error('Error loading conversations:', err);
      setConversationsLoaded(true); // Still mark as loaded even on error
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
        const friendData = firstMsg.sender._id === user?._id ? firstMsg.recipient : firstMsg.sender;
        setSelectedFriend(friendData);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Validate MongoDB ObjectId format (24 hex characters)
  const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(id);

  // Get the reliable friend ID - prefer URL param over cached selectedFriend
  const getReliableFriendId = () => {
    // URL param is always reliable
    if (friendId && isValidObjectId(friendId)) return friendId;
    // Fall back to selectedFriend._id only if valid
    if (selectedFriend?._id && isValidObjectId(selectedFriend._id)) return selectedFriend._id;
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
    setNewMessage(''); // Clear input immediately for better UX
    
    // Create optimistic message for instant UI feedback
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      message: messageText,
      createdAt: new Date().toISOString(),
      sender: { _id: user._id || user.id },
      recipient: { _id: reliableFriendId }
    };
    
    // Show message immediately
    setMessages(prev => [...prev, optimisticMessage]);
    scrollToBottom();
    
    try {
      const res = await api.post(`/direct-messages/${reliableFriendId}`, {
        message: messageText
      });
      // Replace optimistic message with real one
      setMessages(prev => prev.map(m => m._id === tempId ? res.data.message : m));
    } catch (err) {
      console.error('Error sending message:', err);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m._id !== tempId));
      setNewMessage(messageText); // Restore message on error
    }
  };

  const handleSelectConversation = (friend) => {
    // Clear unread count immediately in UI
    setConversations(prev => prev.map(c => 
      c.friend._id === friend._id ? { ...c, unreadCount: 0 } : c
    ));
    
    // Mark messages as read on server
    api.put(`/direct-messages/read/${friend._id}`).catch(() => {});
    
    if (isMobile) {
      navigate(`/messages/${friend._id}`);
    } else {
      setSelectedFriend(friend);
      loadMessages(friend._id);
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
          <Container maxWidth="md" sx={{ height: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
          </Container>
        );
      }
      
      return (
        <>
          <UserProfileDialog 
            open={profileDialogOpen}
            onClose={() => setProfileDialogOpen(false)}
            userId={selectedFriend?._id}
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
            zIndex: 1100,
            overflow: 'hidden'
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
                  <Avatar src={selectedFriend.avatar} sx={{ width: 44, height: 44 }}>{selectedFriend.username[0]}</Avatar>
                  <OnlineIndicator isOnline={onlineUsers.has(selectedFriend._id)} size={14} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
                    {selectedFriend.username}
                  </Typography>
                  <Typography variant="caption" color={onlineUsers.has(selectedFriend._id) ? 'success.main' : 'text.secondary'}>
                    {onlineUsers.has(selectedFriend._id) ? 'Online' : 'Offline'}
                  </Typography>
                </Box>
              </Box>
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
                    if (!msg?.sender?._id) return null;
                    const senderId = String(msg.sender._id);
                    const currentUserId = String(user?._id || user?.id || '');
                    const isOwn = senderId === currentUserId;
                    return (
                      <Box
                        key={msg._id || idx}
                        sx={{
                          display: 'flex',
                          justifyContent: isOwn ? 'flex-end' : 'flex-start',
                          mb: 1.5,
                          animation: msg._id?.startsWith?.('temp_') ? 'slideIn 0.2s ease-out' : 'none',
                          '@keyframes slideIn': {
                            from: { opacity: 0, transform: 'translateY(10px)' },
                            to: { opacity: 1, transform: 'translateY(0)' }
                          }
                        }}
                      >
                        <Box
                          sx={{
                            py: 1.5,
                            px: 2,
                            maxWidth: '75%',
                            bgcolor: isOwn ? 'primary.main' : 'background.paper',
                            color: isOwn ? 'primary.contrastText' : 'text.primary',
                            borderRadius: isOwn ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                            boxShadow: isOwn ? '0 1px 2px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.1)',
                            border: isOwn ? 'none' : '1px solid',
                            borderColor: 'divider'
                          }}
                        >
                          <Typography variant="body1" sx={{ color: 'inherit', wordBreak: 'break-word' }}>{msg.message}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                opacity: 0.7, 
                                color: 'inherit',
                                fontSize: '0.7rem'
                              }}
                            >
                              {formatTime(msg.createdAt)}
                            </Typography>
                            {isOwn && (
                              msg.isRead ? (
                                <DoneAll sx={{ fontSize: 14, color: '#53bdeb' }} /> // Blue = seen
                              ) : msg.isDelivered || !msg._id?.startsWith?.('temp_') ? (
                                <DoneAll sx={{ fontSize: 14, color: 'inherit', opacity: 0.7 }} /> // Gray double = delivered
                              ) : (
                                <Done sx={{ fontSize: 14, color: 'inherit', opacity: 0.5 }} /> // Single = sent/sending
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

            {/* Message Input */}
            <Paper 
              component="form" 
              onSubmit={handleSendMessage} 
              elevation={3}
              sx={{ 
                p: 1.5, 
                borderRadius: 0,
                borderTop: '1px solid',
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
          userId={selectedFriend?._id}
        />
        <Container maxWidth="md" sx={{ mt: isMobile ? 2 : 4, mb: isMobile ? 10 : 4, px: isMobile ? 1 : 3 }}>
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
                <React.Fragment key={conv.friend._id}>
                  {idx > 0 && <Divider />}
                  <ListItem button onClick={() => handleSelectConversation(conv.friend)}>
                    <ListItemAvatar>
                      <Badge badgeContent={conv.unreadCount} color="error">
                        <Box sx={{ position: 'relative' }}>
                          <Avatar src={conv.friend.avatar}>{conv.friend.username[0]}</Avatar>
                          <OnlineIndicator isOnline={onlineUsers.has(conv.friend._id)} />
                        </Box>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={conv.friend.username}
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
        userId={selectedFriend?._id}
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
                    key={conv.friend._id}
                    button
                    selected={selectedFriend?._id === conv.friend._id}
                    onClick={() => handleSelectConversation(conv.friend)}
                  >
                    <ListItemAvatar>
                      <Badge badgeContent={conv.unreadCount} color="error">
                        <Box sx={{ position: 'relative' }}>
                          <Avatar src={conv.friend.avatar}>{conv.friend.username[0]}</Avatar>
                          <OnlineIndicator isOnline={onlineUsers.has(conv.friend._id)} />
                        </Box>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={conv.friend.username}
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
                  <Avatar src={selectedFriend.avatar}>{selectedFriend.username[0]}</Avatar>
                  <OnlineIndicator isOnline={onlineUsers.has(selectedFriend._id)} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
                    {selectedFriend.username}
                  </Typography>
                  <Typography variant="caption" color={onlineUsers.has(selectedFriend._id) ? 'success.main' : 'text.secondary'}>
                    {onlineUsers.has(selectedFriend._id) ? 'Online' : 'Offline'}
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
                      if (!msg?.sender?._id) return null;
                      const senderId = String(msg.sender._id);
                      const currentUserId = String(user?._id || user?.id || '');
                      const isOwn = senderId === currentUserId;
                      return (
                        <Box
                          key={msg._id || idx}
                          sx={{
                            display: 'flex',
                            justifyContent: isOwn ? 'flex-end' : 'flex-start',
                            mb: 1.5,
                            animation: msg._id?.startsWith?.('temp_') ? 'slideIn 0.2s ease-out' : 'none',
                            '@keyframes slideIn': {
                              from: { opacity: 0, transform: 'translateY(10px)' },
                              to: { opacity: 1, transform: 'translateY(0)' }
                            }
                          }}
                        >
                          <Box
                            sx={{
                              py: 1.5,
                              px: 2,
                              maxWidth: '60%',
                              bgcolor: isOwn ? 'primary.main' : 'background.paper',
                              color: isOwn ? 'primary.contrastText' : 'text.primary',
                              borderRadius: isOwn ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                              boxShadow: isOwn ? '0 1px 2px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.1)',
                              border: isOwn ? 'none' : '1px solid',
                              borderColor: 'divider'
                            }}
                          >
                            <Typography variant="body1" sx={{ color: 'inherit', wordBreak: 'break-word' }}>{msg.message}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  opacity: 0.7, 
                                  color: 'inherit',
                                  fontSize: '0.7rem'
                                }}
                              >
                                {formatTime(msg.createdAt)}
                              </Typography>
                              {isOwn && (
                                msg.isRead ? (
                                  <DoneAll sx={{ fontSize: 14, color: '#53bdeb' }} /> // Blue = seen
                                ) : msg.isDelivered || !msg._id?.startsWith?.('temp_') ? (
                                  <DoneAll sx={{ fontSize: 14, color: 'inherit', opacity: 0.7 }} /> // Gray double = delivered
                                ) : (
                                  <Done sx={{ fontSize: 14, color: 'inherit', opacity: 0.5 }} /> // Single = sent/sending
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

              {/* Message Input */}
              <Box 
                component="form" 
                onSubmit={handleSendMessage} 
                sx={{ 
                  p: 2, 
                  borderTop: 1, 
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
      </Paper>
      </Container>
    </>
  );
};

export default MessagesPage;
