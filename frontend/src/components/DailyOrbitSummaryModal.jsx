import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Avatar,
  IconButton,
  Chip,
  Tooltip,
  LinearProgress,
  Fade,
  Zoom,
  keyframes,
} from '@mui/material';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import {
  OrbitSummaryIcon,
  MVPCrownIcon,
  StreakFlameIcon,
  OrbitStableIcon,
  OrbitDimmedIcon,
  InactiveStarIcon,
} from './icons/ConstellationIcons';
import { usePremium } from '../context/PremiumContext';

// Premium animations for room summary
const cardSlideUp = keyframes`
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const countUp = keyframes`
  0% { opacity: 0; transform: scale(0.8); }
  50% { transform: scale(1.1); }
  100% { opacity: 1; transform: scale(1); }
`;

const ringProgress = keyframes`
  0% { stroke-dashoffset: 100; }
`;

const softGlow = keyframes`
  0%, 100% { box-shadow: 0 0 8px rgba(251, 191, 36, 0.4), 0 0 16px rgba(251, 191, 36, 0.2); }
  50% { box-shadow: 0 0 16px rgba(251, 191, 36, 0.6), 0 0 32px rgba(251, 191, 36, 0.3); }
`;

const barGrow = keyframes`
  0% { width: 0%; }
`;

/**
 * Daily Orbit Summary Modal
 * 
 * Shows once per day when user enters a room for the first time.
 * Displays yesterday's activity for each member:
 * - Tasks completed
 * - Streak status (kept/broken)
 * - Room MVP
 * - Room streak status
 */

// Constellation background with animated stars
const ConstellationBackground = ({ children }) => {
  const theme = useMuiTheme();
  const isDark = theme.palette.mode === 'dark';
  
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        background: isDark 
          ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)'
          : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f8fafc 100%)',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isDark
            ? 'radial-gradient(circle at 20% 30%, rgba(96, 165, 250, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(245, 158, 11, 0.1) 0%, transparent 50%)'
            : 'radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(217, 119, 6, 0.1) 0%, transparent 50%)',
          pointerEvents: 'none',
        },
      }}
    >
      {/* Animated star particles */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          '& .star': {
            position: 'absolute',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: isDark ? '#60A5FA' : '#3B82F6',
            boxShadow: isDark 
              ? '0 0 10px #60A5FA, 0 0 20px #60A5FA'
              : '0 0 10px #3B82F6, 0 0 20px #3B82F6',
            animation: 'twinkle 3s ease-in-out infinite',
          },
          '& .star:nth-of-type(2n)': {
            background: isDark ? '#F59E0B' : '#D97706',
            boxShadow: isDark 
              ? '0 0 10px #F59E0B, 0 0 20px #F59E0B'
              : '0 0 10px #D97706, 0 0 20px #D97706',
            animationDelay: '1s',
          },
          '@keyframes twinkle': {
            '0%, 100%': { opacity: 0.3, transform: 'scale(1)' },
            '50%': { opacity: 1, transform: 'scale(1.2)' },
          },
        }}
      >
        {[...Array(12)].map((_, i) => (
          <Box
            key={i}
            className="star"
            sx={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
            }}
          />
        ))}
      </Box>
      {children}
    </Box>
  );
};

// Member card component
const MemberSummaryCard = ({ member, isMVP, index }) => {
  const theme = useMuiTheme();
  const isDark = theme.palette.mode === 'dark';
  
  return (
    <Zoom in={true} style={{ transitionDelay: `${index * 100}ms` }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          borderRadius: 3,
          background: isDark 
            ? member.isActive 
              ? 'rgba(96, 165, 250, 0.1)' 
              : 'rgba(255, 255, 255, 0.03)'
            : member.isActive
              ? 'rgba(59, 130, 246, 0.08)'
              : 'rgba(0, 0, 0, 0.03)',
          border: `1px solid ${
            isMVP 
              ? isDark ? 'rgba(245, 158, 11, 0.5)' : 'rgba(217, 119, 6, 0.5)'
              : member.isActive
                ? isDark ? 'rgba(96, 165, 250, 0.2)' : 'rgba(59, 130, 246, 0.2)'
                : 'transparent'
          }`,
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          '&:hover': {
            background: isDark 
              ? 'rgba(96, 165, 250, 0.15)' 
              : 'rgba(59, 130, 246, 0.12)',
          },
        }}
      >
        {/* MVP Crown Badge */}
        {isMVP && (
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              zIndex: 1,
            }}
          >
            <MVPCrownIcon size={32} glowing animated />
          </Box>
        )}
        
        {/* Avatar with status indicator */}
        <Box sx={{ position: 'relative' }}>
          <Avatar
            src={member.avatar}
            sx={{
              width: 48,
              height: 48,
              border: `2px solid ${
                member.isActive 
                  ? isDark ? '#60A5FA' : '#3B82F6'
                  : isDark ? '#475569' : '#94a3b8'
              }`,
              boxShadow: member.isActive
                ? isDark 
                  ? '0 0 15px rgba(96, 165, 250, 0.4)'
                  : '0 0 15px rgba(59, 130, 246, 0.3)'
                : 'none',
            }}
          >
            {member.username?.[0]?.toUpperCase()}
          </Avatar>
          
          {/* Activity indicator dot */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: member.isActive 
                ? '#22c55e' 
                : isDark ? '#475569' : '#94a3b8',
              border: `2px solid ${isDark ? '#1e293b' : '#ffffff'}`,
            }}
          />
        </Box>
        
        {/* Member info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography 
              variant="subtitle1" 
              fontWeight={600}
              sx={{ 
                color: member.isActive ? 'text.primary' : 'text.secondary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {member.username}
            </Typography>
            {isMVP && (
              <Chip 
                label="MVP" 
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
                  color: '#0f172a',
                }}
              />
            )}
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
            {/* Tasks completed */}
            <Tooltip title={`${member.tasksCompleted} task${member.tasksCompleted !== 1 ? 's' : ''} completed yesterday`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                  ✅
                </Typography>
                <Typography 
                  variant="body2" 
                  fontWeight={600}
                  color={member.tasksCompleted > 0 ? 'primary.main' : 'text.disabled'}
                  sx={{ fontSize: '0.8rem' }}
                >
                  {member.tasksCompleted} tasks
                </Typography>
              </Box>
            </Tooltip>
            
            {/* Streak */}
            <Tooltip title={`Current streak: ${member.currentStreak} day${member.currentStreak !== 1 ? 's' : ''}${member.streakMaintained ? ' (maintained!)' : ''}`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <StreakFlameIcon size={16} streak={member.currentStreak} />
                <Typography 
                  variant="body2" 
                  fontWeight={600}
                  color={member.currentStreak > 0 ? 'secondary.main' : 'text.disabled'}
                  sx={{ fontSize: '0.8rem' }}
                >
                  {member.currentStreak} day{member.currentStreak !== 1 ? 's' : ''}
                </Typography>
              </Box>
            </Tooltip>
            
            {/* Appreciations received */}
            {member.appreciationsReceived && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {member.appreciationsReceived.star > 0 && (
                  <Tooltip title={`${member.appreciationsReceived.star} star(s)`}>
                    <Typography variant="body2">⭐{member.appreciationsReceived.star > 1 ? member.appreciationsReceived.star : ''}</Typography>
                  </Tooltip>
                )}
                {member.appreciationsReceived.fire > 0 && (
                  <Tooltip title={`${member.appreciationsReceived.fire} fire(s)`}>
                    <Typography variant="body2">🔥{member.appreciationsReceived.fire > 1 ? member.appreciationsReceived.fire : ''}</Typography>
                  </Tooltip>
                )}
                {member.appreciationsReceived.shield > 0 && (
                  <Tooltip title={`${member.appreciationsReceived.shield} shield(s)`}>
                    <Typography variant="body2">🛡️{member.appreciationsReceived.shield > 1 ? member.appreciationsReceived.shield : ''}</Typography>
                  </Tooltip>
                )}
              </Box>
            )}
          </Box>
        </Box>
        
        {/* Status icon */}
        <Box sx={{ opacity: 0.8 }}>
          {member.isActive ? (
            <OrbitStableIcon size={24} />
          ) : (
            <InactiveStarIcon size={24} />
          )}
        </Box>
      </Box>
    </Zoom>
  );
};

// Encouragement messages for when user closes the summary
const ENCOURAGEMENT_MESSAGES = [
  "Keep the orbit alive! ✨",
  "You've got this! 🚀",
  "Stay consistent! 🔥",
  "One task at a time! 💪",
  "Your orbit believes in you! 🌟",
  "Let's make today count! ⭐",
  "Small steps, big progress! 🎯",
];

const DailyOrbitSummaryModal = ({ 
  open, 
  onClose, 
  summary,
  roomName,
  roomId,
}) => {
  const theme = useMuiTheme();
  const isDark = theme.palette.mode === 'dark';
  const [showContent, setShowContent] = useState(false);
  const [showEncouragement, setShowEncouragement] = useState(false);
  const [encouragementMessage, setEncouragementMessage] = useState('');
  
  // Premium features
  const { isRoomPremium, isGlobalPremium, trackDailySummaryViewed } = usePremium();
  const isPremium = (roomId && isRoomPremium(roomId)) || isGlobalPremium;
  
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setShowContent(true), 300);
      // Track daily summary view for premium prompting
      trackDailySummaryViewed();
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [open, trackDailySummaryViewed]);

  // Handle close with encouragement animation
  const handleClose = () => {
    // Pick random encouragement message
    const randomMessage = ENCOURAGEMENT_MESSAGES[Math.floor(Math.random() * ENCOURAGEMENT_MESSAGES.length)];
    setEncouragementMessage(randomMessage);
    setShowEncouragement(true);
    
    // Hide encouragement and close after 1.5 seconds
    setTimeout(() => {
      setShowEncouragement(false);
      onClose();
    }, 1500);
  };
  
  // Calculate activity percentage
  const activityPercentage = useMemo(() => {
    if (!summary?.members?.length) return 0;
    return Math.round((summary.activeMembers / summary.totalMembers) * 100);
  }, [summary]);
  
  if (!summary) return null;
  
  const isOrbitStable = summary.roomStreakStatus === 'stable';
  
  // Show encouragement overlay
  if (showEncouragement) {
    return (
      <Dialog
        open={true}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: 'hidden',
            background: isDark 
              ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            minHeight: { xs: 150, sm: 200 },
            maxWidth: { xs: '85vw', sm: '400px' },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            m: { xs: 2, sm: 3 },
          }
        }}
      >
        <Zoom in={true}>
          <Box sx={{ textAlign: 'center', p: { xs: 2, sm: 4 } }}>
            <Typography 
              variant="h5"
              fontWeight={700}
              sx={{
                fontSize: { xs: '1.25rem', sm: '1.5rem' },
                background: isDark
                  ? 'linear-gradient(135deg, #60A5FA, #F59E0B)'
                  : 'linear-gradient(135deg, #3B82F6, #D97706)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'pulse 1s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.05)' },
                },
              }}
            >
              {encouragementMessage}
            </Typography>
          </Box>
        </Zoom>
      </Dialog>
    );
  }
  
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      disablePortal={false}
      sx={{
        '& .MuiDialog-container': {
          alignItems: 'center',
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden',
          background: 'transparent',
          boxShadow: isDark 
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 100px rgba(96, 165, 250, 0.1)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxHeight: { xs: '75vh', sm: '70vh' },
          maxWidth: { xs: '92vw', sm: 450 },
          mx: { xs: 1, sm: 'auto' },
          my: 'auto',
        }
      }}
    >
      <ConstellationBackground>
        <DialogContent sx={{ p: 0, overflowY: 'auto', maxHeight: '80vh' }}>
          {/* Header */}
          <Box
            sx={{
              position: 'relative',
              p: { xs: 2, sm: 3 },
              pb: { xs: 1.5, sm: 2 },
              textAlign: 'center',
            }}
          >
            <IconButton
              onClick={handleClose}
              sx={{
                position: 'absolute',
                top: { xs: 8, sm: 12 },
                right: { xs: 8, sm: 12 },
                color: 'text.secondary',
                '&:hover': {
                  background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                },
              }}
            >
              <CloseIcon />
            </IconButton>
            
            {/* Animated orbit icon */}
            <Fade in={showContent} timeout={800}>
              <Box sx={{ mb: 2 }}>
                {isOrbitStable ? (
                  <OrbitStableIcon size={64} animated />
                ) : (
                  <OrbitDimmedIcon size={64} />
                )}
              </Box>
            </Fade>
            
            <Fade in={showContent} timeout={1000}>
              <Typography 
                variant="h5" 
                fontWeight={700}
                sx={{
                  background: isDark
                    ? 'linear-gradient(135deg, #60A5FA, #F59E0B)'
                    : 'linear-gradient(135deg, #3B82F6, #D97706)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 0.5,
                }}
              >
                Daily Orbit Summary
              </Typography>
            </Fade>
            
            <Fade in={showContent} timeout={1200}>
              <Typography variant="body2" color="text.secondary">
                {roomName} • Yesterday's Activity
              </Typography>
            </Fade>
          </Box>
          
          {/* Room Status Banner - Compact */}
          <Fade in={showContent} timeout={1400}>
            <Box
              sx={{
                mx: { xs: 1.5, sm: 2 },
                p: { xs: 1.5, sm: 2 },
                borderRadius: 2,
                background: isOrbitStable
                  ? isDark 
                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(96, 165, 250, 0.15))'
                    : 'linear-gradient(135deg, rgba(22, 163, 74, 0.1), rgba(59, 130, 246, 0.1))'
                  : isDark
                    ? 'rgba(71, 85, 105, 0.2)'
                    : 'rgba(148, 163, 184, 0.2)',
                border: `1px solid ${
                  isOrbitStable
                    ? isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(22, 163, 74, 0.3)'
                    : isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(148, 163, 184, 0.3)'
                }`,
                textAlign: 'center',
              }}
            >
              <Typography 
                variant="body2" 
                fontWeight={600}
                color={isOrbitStable ? 'success.main' : 'text.secondary'}
                sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
              >
                {isOrbitStable 
                  ? '✨ Orbit Stable!'
                  : '🌑 Orbit Dimmed'
                }
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 2, sm: 3 }, mt: 1 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="body1" 
                    fontWeight={700} 
                    color="primary.main"
                    sx={isPremium ? {
                      animation: `${countUp} 0.5s ease-out forwards`,
                      animationDelay: '0.3s',
                      opacity: 0,
                    } : {}}
                  >
                    {summary.totalTasksCompleted}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    Tasks
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="body1" 
                    fontWeight={700} 
                    color="secondary.main"
                    sx={isPremium ? {
                      animation: `${countUp} 0.5s ease-out forwards`,
                      animationDelay: '0.4s',
                      opacity: 0,
                    } : {}}
                  >
                    {summary.roomStreak}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    Streak
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="body1" 
                    fontWeight={700} 
                    color="success.main"
                    sx={isPremium ? {
                      animation: `${countUp} 0.5s ease-out forwards`,
                      animationDelay: '0.5s',
                      opacity: 0,
                    } : {}}
                  >
                    {summary.activeMembers}/{summary.totalMembers}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    Active
                  </Typography>
                </Box>
              </Box>
              
              {/* Activity bar */}
              <Box sx={{ mt: 1.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={activityPercentage}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 2,
                      background: isOrbitStable
                        ? 'linear-gradient(90deg, #22c55e, #60A5FA)'
                        : isDark ? '#475569' : '#94a3b8',
                      ...(isPremium && {
                        animation: `${barGrow} 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
                        animationDelay: '0.6s',
                      }),
                    },
                  }}
                />
              </Box>
            </Box>
          </Fade>
          
          {/* MVP Highlight - Compact */}
          {summary.mvp && (
            <Fade in={showContent} timeout={1600}>
              <Box
                sx={{
                  mx: { xs: 1.5, sm: 2 },
                  mt: 1.5,
                  p: { xs: 1, sm: 1.5 },
                  borderRadius: 2,
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(251, 191, 36, 0.1))'
                    : 'linear-gradient(135deg, rgba(217, 119, 6, 0.1), rgba(245, 158, 11, 0.05))',
                  border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(217, 119, 6, 0.3)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  ...(isPremium && {
                    animation: `${cardSlideUp} 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards, ${softGlow} 2s ease-in-out infinite 1s`,
                    animationDelay: '0.2s',
                    opacity: 0,
                  }),
                }}
              >
                <MVPCrownIcon size={28} glowing animated />
                <Avatar 
                  src={summary.mvp.avatar} 
                  sx={{ width: 24, height: 24 }}
                >
                  {summary.mvp.username?.[0]?.toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {summary.mvp.username}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    Yesterday's MVP
                  </Typography>
                </Box>
                {summary.mvp.mvpScore && (
                  <Chip
                    label={`⭐ ${summary.mvp.mvpScore}`}
                    size="small"
                    sx={{
                      height: 20,
                      background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
                      color: '#0f172a',
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      '& .MuiChip-label': { px: 1 }
                    }}
                  />
                )}
              </Box>
            </Fade>
          )}
          
          {/* No MVP state */}
          {!summary.mvp && summary.totalMembers > 0 && (
            <Fade in={showContent} timeout={1600}>
              <Box
                sx={{
                  mx: 3,
                  mt: 2,
                  p: 2,
                  borderRadius: 3,
                  background: isDark ? 'rgba(71, 85, 105, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                  textAlign: 'center',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  🌑 No MVP yesterday — orbit was quiet
                </Typography>
              </Box>
            </Fade>
          )}
          
          {/* Members List */}
          <Box sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
            <Typography 
              variant="subtitle2" 
              color="text.secondary" 
              sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <OrbitSummaryIcon size={18} />
              Orbit Members ({summary.members?.length || 0})
            </Typography>
            
            {/* Scrollable members list for mobile */}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 1,
              maxHeight: { xs: '35vh', sm: '40vh' },
              overflowY: 'auto',
              pr: { xs: 0.5, sm: 1 },
              '&::-webkit-scrollbar': {
                width: '4px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                borderRadius: '4px',
              },
            }}>
              {summary.members?.map((member, index) => (
                <MemberSummaryCard
                  key={member.userId}
                  member={member}
                  isMVP={summary.mvp?.userId === member.userId}
                  index={index}
                />
              ))}
            </Box>
          </Box>
          
          {/* Legend */}
          <Box
            sx={{
              px: { xs: 2, sm: 3 },
              py: 1.5,
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
              Legend:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1.5, sm: 2 }, fontSize: '0.7rem' }}>
              <Typography variant="caption" color="text.secondary">✅ = Tasks done</Typography>
              <Typography variant="caption" color="text.secondary">🔥 = Streak days</Typography>
              <Typography variant="caption" color="text.secondary">⭐ = MVP score</Typography>
              <Typography variant="caption" color="text.secondary">🛡️ = Shield</Typography>
            </Box>
          </Box>

          {/* Footer */}
          <Box
            sx={{
              p: { xs: 1.5, sm: 2 },
              textAlign: 'center',
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
            }}
          >
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              This summary shows once daily when you enter the room
            </Typography>
          </Box>
        </DialogContent>
      </ConstellationBackground>
    </Dialog>
  );
};

export default DailyOrbitSummaryModal;
