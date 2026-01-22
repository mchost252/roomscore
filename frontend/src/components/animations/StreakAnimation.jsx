import React, { useState, useEffect } from 'react';
import { Box, keyframes } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePremium } from '../../context/PremiumContext';

// Fire/Lightning pulse
const streakPulse = keyframes`
  0% {
    transform: scale(1);
    filter: brightness(1);
  }
  50% {
    transform: scale(1.15);
    filter: brightness(1.3) drop-shadow(0 0 10px #F59E0B);
  }
  100% {
    transform: scale(1);
    filter: brightness(1);
  }
`;

// Glow settle
const glowSettle = keyframes`
  0% {
    filter: drop-shadow(0 0 15px #F59E0B);
  }
  100% {
    filter: drop-shadow(0 0 4px #F59E0B);
  }
`;

/**
 * StreakAnimation - Animates streak milestones and updates
 * Shows pulse + glow effect, then settles (no looping)
 */
const StreakAnimation = ({ 
  children, 
  trigger = false,
  streakCount = 0,
  onAnimationComplete,
  ...boxProps 
}) => {
  const { isGlobalPremium } = usePremium();
  const theme = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);
  const [showGlow, setShowGlow] = useState(false);

  useEffect(() => {
    if (trigger && isGlobalPremium) {
      setIsAnimating(true);
      
      // Pulse animation
      const pulseTimer = setTimeout(() => {
        setIsAnimating(false);
        setShowGlow(true);
      }, 600);

      // Glow settle
      const glowTimer = setTimeout(() => {
        setShowGlow(false);
        onAnimationComplete?.();
      }, 1200);

      return () => {
        clearTimeout(pulseTimer);
        clearTimeout(glowTimer);
      };
    }
  }, [trigger, isGlobalPremium, onAnimationComplete]);

  if (!isGlobalPremium) {
    return <Box {...boxProps}>{children}</Box>;
  }

  return (
    <Box
      {...boxProps}
      sx={{
        position: 'relative',
        animation: isAnimating 
          ? `${streakPulse} 0.6s ease-out`
          : showGlow
            ? `${glowSettle} 0.6s ease-out forwards`
            : 'none',
        ...boxProps.sx,
      }}
    >
      {children}

      {/* Milestone celebration for significant streaks */}
      {isAnimating && (streakCount === 7 || streakCount === 30 || streakCount === 100) && (
        <>
          {/* Extra sparkle particles for milestones */}
          {Array.from({ length: 5 }).map((_, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 6,
                height: 6,
                background: '#F59E0B',
                borderRadius: '50%',
                animation: `premiumSparkle 1s ease-in-out`,
                animationDelay: `${i * 0.15}s`,
                transform: `rotate(${i * 72}deg) translateY(-20px)`,
                transformOrigin: 'center center',
                pointerEvents: 'none',
              }}
            />
          ))}
        </>
      )}
    </Box>
  );
};

export default StreakAnimation;
