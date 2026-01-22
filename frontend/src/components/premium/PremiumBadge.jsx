import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { usePremium } from '../../context/PremiumContext';

/**
 * PremiumBadge - Shimmering gold badge indicating premium status
 * Shows next to usernames, in navbar, etc.
 */
const PremiumBadge = ({ 
  size = 'normal', // 'small' | 'normal' | 'large'
  showIcon = true,
  showText = true,
  text = 'PRO',
  sx = {},
}) => {
  const { isGlobalPremium } = usePremium();
  const theme = useTheme();

  if (!isGlobalPremium) return null;

  const sizeStyles = {
    small: {
      padding: '2px 6px',
      fontSize: '0.55rem',
      iconSize: 10,
      gap: 0.3,
    },
    normal: {
      padding: '3px 8px',
      fontSize: '0.65rem',
      iconSize: 12,
      gap: 0.4,
    },
    large: {
      padding: '4px 12px',
      fontSize: '0.75rem',
      iconSize: 14,
      gap: 0.5,
    },
  };

  const styles = sizeStyles[size] || sizeStyles.normal;

  return (
    <Box
      className="premium-badge"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: styles.gap,
        padding: styles.padding,
        borderRadius: '20px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        background: 'linear-gradient(90deg, #F59E0B, #FBBF24, #F59E0B, #FBBF24, #F59E0B)',
        backgroundSize: '200% auto',
        color: '#0f172a',
        boxShadow: '0 0 15px rgba(251, 191, 36, 0.4)',
        animation: 'badgeShimmer 3s linear infinite, badgePulse 2s ease-in-out infinite',
        ...sx,
      }}
    >
      {showIcon && (
        <AutoAwesomeIcon sx={{ fontSize: styles.iconSize }} />
      )}
      {showText && (
        <Typography
          component="span"
          sx={{
            fontSize: styles.fontSize,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          {text}
        </Typography>
      )}
    </Box>
  );
};

/**
 * PremiumIndicator - Small glowing dot indicator
 */
export const PremiumIndicator = ({ size = 8, sx = {} }) => {
  const { isGlobalPremium } = usePremium();

  if (!isGlobalPremium) return null;

  return (
    <Box
      className="premium-indicator"
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
        boxShadow: '0 0 10px rgba(251, 191, 36, 0.6)',
        animation: 'badgePulse 2s ease-in-out infinite',
        ...sx,
      }}
    />
  );
};

export default PremiumBadge;
