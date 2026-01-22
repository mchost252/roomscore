import React from 'react';
import { Box, Avatar } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePremium } from '../../context/PremiumContext';

/**
 * PremiumAvatar - Avatar with animated gradient ring and glow
 * Wraps MUI Avatar with cosmic border effect
 */
const PremiumAvatar = ({ 
  children,
  src,
  alt,
  size = 40,
  ringWidth = 2,
  showRing = true,
  sx = {},
  avatarSx = {},
  ...avatarProps 
}) => {
  const { isGlobalPremium } = usePremium();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Regular avatar when not premium
  if (!isGlobalPremium || !showRing) {
    return (
      <Avatar
        src={src}
        alt={alt}
        sx={{
          width: size,
          height: size,
          ...avatarSx,
          ...sx,
        }}
        {...avatarProps}
      >
        {children}
      </Avatar>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'inline-flex',
        padding: `${ringWidth + 1}px`,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #60A5FA, #8B5CF6, #EC4899, #F59E0B, #60A5FA)',
        backgroundSize: '300% 300%',
        animation: 'nebulaShift 4s ease infinite',
        boxShadow: isDark
          ? '0 0 20px rgba(96, 165, 250, 0.4), 0 0 40px rgba(139, 92, 246, 0.2)'
          : '0 0 15px rgba(96, 165, 250, 0.3), 0 0 30px rgba(139, 92, 246, 0.15)',
        ...sx,
      }}
    >
      {/* Inner background to create ring effect */}
      <Box
        sx={{
          position: 'absolute',
          inset: ringWidth,
          borderRadius: '50%',
          background: isDark ? '#0f172a' : '#ffffff',
        }}
      />
      
      {/* Actual avatar */}
      <Avatar
        src={src}
        alt={alt}
        sx={{
          width: size,
          height: size,
          position: 'relative',
          zIndex: 1,
          border: `${ringWidth}px solid ${isDark ? '#0f172a' : '#ffffff'}`,
          ...avatarSx,
        }}
        {...avatarProps}
      >
        {children}
      </Avatar>
    </Box>
  );
};

export default PremiumAvatar;
