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
  CircularProgress
} from '@mui/material';
import { Send, ArrowBack } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useDeviceType } from '../hooks/useDeviceType';

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
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
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
      // Refresh conversations to update last message and unread count
      loadConversations();
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

  const loadConversations = async () => {
    try {
      const res = await api.get('/direct-messages/conversations');
      setConversations(res.data.conversations || []);
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
  };

  const loadMessages = async (fId) => {
    try {
      setLoading(true);
      const res = await api.get(`/direct-messages/${fId}`);
      setMessages(res.data.messages || []);
      
      // Find friend info from conversations or fetch it
      const conv = conversations.find(c => c.friend._id === fId);
      if (conv) {
        setSelectedFriend(conv.friend);
      } else {
        // If not in conversations yet, fetch friend info
        const friendRes = await api.get(`/friends`);
        const friend = friendRes.data.friends.find(f => f._id === fId);
        if (friend) {
          setSelectedFriend(friend);
        }
      }
      
      // Refresh conversations to update unread count
      loadConversations();
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedFriend) return;

    try {
      setSending(true);
      const res = await api.post(`/direct-messages/${selectedFriend._id}`, {
        message: newMessage.trim()
      });
      setMessages(prev => [...prev, res.data.message]);
      setNewMessage('');
      scrollToBottom();
      loadConversations();
    } catch (err) {
      console.error('Error sending message:', err);
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
    if (friendId && selectedFriend) {
      return (
        <Container maxWidth="md" sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', p: 0 }}>
          {/* Chat Header */}
          <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/messages')}>
              <ArrowBack />
            </IconButton>
            <Avatar src={selectedFriend.avatar}>{selectedFriend.username[0]}</Avatar>
            <Typography variant="h6" fontWeight="bold">
              {selectedFriend.username}
            </Typography>
          </Paper>

          {/* Messages */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : messages.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No messages yet. Start the conversation!
                </Typography>
              </Box>
            ) : (
              messages.map((msg, idx) => {
                const isOwn = msg.sender._id === user?._id;
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
                      sx={{
                        p: 1.5,
                        maxWidth: '70%',
                        bgcolor: isOwn ? 'primary.main' : 'grey.100',
                        color: isOwn ? 'white' : 'text.primary'
                      }}
                    >
                      <Typography variant="body2">{msg.message}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5 }}>
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
        </Container>
      );
    }

    // Conversations list for mobile
    return (
      <Container maxWidth="md" sx={{ mt: 2, mb: 4 }}>
        <Paper>
          <Box sx={{ p: 2 }}>
            <Typography variant="h5" fontWeight="bold">
              Messages
            </Typography>
          </Box>
          <Divider />
          {conversations.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                No conversations yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add friends to start messaging
              </Typography>
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
    );
  }

  // Desktop view - split screen
  return (
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
            {conversations.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  No conversations yet
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Add friends to start messaging
                </Typography>
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
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar src={selectedFriend.avatar}>{selectedFriend.username[0]}</Avatar>
                <Typography variant="h6" fontWeight="bold">
                  {selectedFriend.username}
                </Typography>
              </Box>

              {/* Messages */}
              <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No messages yet. Start the conversation!
                    </Typography>
                  </Box>
                ) : (
                  messages.map((msg, idx) => {
                    const isOwn = msg.sender._id === user?._id;
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
                          sx={{
                            p: 1.5,
                            maxWidth: '70%',
                            bgcolor: isOwn ? 'primary.main' : 'grey.100',
                            color: isOwn ? 'white' : 'text.primary'
                          }}
                        >
                          <Typography variant="body2">{msg.message}</Typography>
                          <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5 }}>
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
  );
};

export default MessagesPage;
