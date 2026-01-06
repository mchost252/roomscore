import React from 'react';
import { Fab, Tooltip } from '@mui/material';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = () => {
  const { mode, toggleTheme } = useTheme();

  return (
    <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
      <Fab
        color="primary"
        size="medium"
        onClick={toggleTheme}
        sx={{
          position: 'fixed',
          bottom: { xs: 80, sm: 20 },
          right: 20,
          zIndex: 1000,
        }}
      >
        {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
      </Fab>
    </Tooltip>
  );
};

export default ThemeToggle;
