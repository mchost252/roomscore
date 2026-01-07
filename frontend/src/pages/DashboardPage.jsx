import React, { useState, useEffect } from 'react';
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
import { useNavigate } from 'react-router-dom';
import api, { invalidateCache } from '../utils/api';
import { format, startOfDay, differenceInDays } from 'date-fns';

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Show content immediately, load data in background
    if (user) {
      // Set stats immediately from user context
      setStats({
        totalPoints: user?.totalPoints || 0,
        currentStreak: user?.currentStreak || 0,
        longestStreak: user?.longestStreak || 0,
        roomsJoined: 0
      });
      
      // Load rooms immediately - no delay
      loadDashboardData();
    }
  }, [user]);
  
  // Preload rooms on mount for instant display
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, []);

  const loadDashboardData = async () => {
    try {
      setError(null);
      
      // Fetch user's rooms (single API call)
      const roomsResponse = await api.get('/rooms');
      setRooms(roomsResponse.data.rooms || []);

      // Update stats with room count
      setStats(prev => ({
        ...prev,
        roomsJoined: roomsResponse.data.rooms?.length || 0
      }));
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
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
          <Typography variant="h5" fontWeight="bold">
            Today's Focus
          </Typography>
          <Button variant="text" onClick={() => navigate('/rooms')}>View all</Button>
        </Box>

        {(() => {
          // Build a simple list of active tasks from rooms (best-effort without extra API calls)
          const focusTasks = (rooms || [])
            .flatMap(room => (room?.tasks || []).filter(t => t.isActive).map(t => ({
              id: t._id,
              title: t.title,
              points: t.points,
              roomId: room._id,
              roomName: room.name
            })))
            .slice(0, 5);

          if (focusTasks.length === 0) {
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
            <Grid container spacing={2}>
              {focusTasks.map(task => (
                <Grid item xs={12} md={6} key={task.id}>
                  <Card sx={{ p: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {task.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Room: {task.roomName}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip size="small" color="secondary" label="Room" variant="outlined" />
                        <Chip size="small" color="success" label={`+${task.points} pts`} />
                        <Button size="small" variant="outlined" onClick={() => navigate(`/rooms/${task.roomId}`)}>
                          Go
                        </Button>
                      </Box>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
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
