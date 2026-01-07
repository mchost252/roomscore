import React, { useEffect, useState } from 'react';
import { Container, Paper, Box, Typography, Button } from '@mui/material';
import { ChatBubbleOutline } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const MessagesPage = () => {
  const navigate = useNavigate();
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('messages_hint_seen') === 'true';
    if (!seen) setShowHint(true);
  }, []);

  const dismissHint = () => {
    localStorage.setItem('messages_hint_seen', 'true');
    setShowHint(false);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      {showHint && (
        <Paper sx={{ p: 2, mb: 2, borderLeft: 4, borderColor: 'primary.main' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ChatBubbleOutline color="primary" />
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">
                  Message friends to stay accountable
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Start private conversations outside rooms.
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" onClick={() => navigate('/rooms')}>Find friends</Button>
              <Button variant="text" onClick={dismissHint}>Got it</Button>
            </Box>
          </Box>
        </Paper>
      )}

      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Messages (coming soon)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You will be able to chat with friends privately here.
        </Typography>
      </Paper>
    </Container>
  );
};

export default MessagesPage;
