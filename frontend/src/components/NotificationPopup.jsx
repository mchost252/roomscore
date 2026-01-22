import React, { useState, useEffect } from 'react';
import {
  Menu,
  MenuItem,
  Badge,
  IconButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Divider,
  Box,
  Button
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Circle as CircleIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import useNotifications from '../hooks/useNotifications';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const NotificationPopup = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unreadCount, clearUnreadCount } = useNotifications();
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    if (!user) return; // Don't open if not logged in
    setAnchorEl(event.currentTarget);
    loadNotifications();
    // Mark all notifications as read when popup is opened
    markAllAsRead();
  };

  const markAllAsRead = async () => {
    if (!user) return; // Don't make API call if not logged in
    try {
      await api.put('/notifications/read-all');
      // Clear the unread count in the UI immediately
      clearUnreadCount();
    } catch (error) {
      // Only log if not a 401 (user might have logged out)
      if (error.response?.status !== 401) {
        console.error('Error marking notifications as read:', error);
      }
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const loadNotifications = async () => {
    if (!user) return; // Don't make API call if not logged in
    try {
      setLoading(true);
      const response = await api.get('/notifications?limit=3');
      setNotifications(response.data.notifications || []);
    } catch (error) {
      // Only log if not a 401 (user might have logged out)
      if (error.response?.status !== 401) {
        console.error('Error loading notifications:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read
      if (!notification.isRead) {
        await api.put(`/notifications/${notification._id}/read`);
      }

      handleClose();

      // Navigate to related page based on notification type
      if (notification.type === 'friend_request' || notification.type === 'friend_request_accepted') {
        // Navigate to friends page, requests tab for friend requests
        navigate('/friends', { state: { tab: notification.type === 'friend_request' ? 1 : 0 } });
      } else if (notification.relatedRoom) {
        const roomId = notification.relatedRoom._id || notification.relatedRoom;
        navigate(`/rooms/${roomId}`);
      } else if (notification.type === 'direct_message') {
        const senderId = notification.data?.senderId;
        if (senderId) navigate(`/messages/${senderId}`);
        else navigate('/messages');
      } else if (notification.type === 'nudge') {
        // Navigate to the room where nudge was sent
        const roomId = notification.data?.roomId || notification.relatedRoom?._id;
        if (roomId) navigate(`/rooms/${roomId}`);
        else navigate('/dashboard');
      } else {
        // Default: go to dashboard
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleViewAll = () => {
    handleClose();
    navigate('/notifications');
  };

  const getNotificationIcon = (type) => {
    const iconProps = { fontSize: 'small' };
    switch (type) {
      case 'task_completed':
        return '✅';
      case 'new_task':
        return '📝';
      case 'member_joined':
        return '👋';
      case 'member_left':
        return '👋';
      case 'new_chat':
        return '💬';
      case 'room_updated':
        return '🔔';
      default:
        return '📢';
    }
  };

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        size="large"
        sx={{ 
          ml: 1,
          borderRadius: '50%',
          width: 44,
          height: 44,
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            transform: 'scale(1.05)',
          },
          transition: 'all 0.2s ease',
        }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 360,
            maxHeight: 400,
            mt: 1.5,
            overflow: 'hidden'
          }
        }}
        MenuListProps={{
          sx: {
            py: 0,
            maxHeight: 400,
            overflowY: 'auto'
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        disableScrollLock={true}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontSize={16}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Typography variant="caption" color="primary">
              {unreadCount} new
            </Typography>
          )}
        </Box>
        
        <Divider />

        {loading ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Loading...
            </Typography>
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No notifications yet
            </Typography>
          </Box>
        ) : (
          <>
            {notifications.map((notification, index) => (
              <MenuItem
                key={notification._id}
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  py: 1.5,
                  px: 2,
                  bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                  '&:hover': {
                    bgcolor: 'action.selected'
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: notification.isRead ? 'grey.400' : 'primary.main' }}>
                    {getNotificationIcon(notification.type)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" fontWeight={notification.isRead ? 'normal' : 'bold'}>
                        {notification.title}
                      </Typography>
                      {!notification.isRead && (
                        <CircleIcon sx={{ fontSize: 8, color: 'primary.main' }} />
                      )}
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {formatTimeAgo(notification.createdAt)}
                      </Typography>
                    </>
                  }
                />
              </MenuItem>
            ))}
            
            <Divider />
            
            <Box sx={{ p: 1, textAlign: 'center' }}>
              <Button
                fullWidth
                size="small"
                onClick={handleViewAll}
                sx={{ textTransform: 'none' }}
              >
                View All Notifications
              </Button>
            </Box>
          </>
        )}
      </Menu>
    </>
  );
};

export default NotificationPopup;
