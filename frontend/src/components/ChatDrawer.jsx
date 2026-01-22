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
import { usePremium } from '../context/PremiumContext';

const ChatDrawer = ({ 
  open, 
  onClose, 
  messages = [], 
  onSendMessage, 
  currentUser,
  roomName = 'Room Chat',
  roomId = null,
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
  const { isGlobalPremium, isRoomPremium } = usePremium();
  const isPremiumActive = isGlobalPremium || (roomId && isRoomPremium(roomId));
  const isDark = theme.palette.mode === 'dark';
  
  // Shooting stars for premium chat
  const [shootingStars, setShootingStars] = useState([]);
  
  useEffect(() => {
    if (!isPremiumActive || !open) return;

    const createShootingStar = () => {
      const newStar = {
        id: Date.now() + Math.random(),
        x: 10 + Math.random() * 60,
        y: Math.random() * 30,
        size: Math.random() > 0.6 ? 'large' : 'small',
        speed: 0.8 + Math.random() * 0.4,
      };
      setShootingStars(prev => [...prev, newStar]);
      setTimeout(() => {
        setShootingStars(prev => prev.filter(s => s.id !== newStar.id));
      }, newStar.speed * 1000);
    };

    const interval = setInterval(() => {
      if (Math.random() > 0.5) createShootingStar();
    }, 8000 + Math.random() * 6000);

    return () => clearInterval(interval);
  }, [isPremiumActive, open]);
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

  // Auto-scroll to bottom when new messages arrive or chat opens
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Scroll to bottom when chat opens
  useEffect(() => {
    if (open && messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    }
  }, [open]);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim(), replyTo);
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
      ModalProps={{
        keepMounted: true,
        disableScrollLock: true, // Prevent page shift when drawer opens
      }}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 450,
          maxWidth: '100vw',
          height: '100dvh',
          maxHeight: '100dvh',
          // Premium styling
          ...(isPremiumActive && {
            background: isDark
              ? 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)'
              : 'linear-gradient(180deg, #ffffff 0%, #fef9e7 50%, #ffffff 100%)',
            borderLeft: `1px solid ${isDark ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.15)'}`,
          }),
        }
      }}
      transitionDuration={300}
    >
      <Box
        sx={{
          height: '100%', // Fill the drawer paper
          display: 'flex',
          flexDirection: 'column',
          bgcolor: isPremiumActive ? 'transparent' : 'background.default'
        }}
      >
        {/* Header */}
        <Paper
          elevation={isPremiumActive ? 0 : 2}
          sx={{
            p: 2,
            pt: { xs: 'calc(env(safe-area-inset-top, 0px) + 16px)', md: 2 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 0,
            flexShrink: 0,
            // Premium styling
            ...(isPremiumActive && {
              background: isDark
                ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(139, 92, 246, 0.08) 100%)'
                : 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%)',
              borderBottom: `1px solid ${isDark ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.15)'}`,
            }),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isPremiumActive ? (
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  filter: 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.5))',
                }}
              >
                <ChatIcon sx={{ color: '#FBBF24' }} />
              </Box>
            ) : (
              <ChatIcon color="primary" />
            )}
            <Typography 
              variant="h6" 
              fontWeight="bold"
              sx={isPremiumActive ? {
                background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              } : {}}
            >
              {roomName}
            </Typography>
            {isPremiumActive && (
              <Chip 
                label="✨" 
                size="small" 
                sx={{ 
                  height: 20, 
                  fontSize: '0.7rem',
                  bgcolor: 'rgba(251, 191, 36, 0.15)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                }} 
              />
            )}
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
            bgcolor: isPremiumActive ? 'transparent' : 'background.paper',
            backgroundImage: isPremiumActive
              ? (isDark 
                ? 'radial-gradient(ellipse at 50% 0%, rgba(251, 191, 36, 0.05) 0%, transparent 50%)'
                : 'radial-gradient(ellipse at 50% 0%, rgba(251, 191, 36, 0.03) 0%, transparent 50%)')
              : (isDark 
                ? 'linear-gradient(rgba(255, 255, 255, .02), rgba(255, 255, 255, .02))'
                : 'linear-gradient(rgba(0, 0, 0, .01), rgba(0, 0, 0, .01))'),
            position: 'relative',
            '&::-webkit-scrollbar': {
              width: '8px'
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent'
            },
            '&::-webkit-scrollbar-thumb': {
              background: isPremiumActive ? 'rgba(251, 191, 36, 0.3)' : theme.palette.divider,
              borderRadius: '4px',
              '&:hover': {
                background: isPremiumActive ? 'rgba(251, 191, 36, 0.5)' : theme.palette.action.hover
              }
            }
          }}
        >
          {/* Shooting stars in chat */}
          {isPremiumActive && shootingStars.map((star) => (
            <Box
              key={star.id}
              sx={{
                position: 'absolute',
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: star.size === 'large' ? '3px' : '2px',
                height: star.size === 'large' ? '3px' : '2px',
                background: 'white',
                borderRadius: '50%',
                boxShadow: star.size === 'large' 
                  ? '0 0 8px #fff, 0 0 16px #60A5FA'
                  : '0 0 6px #fff, 0 0 10px #60A5FA',
                pointerEvents: 'none',
                zIndex: 0,
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: '50%',
                  right: '100%',
                  width: star.size === 'large' ? '50px' : '30px',
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7))',
                  transform: 'translateY(-50%)',
                },
                animation: `shootingStar ${star.speed}s ease-out forwards`,
                '@keyframes shootingStar': {
                  '0%': { transform: 'translate(0, 0)', opacity: 1 },
                  '100%': { transform: 'translate(120px, 80px)', opacity: 0 },
                },
              }}
            />
          ))}
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
                      <Box
                        onClick={() => setReplyTo({ _id: msg._id, messageId: msg._id, message: msg.message, sender: msg.userId })}
                        sx={{
                          position: 'relative',
                          p: '10px 12px',
                          pb: '8px',
                          bgcolor: isMine 
                            ? theme.palette.mode === 'dark' 
                              ? '#005c4b' // WhatsApp dark green for sent
                              : '#dcf8c6' // WhatsApp light green for sent
                            : theme.palette.mode === 'dark' 
                              ? '#1f2c34' // WhatsApp dark mode received
                              : '#ffffff', // White for received in light mode
                          color: isMine 
                            ? theme.palette.mode === 'dark' ? '#e9edef' : '#111b21'
                            : theme.palette.mode === 'dark' ? '#e9edef' : '#111b21',
                          // WhatsApp-style border radius with tail
                          borderRadius: isMine 
                            ? '8px 8px 0 8px' // Sent: tail on bottom-right
                            : '8px 8px 8px 0', // Received: tail on bottom-left
                          wordBreak: 'break-word',
                          cursor: 'pointer',
                          boxShadow: theme.palette.mode === 'dark' 
                            ? '0 1px 0.5px rgba(0,0,0,0.13)'
                            : '0 1px 0.5px rgba(0,0,0,0.13)',
                          minWidth: '60px',
                          maxWidth: '100%',
                          // Tail pseudo-element
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            bottom: 0,
                            width: 0,
                            height: 0,
                            border: '8px solid transparent',
                            ...(isMine ? {
                              right: '-8px',
                              borderLeftColor: theme.palette.mode === 'dark' ? '#005c4b' : '#dcf8c6',
                              borderBottom: 'none',
                              borderRight: 'none',
                            } : {
                              left: '-8px',
                              borderRightColor: theme.palette.mode === 'dark' ? '#1f2c34' : '#ffffff',
                              borderBottom: 'none',
                              borderLeft: 'none',
                            }),
                          },
                          '&:hover': {
                            filter: 'brightness(0.97)',
                          },
                          '&:active': {
                            filter: 'brightness(0.95)',
                          }
                        }}
                      >
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            whiteSpace: 'pre-wrap',
                            fontSize: '14.2px',
                            lineHeight: 1.4,
                          }}
                        >
                          {msg.message}
                        </Typography>
                        {/* Inline timestamp like WhatsApp */}
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'flex-end', 
                          alignItems: 'center',
                          gap: 0.5,
                          mt: 0.25,
                          ml: 1,
                          float: 'right',
                          position: 'relative',
                          top: '2px',
                        }}>
                          <Typography
                            variant="caption"
                            sx={{ 
                              fontSize: '11px',
                              color: isMine 
                                ? theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.5)'
                                : theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
                              lineHeight: 1,
                            }}
                          >
                            {formatTime(msg.createdAt)}
                          </Typography>
                          {isMine && (
                            <Box sx={{ 
                              fontSize: '14px', 
                              color: msg.read 
                                ? '#53bdeb' // Blue ticks for read
                                : theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)',
                              lineHeight: 1,
                            }}>
                              {msg.sending ? '🕐' : '✓✓'}
                            </Box>
                          )}
                        </Box>
                      </Box>

                    </Box>
                  </Box>
                </Slide>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </Box>

        <Divider />

        {/* Reply banner - positioned above input */}
        {replyTo && (
          <Paper 
            elevation={0} 
            sx={{ 
              px: 2, 
              py: 1, 
              borderBottom: 1, 
              borderColor: 'divider', 
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1 
            }}
          >
            <Box sx={{ flex: 1, borderLeft: '3px solid', borderColor: 'primary.main', pl: 1.5 }}>
              <Typography variant="caption" color="primary" fontWeight={600}>
                Replying to {replyTo?.sender?.username || 'message'}
              </Typography>
              <Typography variant="body2" noWrap sx={{ opacity: 0.7, fontSize: '0.8rem' }}>
                {replyTo?.message}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setReplyTo(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Paper>
        )}

        {/* Input Area */}
        <Paper
          elevation={3}
          sx={{
            p: 2,
            pb: { xs: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', md: 2 },
            display: 'flex',
            gap: 1,
            alignItems: 'flex-end',
            borderRadius: 0,
            bgcolor: 'background.default',
            flexShrink: 0,
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
                    {appreciationRemaining > 0 && sentAppreciations.size === 0 && (
                      <Tooltip title="Send appreciation (1 per day)">
                        <IconButton 
                          size="small" 
                          onClick={handleAppreciationClick}
                          sx={{ 
                            color: 'warning.main',
                            '&:hover': { bgcolor: 'warning.50' }
                          }}
                        >
                          <Star fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {sentAppreciations.size > 0 && (
                      <Tooltip title="✓ You've sent your daily appreciation">
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                          <IconButton 
                            size="small" 
                            disabled
                            sx={{ color: 'success.main', opacity: 0.6 }}
                          >
                            <Star fontSize="small" />
                          </IconButton>
                        </Box>
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
          disablePortal={false}
          sx={{
            zIndex: 1400,
            '& .MuiDialog-container': {
              alignItems: 'center',
            },
          }}
          PaperProps={{
            sx: {
              borderRadius: 2,
              mx: { xs: 2, sm: 3 },
              my: 'auto',
              maxHeight: { xs: '85vh', sm: '80vh' },
            }
          }}
        >
          <DialogTitle>
            {selectedAppreciationType ? 'Select Member' : 'Send Appreciation'}
            <Typography variant="caption" display="block" color="text.secondary">
              You can send 1 appreciation per day – choose wisely!
            </Typography>
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
                        sx={{
                          borderRadius: 1,
                          mb: 0.5
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
