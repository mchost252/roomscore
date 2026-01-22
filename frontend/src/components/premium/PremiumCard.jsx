import React from 'react';
import { Card } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePremium } from '../../context/PremiumContext';

/**
 * PremiumCard - Card with cosmic glow and glass morphism effects
 * Falls back to regular card when premium is not active
 */
const PremiumCard = ({ 
  children, 
  glowColor = 'primary', // 'primary' | 'secondary' | 'accent' | 'success'
  intensity = 'normal', // 'subtle' | 'normal' | 'strong'
  enableHover = true,
  sx = {},
  ...cardProps 
}) => {
  const { isGlobalPremium } = usePremium();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // If not premium, return regular card
  if (!isGlobalPremium) {
    return (
      <Card sx={sx} {...cardProps}>
        {children}
      </Card>
    );
  }

  // Glow color mapping
  const glowColors = {
    primary: {
      border: 'rgba(96, 165, 250, 0.2)',
      glow: 'rgba(96, 165, 250, 0.15)',
      hoverBorder: 'rgba(139, 92, 246, 0.4)',
      hoverGlow: 'rgba(139, 92, 246, 0.2)',
    },
    secondary: {
      border: 'rgba(139, 92, 246, 0.2)',
      glow: 'rgba(139, 92, 246, 0.15)',
      hoverBorder: 'rgba(236, 72, 153, 0.4)',
      hoverGlow: 'rgba(236, 72, 153, 0.2)',
    },
    accent: {
      border: 'rgba(245, 158, 11, 0.2)',
      glow: 'rgba(245, 158, 11, 0.15)',
      hoverBorder: 'rgba(251, 191, 36, 0.4)',
      hoverGlow: 'rgba(251, 191, 36, 0.25)',
    },
    success: {
      border: 'rgba(34, 197, 94, 0.2)',
      glow: 'rgba(34, 197, 94, 0.15)',
      hoverBorder: 'rgba(34, 197, 94, 0.4)',
      hoverGlow: 'rgba(34, 197, 94, 0.2)',
    },
  };

  const colors = glowColors[glowColor] || glowColors.primary;

  // Intensity multiplier
  const intensityMap = {
    subtle: 0.5,
    normal: 1,
    strong: 1.5,
  };
  const mult = intensityMap[intensity] || 1;

  return (
    <Card
      {...cardProps}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        background: isDark
          ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.98) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${colors.border}`,
        boxShadow: isDark
          ? `0 0 ${20 * mult}px ${colors.glow}, 0 4px 20px rgba(0, 0, 0, 0.3)`
          : `0 0 ${15 * mult}px ${colors.glow}, 0 4px 15px rgba(0, 0, 0, 0.08)`,
        transition: 'all 0.3s ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${colors.border}, transparent)`,
          opacity: 0.8,
        },
        ...(enableHover && {
          '&:hover': {
            borderColor: colors.hoverBorder,
            boxShadow: isDark
              ? `0 0 ${30 * mult}px ${colors.hoverGlow}, 0 8px 32px rgba(0, 0, 0, 0.4)`
              : `0 0 ${25 * mult}px ${colors.hoverGlow}, 0 8px 25px rgba(0, 0, 0, 0.1)`,
            transform: 'translateY(-2px)',
          },
        }),
        ...sx,
      }}
    >
      {children}
    </Card>
  );
};

export default PremiumCard;
