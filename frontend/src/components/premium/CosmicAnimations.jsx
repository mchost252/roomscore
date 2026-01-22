import React, { useState, useEffect } from 'react';
import { Box, keyframes } from '@mui/material';
import { useTheme } from '@mui/material/styles';

/**
 * Cosmic Animations for Room Premium
 * 
 * Provides immediate visual feedback when:
 * - Nudge is sent (cosmic bell)
 * - Appreciation is sent (cosmic star/fire/shield)
 * 
 * These trigger IMMEDIATELY on click, before the API call completes
 */

// Animation keyframes
const cosmicPulse = keyframes`
  0% { transform: scale(0); opacity: 0; }
  30% { transform: scale(1.3); opacity: 1; }
  60% { transform: scale(0.9); opacity: 0.9; }
  100% { transform: scale(1); opacity: 0; }
`;

const particleBurst = keyframes`
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
`;

const ringExpand = keyframes`
  0% { transform: scale(0); opacity: 1; border-width: 4px; }
  100% { transform: scale(3); opacity: 0; border-width: 1px; }
`;

const iconFloat = keyframes`
  0% { transform: translateY(0) scale(1); opacity: 1; }
  40% { transform: translateY(-40px) scale(1.3); opacity: 1; }
  70% { transform: translateY(-50px) scale(1.2); opacity: 0.8; }
  100% { transform: translateY(-70px) scale(0.9); opacity: 0; }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

// Cosmic Nudge Animation - Bell with ripple waves
export const CosmicNudgeAnimation = ({ show, onComplete }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => onComplete?.(), 2000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      {/* Central bell icon */}
      <Box
        sx={{
          fontSize: '4rem',
          animation: `${iconFloat} 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards`,
          filter: 'drop-shadow(0 0 20px rgba(251, 191, 36, 0.8))',
          zIndex: 3,
        }}
      >
        🔔
      </Box>

      {/* Expanding rings */}
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: `4px solid ${isDark ? '#FBBF24' : '#F59E0B'}`,
            animation: `${ringExpand} 1.2s ease-out forwards`,
            animationDelay: `${i * 0.2}s`,
            opacity: 0,
          }}
        />
      ))}

      {/* Cosmic particles */}
      {[...Array(12)].map((_, i) => {
        const angle = (i * 30) * (Math.PI / 180);
        const distance = 80 + Math.random() * 40;
        return (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: i % 3 === 0 ? '#FBBF24' : i % 3 === 1 ? '#F59E0B' : '#FDE68A',
              boxShadow: `0 0 10px ${i % 3 === 0 ? '#FBBF24' : '#F59E0B'}`,
              '--tx': `${Math.cos(angle) * distance}px`,
              '--ty': `${Math.sin(angle) * distance}px`,
              animation: `${particleBurst} 1.2s ease-out forwards`,
              animationDelay: `${0.1 + Math.random() * 0.3}s`,
            }}
          />
        );
      })}

      {/* Sound wave effect */}
      <Box
        sx={{
          position: 'absolute',
          width: 120,
          height: 60,
          background: `linear-gradient(90deg, 
            transparent 0%, 
            rgba(251, 191, 36, 0.3) 25%, 
            rgba(251, 191, 36, 0.5) 50%, 
            rgba(251, 191, 36, 0.3) 75%, 
            transparent 100%)`,
          borderRadius: '50%',
          animation: `${cosmicPulse} 0.6s ease-out forwards`,
          filter: 'blur(4px)',
        }}
      />
    </Box>
  );
};

// Cosmic Star Animation
export const CosmicStarAnimation = ({ show, onComplete }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => onComplete?.(), 2000); // Extended to 2 seconds
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      {/* Central star */}
      <Box
        sx={{
          fontSize: '5rem',
          animation: `${iconFloat} 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards`,
          filter: 'drop-shadow(0 0 30px rgba(251, 191, 36, 1)) drop-shadow(0 0 60px rgba(251, 191, 36, 0.6))',
          zIndex: 3,
        }}
      >
        ⭐
      </Box>

      {/* Golden glow burst */}
      <Box
        sx={{
          position: 'absolute',
          width: 150,
          height: 150,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(251, 191, 36, 0.6) 0%, transparent 70%)`,
          animation: `${cosmicPulse} 1.2s ease-out forwards`,
        }}
      />

      {/* Star trail particles */}
      {[...Array(16)].map((_, i) => {
        const angle = (i * 22.5) * (Math.PI / 180);
        const distance = 100 + Math.random() * 50;
        return (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              width: i % 2 === 0 ? 6 : 4,
              height: i % 2 === 0 ? 6 : 4,
              background: '#FBBF24',
              clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
              boxShadow: '0 0 8px #FBBF24, 0 0 16px rgba(251, 191, 36, 0.5)',
              '--tx': `${Math.cos(angle) * distance}px`,
              '--ty': `${Math.sin(angle) * distance}px`,
              animation: `${particleBurst} 1.3s ease-out forwards`,
              animationDelay: `${Math.random() * 0.4}s`,
            }}
          />
        );
      })}

      {/* Sparkle ring */}
      <Box
        sx={{
          position: 'absolute',
          width: 100,
          height: 100,
          borderRadius: '50%',
          border: '3px solid #FBBF24',
          animation: `${ringExpand} 1.1s ease-out forwards`,
          boxShadow: '0 0 20px rgba(251, 191, 36, 0.5)',
        }}
      />
    </Box>
  );
};

