import React, { useEffect, useState } from 'react';
import { Paper, Box, Typography, Button, IconButton } from '@mui/material';
import { NewReleases, Close } from '@mui/icons-material';

// Simple local "release notes" list. In a real app, this could come from the backend.
const WHATS_NEW = [
  {
    id: '2026-01-06-onboarding-chat-tasktypes',
    title: "New: Onboarding, Today's Focus, Better Chat, Task Types",
    body: "We added a quick setup guide after signup, a 'Today\'s Focus' section on the dashboard, clearer room vs personal tasks, system messages in chat, and a room intro card.",
    ctaLabel: 'View details',
    ctaHref: '/profile',
  }
];

const WhatsNewCard = () => {
  const [item, setItem] = useState(null);

  useEffect(() => {
    // Show the first item that hasn't been dismissed
    const next = WHATS_NEW.find((n) => localStorage.getItem(`whats_new_dismissed_${n.id}`) !== 'true');
    if (next) setItem(next);
  }, []);

  if (!item) return null;

  const handleDismiss = () => {
    localStorage.setItem(`whats_new_dismissed_${item.id}`, 'true');
    setItem(null);
  };

  return (
    <Paper sx={{ p: 2, mb: 2, borderLeft: 4, borderColor: 'primary.main', position: 'relative' }}>
      <IconButton onClick={handleDismiss} size="small" sx={{ position: 'absolute', top: 8, right: 8 }}>
        <Close fontSize="small" />
      </IconButton>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <NewReleases color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {item.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
            {item.body}
          </Typography>
          {item.ctaHref && (
            <Button size="small" href={item.ctaHref} variant="outlined">
              {item.ctaLabel || 'Learn more'}
            </Button>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default WhatsNewCard;
