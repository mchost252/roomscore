import React, { useState, useEffect } from 'react';
import { Box, keyframes } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePremium } from '../../context/PremiumContext';

// Checkmark draw animation
const checkDraw = keyframes`
  0% {
    stroke-dashoffset: 24;
  }
  100% {
    stroke-dashoffset: 0;
  }
`;

// Success pulse
const successPulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5);
  }
  70% {
    box-shadow: 0 0 0 12px rgba(34, 197, 94, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
`;

// Scale bounce
const scaleBounce = keyframes`
  0% { transform: scale(1); }
  30% { transform: scale(0.95); }
  50% { transform: scale(1.05); }
  70% { transform: scale(0.98); }
  100% { transform: scale(1); }
`;

/**
 * TaskCompleteAnimation - Animates task completion checkbox
 * Shows checkmark draw + success pulse
 */
const TaskCompleteAnimation = ({ 
  children, 
  trigger = false,
  onAnimationComplete,
  ...boxProps 
}) => {
  const { isGlobalPremium } = usePremium();
  const theme = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (trigger && isGlobalPremium) {
      setIsAnimating(true);

      // Trigger haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate([10, 50, 10]); // Double light tap
      }

      const timer = setTimeout(() => {
        setIsAnimating(false);
        onAnimationComplete?.();
      }, 500);

      return () => clearTimeout(timer);
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
          ? `${scaleBounce} 0.4s ease, ${successPulse} 0.5s ease`
          : 'none',
        borderRadius: 1,
        ...boxProps.sx,
      }}
    >
      {children}

      {/* Animated checkmark overlay */}
      {isAnimating && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 24,
            height: 24,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke="#22c55e"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 24,
                strokeDashoffset: 24,
                animation: `${checkDraw} 0.3s ease forwards 0.1s`,
              }}
            />
          </svg>
        </Box>
      )}
    </Box>
  );
};

export default TaskCompleteAnimation;
