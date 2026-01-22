import React, { useState, useEffect } from 'react';
import { Box, Typography, keyframes } from '@mui/material';
import { useTheme } from '@mui/material/styles';

/**
 * RoomPremiumTransition - Smooth activation/deactivation effect
 * 
 * Based on checklist:
 * - Screen dims slightly (0.3s pause)
 * - Fade-out (200ms) → Fade-in (400ms)
 * - Cards re-enter with motion
 * - Background gradient activates
 * - "Feels magical, not disruptive"
 */

// Scanning line effect
const scanLine = keyframes`
  0% { 
    top: -2px; 
    opacity: 1; 
  }
  100% { 
    top: 100%; 
    opacity: 0.3; 
  }
`;

// Fade and scale reveal
const premiumReveal = keyframes`
  0% { 
    opacity: 0; 
    filter: brightness(0.5) saturate(0); 
  }
  50% { 
    opacity: 0.8; 
    filter: brightness(1.2) saturate(1.2); 
  }
  100% { 
    opacity: 1; 
    filter: brightness(1) saturate(1); 
  }
`;

// Checkmark draw animation
const checkDraw = keyframes`
  0% { stroke-dashoffset: 24; }
  100% { stroke-dashoffset: 0; }
`;

// Success pulse
const successPulse = keyframes`
  0% { transform: scale(0.8); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
`;

// Particle float up
const floatUp = keyframes`
  0% { 
    transform: translateY(0) scale(1); 
    opacity: 1; 
  }
  100% { 
    transform: translateY(-60px) scale(0); 
    opacity: 0; 
  }
`;

/**
 * Premium Activation Overlay
 * Shows during the transition when premium is activated/deactivated
 */
export const PremiumActivationOverlay = ({ 
  show, 
  type = 'activate', // 'activate' | 'deactivate'
  onComplete 
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [phase, setPhase] = useState('idle'); // idle, scanning, revealing, complete

  useEffect(() => {
    if (show) {
      // Phase 1: Scanning (300ms)
      setPhase('scanning');
      
      // Phase 2: Revealing (400ms)
      const revealTimer = setTimeout(() => {
        setPhase('revealing');
      }, 300);
      
      // Phase 3: Complete (after 700ms total)
      const completeTimer = setTimeout(() => {
        setPhase('complete');
        setTimeout(() => {
          onComplete?.();
          setPhase('idle');
        }, 500);
      }, 700);
      
      return () => {
        clearTimeout(revealTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [show, onComplete]);

  if (!show && phase === 'idle') return null;

  const isActivating = type === 'activate';
  const accentColor = isActivating ? '#FBBF24' : '#6B7280';

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: phase === 'complete' ? 'none' : 'all',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Dim background
        background: phase === 'scanning' 
          ? (isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.4)')
          : 'transparent',
        transition: 'background 0.3s ease',
      }}
    >
      {/* Scanning Line */}
      {phase === 'scanning' && (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '2px',
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
            boxShadow: `0 0 20px ${accentColor}, 0 0 40px ${accentColor}`,
            animation: `${scanLine} 0.3s ease-out forwards`,
          }}
        />
      )}

      {/* Success indicator */}
      {(phase === 'revealing' || phase === 'complete') && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            animation: `${successPulse} 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards`,
          }}
        >
          {/* Checkmark circle */}
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: isDark
                ? `linear-gradient(145deg, ${isActivating ? '#2d2a1a' : '#1f1f2e'}, ${isActivating ? '#1a1a0f' : '#15151f'})`
                : `linear-gradient(145deg, ${isActivating ? '#fef9e7' : '#f3f4f6'}, ${isActivating ? '#fef3c7' : '#e5e7eb'})`,
              boxShadow: isDark
                ? `0 0 30px ${accentColor}40, 8px 8px 16px rgba(0, 0, 0, 0.4), -4px -4px 12px rgba(255, 255, 255, 0.02)`
                : `0 0 25px ${accentColor}30, 6px 6px 12px rgba(0, 0, 0, 0.1), -4px -4px 10px rgba(255, 255, 255, 0.8)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path
                d={isActivating ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"}
                stroke={accentColor}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 24,
                  strokeDashoffset: 24,
                  animation: `${checkDraw} 0.4s ease-out 0.1s forwards`,
                  filter: `drop-shadow(0 0 8px ${accentColor})`,
                }}
              />
            </svg>
          </Box>

          {/* Text */}
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: accentColor,
              textShadow: `0 0 20px ${accentColor}60`,
              opacity: phase === 'complete' ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          >
            {isActivating ? '✨ Constellation Mode' : 'Standard Mode'}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              color: isDark ? '#9CA3AF' : '#6B7280',
              opacity: phase === 'complete' ? 1 : 0,
              transition: 'opacity 0.3s ease 0.1s',
            }}
          >
            {isActivating ? 'Premium features activated' : 'Premium features disabled'}
          </Typography>

          {/* Floating particles (only on activation) */}
          {isActivating && phase === 'complete' && (
            <>
              {[...Array(6)].map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    position: 'absolute',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: i % 2 === 0 ? '#FBBF24' : '#8B5CF6',
                    left: `calc(50% + ${(Math.random() - 0.5) * 100}px)`,
                    top: '50%',
                    animation: `${floatUp} 0.8s ease-out forwards`,
                    animationDelay: `${i * 0.1}s`,
                    boxShadow: `0 0 8px ${i % 2 === 0 ? '#FBBF24' : '#8B5CF6'}`,
                  }}
                />
              ))}
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

/**
 * Hook to manage premium transition state
 */
export const usePremiumTransition = () => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState('activate');

  const startTransition = (type = 'activate') => {
    setTransitionType(type);
    setIsTransitioning(true);
  };

  const endTransition = () => {
    setIsTransitioning(false);
  };

  return {
    isTransitioning,
    transitionType,
    startTransition,
    endTransition,
    TransitionOverlay: () => (
      <PremiumActivationOverlay
        show={isTransitioning}
        type={transitionType}
        onComplete={endTransition}
      />
    ),
  };
};

export default PremiumActivationOverlay;
