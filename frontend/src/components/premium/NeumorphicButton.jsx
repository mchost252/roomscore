import React from 'react';
import { IconButton, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePremium } from '../../context/PremiumContext';

/**
 * NeumorphicButton - Soft 3D pressed/raised button effect
 * Based on neumorphic design (images 10 & neumorphic)
 * Supports both IconButton and regular Button
 */
export const NeumorphicIconButton = ({ 
  children,
  pressed = false,
  glowColor = '#60A5FA',
  size = 'medium', // 'small' | 'medium' | 'large'
  ...buttonProps 
}) => {
  const { isGlobalPremium } = usePremium();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const sizeMap = {
    small: { width: 36, height: 36, iconSize: 18 },
    medium: { width: 48, height: 48, iconSize: 24 },
    large: { width: 64, height: 64, iconSize: 32 },
  };

  const dimensions = sizeMap[size] || sizeMap.medium;

  if (!isGlobalPremium) {
    return (
      <IconButton {...buttonProps} size={size}>
        {children}
      </IconButton>
    );
  }

  return (
    <IconButton
      {...buttonProps}
      sx={{
        width: dimensions.width,
        height: dimensions.height,
        borderRadius: '50%',
        // Neumorphic base
        background: isDark
          ? pressed
            ? 'linear-gradient(145deg, #1a2332, #1e2940)'
            : 'linear-gradient(145deg, #1e2940, #1a2332)'
          : pressed
            ? 'linear-gradient(145deg, #e0e5ec, #f5f8fc)'
            : 'linear-gradient(145deg, #f5f8fc, #e0e5ec)',
        // Soft shadows for depth
        boxShadow: isDark
          ? pressed
            ? `inset 6px 6px 12px rgba(10, 15, 25, 0.8), 
               inset -6px -6px 12px rgba(40, 50, 70, 0.5),
               0 0 15px ${glowColor}30`
            : `6px 6px 12px rgba(10, 15, 25, 0.8), 
               -6px -6px 12px rgba(40, 50, 70, 0.5),
               0 0 20px ${glowColor}40`
          : pressed
            ? `inset 6px 6px 12px rgba(180, 190, 200, 0.7),
               inset -6px -6px 12px rgba(255, 255, 255, 0.9),
               0 0 15px ${glowColor}30`
            : `6px 6px 12px rgba(180, 190, 200, 0.7),
               -6px -6px 12px rgba(255, 255, 255, 0.9),
               0 0 20px ${glowColor}40`,
        // Icon color with glow
        color: glowColor,
        transition: 'all 0.2s ease',
        '& .MuiSvgIcon-root': {
          fontSize: dimensions.iconSize,
          filter: `drop-shadow(0 0 6px ${glowColor})`,
        },
        '&:hover': {
          background: isDark
            ? 'linear-gradient(145deg, #212c3e, #1a2332)'
            : 'linear-gradient(145deg, #ffffff, #e8ecf2)',
          boxShadow: isDark
            ? `8px 8px 16px rgba(10, 15, 25, 0.9),
               -8px -8px 16px rgba(40, 50, 70, 0.6),
               0 0 25px ${glowColor}50`
            : `8px 8px 16px rgba(180, 190, 200, 0.8),
               -8px -8px 16px rgba(255, 255, 255, 1),
               0 0 25px ${glowColor}50`,
        },
        '&:active': {
          background: isDark
            ? 'linear-gradient(145deg, #1a2332, #1e2940)'
            : 'linear-gradient(145deg, #e0e5ec, #f5f8fc)',
          boxShadow: isDark
            ? `inset 8px 8px 16px rgba(10, 15, 25, 0.9),
               inset -8px -8px 16px rgba(40, 50, 70, 0.5)`
            : `inset 8px 8px 16px rgba(180, 190, 200, 0.8),
               inset -8px -8px 16px rgba(255, 255, 255, 1)`,
        },
        ...buttonProps.sx,
      }}
    >
      {children}
    </IconButton>
  );
};

/**
 * NeumorphicButton - Soft 3D button (text button variant)
 */
export const NeumorphicButton = ({ 
  children,
  pressed = false,
  glowColor = '#60A5FA',
  variant = 'contained',
  ...buttonProps 
}) => {
  const { isGlobalPremium } = usePremium();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!isGlobalPremium) {
    return (
      <Button variant={variant} {...buttonProps}>
        {children}
      </Button>
    );
  }

  return (
    <Button
      {...buttonProps}
      sx={{
        borderRadius: 3,
        px: 3,
        py: 1.5,
        // Neumorphic base
        background: isDark
          ? pressed
            ? 'linear-gradient(145deg, #1a2332, #1e2940)'
            : 'linear-gradient(145deg, #1e2940, #1a2332)'
          : pressed
            ? 'linear-gradient(145deg, #e0e5ec, #f5f8fc)'
            : 'linear-gradient(145deg, #f5f8fc, #e0e5ec)',
        // Soft shadows
        boxShadow: isDark
          ? pressed
            ? `inset 8px 8px 16px rgba(10, 15, 25, 0.8),
               inset -8px -8px 16px rgba(40, 50, 70, 0.5),
               0 0 20px ${glowColor}30`
            : `8px 8px 16px rgba(10, 15, 25, 0.8),
               -8px -8px 16px rgba(40, 50, 70, 0.5),
               0 0 25px ${glowColor}40`
          : pressed
            ? `inset 8px 8px 16px rgba(180, 190, 200, 0.7),
               inset -8px -8px 16px rgba(255, 255, 255, 0.9),
               0 0 20px ${glowColor}30`
            : `8px 8px 16px rgba(180, 190, 200, 0.7),
               -8px -8px 16px rgba(255, 255, 255, 0.9),
               0 0 25px ${glowColor}40`,
        color: glowColor,
        fontWeight: 600,
        textShadow: `0 0 10px ${glowColor}`,
        transition: 'all 0.2s ease',
        '&:hover': {
          background: isDark
            ? 'linear-gradient(145deg, #212c3e, #1a2332)'
            : 'linear-gradient(145deg, #ffffff, #e8ecf2)',
          boxShadow: isDark
            ? `10px 10px 20px rgba(10, 15, 25, 0.9),
               -10px -10px 20px rgba(40, 50, 70, 0.6),
               0 0 30px ${glowColor}50`
            : `10px 10px 20px rgba(180, 190, 200, 0.8),
               -10px -10px 20px rgba(255, 255, 255, 1),
               0 0 30px ${glowColor}50`,
        },
        '&:active': {
          background: isDark
            ? 'linear-gradient(145deg, #1a2332, #1e2940)'
            : 'linear-gradient(145deg, #e0e5ec, #f5f8fc)',
          boxShadow: isDark
            ? `inset 10px 10px 20px rgba(10, 15, 25, 0.9),
               inset -10px -10px 20px rgba(40, 50, 70, 0.5)`
            : `inset 10px 10px 20px rgba(180, 190, 200, 0.8),
               inset -10px -10px 20px rgba(255, 255, 255, 1)`,
        },
        ...buttonProps.sx,
      }}
    >
      {children}
    </Button>
  );
};

export default NeumorphicIconButton;