// Cosmic Fire Animation
export const CosmicFireAnimation = ({ show, onComplete }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => onComplete?.(), 2000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      {/* Central fire */}
      <Box
        sx={{
          fontSize: '5rem',
          animation: `${iconFloat} 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards`,
          filter: 'drop-shadow(0 0 30px rgba(239, 68, 68, 1)) drop-shadow(0 0 60px rgba(251, 146, 60, 0.8))',
          zIndex: 3,
        }}
      >
        🔥
      </Box>

      {/* Fire burst gradient */}
      <Box
        sx={{
          position: 'absolute',
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: `radial-gradient(circle, 
            rgba(239, 68, 68, 0.5) 0%, 
            rgba(251, 146, 60, 0.3) 40%, 
            transparent 70%)`,
          animation: `${cosmicPulse} 1.2s ease-out forwards`,
        }}
      />

      {/* Flame particles - rising effect */}
      {[...Array(20)].map((_, i) => {
        const xOffset = (Math.random() - 0.5) * 100;
        const yDistance = -80 - Math.random() * 80;
        return (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              width: 6 + Math.random() * 6,
              height: 12 + Math.random() * 12,
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              background: i % 3 === 0 
                ? 'linear-gradient(to top, #EF4444, #F97316)' 
                : i % 3 === 1 
                  ? 'linear-gradient(to top, #F97316, #FBBF24)'
                  : 'linear-gradient(to top, #FBBF24, #FDE68A)',
              boxShadow: `0 0 10px ${i % 2 === 0 ? '#EF4444' : '#F97316'}`,
              '--tx': `${xOffset}px`,
              '--ty': `${yDistance}px`,
              animation: `${particleBurst} ${1.0 + Math.random() * 0.5}s ease-out forwards`,
              animationDelay: `${Math.random() * 0.4}s`,
            }}
          />
        );
      })}

      {/* Heat wave rings */}
      {[0, 1].map((i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            width: 100,
            height: 100,
            borderRadius: '50%',
            border: `3px solid ${i === 0 ? '#EF4444' : '#F97316'}`,
            animation: `${ringExpand} 1.1s ease-out forwards`,
            animationDelay: `${i * 0.15}s`,
            boxShadow: `0 0 15px ${i === 0 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(249, 115, 22, 0.5)'}`,
          }}
        />
      ))}
    </Box>
  );
};

// Cosmic Shield Animation
export const CosmicShieldAnimation = ({ show, onComplete }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => onComplete?.(), 2000); // Extended to 2 seconds
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      {/* Central shield */}
      <Box
        sx={{
          fontSize: '5rem',
          animation: `${iconFloat} 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards`,
          filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 1)) drop-shadow(0 0 60px rgba(99, 102, 241, 0.8))',
          zIndex: 3,
        }}
      >
        🛡️
      </Box>

      {/* Shield energy burst */}
      <Box
        sx={{
          position: 'absolute',
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: `radial-gradient(circle, 
            rgba(59, 130, 246, 0.5) 0%, 
            rgba(99, 102, 241, 0.3) 40%, 
            transparent 70%)`,
          animation: `${cosmicPulse} 1.2s ease-out forwards`,
        }}
      />

      {/* Hexagonal particles - shield theme */}
      {[...Array(12)].map((_, i) => {
        const angle = (i * 30) * (Math.PI / 180);
        const distance = 90 + Math.random() * 40;
        return (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              width: 10,
              height: 10,
              background: i % 2 === 0 ? '#3B82F6' : '#6366F1',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              boxShadow: `0 0 10px ${i % 2 === 0 ? '#3B82F6' : '#6366F1'}`,
              '--tx': `${Math.cos(angle) * distance}px`,
              '--ty': `${Math.sin(angle) * distance}px`,
              animation: `${particleBurst} 1.2s ease-out forwards`,
              animationDelay: `${Math.random() * 0.35}s`,
            }}
          />
        );
      })}

      {/* Protection ring effect */}
      <Box
        sx={{
          position: 'absolute',
          width: 120,
          height: 120,
          borderRadius: '50%',
          border: '4px solid transparent',
          background: `linear-gradient(${isDark ? '#1e293b' : '#ffffff'}, ${isDark ? '#1e293b' : '#ffffff'}) padding-box,
                       linear-gradient(135deg, #3B82F6, #6366F1, #8B5CF6) border-box`,
          animation: `${ringExpand} 1.2s ease-out forwards`,
        }}
      />

      {/* Inner glow ring */}
      <Box
        sx={{
          position: 'absolute',
          width: 80,
          height: 80,
          borderRadius: '50%',
          border: '2px solid #60A5FA',
          animation: `${ringExpand} 1s ease-out forwards`,
          animationDelay: '0.15s',
          boxShadow: '0 0 20px rgba(96, 165, 250, 0.6)',
        }}
      />
    </Box>
  );
};

// Export all animations
export default {
  CosmicNudgeAnimation,
  CosmicStarAnimation,
  CosmicFireAnimation,
  CosmicShieldAnimation,
};
