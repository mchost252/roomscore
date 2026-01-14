import React, { createContext, useState, useContext, useMemo, useEffect } from 'react';
import { ThemeProvider as MUIThemeProvider, createTheme } from '@mui/material/styles';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Helper to get system preference
const getSystemTheme = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

export const ThemeProvider = ({ children }) => {
  // themePreference can be 'light', 'dark', or 'system'
  const [themePreference, setThemePreference] = useState(() => {
    return localStorage.getItem('themeMode') || 'system';
  });
  
  // actualMode is always 'light' or 'dark' (resolved from preference)
  const [actualMode, setActualMode] = useState(() => {
    const saved = localStorage.getItem('themeMode') || 'system';
    return saved === 'system' ? getSystemTheme() : saved;
  });

  // Listen for system theme changes
  useEffect(() => {
    if (themePreference !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setActualMode(e.matches ? 'dark' : 'light');
    };
    
    // Set initial value
    setActualMode(mediaQuery.matches ? 'dark' : 'light');
    
    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themePreference]);

  // Set theme mode (light, dark, or system)
  const setThemeMode = (newMode) => {
    setThemePreference(newMode);
    localStorage.setItem('themeMode', newMode);
    
    if (newMode === 'system') {
      setActualMode(getSystemTheme());
    } else {
      setActualMode(newMode);
    }
  };

  // Legacy toggle function (cycles through light -> dark -> system)
  const toggleTheme = () => {
    const nextMode = themePreference === 'light' ? 'dark' : themePreference === 'dark' ? 'system' : 'light';
    setThemeMode(nextMode);
  };

  // For backward compatibility, mode returns the actual resolved mode
  const mode = actualMode;

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          ...(mode === 'dark'
            ? {
                // Dark mode - Constellation/Space theme
                primary: {
                  main: '#60A5FA', // Blue star
                  light: '#93C5FD',
                  dark: '#3B82F6',
                  contrastText: '#0f172a',
                },
                secondary: {
                  main: '#F59E0B', // Gold star
                  light: '#FBBF24',
                  dark: '#D97706',
                  contrastText: '#0f172a',
                },
                background: {
                  default: '#0f172a', // Deep space
                  paper: '#1e293b', // Slightly lighter
                },
                text: {
                  primary: '#f1f5f9',
                  secondary: '#94a3b8',
                },
                success: {
                  main: '#22c55e',
                  light: '#4ade80',
                  dark: '#16a34a',
                },
                error: {
                  main: '#ef4444',
                  light: '#f87171',
                  dark: '#dc2626',
                },
                warning: {
                  main: '#F59E0B',
                  light: '#FBBF24',
                  dark: '#D97706',
                },
                info: {
                  main: '#60A5FA',
                  light: '#93C5FD',
                  dark: '#3B82F6',
                },
                divider: 'rgba(255, 255, 255, 0.08)',
                action: {
                  hover: 'rgba(255, 255, 255, 0.05)',
                  selected: 'rgba(96, 165, 250, 0.15)',
                  disabled: 'rgba(255, 255, 255, 0.3)',
                  disabledBackground: 'rgba(255, 255, 255, 0.12)',
                },
              }
            : {
                // Light mode - Clean, bright with blue/gold accents
                primary: {
                  main: '#3B82F6', // Bright blue
                  light: '#60A5FA',
                  dark: '#2563EB',
                  contrastText: '#ffffff',
                },
                secondary: {
                  main: '#D97706', // Gold/amber
                  light: '#F59E0B',
                  dark: '#B45309',
                  contrastText: '#ffffff',
                },
                background: {
                  default: '#f8fafc',
                  paper: '#ffffff',
                },
                text: {
                  primary: '#0f172a',
                  secondary: '#64748b',
                },
                success: {
                  main: '#16a34a',
                  light: '#22c55e',
                  dark: '#15803d',
                },
                error: {
                  main: '#dc2626',
                  light: '#ef4444',
                  dark: '#b91c1c',
                },
                warning: {
                  main: '#D97706',
                  light: '#F59E0B',
                  dark: '#B45309',
                },
                info: {
                  main: '#3B82F6',
                  light: '#60A5FA',
                  dark: '#2563EB',
                },
                divider: 'rgba(0, 0, 0, 0.08)',
                action: {
                  hover: 'rgba(0, 0, 0, 0.04)',
                  selected: 'rgba(59, 130, 246, 0.12)',
                  disabled: 'rgba(0, 0, 0, 0.26)',
                  disabledBackground: 'rgba(0, 0, 0, 0.12)',
                },
              }),
        },
        typography: {
          fontFamily: [
            'Inter',
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
            letterSpacing: '-0.02em',
          },
          h2: {
            fontWeight: 700,
            letterSpacing: '-0.01em',
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
          subtitle1: {
            fontWeight: 500,
          },
          button: {
            textTransform: 'none',
            fontWeight: 600,
          },
        },
        shape: {
          borderRadius: 12,
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                scrollbarWidth: 'thin',
                '&::-webkit-scrollbar': {
                  width: '8px',
                  height: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: mode === 'dark' ? 'rgba(96,165,250,0.3)' : 'rgba(59,130,246,0.3)',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: mode === 'dark' ? 'rgba(96,165,250,0.5)' : 'rgba(59,130,246,0.5)',
                },
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 10,
                padding: '10px 20px',
                transition: 'all 0.2s ease',
              },
              contained: {
                boxShadow: mode === 'dark'
                  ? '0 4px 14px 0 rgba(96, 165, 250, 0.25)'
                  : '0 4px 14px 0 rgba(59, 130, 246, 0.25)',
                '&:hover': {
                  boxShadow: mode === 'dark'
                    ? '0 6px 20px 0 rgba(96, 165, 250, 0.35)'
                    : '0 6px 20px 0 rgba(59, 130, 246, 0.35)',
                  transform: 'translateY(-1px)',
                },
              },
              outlined: {
                borderWidth: '2px',
                '&:hover': {
                  borderWidth: '2px',
                },
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 16,
                boxShadow: mode === 'dark' 
                  ? '0 4px 20px 0 rgba(0,0,0,0.4)'
                  : '0 4px 20px 0 rgba(0,0,0,0.08)',
                border: mode === 'dark' 
                  ? '1px solid rgba(255,255,255,0.05)'
                  : '1px solid rgba(0,0,0,0.05)',
                backdropFilter: 'blur(10px)',
                background: mode === 'dark'
                  ? 'rgba(30, 41, 59, 0.8)'
                  : 'rgba(255, 255, 255, 0.9)',
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                borderRadius: 16,
              },
              elevation1: {
                boxShadow: mode === 'dark'
                  ? '0 2px 10px 0 rgba(0,0,0,0.3)'
                  : '0 2px 10px 0 rgba(0,0,0,0.06)',
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                boxShadow: 'none',
                backdropFilter: 'blur(10px)',
                background: mode === 'dark'
                  ? 'rgba(15, 23, 42, 0.8)'
                  : 'rgba(255, 255, 255, 0.8)',
                borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                backgroundImage: 'none',
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                fontWeight: 500,
              },
              filled: {
                background: mode === 'dark'
                  ? 'rgba(96, 165, 250, 0.15)'
                  : 'rgba(59, 130, 246, 0.1)',
              },
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: {
                '& .MuiOutlinedInput-root': {
                  borderRadius: 10,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: mode === 'dark' ? '#60A5FA' : '#3B82F6',
                    },
                  },
                },
              },
            },
          },
          MuiTooltip: {
            styleOverrides: {
              tooltip: {
                background: mode === 'dark' ? '#1e293b' : '#0f172a',
                color: '#f1f5f9',
                fontSize: '0.75rem',
                fontWeight: 500,
                borderRadius: 8,
                padding: '8px 12px',
              },
              arrow: {
                color: mode === 'dark' ? '#1e293b' : '#0f172a',
              },
            },
          },
          MuiAvatar: {
            styleOverrides: {
              root: {
                fontWeight: 600,
              },
            },
          },
          MuiListItemButton: {
            styleOverrides: {
              root: {
                borderRadius: 10,
                transition: 'all 0.2s ease',
              },
            },
          },
          MuiAlert: {
            styleOverrides: {
              root: {
                borderRadius: 12,
              },
              standardSuccess: {
                background: mode === 'dark' 
                  ? 'rgba(34, 197, 94, 0.15)' 
                  : 'rgba(22, 163, 74, 0.1)',
                border: `1px solid ${mode === 'dark' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(22, 163, 74, 0.3)'}`,
              },
              standardError: {
                background: mode === 'dark'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(220, 38, 38, 0.1)',
                border: `1px solid ${mode === 'dark' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(220, 38, 38, 0.3)'}`,
              },
              standardWarning: {
                background: mode === 'dark'
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'rgba(217, 119, 6, 0.1)',
                border: `1px solid ${mode === 'dark' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(217, 119, 6, 0.3)'}`,
              },
              standardInfo: {
                background: mode === 'dark'
                  ? 'rgba(96, 165, 250, 0.15)'
                  : 'rgba(59, 130, 246, 0.1)',
                border: `1px solid ${mode === 'dark' ? 'rgba(96, 165, 250, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
              },
            },
          },
        },
      }),
    [mode]
  );

  const value = {
    mode,
    themePreference,
    toggleTheme,
    setThemeMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      <MUIThemeProvider theme={theme}>{children}</MUIThemeProvider>
    </ThemeContext.Provider>
  );
};
