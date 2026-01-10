import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container,
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
  Skeleton
} from '@mui/material';
import {
  TrendingUp,
  EmojiEvents,
  CheckCircle,
  Groups,
  CalendarToday,
  LocalFireDepartment
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import api, { invalidateCache } from '../utils/api';
import cacheManager from '../utils/cache';
import { format, startOfDay, differenceInDays } from 'date-fns';
import OnboardingModal from '../components/OnboardingModal';
import WhatsNewCard from '../components/WhatsNewCard';

const DashboardPage = () => {
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
    // Show onboarding if just signed up (flag set in SignupPage)
    // Show onboarding modal if not completed yet
    if (localStorage.getItem('onboardingCompleted') !== 'true') {
      setShowOnboarding(true);
    }

    // Show content immediately, load data in background
    if (user) {
      // Set stats immediately from user context
      setStats({
        totalPoints: user?.totalPoints || 0,
        currentStreak: user?.currentStreak || 0,
        longestStreak: user?.longestStreak || 0,
        roomsJoined: 0
      });
      
      // Try to load from cache first for instant display (mobile optimization)
      loadFromCacheFirst();
    }
  }, [user]);
  
  const handleOnboardingClose = () => {
    setShowOnboarding(false);
    localStorage.setItem('onboardingCompleted', 'true');
  };

  // Load cached data first, then revalidate - stale-while-revalidate pattern
  const loadFromCacheFirst = useCallback(() => {
    const cacheKey = cacheManager.generateKey('/rooms');
    const cached = cacheManager.getWithStale(cacheKey);
    
    if (cached.data?.rooms) {
      // Show cached data immediately
      setRooms(cached.data.rooms);
      setStats(prev => ({
        ...prev,
        roomsJoined: cached.data.rooms.length || 0
      }));
      setIsStaleData(cached.isStale);
      
      // If stale, revalidate in background
      if (cached.isStale) {
        loadDashboardData(true); // silent refresh
      }
    } else {
      // No cache, fetch fresh
      loadDashboardData();
    }
  }, []);

  // Listen for app foreground event to refresh data (mobile)
  useEffect(() => {
    const handleForeground = () => {
      console.log('App came to foreground, refreshing data...');
      loadDashboardData(true); // silent refresh
    };
    
    window.addEventListener('app:foreground', handleForeground);
    return () => window.removeEventListener('app:foreground', handleForeground);
  }, []);

  // Preload rooms on mount for instant display
  useEffect(() => {
    if (user && !hasMounted.current) {
      hasMounted.current = true;
      loadFromCacheFirst();
    }
  }, [user, loadFromCacheFirst]);

  // Listen for real-time task completion updates
  useEffect(() => {
    if (!socket) return;

    const handleTaskCompleted = (data) => {
      // Update the specific task in the rooms state
      setRooms(prevRooms => 
        prevRooms.map(room => {
          if (room._id === data.roomId) {
            return {
              ...room,
              tasks: room.tasks.map(task => {
                if (task._id === data.taskId) {
                  // If current user completed it, mark as completed
                  if (data.userId === user?.id) {
                    return { ...task, isCompleted: true };
                  }
                }
                return task;
              })
            };
          }
          return room;
        })
      );
      
      // Update points if it was the current user
      if (data.userId === user?.id && data.points) {
        setStats(prev => ({
          ...prev,
          totalPoints: (prev?.totalPoints || 0) + data.points
        }));
      }
    };

    const handleTaskUncompleted = (data) => {
      // Update the specific task in the rooms state
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
      if (!silentRefresh) {
        setError(null);
      }
      
      // Fetch user's rooms (single API call)
      const roomsResponse = await api.get('/rooms');
      const freshRooms = roomsResponse.data.rooms || [];
      
      setRooms(freshRooms);
      setIsStaleData(false);

      // Update stats with room count
      setStats(prev => ({
        ...prev,
        roomsJoined: freshRooms.length || 0
      }));
    } catch (err) {
      console.error('Error loading dashboard:', err);
      // Only show error if not a silent refresh and we don't have cached data
      if (!silentRefresh && rooms.length === 0) {
        setError(err.response?.data?.message || 'Failed to load dashboard data');
      }
    }
  };

  const getStreakColor = (streak) => {
    if (streak === 0) return 'default';
    if (streak < 7) return 'primary';
    if (streak < 30) return 'warning';
    return 'error';
  };

  // Remove blocking loading screen - show content immediately

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Onboarding Modal (after signup) */}
      <OnboardingModal open={showOnboarding} onClose={handleOnboardingClose} />

      {/* What's New */}
      <WhatsNewCard />

      {/* Welcome Section */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          gutterBottom 
          fontWeight="bold"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%'
          }}
        >
          Welcome back, {user?.username}! 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's your habit tracking progress
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Today's Focus Section */}
      <Paper sx={{ p: 3, mb: 3, borderLeft: 4, borderColor: 'primary.main' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h5" fontWeight="bold">
              Today's Focus
            </Typography>
            {(() => {
              const allTasks = (rooms || []).flatMap(room => (room?.tasks || []).filter(t => t.isActive));
              const completedCount = allTasks.filter(t => t.isCompleted).length;
              const totalCount = allTasks.length;
              if (totalCount > 0) {
                return (
                  <Chip 
                    size="small" 
                    color={completedCount === totalCount ? 'success' : 'default'}
                    label={`${completedCount}/${totalCount} done`}
                  />
                );
              }
              return null;
            })()}
          </Box>
          <Button variant="text" onClick={() => navigate('/rooms')}>View all</Button>
        </Box>

        {(() => {
          // Build task list grouped by room, showing completion status
          const roomsWithTasks = (rooms || [])
            .map(room => ({
              ...room,
              activeTasks: (room?.tasks || []).filter(t => t.isActive)
            }))
            .filter(room => room.activeTasks.length > 0)
            .slice(0, 3); // Limit to 3 rooms max

          if (roomsWithTasks.length === 0) {
            return (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  No tasks for today yet. Start with one small task.
                </Typography>
                <Button variant="contained" onClick={() => navigate('/rooms')}>
                  Add a Task
                </Button>
              </Box>
            );
          }

          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {roomsWithTasks.map(room => {
                const completedTasks = room.activeTasks.filter(t => t.isCompleted).length;
                const totalTasks = room.activeTasks.length;
                const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
                
                return (
                  <Card 
                    key={room._id} 
                    sx={{ 
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' }
                    }}
                    onClick={() => navigate(`/rooms/${room._id}`)}
                  >
                    <Box sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {room.name}
                          </Typography>
                          <Chip 
                            size="small" 
                            label={`${completedTasks}/${totalTasks}`}
                            color={completedTasks === totalTasks ? 'success' : 'default'}
                            variant={completedTasks === totalTasks ? 'filled' : 'outlined'}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {room.activeTasks.reduce((sum, t) => sum + (t.isCompleted ? 0 : t.points), 0)} pts remaining
                        </Typography>
                      </Box>
                      
                      {/* Progress bar */}
                      <LinearProgress 
                        variant="determinate" 
                        value={progress} 
                        sx={{ 
                          height: 6, 
                          borderRadius: 3,
                          bgcolor: 'action.hover',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: completedTasks === totalTasks ? 'success.main' : 'primary.main'
                          }
                        }} 
                      />
                      
                      {/* Task list - compact */}
                      <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {room.activeTasks.slice(0, 4).map(task => (
                          <Chip
                            key={task._id}
                            size="small"
                            icon={task.isCompleted ? <CheckCircle sx={{ fontSize: 14 }} /> : undefined}
                            label={task.title.length > 20 ? task.title.substring(0, 20) + '...' : task.title}
                            variant={task.isCompleted ? 'filled' : 'outlined'}
                            color={task.isCompleted ? 'success' : 'default'}
                            sx={{ 
                              textDecoration: task.isCompleted ? 'line-through' : 'none',
                              opacity: task.isCompleted ? 0.7 : 1
                            }}
                          />
                        ))}
                        {room.activeTasks.length > 4 && (
                          <Chip
                            size="small"
                            label={`+${room.activeTasks.length - 4} more`}
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  </Card>
                );
              })}
              
              {rooms.length > 3 && (
                <Button 
                  variant="text" 
                  onClick={() => navigate('/rooms')}
                  sx={{ alignSelf: 'center' }}
                >
                  View {rooms.length - 3} more rooms
                </Button>
              )}
            </Box>
          );
        })()}
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Total Points */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                    Total Points
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                    {stats?.totalPoints || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                  <TrendingUp sx={{ color: 'white' }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Current Streak */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                    Current Streak
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                    {stats?.currentStreak || 0}
                    <Typography component="span" variant="body1" sx={{ ml: 0.5 }}>
                      days
                    </Typography>
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                  <LocalFireDepartment sx={{ color: 'white' }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Longest Streak */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                    Best Streak
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                    {stats?.longestStreak || 0}
                    <Typography component="span" variant="body1" sx={{ ml: 0.5 }}>
                      days
                    </Typography>
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                  <EmojiEvents sx={{ color: 'white' }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Rooms Joined */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                    Rooms
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                    {stats?.roomsJoined || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                  <Groups sx={{ color: 'white' }} />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* My Rooms Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight="bold">
            My Rooms
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/rooms')}
          >
            View All Rooms
          </Button>
        </Box>

        {rooms.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Groups sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No rooms yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Join or create a room to start tracking your habits with others
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/rooms/create')}
              sx={{ mr: 2 }}
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
        ) : (
          <Grid container spacing={2}>
            {rooms.slice(0, 4).map((room) => {
              const isOwner = room.owner._id === user?.id || room.owner === user?.id;
              const memberCount = room.members?.length || 0;
              const myMember = room.members?.find(m => 
                m.userId._id === user?.id || m.userId === user?.id
              );

              return (
                <Grid item xs={12} sm={6} md={6} key={room._id}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 6
                      }
                    }}
                    onClick={() => navigate(`/rooms/${room._id}`)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6" fontWeight="bold">
                          {room.name}
                        </Typography>
                        {isOwner && (
                          <Chip label="Owner" size="small" color="primary" />
                        )}
                      </Box>
                      
                      {room.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {room.description.length > 100 
                            ? `${room.description.substring(0, 100)}...` 
                            : room.description}
                        </Typography>
                      )}

                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Groups fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            {memberCount} {memberCount === 1 ? 'member' : 'members'}
                          </Typography>
                        </Box>
                        
                        {myMember && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EmojiEvents fontSize="small" color="warning" />
                            <Typography variant="body2" color="text.secondary">
                              {myMember.points} points
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      {room.tasks && room.tasks.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            {room.tasks.filter(t => t.isActive).length} active tasks
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Paper>

      {/* Quick Actions */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Quick Actions
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Groups />}
              onClick={() => navigate('/rooms/create')}
            >
              Create Room
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<CheckCircle />}
              onClick={() => navigate('/rooms')}
            >
              Browse Rooms
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<CalendarToday />}
              onClick={() => navigate('/profile')}
            >
              View Profile
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<EmojiEvents />}
              onClick={() => navigate('/rooms')}
            >
              Leaderboards
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default DashboardPage;
