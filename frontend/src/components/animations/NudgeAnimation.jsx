import React, { useState, useEffect, useCallback } from 'react';
import { Box, keyframes } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePremium } from '../../context/PremiumContext';

// Keyframes for paper plane fly animation
const flyAway = keyframes`
  0% {
    transform: scale(1) translateX(0) translateY(0) rotate(0deg);
    opacity: 1;
  }
  30% {
    transform: scale(1.2) translateX(5px) translateY(-5px) rotate(-10deg);
    opacity: 1;
  }
  100% {
    transform: scale(0.6) translateX(60px) translateY(-30px) rotate(-20deg);
    opacity: 0;
  }
`;

// Subtle shake for receiving nudge
const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
  20%, 40%, 60%, 80% { transform: translateX(2px); }
`;

// Glow pulse effect
const glowPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 5px rgba(96, 165, 250, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(96, 165, 250, 0.6), 0 0 30px rgba(96, 165, 250, 0.3);
  }
`;

/**
 * NudgeAnimation - Wraps nudge button/card for send/receive animations
 */
const NudgeAnimation = ({ 
  children, 
  type = 'send', // 'send' | 'receive'
  trigger = false,
  roomId = null, // Pass roomId to check room premium
  onAnimationComplete,
  ...boxProps 
}) => {
  const { isGlobalPremium, isRoomPremium, trackNudgeSent } = usePremium();
  const theme = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);
  const [showRipple, setShowRipple] = useState(false);
  const [ripplePos, setRipplePos] = useState({ x: 0, y: 0 });
  
  // Check if any premium is active (global or room-specific)
  const isPremiumActive = isGlobalPremium || (roomId && isRoomPremium(roomId));

  useEffect(() => {
    if (trigger && isPremiumActive) {
      setIsAnimating(true);
      
      if (type === 'send') {
        trackNudgeSent();
      }

      const timer = setTimeout(() => {
        setIsAnimating(false);
        onAnimationComplete?.();
      }, type === 'send' ? 500 : 500);

      return () => clearTimeout(timer);
    }
  }, [trigger, type, isPremiumActive, onAnimationComplete, trackNudgeSent]);

  const handleClick = useCallback((e) => {
    if (!isPremiumActive) return;

    const rect = e.currentTarget.getBoundingClientRect();
    setRipplePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setShowRipple(true);

    setTimeout(() => setShowRipple(false), 600);
  }, [isPremiumActive]);

  if (!isPremiumActive) {
    return <Box {...boxProps}>{children}</Box>;
  }

  return (
    <Box
      {...boxProps}
      onClick={handleClick}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        animation: isAnimating 
          ? type === 'send' 
            ? `${flyAway} 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards`
            : `${shake} 0.5s ease-in-out, ${glowPulse} 0.5s ease-in-out`
          : 'none',
        ...boxProps.sx,
      }}
    >
      {children}
      
      {/* Ripple effect on click */}
      {showRipple && (
        <Box
          sx={{
            position: 'absolute',
            left: ripplePos.x,
            top: ripplePos.y,
            width: 20,
            height: 20,
            marginLeft: -10,
            marginTop: -10,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.4)',
            animation: 'premiumRipple 0.6s ease-out forwards',
            pointerEvents: 'none',
          }}
        />
      )}
    </Box>
  );
};

export default NudgeAnimation;
