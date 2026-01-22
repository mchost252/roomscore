import React from 'react';
import { Box, LinearProgress, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePremium } from '../../context/PremiumContext';

/**
 * PremiumLinearProgress - Cosmic gradient progress bar with glow
 */
export const PremiumLinearProgress = ({ 
  value = 0, 
  height = 8,
  showLabel = false,
  sx = {},
  ...props 
}) => {
  const { isGlobalPremium } = usePremium();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!isGlobalPremium) {
    return (
      <Box sx={sx}>
        <LinearProgress variant="determinate" value={value} {...props} />
        {showLabel && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {Math.round(value)}%
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box sx={sx}>
      <Box
        sx={{
          position: 'relative',
          height,
          borderRadius: height / 2,
          background: isDark 
            ? 'rgba(96, 165, 250, 0.1)' 
            : 'rgba(96, 165, 250, 0.15)',
          overflow: 'hidden',
        }}
      >
        {/* Animated progress bar */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${value}%`,
            borderRadius: height / 2,
            background: 'linear-gradient(90deg, #60A5FA, #8B5CF6, #EC4899)',
            backgroundSize: '200% 100%',
            animation: 'nebulaShift 3s ease infinite',
            boxShadow: '0 0 15px rgba(96, 165, 250, 0.5), 0 0 30px rgba(139, 92, 246, 0.3)',
            transition: 'width 0.5s ease',
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              animation: 'progressShine 2s ease-in-out infinite',
            },
          }}
        />
      </Box>
      {showLabel && (
        <Typography 
          variant="caption" 
          sx={{ 
            mt: 0.5,
            display: 'block',
            background: 'linear-gradient(90deg, #60A5FA, #8B5CF6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 600,
          }}
        >
          {Math.round(value)}%
        </Typography>
      )}
    </Box>
  );
};

/**
 * PremiumCircularProgress - Cosmic ring progress with glow
 */
export const PremiumCircularProgress = ({ 
  value = 0, 
  size = 60,
  thickness = 4,
  showLabel = true,
  label,
  sx = {},
}) => {
  const { isGlobalPremium } = usePremium();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!isGlobalPremium) {
    return (
      <Box sx={{ position: 'relative', display: 'inline-flex', ...sx }}>
        <CircularProgress variant="determinate" value={value} size={size} thickness={thickness} />
        {showLabel && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {label || `${Math.round(value)}%`}
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  const circumference = 2 * Math.PI * ((size - thickness) / 2);
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', ...sx }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size - thickness) / 2}
          fill="none"
          stroke={isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(96, 165, 250, 0.15)'}
          strokeWidth={thickness}
        />
        {/* Progress circle with gradient */}
        <defs>
          <linearGradient id="premiumProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <filter id="premiumGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size - thickness) / 2}
          fill="none"
          stroke="url(#premiumProgressGradient)"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          filter="url(#premiumGlow)"
          style={{
            transition: 'stroke-dashoffset 0.5s ease',
          }}
        />
      </svg>
      {showLabel && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography 
            variant="caption" 
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #60A5FA, #8B5CF6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {label || `${Math.round(value)}%`}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default PremiumLinearProgress;
