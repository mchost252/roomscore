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
import { subscribeToPush, getPushPermission } from '../utils/pushClient';

/**
 * Push Notification Prompt
 * Shows a friendly prompt asking users to enable push notifications
 * Only shows once, and remembers the user's choice
 */
const PushNotificationPrompt = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if we should show the prompt
    const checkPrompt = async () => {
      // Don't show if already prompted
      if (localStorage.getItem('pushPromptShown') === 'true') {
        return;
      }

      // Don't show if push not supported
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        return;
      }

      // Don't show if already granted or denied
      const permission = Notification.permission;
      if (permission === 'granted' || permission === 'denied') {
        localStorage.setItem('pushPromptShown', 'true');
        return;
      }

      // Wait a bit before showing (let user settle in)
      setTimeout(() => {
        setOpen(true);
      }, 3000);
    };

    checkPrompt();
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await subscribeToPush();
      
      if (result.success) {
        localStorage.setItem('pushPromptShown', 'true');
        localStorage.setItem('pushEnabled', 'true');
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
    localStorage.setItem('pushPromptShown', 'true');
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={handleSkip}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          p: 1,
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
