import React, { memo } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const LoadingScreen = memo(() => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <CircularProgress size={48} thickness={4} />
      <Typography variant="body1" sx={{ mt: 2, color: 'text.secondary' }}>
        Loading...
      </Typography>
    </Box>
  );
});

LoadingScreen.displayName = 'LoadingScreen';

export default LoadingScreen;
