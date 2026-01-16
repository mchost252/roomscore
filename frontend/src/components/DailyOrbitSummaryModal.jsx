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
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
            {/* Tasks completed */}
            <Tooltip title="Tasks completed yesterday">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  ✓
                </Typography>
                <Typography 
                  variant="body2" 
                  fontWeight={600}
                  color={member.tasksCompleted > 0 ? 'primary.main' : 'text.disabled'}
                >
                  {member.tasksCompleted}
                </Typography>
              </Box>
            </Tooltip>
            
            {/* Streak */}
            <Tooltip title={member.streakMaintained ? 'Streak maintained!' : 'Streak broken'}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <StreakFlameIcon size={16} streak={member.currentStreak} />
                <Typography 
                  variant="body2" 
                  fontWeight={600}
                  color={member.currentStreak > 0 ? 'secondary.main' : 'text.disabled'}
                >
                  {member.currentStreak}d
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

const DailyOrbitSummaryModal = ({ 
  open, 
  onClose, 
  summary,
  roomName,
}) => {
  const theme = useMuiTheme();
  const isDark = theme.palette.mode === 'dark';
  const [showContent, setShowContent] = useState(false);
  
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setShowContent(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [open]);
  
  // Calculate activity percentage
  const activityPercentage = useMemo(() => {
    if (!summary?.members?.length) return 0;
    return Math.round((summary.activeMembers / summary.totalMembers) * 100);
  }, [summary]);
  
  if (!summary) return null;
  
  const isOrbitStable = summary.roomStreakStatus === 'stable';
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
          background: 'transparent',
          boxShadow: isDark 
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 100px rgba(96, 165, 250, 0.1)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }
      }}
    >
      <ConstellationBackground>
        <DialogContent sx={{ p: 0 }}>
          {/* Header */}
          <Box
            sx={{
              position: 'relative',
              p: 3,
              pb: 2,
              textAlign: 'center',
            }}
          >
            <IconButton
              onClick={onClose}
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
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
          
          {/* Room Status Banner */}
          <Fade in={showContent} timeout={1400}>
            <Box
              sx={{
                mx: 3,
                p: 2,
                borderRadius: 3,
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
                variant="subtitle1" 
                fontWeight={600}
                color={isOrbitStable ? 'success.main' : 'text.secondary'}
              >
                {isOrbitStable 
                  ? '✨ Orbit Stable — Great teamwork yesterday!'
                  : '🌑 Orbit Dimmed — No activity yesterday'
                }
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 1.5 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    {summary.totalTasksCompleted}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Tasks Done
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" fontWeight={700} color="secondary.main">
                    {summary.roomStreak}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Room Streak
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" fontWeight={700} color="success.main">
                    {summary.activeMembers}/{summary.totalMembers}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active
                  </Typography>
                </Box>
              </Box>
              
              {/* Activity bar */}
              <Box sx={{ mt: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={activityPercentage}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      background: isOrbitStable
                        ? 'linear-gradient(90deg, #22c55e, #60A5FA)'
                        : isDark ? '#475569' : '#94a3b8',
                    },
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {activityPercentage}% orbit activity
                </Typography>
              </Box>
            </Box>
          </Fade>
          
          {/* MVP Highlight */}
          {summary.mvp && (
            <Fade in={showContent} timeout={1600}>
              <Box
                sx={{
                  mx: 3,
                  mt: 2,
                  p: 2,
                  borderRadius: 3,
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(251, 191, 36, 0.1))'
                    : 'linear-gradient(135deg, rgba(217, 119, 6, 0.1), rgba(245, 158, 11, 0.05))',
                  border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(217, 119, 6, 0.3)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <MVPCrownIcon size={40} glowing animated />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    YESTERDAY'S MVP
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar 
                      src={summary.mvp.avatar} 
                      sx={{ width: 28, height: 28 }}
                    >
                      {summary.mvp.username?.[0]?.toUpperCase()}
                    </Avatar>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {summary.mvp.username}
                    </Typography>
                  </Box>
                </Box>
                <Tooltip title="Most consistent & reliable contributor">
                  <Chip
                    label="👑 Consistency & Contribution"
                    size="small"
                    sx={{
                      background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
                      color: '#0f172a',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                    }}
                  />
                </Tooltip>
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
          <Box sx={{ px: 3, py: 2 }}>
            <Typography 
              variant="subtitle2" 
              color="text.secondary" 
              sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <OrbitSummaryIcon size={18} />
              Orbit Members
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
          
          {/* Footer */}
          <Box
            sx={{
              p: 2,
              textAlign: 'center',
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
            }}
          >
            <Typography variant="caption" color="text.disabled">
              This summary shows once daily when you enter the room
            </Typography>
          </Box>
        </DialogContent>
      </ConstellationBackground>
    </Dialog>
  );
};

export default DailyOrbitSummaryModal;
