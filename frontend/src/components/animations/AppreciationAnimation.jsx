import React, { useState, useEffect, useRef } from 'react';
import { Box, keyframes } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePremium } from '../../context/PremiumContext';

// Icon pop animation
const iconPop = keyframes`
  0% { transform: scale(0); }
  50% { transform: scale(1.3); }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); }
`;

// Particle burst animation
const particleBurst = keyframes`
  0% {
    transform: scale(0) translate(0, 0);
    opacity: 1;
  }
  100% {
    transform: scale(1) translate(var(--tx), var(--ty));
    opacity: 0;
  }
`;

// Card lift animation
const cardLift = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
`;

// Smooth count increment
const countBump = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
`;

/**
 * AppreciationAnimation - Handles appreciation send/receive animations
 * Shows particle burst, icon pop, and card lift effects
 */
const AppreciationAnimation = ({ 
  children, 
  type = 'star', // 'star' | 'fire' | 'shield'
  trigger = false,
  showParticles = true,
  roomId = null, // Pass roomId to check room premium
  onAnimationComplete,
  ...boxProps 
}) => {
  const { isGlobalPremium, isRoomPremium } = usePremium();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [isAnimating, setIsAnimating] = useState(false);
  const [particles, setParticles] = useState([]);
  const containerRef = useRef(null);
  
  // Check if any premium is active (global or room-specific)
  const isPremiumActive = isGlobalPremium || (roomId && isRoomPremium(roomId));

  // Get color based on appreciation type
  const getTypeColor = () => {
    switch (type) {
      case 'star': return '#F59E0B';
      case 'fire': return '#EF4444';
      case 'shield': return '#3B82F6';
      default: return '#F59E0B';
    }
  };

  // Get emoji based on type
  const getTypeEmoji = () => {
    switch (type) {
      case 'star': return '⭐';
      case 'fire': return '🔥';
      case 'shield': return '🛡️';
      default: return '⭐';
    }
  };

  useEffect(() => {
    if (trigger && isPremiumActive) {
      setIsAnimating(true);

      // Create 2-3 particles
      if (showParticles) {
        const newParticles = Array.from({ length: 3 }, (_, i) => ({
          id: Date.now() + i,
          tx: (Math.random() - 0.5) * 60,
          ty: -20 - Math.random() * 30,
          delay: i * 100,
        }));
        setParticles(newParticles);
      }

      const timer = setTimeout(() => {
        setIsAnimating(false);
        setParticles([]);
        onAnimationComplete?.();
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [trigger, isPremiumActive, showParticles, onAnimationComplete]);

  if (!isPremiumActive) {
    return <Box {...boxProps}>{children}</Box>;
  }

  const color = getTypeColor();

  return (
    <Box
      ref={containerRef}
      {...boxProps}
      sx={{
        position: 'relative',
        animation: isAnimating ? `${cardLift} 0.3s ease` : 'none',
        ...boxProps.sx,
      }}
    >
      {children}

      {/* Particle burst effect */}
      {particles.map((particle) => (
        <Box
          key={particle.id}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 6px ${color}`,
            pointerEvents: 'none',
            '--tx': `${particle.tx}px`,
            '--ty': `${particle.ty}px`,
            animation: `${particleBurst} 0.5s ease-out forwards`,
            animationDelay: `${particle.delay}ms`,
            zIndex: 10,
          }}
        />
      ))}

      {/* Icon pop overlay */}
      {isAnimating && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '2rem',
            animation: `${iconPop} 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards`,
            pointerEvents: 'none',
            zIndex: 11,
            filter: `drop-shadow(0 0 8px ${color})`,
          }}
        >
          {getTypeEmoji()}
        </Box>
      )}
    </Box>
  );
};

export default AppreciationAnimation;
