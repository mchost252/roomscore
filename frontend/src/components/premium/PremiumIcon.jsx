import React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePremium } from '../../context/PremiumContext';

/**
 * PremiumIcon - Wrapper that adds glow effect to icons
 * Works with any MUI icon or custom icon component
 */
const PremiumIcon = ({ 
  children,
  color = 'primary', // 'primary' | 'secondary' | 'accent' | 'success' | 'inherit'
  glow = true,
  float = false,
  pulse = false,
  sx = {},
}) => {
  const { isGlobalPremium } = usePremium();
  const theme = useTheme();

  // Return children as-is when not premium
  if (!isGlobalPremium) {
    return <>{children}</>;
  }

  // Color mapping for glow effects
  const colorMap = {
    primary: '#60A5FA',
    secondary: '#8B5CF6',
    accent: '#F59E0B',
    success: '#22C55E',
    error: '#EF4444',
    inherit: 'currentColor',
  };

  const glowColor = colorMap[color] || colorMap.primary;

  // Build animation string
  const animations = [];
  if (glow) animations.push('iconGlow 3s ease-in-out infinite');
  if (float) animations.push('iconFloat 4s ease-in-out infinite');
  if (pulse) animations.push('badgePulse 2s ease-in-out infinite');

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: glowColor !== 'currentColor' ? glowColor : undefined,
        filter: glow ? `drop-shadow(0 0 6px ${glowColor})` : undefined,
        animation: animations.length > 0 ? animations.join(', ') : undefined,
        '& > *': {
          color: 'inherit',
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

/**
 * PremiumStreakIcon - Special wrapper for streak/fire icons
 */
export const PremiumStreakIcon = ({ children, sx = {} }) => {
  const { isGlobalPremium } = usePremium();

  if (!isGlobalPremium) {
    return <>{children}</>;
  }

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        animation: 'streakFire 2s ease-in-out infinite',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

export default PremiumIcon;
