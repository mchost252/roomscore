import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box
} from '@mui/material';
import { Notifications, NotificationsOff } from '@mui/icons-material';
import pushNotificationManager from '../utils/pushNotifications';

const PushNotificationPrompt = () => {
  const [open, setOpen] = useState(false);
  const [postponed, setPostponed] = useState(false);

  useEffect(() => {
    checkAndShowPrompt();
  }, []);

  const checkAndShowPrompt = async () => {
    // Check if we should show the prompt
    const lastPrompt = localStorage.getItem('pushNotificationPromptTime');
    const declined = localStorage.getItem('pushNotificationDeclined');
    
    // Don't show if user declined
    if (declined === 'true') return;
    
    // Don't show if postponed recently (within 24 hours)
    if (lastPrompt) {
      const timeSinceLastPrompt = Date.now() - parseInt(lastPrompt);
      if (timeSinceLastPrompt < 24 * 60 * 60 * 1000) return;
    }

    // Check if push notifications are supported
    if (!pushNotificationManager.isSupported()) return;

    // Check current permission status
    const permission = pushNotificationManager.getPermissionStatus();
    
    // Only show prompt if permission is 'default' (not yet decided)
    if (permission === 'default') {
      // Small delay before showing prompt
      setTimeout(() => setOpen(true), 2000);
    }
  };

  const handleEnable = async () => {
    try {
      await pushNotificationManager.enable();
      setOpen(false);
    } catch (error) {
      console.error('Failed to enable push notifications:', error);
      setOpen(false);
    }
  };

  const handleDecline = () => {
    localStorage.setItem('pushNotificationDeclined', 'true');
    setOpen(false);
  };

  const handlePostpone = () => {
    localStorage.setItem('pushNotificationPromptTime', Date.now().toString());
    setOpen(false);
  };

  return (
    <Dialog 
      open={open} 
      onClose={handlePostpone}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <Notifications sx={{ fontSize: 48, color: 'primary.main' }} />
        </Box>
        Enable Notifications?
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Get notified when you receive new messages, friend requests, or task reminders. 
          You can change this anytime in settings.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ flexDirection: 'column', gap: 1, px: 3, pb: 3 }}>
        <Button 
          variant="contained" 
          fullWidth 
          onClick={handleEnable}
          startIcon={<Notifications />}
        >
          Enable Notifications
        </Button>
        <Button 
          variant="outlined" 
          fullWidth 
          onClick={handlePostpone}
        >
          Maybe Later
        </Button>
        <Button 
          size="small" 
          color="inherit"
          onClick={handleDecline}
          sx={{ opacity: 0.7 }}
        >
          Don't ask again
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PushNotificationPrompt;
