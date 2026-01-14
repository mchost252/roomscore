import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container,
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
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom fontWeight="bold">
          Profile
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your account and view your progress
        </Typography>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left Sidebar - Profile Info */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center', mb: 3 }}>
            <Avatar
              src={user?.avatar || undefined}
              sx={{
                width: 120,
                height: 120,
                margin: '0 auto',
                mb: 2,
                fontSize: '3rem',
                bgcolor: 'primary.main'
              }}
            >
              {!user?.avatar && (user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?')}
            </Avatar>
            
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              {user?.username || 'User'}
            </Typography>
            
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {user?.email}
            </Typography>

            {user?.bio && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
                "{user.bio}"
              </Typography>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={() => setEditDialogOpen(true)}
              >
                Edit Profile
              </Button>
              <IconButton color="error" onClick={handleLogout}>
                <Logout />
              </IconButton>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ textAlign: 'left' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Email fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {user?.email}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarToday fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  Joined {user?.createdAt ? format(parseISO(user.createdAt), 'MMM d, yyyy') : 'Recently'}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Quick Stats */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Quick Stats
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmojiEvents color="warning" />
                  <Typography variant="body2">Total Points</Typography>
                </Box>
                <Typography variant="h6" fontWeight="bold">
                  {userStats?.totalPoints || 0}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocalFireDepartment color="error" />
                  <Typography variant="body2">Current Streak</Typography>
                </Box>
                <Typography variant="h6" fontWeight="bold">
                  {userStats?.currentStreak || 0} days
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUp color="success" />
                  <Typography variant="body2">Best Streak</Typography>
                </Box>
                <Typography variant="h6" fontWeight="bold">
                  {userStats?.longestStreak || 0} days
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Right Content Area */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ mb: 3 }}>
            <Tabs 
              value={tabValue} 
              onChange={(e, newValue) => setTabValue(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
            >
              <Tab icon={<TrendingUp />} label="Overview" iconPosition="start" />
              <Tab icon={<History />} label="Activity" iconPosition="start" />
              <Tab 
                icon={<Notifications />} 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    Notifications
                    {unreadNotifications > 0 && (
                      <Chip label={unreadNotifications} size="small" color="error" />
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
            <Box>
              <Grid container spacing={3}>
                {/* Stat Cards */}
                <Grid item xs={12} sm={6}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Total Points
                          </Typography>
                          <Typography variant="h4" fontWeight="bold">
                            {userStats?.totalPoints || 0}
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <EmojiEvents />
                        </Avatar>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Current Streak
                          </Typography>
                          <Typography variant="h4" fontWeight="bold">
                            {userStats?.currentStreak || 0}
                            <Typography component="span" variant="body1" sx={{ ml: 0.5 }}>
                              days
                            </Typography>
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: 'error.main' }}>
                          <LocalFireDepartment />
                        </Avatar>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Longest Streak
                          </Typography>
                          <Typography variant="h4" fontWeight="bold">
                            {userStats?.longestStreak || 0}
                            <Typography component="span" variant="body1" sx={{ ml: 0.5 }}>
                              days
                            </Typography>
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: 'success.main' }}>
                          <TrendingUp />
                        </Avatar>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Rooms Joined
                          </Typography>
                          <Typography variant="h4" fontWeight="bold">
                            {userStats?.roomsJoined || 0}
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: 'warning.main' }}>
                          <Person />
                        </Avatar>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Achievement Section */}
              <Paper sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Recent Achievements
                </Typography>
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <EmojiEvents sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    No achievements yet. Keep completing tasks to earn badges!
                  </Typography>
                </Box>
              </Paper>
            </Box>
          )}

          {/* Activity Tab */}
          {tabValue === 1 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Activity History
              </Typography>
              {activityHistory.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <History sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    No activity history yet
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Your completed tasks and milestones will appear here
                  </Typography>
                </Box>
              ) : (
                <List>
                  {activityHistory.map((activity, index) => (
                    <ListItem key={index} divider={index < activityHistory.length - 1}>
                      <ListItemText
                        primary={activity.description}
                        secondary={format(parseISO(activity.timestamp), 'MMM d, yyyy h:mm a')}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          )}

          {/* Notifications Tab */}
          {tabValue === 2 && (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h6" fontWeight="bold">
                    Notifications
                  </Typography>
                  {unreadNotifications > 0 && (
                    <Chip 
                      label={`${unreadNotifications} unread`} 
                      color="error" 
                      size="small" 
                    />
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    variant={notifStatus === 'all' ? 'contained' : 'text'}
                    size="small"
                    onClick={async () => { setNotifStatus('all'); await loadProfileData(); }}
                  >
                    All
                  </Button>
                  <Button
                    variant={notifStatus === 'unread' ? 'contained' : 'text'}
                    size="small"
                    onClick={async () => { setNotifStatus('unread'); await loadProfileData(); }}
                  >
                    Unread
                  </Button>
                  <Button
                    variant={notifStatus === 'read' ? 'contained' : 'text'}
                    size="small"
                    onClick={async () => { setNotifStatus('read'); await loadProfileData(); }}
                  >
                    Read
                  </Button>

                  {notifications.length > 0 && (
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<Clear />}
                      onClick={() => setConfirmClearOpen(true)}
                    >
                      Clear All Read
                    </Button>
                  )}
                </Box>
              </Box>

              {notifications.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Notifications sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    No notifications yet
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    You'll receive notifications about room activity and achievements
                  </Typography>
                </Box>
              ) : (
                <List>
                  {notifications.map((notification, index) => (
                    <ListItem
                      key={notification._id}
                      divider={index < notifications.length - 1}
                      sx={{
                        bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                        borderRadius: 1,
                        mb: 1,
                        cursor: notification.relatedRoom ? 'pointer' : 'default',
                        '&:hover': notification.relatedRoom ? {
                          bgcolor: 'action.selected'
                        } : {}
                      }}
                      onClick={() => notification.relatedRoom && handleNotificationClick(notification)}
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {!notification.isRead && (
                            <Button 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkNotificationRead(notification._id);
                              }}
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
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={
                          <Box>
                            <Typography 
                              variant="body2" 
                              color="primary"
                              fontWeight="bold"
                              gutterBottom
                            >
                              {notification.title}
                            </Typography>
                            <Typography 
                              variant="body1" 
                              fontWeight={notification.isRead ? 'normal' : 'bold'}
                            >
                              {notification.message}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5 }}>
                            {notification.createdAt && (
                              <Typography variant="caption" color="text.secondary">
                                {format(parseISO(notification.createdAt), 'MMM d, yyyy h:mm a')}
                              </Typography>
                            )}
                            {notification.relatedRoom && (
                              <Chip 
                                label="Click to view room" 
                                size="small" 
                                sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          )}

          {/* Settings Tab */}
          {tabValue === 3 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Settings
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Manage your preferences
              </Typography>

              {/* Appearance Section */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Appearance
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {mode === 'dark' ? (
                      <Brightness4 color="primary" />
                    ) : (
                      <Brightness7 color="primary" />
                    )}
                    <Box>
                      <Typography variant="body1" fontWeight="bold">
                        Theme
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {themePreference === 'system' 
                          ? `System (${mode === 'dark' ? 'Dark' : 'Light'})` 
                          : mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant={themePreference === 'light' ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setThemeMode('light')}
                      startIcon={<Brightness7 />}
                    >
                      Light
                    </Button>
                    <Button
                      variant={themePreference === 'dark' ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setThemeMode('dark')}
                      startIcon={<Brightness4 />}
                    >
                      Dark
                    </Button>
                    <Button
                      variant={themePreference === 'system' ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setThemeMode('system')}
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
    </Container>
  );
};

export default ProfilePage;
