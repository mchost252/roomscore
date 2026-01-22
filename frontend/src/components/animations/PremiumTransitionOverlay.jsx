import React, { useEffect, useState } from 'react';
import { Box, keyframes } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePremium } from '../../context/PremiumContext';

// Checkmark animation
const drawCheck = keyframes`
  0% { stroke-dashoffset: 50; }
  100% { stroke-dashoffset: 0; }
`;

// Circle fill
const circleFill = keyframes`
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
`;

// Fade in overlay
const fadeIn = keyframes`
  0% { opacity: 0; }
  100% { opacity: 1; }
`;

// Fade out overlay
const fadeOut = keyframes`
  0% { opacity: 1; }
  100% { opacity: 0; }
`;

// Scanning line animation (top to bottom)
const scanLine = keyframes`
  0% { top: 0%; opacity: 1; }
  100% { top: 100%; opacity: 0; }
`;

// Screen dissolve effect
const dissolve = keyframes`
  0% { opacity: 1; filter: blur(0px); }
  100% { opacity: 0; filter: blur(20px); }
`;

/**
 * PremiumTransitionOverlay - Full-screen overlay during premium activation
 * Shows the "Wow" moment with scanning laser effect
 */
const PremiumTransitionOverlay = () => {
  const { isTransitioning, transitionType } = usePremium();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [phase, setPhase] = useState('idle'); // idle | dimming | scanning | success | revealing

  useEffect(() => {
    if (!isTransitioning) {
      setPhase('idle');
      return;
    }

    if (transitionType === 'activate') {
      // Phase 1: Dim screen (0.5s dark)
      setPhase('dimming');
      
      // Phase 2: Scanning line (laser passes from top to bottom)
      const scanTimer = setTimeout(() => {
        setPhase('scanning');
      }, 500);

      // Phase 3: Show success checkmark
      const successTimer = setTimeout(() => {
        setPhase('success');
      }, 1300);

      // Phase 4: Reveal premium UI (boot up)
      const revealTimer = setTimeout(() => {
        setPhase('revealing');
      }, 1900);

      return () => {
        clearTimeout(scanTimer);
        clearTimeout(successTimer);
        clearTimeout(revealTimer);
      };
    } else if (transitionType === 'deactivate') {
      setPhase('dimming');
      
      const revealTimer = setTimeout(() => {
        setPhase('revealing');
      }, 400);

      return () => clearTimeout(revealTimer);
    }
  }, [isTransitioning, transitionType]);

  if (phase === 'idle') {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: phase === 'dimming'
          ? (isDark ? '#0f172a' : '#ffffff')
          : (isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)'),
        backdropFilter: 'blur(8px)',
        animation: phase === 'revealing' 
          ? `${fadeOut} 0.5s ease forwards`
          : `${fadeIn} 0.3s ease forwards`,
      }}
    >
      {/* Scanning laser line (Phase 2) */}
      {phase === 'scanning' && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, transparent, #60A5FA, #8B5CF6, #60A5FA, transparent)',
            boxShadow: '0 0 20px #60A5FA, 0 0 40px #8B5CF6, 0 0 60px #60A5FA',
            animation: `${scanLine} 0.8s ease-out forwards`,
            zIndex: 10,
          }}
        />
      )}
      {/* Success checkmark for activation */}
      {transitionType === 'activate' && phase === 'success' && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {/* Animated circle with checkmark */}
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: `${circleFill} 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
              boxShadow: '0 0 30px rgba(34, 197, 94, 0.5)',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path
                d="M10 20L17 27L30 13"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 50,
                  strokeDashoffset: 50,
                  animation: `${drawCheck} 0.4s ease forwards 0.2s`,
                }}
              />
            </svg>
          </Box>
          
          {/* Text */}
          <Box
            sx={{
              color: isDark ? '#f1f5f9' : '#0f172a',
              fontWeight: 700,
              fontSize: '1.25rem',
              opacity: 0,
              animation: `${fadeIn} 0.3s ease forwards 0.3s`,
            }}
          >
            Premium Activated! ✨
          </Box>
        </Box>
      )}

      {/* Deactivation feedback */}
      {transitionType === 'deactivate' && phase === 'dimming' && (
        <Box
          sx={{
            color: isDark ? '#94a3b8' : '#64748b',
            fontWeight: 500,
            fontSize: '1rem',
          }}
        >
          Switching to standard mode...
        </Box>
      )}
    </Box>
  );
};

export default PremiumTransitionOverlay;
