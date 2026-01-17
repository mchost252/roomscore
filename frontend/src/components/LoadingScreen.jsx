import React, { memo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';

/**
 * Constellation K Loading Screen
 * Creates a "K" shape using animated stars connected by constellation lines
 * Stars pulse and lines draw in sequence for a magical effect
 */
const LoadingScreen = memo(() => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  // Define star positions to form a "K" shape
  // K consists of: vertical line (left) + two diagonal lines (right)
  const stars = [
    // Vertical line of K (left side)
    { id: 1, x: 30, y: 10, delay: 0 },
    { id: 2, x: 30, y: 30, delay: 0.1 },
    { id: 3, x: 30, y: 50, delay: 0.2 },  // Center point
    { id: 4, x: 30, y: 70, delay: 0.3 },
    { id: 5, x: 30, y: 90, delay: 0.4 },
    // Upper diagonal of K
    { id: 6, x: 50, y: 30, delay: 0.5 },
    { id: 7, x: 70, y: 10, delay: 0.6 },
    // Lower diagonal of K
    { id: 8, x: 50, y: 70, delay: 0.7 },
    { id: 9, x: 70, y: 90, delay: 0.8 },
  ];
  
  // Define constellation lines connecting stars
  const lines = [
    // Vertical line
    { from: 1, to: 2, delay: 0.15 },
    { from: 2, to: 3, delay: 0.25 },
    { from: 3, to: 4, delay: 0.35 },
    { from: 4, to: 5, delay: 0.45 },
    // Upper diagonal
    { from: 3, to: 6, delay: 0.55 },
    { from: 6, to: 7, delay: 0.65 },
    // Lower diagonal
    { from: 3, to: 8, delay: 0.75 },
    { from: 8, to: 9, delay: 0.85 },
  ];

  const getStarById = (id) => stars.find(s => s.id === id);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: isDark ? '#0a0a1a' : '#f0f4ff',
        background: isDark 
          ? 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a1a 100%)'
          : 'radial-gradient(ellipse at center, #f8faff 0%, #e8f0ff 100%)',
        overflow: 'hidden',
      }}
    >
      {/* Constellation Container */}
      <Box
        sx={{
          position: 'relative',
          width: 60,
          height: 70,
          mb: 1.5,
        }}
      >
        {/* SVG for constellation lines */}
        <svg
          width="60"
          height="70"
          viewBox="0 0 100 100"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {/* Draw constellation lines */}
          {lines.map((line, index) => {
            const from = getStarById(line.from);
            const to = getStarById(line.to);
            return (
              <line
                key={index}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={isDark ? 'rgba(96, 165, 250, 0.4)' : 'rgba(59, 130, 246, 0.3)'}
                strokeWidth="1"
                strokeLinecap="round"
                style={{
                  animation: `drawLine 0.5s ease-out ${line.delay + 0.5}s forwards, pulseLine 2s ease-in-out ${line.delay + 1}s infinite`,
                  strokeDasharray: 100,
                  strokeDashoffset: 100,
                }}
              />
            );
          })}
        </svg>

        {/* Render stars */}
        {stars.map((star) => (
          <Box
            key={star.id}
            sx={{
              position: 'absolute',
              left: `${star.x}%`,
              top: `${star.y}%`,
              transform: 'translate(-50%, -50%)',
              width: 5,
              height: 5,
              borderRadius: '50%',
              bgcolor: isDark ? '#60A5FA' : '#3B82F6',
              boxShadow: isDark 
                ? '0 0 4px #60A5FA, 0 0 8px #60A5FA, 0 0 12px rgba(96, 165, 250, 0.4)'
                : '0 0 4px #3B82F6, 0 0 8px rgba(59, 130, 246, 0.4)',
              animation: `
                fadeInStar 0.3s ease-out ${star.delay}s forwards,
                twinkleStar 1.5s ease-in-out ${star.delay + 0.5}s infinite
              `,
              opacity: 0,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: isDark ? 'rgba(96, 165, 250, 0.15)' : 'rgba(59, 130, 246, 0.1)',
              }
            }}
          />
        ))}
      </Box>

      {/* App name with fade-in */}
      <Typography 
        variant="body1" 
        sx={{ 
          fontWeight: 700,
          color: isDark ? '#60A5FA' : '#3B82F6',
          letterSpacing: 2,
          fontSize: '0.95rem',
          animation: 'fadeIn 0.5s ease-out 1s forwards',
          opacity: 0,
          textShadow: isDark ? '0 0 12px rgba(96, 165, 250, 0.4)' : 'none',
        }}
      >
        KRIOS
      </Typography>
      
      <Typography 
        variant="caption" 
        sx={{ 
          mt: 0.3,
          color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)',
          animation: 'fadeIn 0.5s ease-out 1.2s forwards',
          opacity: 0,
          letterSpacing: 0.5,
          fontSize: '0.65rem',
        }}
      >
        Loading your orbit...
      </Typography>

      {/* CSS Animations */}
      <style>
        {`
          @keyframes fadeInStar {
            from {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
            }
          }
          
          @keyframes twinkleStar {
            0%, 100% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
              filter: brightness(1);
            }
            50% {
              opacity: 0.6;
              transform: translate(-50%, -50%) scale(0.85);
              filter: brightness(1.3);
            }
          }
          
          @keyframes drawLine {
            to {
              stroke-dashoffset: 0;
            }
          }
          
          @keyframes pulseLine {
            0%, 100% {
              opacity: 0.4;
            }
            50% {
              opacity: 0.8;
            }
          }
          
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </Box>
  );
});

LoadingScreen.displayName = 'LoadingScreen';

export default LoadingScreen;
