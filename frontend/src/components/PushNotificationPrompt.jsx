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

/**
 * Push Notification Prompt
 * Shows a friendly prompt asking users to enable push notifications
 * - Shows if permission is 'default' (not yet asked)
 * - Shows if permission is 'granted' but no subscription exists on server
 * - Re-prompts after 7 days if user clicked "Maybe Later"
 */
const PushNotificationPrompt = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if we should show the prompt
    const checkPrompt = async () => {
      // Don't show if push not supported
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported');
        return;
      }

      const permission = Notification.permission;
      
      // If permission was denied by browser, we can't do anything
      if (permission === 'denied') {
        console.log('Push permission denied by browser');
        return;
      }

      // Check if user skipped recently (within 7 days)
      const lastSkipped = localStorage.getItem('pushPromptSkippedAt');
      if (lastSkipped) {
        const daysSinceSkip = (Date.now() - parseInt(lastSkipped)) / (1000 * 60 * 60 * 24);
        if (daysSinceSkip < 7) {
          console.log('Push prompt skipped recently, will ask again in', Math.ceil(7 - daysSinceSkip), 'days');
          return;
        }
      }

      // If permission is granted, check if we have an active subscription
      if (permission === 'granted') {
        try {
          const reg = await ensureServiceWorkerRegistered();
          if (reg) {
            const subscription = await reg.pushManager.getSubscription();
            if (subscription) {
              // Already subscribed, no need to prompt
              console.log('Push already subscribed');
              localStorage.setItem('pushEnabled', 'true');
              return;
            }
          }
          // Permission granted but no subscription - need to subscribe
          console.log('Permission granted but no subscription, will prompt');
        } catch (err) {
          console.error('Error checking push subscription:', err);
        }
      }

      // Detect if this is a manual refresh
      const isManualRefresh = () => {
        // Check if page was loaded via refresh (performance API)
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation && navigation.type === 'reload') {
          return true;
        }
        
        // Fallback: Check if sessionStorage has a flag (persists during refresh)
        const wasRunning = sessionStorage.getItem('appWasRunning');
        if (wasRunning) {
          return true;
        }
        
        // Set flag for future refreshes
        sessionStorage.setItem('appWasRunning', 'true');
        return false;
      };

      // Only show on manual refresh to avoid being annoying
      if (isManualRefresh()) {
        console.log('Manual refresh detected, showing push notification prompt');
        // Show immediately on refresh (user is engaged)
        setTimeout(() => {
          setOpen(true);
        }, 1000); // Short delay for smooth UX
      } else {
        console.log('Initial load, not showing push prompt (will show on refresh)');
      }
    };

    checkPrompt();
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await subscribeToPush();
      
      if (result.success) {
        localStorage.setItem('pushEnabled', 'true');
        localStorage.removeItem('pushPromptSkippedAt'); // Clear skip timestamp
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
    // Remember when user skipped, so we can ask again after 7 days
    localStorage.setItem('pushPromptSkippedAt', Date.now().toString());
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
