import React, { createContext, useState, useContext, useMemo } from 'react';
import { ThemeProvider as MUIThemeProvider, createTheme } from '@mui/material/styles';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('themeMode') || 'dark';
  });

  const toggleTheme = () => {
    setMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', newMode);
      return newMode;
    });
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          ...(mode === 'dark'
            ? {
                // Dark mode - Discord inspired
                primary: {
                  main: '#5865F2',
                  light: '#7289DA',
                  dark: '#4752C4',
                },
                secondary: {
                  main: '#EB459E',
                  light: '#ED4245',
                  dark: '#992D22',
                },
                background: {
                  default: '#36393F',
                  paper: '#2F3136',
                },
                text: {
                  primary: '#DCDDDE',
                  secondary: '#B9BBBE',
                },
                success: {
                  main: '#3BA55D',
                },
                error: {
                  main: '#ED4245',
                },
                warning: {
                  main: '#FAA81A',
                },
                divider: '#202225',
              }
            : {
                // Light mode - Clean and modern
                primary: {
                  main: '#5865F2',
                  light: '#7289DA',
                  dark: '#4752C4',
                },
                secondary: {
                  main: '#EB459E',
                  light: '#ED4245',
                  dark: '#992D22',
                },
                background: {
                  default: '#F5F5F5',
                  paper: '#FFFFFF',
                },
                text: {
                  primary: '#2E3338',
                  secondary: '#5E6772',
                },
                success: {
                  main: '#3BA55D',
                },
                error: {
                  main: '#ED4245',
                },
                warning: {
                  main: '#FAA81A',
                },
                divider: '#E3E5E8',
              }),
        },
        typography: {
          fontFamily: [
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            '"Helvetica Neue"',
            'Arial',
            'sans-serif',
          ].join(','),
          h1: {
            fontWeight: 700,
          },
          h2: {
            fontWeight: 600,
          },
          h3: {
            fontWeight: 600,
          },
          h4: {
            fontWeight: 600,
          },
          h5: {
            fontWeight: 600,
          },
          h6: {
            fontWeight: 600,
          },
          button: {
            textTransform: 'none',
            fontWeight: 500,
          },
        },
        shape: {
          borderRadius: 8,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                padding: '10px 20px',
              },
              contained: {
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: 'none',
                },
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 12,
                boxShadow: mode === 'dark' 
                  ? '0 2px 10px 0 rgba(0,0,0,0.4)'
                  : '0 2px 10px 0 rgba(0,0,0,0.1)',
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                boxShadow: 'none',
                borderBottom: `1px solid ${mode === 'dark' ? '#202225' : '#E3E5E8'}`,
              },
            },
          },
        },
      }),
    [mode]
  );

  const value = {
    mode,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      <MUIThemeProvider theme={theme}>{children}</MUIThemeProvider>
    </ThemeContext.Provider>
  );
};
