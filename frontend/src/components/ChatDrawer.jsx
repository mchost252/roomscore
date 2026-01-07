import React, { useState, useEffect, useRef } from 'react';
import {
  Drawer,
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Paper,
  Divider,
  Fab,
  Badge,
  Slide,
  useTheme,
  useMediaQuery,
  Popover,
  Tooltip,
  InputAdornment
} from '@mui/material';
import {
  Send as SendIcon,
  Close as CloseIcon,
  Chat as ChatIcon,
  EmojiEmotions
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

const ChatDrawer = ({ 
  open, 
  onClose, 
  messages = [], 
  onSendMessage, 
  currentUser,
  roomName = 'Room Chat'
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [message, setMessage] = useState('');
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  
  const quickEmojis = ['👍', '❤️', '😂', '🔥', '🎉'];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleEmojiClick = (emoji) => {
    setMessage(prev => prev + emoji);
    setEmojiAnchor(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isMyMessage = (msg) => {
    return msg.userId?._id === currentUser?._id || msg.userId?._id === currentUser?.id || msg.userId === currentUser?._id || msg.userId === currentUser?.id;
  };

  const formatTime = (date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'Just now';
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 450,
          maxWidth: '100vw'
        }
      }}
      transitionDuration={300}
    >
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default'
        }}
      >
        {/* Header */}
        <Paper
          elevation={2}
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 0
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ChatIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              {roomName}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Paper>

        <Divider />

        {/* Messages Container */}
        <Box
          ref={chatContainerRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            bgcolor: 'background.paper',
            backgroundImage: theme.palette.mode === 'dark' 
              ? 'linear-gradient(rgba(255, 255, 255, .02), rgba(255, 255, 255, .02))'
              : 'linear-gradient(rgba(0, 0, 0, .01), rgba(0, 0, 0, .01))',
            '&::-webkit-scrollbar': {
              width: '8px'
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent'
            },
            '&::-webkit-scrollbar-thumb': {
              background: theme.palette.divider,
              borderRadius: '4px',
              '&:hover': {
                background: theme.palette.action.hover
              }
            }
          }}
        >
          {messages.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                opacity: 0.5
              }}
            >
              <ChatIcon sx={{ fontSize: 64, mb: 2, color: 'text.secondary' }} />
              <Typography variant="body1" color="text.secondary">
                No messages yet
              </Typography>
              <Typography variant="body2" color="text.disabled">
                Start the conversation!
              </Typography>
            </Box>
          ) : (
            messages.map((msg, index) => {
              const isMine = isMyMessage(msg);
              const showAvatar = !isMine && (
                index === 0 || 
                messages[index - 1]?.userId?._id !== msg.userId?._id
              );

              return (
                <Slide key={msg._id} direction="up" in={true} timeout={300}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: isMine ? 'row-reverse' : 'row',
                      gap: 1,
                      alignItems: 'flex-end',
                      animation: msg.sending ? 'pulse 1.5s infinite' : 'none',
                      '@keyframes pulse': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.7 }
                      }
                    }}
                  >
                    {/* Avatar */}
                    {showAvatar && !isMine && (
                      <Avatar
                        src={msg.userId?.avatar}
                        alt={msg.userId?.username}
                        sx={{ width: 32, height: 32 }}
                      >
                        {msg.userId?.username?.[0]?.toUpperCase()}
                      </Avatar>
                    )}
                    {!showAvatar && !isMine && <Box sx={{ width: 32 }} />}

                    {/* Message Bubble */}
                    <Box
                      sx={{
                        maxWidth: '75%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMine ? 'flex-end' : 'flex-start'
                      }}
                    >
                      {/* Sender Name (for others) */}
                      {showAvatar && !isMine && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: 1, mb: 0.5 }}
                        >
                          {msg.userId?.username || 'Unknown'}
                        </Typography>
                      )}

                      {/* Message Content */}
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.5,
                          bgcolor: isMine 
                            ? 'primary.main' 
                            : theme.palette.mode === 'dark' 
                              ? 'grey.800' 
                              : 'grey.100',
                          color: isMine ? 'primary.contrastText' : 'text.primary',
                          borderRadius: 2,
                          borderTopRightRadius: isMine ? 4 : 16,
                          borderTopLeftRadius: isMine ? 16 : 4,
                          wordBreak: 'break-word'
                        }}
                      >
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                          {msg.message}
                        </Typography>
                      </Paper>

                      {/* Timestamp */}
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ 
                          mt: 0.5, 
                          mx: 1,
                          fontSize: '0.65rem'
                        }}
                      >
                        {formatTime(msg.createdAt)}
                        {msg.sending && ' • Sending...'}
                      </Typography>
                    </Box>
                  </Box>
                </Slide>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </Box>

        <Divider />

        {/* Input Area */}
        <Paper
          elevation={3}
          sx={{
            p: 2,
            display: 'flex',
            gap: 1,
            alignItems: 'flex-end',
            borderRadius: 0,
            bgcolor: 'background.default'
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            variant="outlined"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <IconButton size="small" onClick={(e) => setEmojiAnchor(e.currentTarget)}>
                    <EmojiEmotions />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                bgcolor: 'background.paper'
              }
            }}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!message.trim()}
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                bgcolor: 'primary.dark'
              },
              '&.Mui-disabled': {
                bgcolor: 'action.disabledBackground'
              }
            }}
          >
            <SendIcon />
          </IconButton>
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
      </Box>
    </Drawer>
  );
};

export default ChatDrawer;
