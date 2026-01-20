import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { Notifications, NotificationsOff } from '@mui/icons-material';
import { subscribeToPush, getPushPermission, ensureServiceWorkerRegistered } from '../utils/pushClient';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

/**
 * Push Notification Prompt
 * Shows a friendly prompt asking users to enable push notifications
 * - Shows EVERY TIME user visits dashboard if they haven't enabled push
 * - Only stops showing once user successfully enables push notifications
 * - If browser permission is denied, doesn't show (can't do anything)
 */
const PushNotificationPrompt = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Debug: Log on every render
  console.log('[PushPrompt] Component rendered, user:', user?.id || user?._id || 'NO USER');

  useEffect(() => {
    console.log('[PushPrompt] useEffect triggered, user:', JSON.stringify(user));
    
    // Wait for user to be loaded - check for both id and _id formats
    const userId = user?.id || user?._id;
    if (!userId) {
      console.log('[PushPrompt] No user id found');
      return;
    }
    
    console.log('[PushPrompt] Checking for user:', userId);
    
    // Account-specific key for enabled status
    const userEnabledKey = `pushEnabled_${userId}`;
    
    // Check if THIS user already has push enabled - only then skip
    if (localStorage.getItem(userEnabledKey) === 'true') {
      console.log('[PushPrompt] Already enabled for this user');
      return;
    }

    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('[PushPrompt] Notifications not supported');
      return;
    }
    
    // If permission was denied by browser, we can't do anything
    if (Notification.permission === 'denied') {
      console.log('[PushPrompt] Permission denied by browser');
      return;
    }

    // Show prompt after delay - user doesn't have push enabled
    // This will show EVERY time they visit the dashboard until they enable it
    console.log('[PushPrompt] Will show prompt in 2 seconds');
    const timer = setTimeout(() => {
      console.log('[PushPrompt] Showing prompt NOW');
      setOpen(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [user]);

  const handleEnable = async () => {
    setLoading(true);
    setError(null);
    const userId = user?.id || user?._id;

    try {
      const result = await subscribeToPush();
      
      if (result.success) {
        // Mark push as enabled for this user - prompt won't show again
        const userEnabledKey = `pushEnabled_${userId}`;
        localStorage.setItem(userEnabledKey, 'true');
        setOpen(false);
      } else {
        setError(result.message || 'Failed to enable notifications');
      }
    } catch (err) {
      setError('Failed to enable notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Just close the dialog - it will show again next time user visits dashboard
    // This ensures users who haven't enabled push get reminded each visit
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={handleSkip}
      maxWidth="xs"
      fullWidth
      disablePortal={false}
      sx={{
        '& .MuiDialog-container': {
          alignItems: 'center',
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: 2,
          p: 1,
          mx: { xs: 2, sm: 3 },
          my: 'auto',
        }
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
          }}
        >
          <Notifications sx={{ fontSize: 32, color: 'white' }} />
        </Box>
        <Typography variant="h6" fontWeight={700}>
          Stay in the Loop! 🔔
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enable push notifications to get:
        </Typography>
        
        <Box sx={{ textAlign: 'left', pl: 2, mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            ✨ Nudges from your orbit members
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            💬 New message alerts
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            🏆 Task completion updates
          </Typography>
          <Typography variant="body2">
            👋 Friend requests
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ flexDirection: 'column', gap: 1, px: 3, pb: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={handleEnable}
          disabled={loading}
          startIcon={<Notifications />}
          sx={{ borderRadius: 2 }}
        >
          {loading ? 'Enabling...' : 'Enable Notifications'}
        </Button>
        <Button
          fullWidth
          variant="text"
          onClick={handleSkip}
          disabled={loading}
          sx={{ color: 'text.secondary' }}
        >
          Maybe Later
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PushNotificationPrompt;
