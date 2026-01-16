import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  LinearProgress,
  Button,
  Chip,
  Alert,
  Skeleton,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  TrendingUp,
  EmojiEvents,
  CheckCircle,
  Groups,
  LocalFireDepartment,
  ArrowForward,
  Add,
  Star,
  Whatshot,
  AccessTime,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import api, { invalidateCache } from '../utils/api';
import cacheManager from '../utils/cache';
import OnboardingModal from '../components/OnboardingModal';
import { getErrorMessage } from '../utils/errorMessages';
import WhatsNewCard from '../components/WhatsNewCard';

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, color, subtext }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  return (
    <Card
      sx={{
        height: '100%',
        background: isDark
          ? `linear-gradient(135deg, ${alpha(color, 0.15)} 0%, ${alpha(color, 0.05)} 100%)`
          : `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(color, 0.02)} 100%)`,
        border: `1px solid ${alpha(color, isDark ? 0.2 : 0.15)}`,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 24px ${alpha(color, 0.2)}`,
        },
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              fontWeight={500} 
              gutterBottom
              sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' } }}
            >
              {label}
            </Typography>
            <Typography 
              variant="h3" 
              fontWeight={700} 
              sx={{ color, fontSize: { xs: '1.5rem', md: '3rem' } }}
            >
              {value}
            </Typography>
            {subtext && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', md: '0.75rem' } }}>
                {subtext}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: { xs: 32, md: 48 },
              height: { xs: 32, md: 48 },
              borderRadius: { xs: 1.5, md: 2 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(color, isDark ? 0.2 : 0.15),
            }}
          >
            <Icon sx={{ fontSize: { xs: 18, md: 28 }, color }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// Constellation Progress Ring Component
const ConstellationProgressRing = ({ progress, size = 60 }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  
  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Outer glow circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius + 2}
          fill="none"
          stroke={isDark ? 'rgba(96,165,250,0.1)' : 'rgba(59,130,246,0.1)'}
          strokeWidth={1}
        />
        
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
          strokeWidth={strokeWidth}
        />
        
        {/* Progress arc with smooth gradient */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
        
        {/* Gradient definition - more vibrant */}
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#60A5FA' : '#3B82F6'} />
            <stop offset="50%" stopColor={isDark ? '#8B5CF6' : '#6366F1'} />
            <stop offset="100%" stopColor={isDark ? '#EC4899' : '#F59E0B'} />
          </linearGradient>
          
          {/* Glow filter for active state */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* End cap circle for progress */}
        {progress > 0 && (
          <circle
            cx={size / 2 + radius * Math.cos((progress / 100) * 2 * Math.PI - Math.PI / 2)}
            cy={size / 2 + radius * Math.sin((progress / 100) * 2 * Math.PI - Math.PI / 2)}
            r={strokeWidth / 2 + 1}
            fill={isDark ? '#60A5FA' : '#3B82F6'}
            filter="url(#glow)"
            style={{ transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        )}
      </svg>
      {/* Center percentage */}
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        <Typography 
          variant="caption" 
          fontWeight={700} 
          sx={{ 
            fontSize: size > 50 ? '0.75rem' : '0.6rem',
            background: 'linear-gradient(135deg, #60A5FA 0%, #F59E0B 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {Math.round(progress)}%
        </Typography>
      </Box>
    </Box>
  );
};

// Room Card Component
const RoomCard = ({ room, user, onClick }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isOwner = room.owner._id === user?.id || room.owner === user?.id;
  const memberCount = room.members?.length || 0;
  const myMember = room.members?.find(m => 
    m.userId._id === user?.id || m.userId === user?.id
  );
  const activeTasks = room.tasks?.filter(t => t.isActive) || [];
  // Backend adds isCompleted flag to tasks based on user's completions today
  const completedTasks = activeTasks.filter(t => t.isCompleted);
  const taskProgress = activeTasks.length > 0 
    ? (completedTasks.length / activeTasks.length) * 100 
    : 0;
  
  // Calculate days until expiry
  const daysLeft = room.expiresAt 
    ? Math.max(0, Math.ceil((new Date(room.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        height: '100%',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: isDark
            ? '0 12px 24px rgba(0,0,0,0.4)'
            : '0 12px 24px rgba(0,0,0,0.1)',
          '& .arrow-icon': {
            transform: 'translateX(4px)',
            opacity: 1,
          },
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 3 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700} noWrap sx={{ fontSize: { xs: '0.95rem', md: '1.25rem' } }}>
              {room.name}
            </Typography>
            {room.description && (
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  mt: 0.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  fontSize: { xs: '0.7rem', md: '0.875rem' },
                }}
              >
                {room.description}
              </Typography>
            )}
          </Box>
          {/* Progress Ring */}
          <Box sx={{ ml: 1, flexShrink: 0 }}>
            <ConstellationProgressRing progress={taskProgress} size={50} />
          </Box>
        </Box>

        <Box sx={{ flex: 1 }} />

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
          {isOwner && (
            <Chip 
              label="Owner" 
              size="small" 
              color="secondary"
              sx={{ fontWeight: 600, fontSize: '0.65rem', height: 22 }}
            />
          )}
          <Chip 
            icon={<Groups sx={{ fontSize: 12 }} />}
            label={memberCount}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.65rem', height: 22 }}
          />
          {activeTasks.length > 0 && (
            <Chip 
              icon={<CheckCircle sx={{ fontSize: 12 }} />}
              label={`${completedTasks.length}/${activeTasks.length}`}
              size="small"
              variant="outlined"
              color={taskProgress === 100 ? 'success' : 'default'}
              sx={{ fontSize: '0.65rem', height: 22 }}
            />
          )}
          {daysLeft !== null && (
            <Chip 
              icon={<AccessTime sx={{ fontSize: 12 }} />}
              label={`${daysLeft}d`}
              size="small"
              variant="outlined"
              color={daysLeft <= 7 ? 'warning' : 'default'}
              sx={{ fontSize: '0.65rem', height: 22 }}
            />
          )}
        </Box>

        {myMember && (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              p: { xs: 1, md: 1.5 },
              borderRadius: 2,
              bgcolor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(217, 119, 6, 0.08)',
            }}
          >
            <EmojiEvents sx={{ color: '#F59E0B', fontSize: { xs: 16, md: 20 } }} />
            <Typography variant="body2" fontWeight={600} sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
              {myMember.points} pts
            </Typography>
            {myMember.streak > 0 && (
              <>
                <Box sx={{ width: 1, height: 14, bgcolor: 'divider' }} />
                <Whatshot sx={{ color: '#EF4444', fontSize: { xs: 14, md: 18 } }} />
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
                  {myMember.streak}d
                </Typography>
              </>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const DashboardPage = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isStaleData, setIsStaleData] = useState(false);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (localStorage.getItem('onboardingCompleted') !== 'true') {
      setShowOnboarding(true);
    }

    if (user) {
      setStats({
        // These are derived from server fields. totalPoints is computed from room membership points.
        totalPoints: 0,
        currentStreak: user?.streak || user?.currentStreak || 0,
        longestStreak: user?.longestStreak || 0,
        roomsJoined: 0
      });
      loadFromCacheFirst();
    }
  }, [user]);
  
  const handleOnboardingClose = () => {
    setShowOnboarding(false);
    localStorage.setItem('onboardingCompleted', 'true');
  };

  const loadFromCacheFirst = useCallback(() => {
    const cacheKey = cacheManager.generateKey('/rooms');
    const cached = cacheManager.getWithStale(cacheKey);
    
    if (cached.data?.rooms) {
      setRooms(cached.data.rooms);
      setStats(prev => ({
        ...prev,
        roomsJoined: cached.data.rooms.length || 0
      }));
      setIsStaleData(cached.isStale);
      
      if (cached.isStale) {
        loadDashboardData(true);
      }
    } else {
      loadDashboardData();
    }
  }, []);

  useEffect(() => {
    const handleForeground = () => {
      loadDashboardData(true);
    };
    
    window.addEventListener('app:foreground', handleForeground);
    return () => window.removeEventListener('app:foreground', handleForeground);
  }, []);

  useEffect(() => {
    if (user && !hasMounted.current) {
      hasMounted.current = true;
      loadFromCacheFirst();
    }
  }, [user, loadFromCacheFirst]);

  useEffect(() => {
    if (!socket) return;

    const handleTaskCompleted = (data) => {
      setRooms(prevRooms => 
        prevRooms.map(room => {
          if (room._id === data.roomId) {
            return {
              ...room,
              tasks: room.tasks.map(task => {
                if (task._id === data.taskId && data.userId === user?.id) {
                  return { ...task, isCompleted: true };
                }
                return task;
              })
            };
          }
          return room;
        })
      );
      
      if (data.userId === user?.id && data.points) {
        setStats(prev => ({
          ...prev,
          totalPoints: (prev?.totalPoints || 0) + data.points
        }));
      }
    };

    const handleTaskUncompleted = (data) => {
      setRooms(prevRooms => 
        prevRooms.map(room => {
          if (room._id === data.roomId) {
            return {
              ...room,
              tasks: room.tasks.map(task => {
                if (task._id === data.taskId && data.userId === user?.id) {
                  return { ...task, isCompleted: false };
                }
                return task;
              })
            };
          }
          return room;
        })
      );
    };

    socket.on('task:completed', handleTaskCompleted);
    socket.on('task:uncompleted', handleTaskUncompleted);

    return () => {
      socket.off('task:completed', handleTaskCompleted);
      socket.off('task:uncompleted', handleTaskUncompleted);
    };
  }, [socket, user?.id]);

  const loadDashboardData = async (silentRefresh = false) => {
    try {
      if (!silentRefresh) setError(null);
      
      const roomsResponse = await api.get('/rooms');
      const freshRooms = roomsResponse.data.rooms || [];

      // IMPORTANT: never wipe existing rooms during silent refresh.
      // This prevents the "rooms show then disappear" bug when a background refresh returns empty.
      if (silentRefresh && freshRooms.length === 0 && rooms.length > 0) {
        console.warn('⚠️ Silent refresh returned 0 rooms; keeping existing rooms and retrying soon');
        setIsStaleData(true);
        // Retry once shortly after (handles brief backend hiccups)
        setTimeout(() => loadDashboardData(true), 2000);
        return;
      }
      
      setRooms(freshRooms);
      setIsStaleData(false);

      setStats(prev => ({
        ...prev,
        roomsJoined: freshRooms.length || 0
      }));
    } catch (err) {
      console.error('Error loading dashboard:', err);
      // On silent refresh errors, keep current rooms.
      if (!silentRefresh && rooms.length === 0) {
        const { icon, message } = getErrorMessage(err);
        setError(`${icon} ${message}`);
      } else {
        setIsStaleData(true);
      }
    }
  };

  // Calculate greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {/* Onboarding Modal */}
      <OnboardingModal open={showOnboarding} onClose={handleOnboardingClose} />

      {/* Header Section */}
      <Box sx={{ mb: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography 
            variant="h4" 
            fontWeight={700}
            sx={{
              fontSize: { xs: '1.5rem', md: '2.125rem' },
              background: isDark
                ? 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%)'
                : 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {getGreeting()}, {user?.username || 'there'}!
          </Typography>
          <span style={{ fontSize: '1.75rem' }} role="img" aria-label="wave">👋</span>
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, fontSize: { xs: '0.875rem', md: '1rem' } }}>
          Here's your habit tracking overview
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stale Data Indicator */}
      {isStaleData && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Showing cached data. Refreshing in background...
        </Alert>
      )}

      {/* Stats Grid */}
      <Grid container spacing={{ xs: 1.5, md: 3 }} sx={{ mb: { xs: 2, md: 4 } }}>
        <Grid item xs={6} md={3}>
          <StatCard
            icon={EmojiEvents}
            label="Total Points"
            value={stats?.totalPoints || 0}
            color="#F59E0B"
            subtext="Keep earning!"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            icon={LocalFireDepartment}
            label="Current Streak"
            value={stats?.currentStreak || 0}
            color="#EF4444"
            subtext="days"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            icon={TrendingUp}
            label="Best Streak"
            value={stats?.longestStreak || 0}
            color="#22C55E"
            subtext="days"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            icon={Groups}
            label="Rooms Joined"
            value={stats?.roomsJoined || 0}
            color={isDark ? '#60A5FA' : '#3B82F6'}
            subtext="active"
          />
        </Grid>
      </Grid>

      {/* What's New */}
      <WhatsNewCard />

      {/* Your Rooms Section */}
      <Box sx={{ mb: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 2, md: 3 } }}>
          <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
            Your Rooms
          </Typography>
          <Button
            variant="text"
            endIcon={<ArrowForward />}
            onClick={() => navigate('/rooms')}
            sx={{ fontWeight: 600 }}
          >
            View All
          </Button>
        </Box>

        {rooms.length === 0 ? (
          <Card
            sx={{
              p: 6,
              textAlign: 'center',
              background: isDark
                ? 'linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(217, 119, 6, 0.04) 100%)',
              border: `2px dashed ${isDark ? 'rgba(96, 165, 250, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
            }}
          >
            <Groups sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
            <Typography variant="h6" color="text.secondary" fontWeight={600} gutterBottom>
              No rooms yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
              Join or create a room to start tracking your habits with friends and build streaks together!
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/rooms/create')}
              >
                Create Room
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/rooms')}
              >
                Browse Rooms
              </Button>
            </Box>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {rooms.slice(0, 4).map((room) => (
              <Grid item xs={12} sm={6} key={room._id}>
                <RoomCard
                  room={room}
                  user={user}
                  onClick={() => navigate(`/rooms/${room._id}`)}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Quick Actions */}
      <Box>
        <Typography variant="h5" fontWeight={700} sx={{ mb: { xs: 2, md: 3 }, fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
          Quick Actions
        </Typography>
        <Grid container spacing={{ xs: 1.5, md: 2 }}>
          {[
            { label: 'Create Room', icon: Add, path: '/rooms/create', color: '#F59E0B' },
            { label: 'Browse Rooms', icon: Groups, path: '/rooms', color: '#3B82F6' },
            { label: 'View Friends', icon: Star, path: '/friends', color: '#22C55E' },
            { label: 'Leaderboards', icon: EmojiEvents, path: '/rooms', color: '#EF4444' },
          ].map((action) => (
            <Grid item xs={6} sm={3} key={action.label}>
              <Card
                onClick={() => navigate(action.path)}
                sx={{
                  cursor: 'pointer',
                  textAlign: 'center',
                  p: { xs: 2, md: 3 },
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 8px 24px ${alpha(action.color, 0.25)}`,
                    '& .action-icon': {
                      transform: 'scale(1.1)',
                    },
                  },
                }}
              >
                <Box
                  className="action-icon"
                  sx={{
                    width: { xs: 40, md: 56 },
                    height: { xs: 40, md: 56 },
                    borderRadius: { xs: 2, md: 3 },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: { xs: 1, md: 2 },
                    bgcolor: alpha(action.color, isDark ? 0.2 : 0.15),
                    transition: 'transform 0.3s ease',
                  }}
                >
                  <action.icon sx={{ fontSize: { xs: 20, md: 28 }, color: action.color }} />
                </Box>
                <Typography variant="body1" fontWeight={600} sx={{ fontSize: { xs: '0.8rem', md: '1rem' } }}>
                  {action.label}
                </Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
};

export default DashboardPage;
