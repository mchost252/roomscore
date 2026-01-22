import React, { useMemo, useEffect, useState } from 'react';
import { Box, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';

/**
 * RoomPremiumWrapper - Constellation Mode for Rooms
 * OPTIMIZED for performance - removed heavy effects that cause lag
 * 
 * Features:
 * - Subtle gradient backgrounds (no heavy blur)
 * - Clean neumorphic styling
 * - Smooth but lightweight transitions
 */

// Premium Paper component for room containers - OPTIMIZED
export const RoomPremiumPaper = ({ 
  children, 
  isPremium, 
  variant = 'default', // 'default' | 'header' | 'sidebar' | 'chat'
  enableScanBorder = false,
  sx = {},
  ...props 
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Return regular Paper if not premium - no extra processing
  if (!isPremium) {
    return <Paper sx={sx} {...props}>{children}</Paper>;
  }

  // Neumorphic color schemes based on variant
  const variantStyles = {
    header: {
      background: isDark
        ? 'linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)'
        : 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
      borderColor: isDark ? 'rgba(251, 191, 36, 0.3)' : 'rgba(251, 191, 36, 0.2)',
      accentColor: '#FBBF24',
    },
    sidebar: {
      background: isDark
        ? 'linear-gradient(145deg, #1e1e30 0%, #171728 100%)'
        : 'linear-gradient(145deg, #fefefe 0%, #f5f5f7 100%)',
      borderColor: isDark ? 'rgba(139, 92, 246, 0.25)' : 'rgba(139, 92, 246, 0.15)',
      accentColor: '#8B5CF6',
    },
    chat: {
      background: isDark
        ? 'linear-gradient(145deg, #1a2332 0%, #151d2b 100%)'
        : 'linear-gradient(145deg, #ffffff 0%, #f0f9ff 100%)',
      borderColor: isDark ? 'rgba(34, 211, 238, 0.25)' : 'rgba(34, 211, 238, 0.15)',
      accentColor: '#22D3EE',
    },
    default: {
      background: isDark
        ? 'linear-gradient(145deg, #1f1f2e 0%, #18182a 100%)'
        : 'linear-gradient(145deg, #ffffff 0%, #fafafa 100%)',
      borderColor: isDark ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.12)',
      accentColor: '#F59E0B',
    },
  };

  const styles = variantStyles[variant] || variantStyles.default;

  return (
    <Paper
      {...props}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        // Glassmorphism effect - lightweight (no blur for performance)
        background: isDark
          ? 'rgba(15, 23, 42, 0.85)'
          : 'rgba(255, 255, 255, 0.85)',
        border: '1px solid',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        boxShadow: isDark
          ? '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          : '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        // Top accent line - lightweight
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${styles.accentColor}, transparent)`,
          opacity: 0.6,
          zIndex: 2,
        },
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
};

// Room Premium Background - EXACT SAME as main app premium background
// Uses CSS classes from premiumAnimations.css for performance
export const RoomPremiumBackground = ({ isPremium, roomId }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [isVisible, setIsVisible] = useState(false);
  const [shootingStars, setShootingStars] = useState([]);

  useEffect(() => {
    if (isPremium) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isPremium]);

  // Generate stars - OPTIMIZED: reduced count for better performance
  const stars = useMemo(() => {
    if (!isPremium) return [];
    if (typeof window === 'undefined') return [];
    
    // Reduced star count for better mobile performance
    const starCount = window.innerWidth < 600 ? 20 : 35;
    return Array.from({ length: starCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() > 0.7 ? 'large' : 'normal',
      type: Math.random() > 0.7 ? (Math.random() > 0.5 ? 'blue' : 'gold') : 'white',
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 2, // Slower animations = less CPU
    }));
  }, [isPremium]);

  // Multiple shooting stars with variety - OPTIMIZED: less frequent
  useEffect(() => {
    if (!isPremium) return;

    const createShootingStar = () => {
      const newStar = {
        id: Date.now() + Math.random(),
        x: 10 + Math.random() * 70,
        y: Math.random() * 40,
        size: Math.random() > 0.8 ? 'large' : 'small', // Simplified sizes
        speed: 1 + Math.random() * 0.5,
        brightness: 0.7 + Math.random() * 0.3,
      };
      setShootingStars(prev => [...prev, newStar]);
      setTimeout(() => {
        setShootingStars(prev => prev.filter(s => s.id !== newStar.id));
      }, newStar.speed * 1000);
    };

    // Less frequent shooting stars for better performance
    const interval = setInterval(() => {
      if (Math.random() > 0.6) createShootingStar();
    }, 8000 + Math.random() * 8000);

    return () => clearInterval(interval);
  }, [isPremium]);

  if (!isPremium) return null;

  return (
    <>
      {/* Nebula gradient layer - same as main app */}
      <Box
        className={`premium-nebula-bg ${isDark ? 'premium-nebula-bg--dark' : 'premium-nebula-bg--light'}`}
        sx={{
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.8s ease-in-out',
          zIndex: 0,
        }}
      />

      {/* Stars layer - same as main app */}
      <Box
        className="premium-particles"
        sx={{
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 1s ease-in-out 0.3s',
          zIndex: 0,
        }}
      >
        {stars.map((star) => (
          <Box
            key={star.id}
            className={`premium-star ${star.size === 'large' ? 'premium-star--large' : ''} ${
              star.type === 'blue' ? 'premium-star--blue' : 
              star.type === 'gold' ? 'premium-star--gold' : ''
            }`}
            sx={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            }}
          />
        ))}

        {/* Shooting stars with variety */}
        {shootingStars.map((star) => (
          <Box
            key={star.id}
            sx={{
              position: 'absolute',
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size === 'large' ? '4px' : star.size === 'medium' ? '3px' : '2px',
              height: star.size === 'large' ? '4px' : star.size === 'medium' ? '3px' : '2px',
              background: 'white',
              borderRadius: '50%',
              opacity: star.brightness,
              boxShadow: star.size === 'large' 
                ? '0 0 10px #fff, 0 0 20px #60A5FA, 0 0 30px #60A5FA'
                : star.size === 'medium'
                  ? '0 0 8px #fff, 0 0 14px #60A5FA'
                  : '0 0 6px #fff, 0 0 10px #60A5FA',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: '50%',
                right: '100%',
                width: star.size === 'large' ? '80px' : star.size === 'medium' ? '60px' : '40px',
                height: star.size === 'large' ? '2px' : '1px',
                background: `linear-gradient(90deg, transparent, rgba(255,255,255,${star.brightness}))`,
                transform: 'translateY(-50%)',
              },
              animation: `shootingStar ${star.speed}s ease-out forwards`,
            }}
          />
        ))}
      </Box>

      {/* Second nebula layer for depth - OPTIMIZED: slower animation, GPU accelerated */}
      <Box
        sx={{
          position: 'fixed',
          inset: '-20%',
          width: '140%',
          height: '140%',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: isVisible ? 0.4 : 0,
          transition: 'opacity 0.8s ease-in-out',
          background: isDark
            ? `radial-gradient(ellipse at 60% 40%, rgba(139, 92, 246, 0.15) 0%, transparent 40%),
               radial-gradient(ellipse at 25% 75%, rgba(236, 72, 153, 0.12) 0%, transparent 45%)`
            : `radial-gradient(ellipse at 60% 40%, rgba(139, 92, 246, 0.08) 0%, transparent 40%),
               radial-gradient(ellipse at 25% 75%, rgba(236, 72, 153, 0.06) 0%, transparent 45%)`,
          animation: 'nebulaDrift 60s ease-in-out infinite reverse',
          willChange: 'transform',
          transform: 'translateZ(0)', // Force GPU layer
        }}
      />

      {/* Third layer - OPTIMIZED: removed for mobile, slower on desktop */}
      <Box
        sx={{
          position: 'fixed',
          inset: '-30%',
          width: '160%',
          height: '160%',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: isVisible ? 0.2 : 0,
          transition: 'opacity 0.8s ease-in-out',
          background: isDark
            ? `radial-gradient(ellipse at 80% 20%, rgba(56, 189, 248, 0.1) 0%, transparent 35%)`
            : `radial-gradient(ellipse at 80% 20%, rgba(56, 189, 248, 0.05) 0%, transparent 35%)`,
          animation: 'nebulaDrift 90s ease-in-out infinite',
          willChange: 'transform',
          transform: 'translateZ(0)', // Force GPU layer
          display: { xs: 'none', md: 'block' }, // Hide on mobile for performance
        }}
      />

      {/* Vignette - darkened for room premium */}
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          background: isDark
            ? 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.6) 100%)'
            : 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.08) 100%)',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 1s ease-in-out',
        }}
      />
      
      {/* Extra darkening layer for room premium */}
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          background: isDark ? 'rgba(0, 0, 0, 0.25)' : 'transparent',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 1s ease-in-out',
        }}
      />
    </>
  );
};

// Premium Task Card styling - Neumorphic
export const getRoomPremiumTaskStyles = (isPremium, isDark) => {
  if (!isPremium) return {};
  
  return {
    background: isDark
      ? 'linear-gradient(145deg, #1f1f2e 0%, #18182a 100%)'
      : 'linear-gradient(145deg, #ffffff 0%, #f5f5f7 100%)',
    border: '1px solid',
    borderColor: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.1)',
    borderRadius: '12px',
    boxShadow: isDark
      ? '6px 6px 12px rgba(0, 0, 0, 0.3), -3px -3px 8px rgba(255, 255, 255, 0.02)'
      : '4px 4px 8px rgba(0, 0, 0, 0.06), -3px -3px 6px rgba(255, 255, 255, 0.8)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: isDark
        ? '8px 8px 16px rgba(0, 0, 0, 0.4), -4px -4px 10px rgba(255, 255, 255, 0.03)'
        : '6px 6px 12px rgba(0, 0, 0, 0.08), -4px -4px 8px rgba(255, 255, 255, 0.9)',
    },
    '&:active': {
      transform: 'scale(0.98)',
      boxShadow: isDark
        ? 'inset 4px 4px 8px rgba(0, 0, 0, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.02)'
        : 'inset 3px 3px 6px rgba(0, 0, 0, 0.05), inset -2px -2px 4px rgba(255, 255, 255, 0.7)',
    },
  };
};

// Neumorphic Button for Room Premium
export const NeuroButton = ({ children, variant = 'default', color = 'gold', sx = {}, ...props }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const colorMap = {
    gold: { accent: '#FBBF24', glow: 'rgba(251, 191, 36, 0.4)' },
    cyan: { accent: '#22D3EE', glow: 'rgba(34, 211, 238, 0.4)' },
    purple: { accent: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.4)' },
    green: { accent: '#22C55E', glow: 'rgba(34, 197, 94, 0.4)' },
  };
  
  const colors = colorMap[color] || colorMap.gold;
  
  return (
    <Box
      component="button"
      {...props}
      sx={{
        position: 'relative',
        padding: '12px 24px',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '0.875rem',
        color: isDark ? colors.accent : '#1f2937',
        background: isDark
          ? 'linear-gradient(145deg, #252538 0%, #1a1a2e 100%)'
          : 'linear-gradient(145deg, #ffffff 0%, #e8e8e8 100%)',
        boxShadow: isDark
          ? `6px 6px 12px rgba(0, 0, 0, 0.4), -4px -4px 10px rgba(255, 255, 255, 0.03), inset 0 0 0 1px rgba(${color === 'gold' ? '251, 191, 36' : '139, 92, 246'}, 0.15)`
          : `4px 4px 8px rgba(0, 0, 0, 0.08), -4px -4px 8px rgba(255, 255, 255, 0.9), inset 0 0 0 1px rgba(${color === 'gold' ? '251, 191, 36' : '139, 92, 246'}, 0.1)`,
        transition: 'all 0.15s ease',
        '&:hover': {
          background: isDark
            ? 'linear-gradient(145deg, #2a2a40 0%, #1f1f35 100%)'
            : 'linear-gradient(145deg, #f8f8f8 0%, #e0e0e0 100%)',
          boxShadow: isDark
            ? `8px 8px 16px rgba(0, 0, 0, 0.5), -5px -5px 12px rgba(255, 255, 255, 0.04), 0 0 20px ${colors.glow}`
            : `6px 6px 12px rgba(0, 0, 0, 0.1), -5px -5px 10px rgba(255, 255, 255, 0.95), 0 0 15px ${colors.glow}`,
        },
        '&:active': {
          transform: 'scale(0.96)',
          boxShadow: isDark
            ? `inset 4px 4px 8px rgba(0, 0, 0, 0.4), inset -2px -2px 4px rgba(255, 255, 255, 0.02)`
            : `inset 3px 3px 6px rgba(0, 0, 0, 0.08), inset -2px -2px 4px rgba(255, 255, 255, 0.7)`,
        },
        '&:disabled': {
          opacity: 0.5,
          cursor: 'not-allowed',
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

// Neumorphic Icon Button
export const NeuroIconButton = ({ children, size = 'medium', color = 'gold', sx = {}, ...props }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const sizeMap = {
    small: 32,
    medium: 40,
    large: 48,
  };
  
  const buttonSize = sizeMap[size] || sizeMap.medium;
  
  const colorMap = {
    gold: { accent: '#FBBF24', glow: 'rgba(251, 191, 36, 0.3)' },
    cyan: { accent: '#22D3EE', glow: 'rgba(34, 211, 238, 0.3)' },
    purple: { accent: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.3)' },
  };
  
  const colors = colorMap[color] || colorMap.gold;
  
  return (
    <Box
      component="button"
      {...props}
      sx={{
        width: buttonSize,
        height: buttonSize,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isDark ? colors.accent : '#4b5563',
        background: isDark
          ? 'linear-gradient(145deg, #252538 0%, #1a1a2e 100%)'
          : 'linear-gradient(145deg, #ffffff 0%, #e8e8e8 100%)',
        boxShadow: isDark
          ? '4px 4px 8px rgba(0, 0, 0, 0.4), -2px -2px 6px rgba(255, 255, 255, 0.02)'
          : '3px 3px 6px rgba(0, 0, 0, 0.08), -3px -3px 6px rgba(255, 255, 255, 0.9)',
        transition: 'all 0.15s ease',
        '&:hover': {
          boxShadow: isDark
            ? `6px 6px 12px rgba(0, 0, 0, 0.5), -3px -3px 8px rgba(255, 255, 255, 0.03), 0 0 15px ${colors.glow}`
            : `5px 5px 10px rgba(0, 0, 0, 0.1), -4px -4px 8px rgba(255, 255, 255, 0.95), 0 0 12px ${colors.glow}`,
        },
        '&:active': {
          transform: 'scale(0.92)',
          boxShadow: isDark
            ? 'inset 3px 3px 6px rgba(0, 0, 0, 0.4), inset -1px -1px 3px rgba(255, 255, 255, 0.02)'
            : 'inset 2px 2px 4px rgba(0, 0, 0, 0.08), inset -1px -1px 3px rgba(255, 255, 255, 0.7)',
        },
        '&:disabled': {
          opacity: 0.5,
          cursor: 'not-allowed',
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

// Neumorphic Input Field
export const NeuroInput = ({ sx = {}, ...props }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  return (
    <Box
      component="input"
      {...props}
      sx={{
        width: '100%',
        padding: '12px 16px',
        border: 'none',
        borderRadius: '10px',
        fontSize: '0.875rem',
        color: isDark ? '#e5e7eb' : '#1f2937',
        background: isDark
          ? 'linear-gradient(145deg, #18182a 0%, #1f1f2e 100%)'
          : 'linear-gradient(145deg, #e8e8e8 0%, #ffffff 100%)',
        boxShadow: isDark
          ? 'inset 4px 4px 8px rgba(0, 0, 0, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.02)'
          : 'inset 3px 3px 6px rgba(0, 0, 0, 0.06), inset -2px -2px 4px rgba(255, 255, 255, 0.8)',
        outline: 'none',
        transition: 'box-shadow 0.2s ease',
        '&:focus': {
          boxShadow: isDark
            ? 'inset 4px 4px 8px rgba(0, 0, 0, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.02), 0 0 0 2px rgba(251, 191, 36, 0.3)'
            : 'inset 3px 3px 6px rgba(0, 0, 0, 0.06), inset -2px -2px 4px rgba(255, 255, 255, 0.8), 0 0 0 2px rgba(251, 191, 36, 0.2)',
        },
        '&::placeholder': {
          color: isDark ? '#6b7280' : '#9ca3af',
        },
        ...sx,
      }}
    />
  );
};

// Neumorphic Progress Ring for scores
export const NeuroProgressRing = ({ progress = 0, size = 80, color = 'gold', children }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const colorMap = {
    gold: '#FBBF24',
    cyan: '#22D3EE',
    purple: '#8B5CF6',
    green: '#22C55E',
  };
  
  const accentColor = colorMap[color] || colorMap.gold;
  const circumference = 2 * Math.PI * 35; // radius = 35
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 80 80">
        {/* Background circle - neumorphic inset */}
        <circle
          cx="40"
          cy="40"
          r="35"
          fill="none"
          stroke={isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}
          strokeWidth="6"
        />
        {/* Progress circle */}
        <circle
          cx="40"
          cy="40"
          r="35"
          fill="none"
          stroke={accentColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 40 40)"
          style={{
            filter: `drop-shadow(0 0 6px ${accentColor})`,
            transition: 'stroke-dashoffset 0.5s ease',
          }}
        />
      </svg>
      {/* Center content */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

// Leaderboard rank styling
export const getRoomPremiumRankStyles = (isPremium, rank, isDark) => {
  if (!isPremium) return {};
  
  const rankColors = {
    0: { // 1st place - Gold
      background: isDark
        ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.15) 100%)'
        : 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%)',
      borderColor: 'rgba(251, 191, 36, 0.5)',
      glow: 'rgba(251, 191, 36, 0.3)',
    },
    1: { // 2nd place - Silver
      background: isDark
        ? 'linear-gradient(135deg, rgba(156, 163, 175, 0.2) 0%, rgba(209, 213, 219, 0.15) 100%)'
        : 'linear-gradient(135deg, rgba(156, 163, 175, 0.12) 0%, rgba(209, 213, 219, 0.08) 100%)',
      borderColor: 'rgba(156, 163, 175, 0.4)',
      glow: 'rgba(156, 163, 175, 0.2)',
    },
    2: { // 3rd place - Bronze
      background: isDark
        ? 'linear-gradient(135deg, rgba(217, 119, 6, 0.2) 0%, rgba(180, 83, 9, 0.15) 100%)'
        : 'linear-gradient(135deg, rgba(217, 119, 6, 0.12) 0%, rgba(180, 83, 9, 0.08) 100%)',
      borderColor: 'rgba(217, 119, 6, 0.4)',
      glow: 'rgba(217, 119, 6, 0.2)',
    },
  };
  
  const styles = rankColors[rank];
  if (!styles) return {};
  
  return {
    background: styles.background,
    borderLeft: `3px solid ${styles.borderColor}`,
    boxShadow: `0 0 15px ${styles.glow}`,
    borderRadius: 1,
    mb: 1,
    transition: 'all 0.3s ease',
  };
};

export default RoomPremiumBackground;
