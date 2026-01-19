import React from 'react';
import { Container, Paper, Box, Typography, List, ListItem, ListItemText } from '@mui/material';

const CHANGES = [
  {
    id: '2026-01-06-onboarding-chat-tasktypes',
    title: "Onboarding, Today's Focus, Better Chat, Task Types",
    details: [
      'Quick setup guide appears after signup',
      "Dashboard now shows 'Today\'s Focus' tasks",
      'Chat shows system messages and has a helpful hint',
      'Clear room vs personal task differentiation and selector',
      'Room intro card and task completion feedback',
      'Profile progress summary and notification opt-in',
      "Dashboard 'What's New' card",
    ],
  },
];

const ChangelogPage = () => {
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4, px: { xs: 2, sm: 3, md: 4 } }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          What’s New
        </Typography>
        {CHANGES.map((c) => (
          <Box key={c.id} sx={{ mb: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              {c.title}
            </Typography>
            <List dense>
              {c.details.map((d, i) => (
                <ListItem key={i} sx={{ py: 0 }}>
                  <ListItemText primary={d} />
                </ListItem>
              ))}
            </List>
          </Box>
        ))}
      </Paper>
    </Container>
  );
};

export default ChangelogPage;
