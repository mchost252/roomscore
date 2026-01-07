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
import { Send, ArrowBack, EmojiEmotions } from '@mui/icons-material';
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
  const [sending, setSending] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const messagesEndRef = useRef(null);

  const quickEmojis = ['👍', '❤️', '😂', '🔥', '🎉'];

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
      // If we're viewing this conversation, add the message
      if (selectedFriend && 
          (message.sender._id === selectedFriend._id || message.recipient._id === selectedFriend._id)) {
        setMessages(prev => [...prev, message]);
        scrollToBottom();
      }
      // Update conversations in cache only - don't refetch
      // This prevents slow API calls on every message
    };

    socket.on('new_direct_message', handleNewDirectMessage);

    return () => {
      socket.off('new_direct_message', handleNewDirectMessage);
    };
  }, [socket, selectedFriend]);

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
      // Cache for instant loading next time - cache even if empty
      sessionStorage.setItem('conversations_cache', JSON.stringify(conversationsData));
    } catch (err) {
      console.error('Error loading conversations:', err);
      setConversationsLoaded(true); // Still mark as loaded even on error
      // Don't clear cache on error - keep showing cached data
    }
  };

  const loadMessages = async (fId) => {
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
            // Update cache
            sessionStorage.setItem('friends_cache', JSON.stringify(friends));
          }
        } catch (e) {
          console.error('Error fetching friends:', e);
        }
      }
      
      // Fetch messages from API
      const res = await api.get(`/direct-messages/${fId}`);
      const messagesData = res.data.messages || [];
      setMessages(messagesData);
      // Cache messages
      sessionStorage.setItem(`messages_${fId}`, JSON.stringify(messagesData));
      
      // If friend not found in cache, extract from first message
      if (!friendFound && messagesData.length > 0) {
        const firstMsg = messagesData[0];
        const friendData = firstMsg.sender._id === user?._id ? firstMsg.recipient : firstMsg.sender;
        setSelectedFriend(friendData);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedFriend || sending) return;

    const messageText = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX
    
    try {
      setSending(true);
      const res = await api.post(`/direct-messages/${selectedFriend._id}`, {
        message: messageText
      });
      const updatedMessages = [...messages, res.data.message];
      setMessages(updatedMessages);
      // Update cache immediately
      sessionStorage.setItem(`messages_${selectedFriend._id}`, JSON.stringify(updatedMessages));
      scrollToBottom();
      // Don't refresh conversations on send - it's too slow
      // loadConversations(); // Removed for performance
    } catch (err) {
      console.error('Error sending message:', err);
      setNewMessage(messageText); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const handleSelectConversation = (friend) => {
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
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
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
          <Container maxWidth="md" sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', p: 0, mb: 8 }}>
            {/* Chat Header */}
            <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/messages')}>
              <ArrowBack />
            </IconButton>
            <Box 
              sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, cursor: 'pointer' }}
              onClick={() => setProfileDialogOpen(true)}
            >
              <Avatar src={selectedFriend.avatar}>{selectedFriend.username[0]}</Avatar>
              <Typography variant="h6" fontWeight="bold">
                {selectedFriend.username}
              </Typography>
            </Box>
          </Paper>

          {/* Messages */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {messages.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No messages yet. Start the conversation!
                </Typography>
              </Box>
            ) : (
              messages.map((msg, idx) => {
                const isOwn = msg.sender._id.toString() === user?._id.toString();
                return (
                  <Box
                    key={msg._id || idx}
                    sx={{
                      display: 'flex',
                      justifyContent: isOwn ? 'flex-end' : 'flex-start',
                      mb: 1
                    }}
                  >
                    <Paper
                      elevation={1}
                      sx={{
                        p: 1.5,
                        maxWidth: '70%',
                        bgcolor: isOwn ? 'primary.main' : 'background.default',
                        color: isOwn ? 'primary.contrastText' : 'text.primary',
                        border: isOwn ? 'none' : '1px solid',
                        borderColor: isOwn ? 'transparent' : 'divider'
                      }}
                    >
                      <Typography variant="body2" sx={{ color: 'inherit' }}>{msg.message}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5, color: 'inherit' }}>
                        {formatTime(msg.createdAt)}
                      </Typography>
                    </Paper>
                  </Box>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Message Input */}
          <Paper component="form" onSubmit={handleSendMessage} sx={{ p: 2 }}>
            <TextField
              fullWidth
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sending}
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
                    <IconButton type="submit" disabled={!newMessage.trim() || sending}>
                      {sending ? <CircularProgress size={20} /> : <Send />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Paper>
          
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
          </Container>
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
                        <Avatar src={conv.friend.avatar}>{conv.friend.username[0]}</Avatar>
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
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ height: '70vh', display: 'flex' }}>
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
                        <Avatar src={conv.friend.avatar}>{conv.friend.username[0]}</Avatar>
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
                <Avatar src={selectedFriend.avatar}>{selectedFriend.username[0]}</Avatar>
                <Typography variant="h6" fontWeight="bold">
                  {selectedFriend.username}
                </Typography>
              </Box>

              {/* Messages */}
              <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                {messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No messages yet. Start the conversation!
                    </Typography>
                  </Box>
                ) : (
                  messages.map((msg, idx) => {
                    const isOwn = msg.sender._id.toString() === user?._id.toString();
                    return (
                      <Box
                        key={msg._id || idx}
                        sx={{
                          display: 'flex',
                          justifyContent: isOwn ? 'flex-end' : 'flex-start',
                          mb: 1
                        }}
                      >
                        <Paper
                          elevation={1}
                          sx={{
                            p: 1.5,
                            maxWidth: '70%',
                            bgcolor: isOwn ? 'primary.main' : 'background.default',
                            color: isOwn ? 'primary.contrastText' : 'text.primary',
                            border: isOwn ? 'none' : '1px solid',
                            borderColor: isOwn ? 'transparent' : 'divider'
                          }}
                        >
                          <Typography variant="body2" sx={{ color: 'inherit' }}>{msg.message}</Typography>
                          <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5, color: 'inherit' }}>
                            {formatTime(msg.createdAt)}
                          </Typography>
                        </Paper>
                      </Box>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </Box>

              {/* Message Input */}
              <Box component="form" onSubmit={handleSendMessage} sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <TextField
                  fullWidth
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={sending}
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
                        <IconButton type="submit" disabled={!newMessage.trim() || sending}>
                          {sending ? <CircularProgress size={20} /> : <Send />}
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
