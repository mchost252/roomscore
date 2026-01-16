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
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Chip
} from '@mui/material';
import {
  Send as SendIcon,
  Close as CloseIcon,
  Chat as ChatIcon,
  EmojiEmotions,
  Star,
  Whatshot,
  Shield,
  NotificationsActive
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

const ChatDrawer = ({ 
  open, 
  onClose, 
  messages = [], 
  onSendMessage, 
  currentUser,
  roomName = 'Room Chat',
  roomMembers = [],
  onSendAppreciation,
  appreciationRemaining = 3,
  sentAppreciations = new Set(),
  appreciationStatsByUser = {},
  onSendNudge,
  canNudge = false,
  nudgeStatus = null, // { hasCompletedTask: bool, alreadySentToday: bool }
  nudging = false
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [message, setMessage] = useState('');
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const messagesEndRef = useRef(null);
  const [appreciationDialogOpen, setAppreciationDialogOpen] = useState(false);
  const [selectedAppreciationType, setSelectedAppreciationType] = useState(null);
  const [quickAppreciateUser, setQuickAppreciateUser] = useState(null);
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
      onSendMessage(message.trim(), replyTo?.messageId || replyTo?._id || null);
      setMessage('');
      setReplyTo(null);
    }
  };

  const handleEmojiClick = (emoji) => {
    setMessage(prev => prev + emoji);
    setEmojiAnchor(null);
  };

  // Handle appreciation dialog opening
  const handleAppreciationClick = () => {
    setSelectedAppreciationType(null);
    setAppreciationDialogOpen(true);
  };

  // Handle appreciation type selection
  const handleAppreciationTypeSelect = (type) => {
    setSelectedAppreciationType(type);
  };

  // Handle member selection for appreciation
  const handleMemberSelect = (memberId) => {
    if (selectedAppreciationType && onSendAppreciation) {
      onSendAppreciation(memberId, selectedAppreciationType);
      setAppreciationDialogOpen(false);
      setSelectedAppreciationType(null);
    }
  };

  // Quick appreciation from chat message
  const handleQuickAppreciate = (userId, type) => {
    if (onSendAppreciation) {
      onSendAppreciation(userId, type);
      setQuickAppreciateUser(null);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getUserId = (u) => u?._id || u?.id || u || null;
  const isMyMessage = (msg) => {
    const msgUserId = getUserId(msg.userId);
    const myId = getUserId(currentUser);
    return msgUserId === myId;
  };

  const getAppreciationDisplay = (userId) => {
    const uid = getUserId(userId);
    const stats = appreciationStatsByUser?.[uid];
    if (!stats) return [];

    const mapping = [
      { type: 'star', emoji: '⭐', count: stats.star || 0 },
      { type: 'fire', emoji: '🔥', count: stats.fire || 0 },
      { type: 'shield', emoji: '🛡️', count: stats.shield || 0 }
    ];

    // Only show if count > 0. If count==1 show emoji only; if >1 show emoji+count.
    return mapping
      .filter(x => x.count > 0)
      .map(x => ({
        type: x.type,
        label: x.count === 1 ? x.emoji : `${x.emoji}${x.count}`
      }));
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
              // Render system messages (nudges, task completions, etc.) as compact center text
              if (msg.messageType === 'system' || msg.type === 'system' || msg.isSystemMessage) {
                return (
                  <Slide key={msg._id || `sys-${index}`} direction="up" in={true} timeout={200}>
                    <Box sx={{ textAlign: 'center', my: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {msg.message}
                      </Typography>
                    </Box>
                  </Slide>
                );
              }

              const isMine = isMyMessage(msg);
              const msgUserId = getUserId(msg.userId);
              const prevUserId = getUserId(messages[index - 1]?.userId);
              const showAvatar = !isMine && (
                index === 0 || prevUserId !== msgUserId
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
                      {/* Sender Name (always show badges if available) */}
                      {(showAvatar || isMine) && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: isMine ? 0 : 1, mb: 0.5 }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                            <span>{isMine ? 'You' : (msg.userId?.username || 'Unknown')}</span>
                            {getAppreciationDisplay(msg.userId).map((b) => (
                              <Chip
                                key={b.type}
                                label={b.label}
                                size="small"
                                variant="outlined"
                                sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
                              />
                            ))}
                          </Box>
                        </Typography>
                      )}

                      {/* Message Content */}
                      {/* Reply preview */}
                      {msg.replyTo && (
                        <Box sx={{
                          mb: 0.5,
                          px: 1,
                          py: 0.5,
                          borderLeft: 3,
                          borderColor: 'primary.light',
                          bgcolor: isMine ? 'rgba(255,255,255,0.1)' : 'action.hover',
                          borderRadius: 1
                        }}>
                          <Typography variant="caption" color="text.secondary">
                            Replying to {msg.replyTo?.sender?.username || msg.replyTo?.userId?.username || 'message'}:
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block' }} noWrap>
                            {msg.replyTo?.message}
                          </Typography>
                        </Box>
                      )}
                      <Paper
                        elevation={0}
                        onClick={() => setReplyTo({ _id: msg._id, messageId: msg._id, message: msg.message, sender: msg.userId })}
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
                          wordBreak: 'break-word',
                          cursor: 'pointer'
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
                  <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center' }}>
                    <Tooltip title="Emoji">
                      <IconButton 
                        size="small" 
                        onClick={(e) => setEmojiAnchor(e.currentTarget)}
                        sx={{ color: 'text.secondary' }}
                      >
                        <EmojiEmotions fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {appreciationRemaining > 0 && (
                      <Tooltip title={`Send appreciation (${appreciationRemaining} left today)`}>
                        <IconButton 
                          size="small" 
                          onClick={handleAppreciationClick}
                          sx={{ 
                            color: 'warning.main',
                            '&:hover': { bgcolor: 'warning.50' }
                          }}
                        >
                          <Badge 
                            badgeContent={appreciationRemaining} 
                            color="primary"
                            sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', minWidth: 14, height: 14 } }}
                          >
                            <Star fontSize="small" />
                          </Badge>
                        </IconButton>
                      </Tooltip>
                    )}
                    {/* Nudge Button - Show different states */}
                    {nudgeStatus?.alreadySentToday ? (
                      <Tooltip title="✓ You've already sent your daily nudge">
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                          <IconButton 
                            size="small" 
                            disabled
                            sx={{ color: 'success.main', opacity: 0.6 }}
                          >
                            <NotificationsActive fontSize="small" />
                          </IconButton>
                        </Box>
                      </Tooltip>
                    ) : !nudgeStatus?.hasCompletedTask ? (
                      <Tooltip title="Complete a task first to unlock nudge">
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                          <IconButton 
                            size="small" 
                            disabled
                            sx={{ color: 'text.disabled' }}
                          >
                            <NotificationsActive fontSize="small" />
                          </IconButton>
                        </Box>
                      </Tooltip>
                    ) : canNudge && (
                      <Tooltip title="🔔 Nudge room - remind everyone to complete tasks">
                        <IconButton 
                          size="small" 
                          onClick={onSendNudge}
                          disabled={nudging}
                          sx={{ 
                            color: 'info.main',
                            '&:hover': { bgcolor: 'info.50' },
                            animation: nudging ? 'pulse 1s infinite' : 'none'
                          }}
                        >
                          <NotificationsActive fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
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
        {/* Reply banner */}
        {replyTo && (
          <Paper elevation={0} sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ flex: 1 }}>
              Replying to {replyTo?.sender?.username || 'message'}: {replyTo?.message?.slice(0, 60)}{replyTo?.message?.length > 60 ? '...' : ''}
            </Typography>
            <IconButton size="small" onClick={() => setReplyTo(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Paper>
        )}

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

        {/* Appreciation Dialog */}
        <Dialog 
          open={appreciationDialogOpen} 
          onClose={() => setAppreciationDialogOpen(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>
            {selectedAppreciationType ? 'Select Member' : 'Choose Appreciation'}
          </DialogTitle>
          <DialogContent>
            {!selectedAppreciationType ? (
              // Step 1: Select appreciation type
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<Star />}
                  onClick={() => handleAppreciationTypeSelect('star')}
                  sx={{ 
                    justifyContent: 'flex-start',
                    py: 2,
                    borderColor: 'warning.main',
                    color: 'warning.main',
                    '&:hover': {
                      borderColor: 'warning.dark',
                      bgcolor: 'warning.50'
                    }
                  }}
                >
                  <Box sx={{ textAlign: 'left', flex: 1 }}>
                    <Typography variant="body1" fontWeight="bold">⭐ Star</Typography>
                    <Typography variant="caption" color="text.secondary">Good effort / appreciated</Typography>
                  </Box>
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<Whatshot />}
                  onClick={() => handleAppreciationTypeSelect('fire')}
                  sx={{ 
                    justifyContent: 'flex-start',
                    py: 2,
                    borderColor: 'error.main',
                    color: 'error.main',
                    '&:hover': {
                      borderColor: 'error.dark',
                      bgcolor: 'error.50'
                    }
                  }}
                >
                  <Box sx={{ textAlign: 'left', flex: 1 }}>
                    <Typography variant="body1" fontWeight="bold">🔥 Fire</Typography>
                    <Typography variant="caption" color="text.secondary">You really showed up today</Typography>
                  </Box>
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<Shield />}
                  onClick={() => handleAppreciationTypeSelect('shield')}
                  sx={{ 
                    justifyContent: 'flex-start',
                    py: 2,
                    borderColor: 'info.main',
                    color: 'info.main',
                    '&:hover': {
                      borderColor: 'info.dark',
                      bgcolor: 'info.50'
                    }
                  }}
                >
                  <Box sx={{ textAlign: 'left', flex: 1 }}>
                    <Typography variant="body1" fontWeight="bold">🛡️ Shield</Typography>
                    <Typography variant="caption" color="text.secondary">Reliable / kept the streak alive</Typography>
                  </Box>
                </Button>
              </Box>
            ) : (
              // Step 2: Select member
              <List sx={{ pt: 0 }}>
                {roomMembers
                  .filter(member => {
                    const memberId = member.userId?._id || member.userId;
                    return memberId !== currentUser?.id;
                  })
                  .map((member) => {
                    const memberId = member.userId?._id || member.userId;
                    const memberData = member.userId;
                    return (
                      <ListItemButton
                        key={memberId}
                        onClick={() => handleMemberSelect(memberId)}
                        disabled={sentAppreciations.has(`${memberId}:${selectedAppreciationType}`)}
                        sx={{
                          borderRadius: 1,
                          mb: 0.5,
                          opacity: sentAppreciations.has(`${memberId}:${selectedAppreciationType}`) ? 0.5 : 1
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar src={memberData?.avatar}>
                            {memberData?.username?.[0]?.toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText 
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <span>{memberData?.username || 'Unknown'}</span>
                              {getAppreciationDisplay(memberId).map((b) => (
                                <Chip
                                  key={b.type}
                                  label={b.label}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
                                />
                              ))}
                              {sentAppreciations.has(`${memberId}:${selectedAppreciationType}`) && (
                                <Chip
                                  label="Sent"
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: '0.65rem' }}
                                />
                              )}
                            </Box>
                          }
                          secondary={`${member.points || 0} points`}
                        />
                      </ListItemButton>
                    );
                  })}
              </List>
            )}
          </DialogContent>
          <DialogActions>
            {selectedAppreciationType && (
              <Button onClick={() => setSelectedAppreciationType(null)}>
                Back
              </Button>
            )}
            <Button onClick={() => setAppreciationDialogOpen(false)}>
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Drawer>
  );
};

export default ChatDrawer;
