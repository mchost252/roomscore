import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Avatar,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Tab,
  Tabs,
  LinearProgress
} from '@mui/material';
import {
  Edit,
  Email,
  CalendarToday,
  EmojiEvents,
  TrendingUp,
  LocalFireDepartment,
  Logout,
  Settings,
  Person,
  History,
  Notifications,
  NotificationsActive,
  NotificationsOff,
  Delete,
  Clear,
  Brightness4,
  Brightness7
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme as useCustomTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import api from '../utils/api';

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const { mode, themePreference, setThemeMode } = useCustomTheme();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [activityHistory, setActivityHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notifPage, setNotifPage] = useState(1);
  const [notifHasMore, setNotifHasMore] = useState(true);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifStatus, setNotifStatus] = useState('all'); // all | unread | read
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [showNotifHint, setShowNotifHint] = useState(false);

  const [editData, setEditData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    avatar: user?.avatar || '',
    bio: user?.bio || ''
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');

  useEffect(() => {
    loadProfileData();
  }, []);

  // Real-time notification updates
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (payload) => {
      const notif = payload?.notification || payload;
      setNotifications(prev => [notif, ...prev]);
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      
      // Load user stats
      setUserStats({
        totalPoints: user?.totalPoints || 0,
        currentStreak: user?.currentStreak || 0,
        longestStreak: user?.longestStreak || 0,
        roomsJoined: 0, // This would come from API
        tasksCompleted: 0 // This would come from API
      });

      // Load notifications (first page)
      try {
        setNotifLoading(true);
        const notifResponse = await api.get(`/notifications`, { params: { page: 1, limit: 20, status: notifStatus } });
        setNotifications(notifResponse.data.notifications || []);
        setNotifPage(1);
        setNotifHasMore(!!notifResponse.data.hasMore);
      } catch (err) {
        console.error('Error loading notifications:', err);
      } finally {
        setNotifLoading(false);
      }

      // In a real app, you'd load activity history from API
      setActivityHistory([]);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      setAvatarFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
        setEditData(prev => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Convert avatar to base64 if file was uploaded
      let avatarData = editData.avatar;
      
      await api.put('/auth/profile', {
        username: editData.username,
        avatar: avatarData || null,
        bio: editData.bio
      });
      
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
      setEditDialogOpen(false);
      
      // Reload user profile
      window.location.reload();
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.message || 'Failed to update profile');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.isRead) {
      await handleMarkNotificationRead(notification._id);
    }

    // Navigate to the related room if exists
    if (notification.relatedRoom) {
      // relatedRoom can be either an object with _id or just an ID string
      const roomId = notification.relatedRoom._id || notification.relatedRoom;
      navigate(`/rooms/${roomId}`);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
      setSuccess('Notification deleted');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error('Error deleting notification:', err);
      setError('Failed to delete notification');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleClearAllNotifications = async () => {
    setConfirmClearOpen(false);
    try {
      await api.delete('/notifications');
      setNotifications(prev => prev.filter(n => !n.isRead));
      setSuccess('All read notifications cleared');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error('Error clearing notifications:', err);
      setError('Failed to clear notifications');
      setTimeout(() => setError(null), 3000);
    }
  };

  const fetchMoreNotifications = useCallback(async () => {
    if (notifLoading || !notifHasMore) return;
    try {
      setNotifLoading(true);
      const nextPage = notifPage + 1;
      const res = await api.get('/notifications', { params: { page: nextPage, limit: 20, status: notifStatus } });
      setNotifications(prev => [...prev, ...(res.data.notifications || [])]);
      setNotifPage(nextPage);
      setNotifHasMore(!!res.data.hasMore);
    } catch (err) {
      console.error('Error loading more notifications:', err);
    } finally {
      setNotifLoading(false);
    }
  }, [notifLoading, notifHasMore, notifPage, notifStatus]);

  const unreadNotifications = notifications.filter(n => !n.isRead).length;

  // Auto-mark all notifications as read when viewing the Notifications tab
  useEffect(() => {
    if (tabValue === 2 && unreadNotifications > 0) {
      const markAllAsRead = async () => {
        try {
          await api.put('/notifications/read-all');
          // Update local state to reflect read status
          setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (err) {
          console.error('Error marking notifications as read:', err);
        }
      };
      markAllAsRead();
    }
  }, [tabValue]);

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = document.getElementById('notif-sentinel');
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        fetchMoreNotifications();
      }
    }, { rootMargin: '200px' });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchMoreNotifications]);

  return (
    <Box sx={{ 
      width: '100%', 
      maxWidth: '100%', 
      overflowX: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <Box sx={{ mb: { xs: 2, md: 4 } }}>
        <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ fontSize: { xs: '1.3rem', md: '2.125rem' } }}>
          Profile
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', md: '1rem' } }}>
          Manage your account and view your progress
        </Typography>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: { xs: 2, md: 3 }, fontSize: { xs: '0.75rem', md: '0.875rem' } }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: { xs: 2, md: 3 }, fontSize: { xs: '0.75rem', md: '0.875rem' } }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={{ xs: 0, md: 3 }} sx={{ width: '100%', maxWidth: '100%', margin: 0, minHeight: 0 }}>
        {/* Left Sidebar - Profile Info */}
        <Grid item xs={12} md={4} sx={{ maxWidth: '100%' }}>
          <Paper sx={{ p: { xs: 2, md: 3 }, textAlign: 'center', mb: { xs: 2, md: 3 } }}>
            <Avatar
              src={user?.avatar || undefined}
              sx={{
                width: { xs: 80, md: 120 },
                height: { xs: 80, md: 120 },
                margin: '0 auto',
                mb: { xs: 1.5, md: 2 },
                fontSize: { xs: '2rem', md: '3rem' },
                bgcolor: 'primary.main'
              }}
            >
              {!user?.avatar && (user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?')}
            </Avatar>
            
            <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1.2rem', md: '1.5rem' } }}>
              {user?.username || 'User'}
            </Typography>
            
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, wordBreak: 'break-all' }}>
              {user?.email}
            </Typography>

            {user?.bio && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: { xs: 1, md: 2 }, fontStyle: 'italic', fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                "{user.bio}"
              </Typography>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: { xs: 1.5, md: 2 } }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Edit />}
                onClick={() => setEditDialogOpen(true)}
                sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}
              >
                Edit Profile
              </Button>
              <IconButton color="error" onClick={handleLogout} size="small">
                <Logout fontSize="small" />
              </IconButton>
            </Box>

            <Divider sx={{ my: { xs: 2, md: 3 } }} />

            <Box sx={{ textAlign: 'left', overflow: 'hidden' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 1, md: 2 } }}>
                <Email fontSize="small" color="action" sx={{ flexShrink: 0 }} />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, wordBreak: 'break-all' }}>
                  {user?.email}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarToday fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                  Joined {user?.createdAt ? format(parseISO(user.createdAt), 'MMM d, yyyy') : 'Recently'}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Quick Stats */}
          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
              Quick Stats
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmojiEvents color="warning" sx={{ fontSize: { xs: 18, md: 24 } }} />
                  <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>Total Points</Typography>
                </Box>
                <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
                  {userStats?.totalPoints || 0}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocalFireDepartment color="error" sx={{ fontSize: { xs: 18, md: 24 } }} />
                  <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>Current Streak</Typography>
                </Box>
                <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
                  {userStats?.currentStreak || 0} days
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUp color="success" sx={{ fontSize: { xs: 18, md: 24 } }} />
                  <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>Best Streak</Typography>
                </Box>
                <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
                  {userStats?.longestStreak || 0} days
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Right Content Area */}
        <Grid item xs={12} md={8} sx={{ maxWidth: '100%' }}>
          <Paper sx={{ mb: { xs: 2, md: 3 } }}>
            <Tabs 
              value={tabValue} 
              onChange={(e, newValue) => setTabValue(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                '& .MuiTab-root': {
                  minHeight: { xs: 48, md: 64 },
                  fontSize: { xs: '0.7rem', md: '0.875rem' },
                  px: { xs: 1, md: 2 },
                },
                '& .MuiTab-iconWrapper': {
                  fontSize: { xs: 18, md: 24 },
                },
              }}
            >
              <Tab icon={<TrendingUp />} label="Overview" iconPosition="start" />
              <Tab icon={<History />} label="Activity" iconPosition="start" />
              <Tab 
                icon={<Notifications />} 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Notifications
                    {unreadNotifications > 0 && (
                      <Chip label={unreadNotifications} size="small" color="error" sx={{ height: { xs: 18, md: 24 }, '& .MuiChip-label': { px: 0.5, fontSize: { xs: '0.65rem', md: '0.75rem' } } }} />
                    )}
                  </Box>
                } 
                iconPosition="start" 
              />
              <Tab icon={<Settings />} label="Settings" iconPosition="start" />
            </Tabs>
          </Paper>

          {/* Overview Tab */}
          {tabValue === 0 && (
            <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
              <Grid container spacing={{ xs: 0.5, md: 3 }} sx={{ width: '100%', maxWidth: '100%', margin: 0 }}>
                {/* Stat Cards */}
                <Grid item xs={6} sm={6} sx={{ maxWidth: '100%' }}>
                  <Card>
                    <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontSize: { xs: '0.65rem', md: '0.875rem' } }}>
                            Total Points
                          </Typography>
                          <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', md: '2.125rem' } }}>
                            {userStats?.totalPoints || 0}
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: 'primary.main', width: { xs: 28, md: 40 }, height: { xs: 28, md: 40 } }}>
                          <EmojiEvents sx={{ fontSize: { xs: 16, md: 24 } }} />
                        </Avatar>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={6} sm={6} sx={{ maxWidth: '100%' }}>
                  <Card>
                    <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontSize: { xs: '0.65rem', md: '0.875rem' } }}>
                            Current Streak
                          </Typography>
                          <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', md: '2.125rem' } }}>
                            {userStats?.currentStreak || 0}
                            <Typography component="span" variant="body1" sx={{ ml: 0.5, fontSize: { xs: '0.7rem', md: '1rem' } }}>
                              days
                            </Typography>
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: 'error.main', width: { xs: 28, md: 40 }, height: { xs: 28, md: 40 } }}>
                          <LocalFireDepartment sx={{ fontSize: { xs: 16, md: 24 } }} />
                        </Avatar>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={6} sm={6} sx={{ maxWidth: '100%' }}>
                  <Card>
                    <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontSize: { xs: '0.65rem', md: '0.875rem' } }}>
                            Longest Streak
                          </Typography>
                          <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', md: '2.125rem' } }}>
                            {userStats?.longestStreak || 0}
                            <Typography component="span" variant="body1" sx={{ ml: 0.5, fontSize: { xs: '0.7rem', md: '1rem' } }}>
                              days
                            </Typography>
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: 'success.main', width: { xs: 28, md: 40 }, height: { xs: 28, md: 40 } }}>
                          <TrendingUp sx={{ fontSize: { xs: 16, md: 24 } }} />
                        </Avatar>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={6} sm={6} sx={{ maxWidth: '100%' }}>
                  <Card>
                    <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontSize: { xs: '0.65rem', md: '0.875rem' } }}>
                            Rooms Joined
                          </Typography>
                          <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', md: '2.125rem' } }}>
                            {userStats?.roomsJoined || 0}
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: 'warning.main', width: { xs: 28, md: 40 }, height: { xs: 28, md: 40 } }}>
                          <Person sx={{ fontSize: { xs: 16, md: 24 } }} />
                        </Avatar>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Achievement Section */}
              <Paper sx={{ p: { xs: 2, md: 3 }, mt: { xs: 2, md: 3 } }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
                  Recent Achievements
                </Typography>
                <Box sx={{ textAlign: 'center', py: { xs: 2, md: 4 } }}>
                  <EmojiEvents sx={{ fontSize: { xs: 40, md: 60 }, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                    No achievements yet. Keep completing tasks to earn badges!
                  </Typography>
                </Box>
              </Paper>
            </Box>
          )}

          {/* Activity Tab */}
          {tabValue === 1 && (
            <Paper sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
                Activity History
              </Typography>
              {activityHistory.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: { xs: 3, md: 6 } }}>
                  <History sx={{ fontSize: { xs: 40, md: 60 }, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                    No activity history yet
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', md: '0.75rem' } }}>
                    Your completed tasks and milestones will appear here
                  </Typography>
                </Box>
              ) : (
                <List dense>
                  {activityHistory.map((activity, index) => (
                    <ListItem key={index} divider={index < activityHistory.length - 1}>
                      <ListItemText
                        primary={activity.description}
                        secondary={format(parseISO(activity.timestamp), 'MMM d, yyyy h:mm a')}
                        primaryTypographyProps={{ fontSize: { xs: '0.8rem', md: '1rem' } }}
                        secondaryTypographyProps={{ fontSize: { xs: '0.65rem', md: '0.75rem' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          )}

          {/* Notifications Tab */}
          {tabValue === 2 && (
            <Paper sx={{ p: { xs: 1.5, md: 3 } }}>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between', 
                alignItems: { xs: 'flex-start', sm: 'center' }, 
                gap: { xs: 1.5, sm: 2 },
                mb: { xs: 2, md: 3 } 
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
                    Notifications
                  </Typography>
                  {unreadNotifications > 0 && (
                    <Chip 
                      label={`${unreadNotifications} unread`} 
                      color="error" 
                      size="small"
                      sx={{ height: { xs: 20, md: 24 }, '& .MuiChip-label': { fontSize: { xs: '0.65rem', md: '0.75rem' }, px: 1 } }}
                    />
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                  <Button
                    variant={notifStatus === 'all' ? 'contained' : 'text'}
                    size="small"
                    onClick={async () => { setNotifStatus('all'); await loadProfileData(); }}
                    sx={{ minWidth: 'auto', px: { xs: 1, md: 2 }, fontSize: { xs: '0.7rem', md: '0.875rem' } }}
                  >
                    All
                  </Button>
                  <Button
                    variant={notifStatus === 'unread' ? 'contained' : 'text'}
                    size="small"
                    onClick={async () => { setNotifStatus('unread'); await loadProfileData(); }}
                    sx={{ minWidth: 'auto', px: { xs: 1, md: 2 }, fontSize: { xs: '0.7rem', md: '0.875rem' } }}
                  >
                    Unread
                  </Button>
                  <Button
                    variant={notifStatus === 'read' ? 'contained' : 'text'}
                    size="small"
                    onClick={async () => { setNotifStatus('read'); await loadProfileData(); }}
                    sx={{ minWidth: 'auto', px: { xs: 1, md: 2 }, fontSize: { xs: '0.7rem', md: '0.875rem' } }}
                  >
                    Read
                  </Button>

                  {notifications.length > 0 && (
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<Clear sx={{ fontSize: { xs: 14, md: 18 } }} />}
                      onClick={() => setConfirmClearOpen(true)}
                      sx={{ minWidth: 'auto', px: { xs: 1, md: 2 }, fontSize: { xs: '0.65rem', md: '0.875rem' } }}
                    >
                      Clear
                    </Button>
                  )}
                </Box>
              </Box>

              {notifications.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: { xs: 3, md: 6 } }}>
                  <Notifications sx={{ fontSize: { xs: 40, md: 60 }, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                    No notifications yet
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', md: '0.75rem' } }}>
                    You'll receive notifications about room activity and achievements
                  </Typography>
                </Box>
              ) : (
                <List dense sx={{ '& .MuiListItem-root': { px: { xs: 1, md: 2 } } }}>
                  {notifications.map((notification, index) => (
                    <ListItem
                      key={notification._id}
                      divider={index < notifications.length - 1}
                      sx={{
                        bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                        borderRadius: 1,
                        mb: 1,
                        cursor: notification.relatedRoom ? 'pointer' : 'default',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        '&:hover': notification.relatedRoom ? {
                          bgcolor: 'action.selected'
                        } : {}
                      }}
                      onClick={() => notification.relatedRoom && handleNotificationClick(notification)}
                    >
                      <ListItemText
                        sx={{ width: '100%', m: 0 }}
                        primary={
                          <Box>
                            <Typography 
                              variant="body2" 
                              color="primary"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}
                            >
                              {notification.title}
                            </Typography>
                            <Typography 
                              variant="body1" 
                              fontWeight={notification.isRead ? 'normal' : 'bold'}
                              sx={{ fontSize: { xs: '0.8rem', md: '1rem' }, wordBreak: 'break-word' }}
                            >
                              {notification.message}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                            {notification.createdAt && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', md: '0.75rem' } }}>
                                {format(parseISO(notification.createdAt), 'MMM d, yyyy')}
                              </Typography>
                            )}
                            {notification.relatedRoom && (
                              <Chip 
                                label="View room" 
                                size="small" 
                                sx={{ height: 18, fontSize: { xs: '0.55rem', md: '0.65rem' } }}
                              />
                            )}
                          </Box>
                        }
                      />
                      {/* Action buttons below content on mobile */}
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 1, width: '100%', justifyContent: 'flex-end' }}>
                        {!notification.isRead && (
                          <Button 
                            size="small"
                            variant="text"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkNotificationRead(notification._id);
                            }}
                            sx={{ fontSize: { xs: '0.6rem', md: '0.75rem' }, minWidth: 'auto', px: 1 }}
                          >
                            Mark Read
                          </Button>
                        )}
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNotification(notification._id);
                          }}
                          sx={{ p: 0.5 }}
                        >
                          <Delete sx={{ fontSize: { xs: 16, md: 20 } }} />
                        </IconButton>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          )}

          {/* Settings Tab */}
          {tabValue === 3 && (
            <Paper sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
                Settings
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: { xs: 2, md: 3 }, fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                Manage your preferences
              </Typography>

              {/* Appearance Section */}
              <Box sx={{ mb: { xs: 2, md: 3 } }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '0.9rem', md: '1rem' } }}>
                  Appearance
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between', 
                  alignItems: { xs: 'flex-start', sm: 'center' }, 
                  gap: { xs: 1.5, sm: 2 },
                  mb: 2 
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {mode === 'dark' ? (
                      <Brightness4 color="primary" sx={{ fontSize: { xs: 20, md: 24 } }} />
                    ) : (
                      <Brightness7 color="primary" sx={{ fontSize: { xs: 20, md: 24 } }} />
                    )}
                    <Box>
                      <Typography variant="body1" fontWeight="bold" sx={{ fontSize: { xs: '0.85rem', md: '1rem' } }}>
                        Theme
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
                        {themePreference === 'system' 
                          ? `System (${mode === 'dark' ? 'Dark' : 'Light'})` 
                          : mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Button
                      variant={themePreference === 'light' ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setThemeMode('light')}
                      startIcon={<Brightness7 sx={{ fontSize: { xs: 14, md: 18 } }} />}
                      sx={{ minWidth: 'auto', px: { xs: 1, md: 1.5 }, fontSize: { xs: '0.7rem', md: '0.875rem' } }}
                    >
                      Light
                    </Button>
                    <Button
                      variant={themePreference === 'dark' ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setThemeMode('dark')}
                      startIcon={<Brightness4 sx={{ fontSize: { xs: 14, md: 18 } }} />}
                      sx={{ minWidth: 'auto', px: { xs: 1, md: 1.5 }, fontSize: { xs: '0.7rem', md: '0.875rem' } }}
                    >
                      Dark
                    </Button>
                    <Button
                      variant={themePreference === 'system' ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setThemeMode('system')}
                      sx={{ minWidth: 'auto', px: { xs: 1, md: 1.5 }, fontSize: { xs: '0.7rem', md: '0.875rem' } }}
                    >
                      System
                    </Button>
                  </Box>
                </Box>
              </Box>

            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Confirm Clear All Read */}
      <Dialog open={confirmClearOpen} onClose={() => setConfirmClearOpen(false)}>
        <DialogTitle>Clear all read notifications?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">This will remove all notifications marked as read. Unread notifications will be kept.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClearOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleClearAllNotifications}>Clear</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => !loading && setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              fullWidth
              label="Username"
              value={editData.username}
              onChange={(e) => setEditData(prev => ({ ...prev, username: e.target.value }))}
              required
            />
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Profile Picture
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar
                  src={avatarPreview || editData.avatar}
                  sx={{ width: 80, height: 80 }}
                >
                  {!avatarPreview && !editData.avatar && (editData.username?.[0]?.toUpperCase() || '?')}
                </Avatar>
                <Box>
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                  >
                    Upload Image
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={handleAvatarChange}
                    />
                  </Button>
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                    Max 5MB (JPG, PNG, GIF)
                  </Typography>
                </Box>
              </Box>
              <TextField
                fullWidth
                label="Or paste image URL"
                value={editData.avatar}
                onChange={(e) => {
                  setEditData(prev => ({ ...prev, avatar: e.target.value }));
                  setAvatarPreview(e.target.value);
                }}
                placeholder="https://example.com/avatar.jpg"
                size="small"
              />
            </Box>
            <TextField
              fullWidth
              label="Bio"
              value={editData.bio}
              onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))}
              multiline
              rows={3}
              placeholder="Tell us about yourself..."
              helperText={`${editData.bio.length}/500 characters`}
              inputProps={{ maxLength: 500 }}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={editData.email}
              disabled
              helperText="Email cannot be changed"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateProfile} 
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProfilePage;
