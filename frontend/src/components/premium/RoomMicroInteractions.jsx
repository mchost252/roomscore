import React, { useState, useCallback } from 'react';
import { Box, keyframes } from '@mui/material';
import { useTheme } from '@mui/material/styles';

/**
 * Room Premium Micro-Interactions
 * Provides subtle, satisfying animations for user actions
 * 
 * Based on checklist:
 * - Button tap: ripple + scale (1 → 0.96 → 1)
 * - Tab switch: horizontal slide + opacity
 * - Task complete: checkmark burst + confetti
 * - Modal open: bottom sheet with spring easing
 */

// Ripple effect for button presses
export const useRipple = () => {
  const [ripples, setRipples] = useState([]);

  const createRipple = useCallback((event) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    const newRipple = {
      id: Date.now(),
      x,
      y,
      size,
    };
    
    setRipples((prev) => [...prev, newRipple]);
    
    // Remove ripple after animation
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);
  }, []);

  const RippleContainer = ({ color = 'rgba(251, 191, 36, 0.3)' }) => (
    <>
      {ripples.map((ripple) => (
        <Box
          key={ripple.id}
          sx={{
            position: 'absolute',
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            borderRadius: '50%',
            backgroundColor: color,
            transform: 'scale(0)',
            animation: 'rippleEffect 0.6s ease-out forwards',
            pointerEvents: 'none',
            '@keyframes rippleEffect': {
              '0%': { transform: 'scale(0)', opacity: 1 },
              '100%': { transform: 'scale(2.5)', opacity: 0 },
            },
          }}
        />
      ))}
    </>
  );

  return { createRipple, RippleContainer };
};

// Task completion animation - checkmark with particles
export const TaskCompleteAnimation = ({ show, onComplete }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!show) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {/* Checkmark */}
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: isDark
            ? 'linear-gradient(145deg, #1f3a1f 0%, #162816 100%)'
            : 'linear-gradient(145deg, #dcfce7 0%, #bbf7d0 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'checkmarkPop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards',
          boxShadow: isDark
            ? '0 0 30px rgba(34, 197, 94, 0.4), 8px 8px 16px rgba(0, 0, 0, 0.4)'
            : '0 0 25px rgba(34, 197, 94, 0.3), 6px 6px 12px rgba(0, 0, 0, 0.1)',
          '@keyframes checkmarkPop': {
            '0%': { transform: 'scale(0)', opacity: 0 },
            '50%': { transform: 'scale(1.2)' },
            '100%': { transform: 'scale(1)', opacity: 1 },
          },
        }}
        onAnimationEnd={() => {
          setTimeout(() => onComplete?.(), 400);
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          style={{ filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.5))' }}
        >
          <path
            d="M5 13l4 4L19 7"
            stroke="#22C55E"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 30,
              strokeDashoffset: 30,
              animation: 'checkDraw 0.4s ease-out 0.2s forwards',
            }}
          />
        </svg>
        <style>{`
          @keyframes checkDraw {
            to { stroke-dashoffset: 0; }
          }
        `}</style>
      </Box>

      {/* Particles */}
      {[...Array(8)].map((_, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: i % 2 === 0 ? '#22C55E' : '#FBBF24',
            animation: `particle${i} 0.6s ease-out forwards`,
            [`@keyframes particle${i}`]: {
              '0%': { 
                transform: 'translate(0, 0) scale(1)', 
                opacity: 1 
              },
              '100%': { 
                transform: `translate(${Math.cos(i * 45 * Math.PI / 180) * 60}px, ${Math.sin(i * 45 * Math.PI / 180) * 60}px) scale(0)`, 
                opacity: 0 
              },
            },
          }}
        />
      ))}
    </Box>
  );
};

// Tab switch animation wrapper
export const TabSwitchWrapper = ({ children, direction = 'left', active }) => {
  return (
    <Box
      sx={{
        animation: active ? `slideIn${direction === 'left' ? 'Left' : 'Right'} 0.25s ease-out` : 'none',
        '@keyframes slideInLeft': {
          '0%': { transform: 'translateX(-20px)', opacity: 0 },
          '100%': { transform: 'translateX(0)', opacity: 1 },
        },
        '@keyframes slideInRight': {
          '0%': { transform: 'translateX(20px)', opacity: 0 },
          '100%': { transform: 'translateX(0)', opacity: 1 },
        },
      }}
    >
      {children}
    </Box>
  );
};

// Button press animation hook
export const usePressAnimation = () => {
  const [isPressed, setIsPressed] = useState(false);

  const pressProps = {
    onMouseDown: () => setIsPressed(true),
    onMouseUp: () => setIsPressed(false),
    onMouseLeave: () => setIsPressed(false),
    onTouchStart: () => setIsPressed(true),
    onTouchEnd: () => setIsPressed(false),
  };

  const pressStyle = {
    transform: isPressed ? 'scale(0.96)' : 'scale(1)',
    transition: 'transform 0.1s ease',
  };

  return { pressProps, pressStyle, isPressed };
};

// Points increment animation
export const AnimatedNumber = ({ value, duration = 500 }) => {
  const [displayValue, setDisplayValue] = useState(value);
  
  React.useEffect(() => {
    const startValue = displayValue;
    const endValue = value;
    const startTime = Date.now();
    
    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(startValue + (endValue - startValue) * easeProgress);
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    if (startValue !== endValue) {
      requestAnimationFrame(animate);
    }
  }, [value]);

  return <span>{displayValue}</span>;
};

// Streak fire animation
export const StreakFireAnimation = ({ streak, show }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!show || streak <= 0) return null;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        animation: 'streakPulse 2s ease-in-out infinite',
        '@keyframes streakPulse': {
          '0%, 100%': { 
            filter: 'drop-shadow(0 0 4px #F59E0B)', 
            transform: 'scale(1)' 
          },
          '50%': { 
            filter: 'drop-shadow(0 0 10px #F59E0B) drop-shadow(0 0 15px #EF4444)', 
            transform: 'scale(1.05)' 
          },
        },
      }}
    >
      🔥
    </Box>
  );
};

// Modal spring animation wrapper
export const ModalSpringWrapper = ({ children, open }) => {
  if (!open) return null;

  return (
    <Box
      sx={{
        animation: 'modalSpring 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        '@keyframes modalSpring': {
          '0%': { 
            transform: 'translateY(100%) scale(0.95)', 
            opacity: 0 
          },
          '100%': { 
            transform: 'translateY(0) scale(1)', 
            opacity: 1 
          },
        },
      }}
    >
      {children}
    </Box>
  );
};

// Success haptic feedback (visual alternative)
export const SuccessFeedback = ({ show, onComplete }) => {
  if (!show) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 100,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '8px 16px',
        borderRadius: '20px',
        background: 'linear-gradient(145deg, #166534 0%, #14532d 100%)',
        color: '#22C55E',
        fontSize: '0.875rem',
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 0 20px rgba(34, 197, 94, 0.2)',
        animation: 'feedbackPop 0.3s ease-out forwards, feedbackFade 0.3s ease-in 1.5s forwards',
        zIndex: 9999,
        '@keyframes feedbackPop': {
          '0%': { transform: 'translateX(-50%) translateY(20px) scale(0.8)', opacity: 0 },
          '100%': { transform: 'translateX(-50%) translateY(0) scale(1)', opacity: 1 },
        },
        '@keyframes feedbackFade': {
          '0%': { opacity: 1 },
          '100%': { opacity: 0 },
        },
      }}
      onAnimationEnd={(e) => {
        if (e.animationName === 'feedbackFade') {
          onComplete?.();
        }
      }}
    >
      ✓ Task completed!
    </Box>
  );
};

export default {
  useRipple,
  TaskCompleteAnimation,
  TabSwitchWrapper,
  usePressAnimation,
  AnimatedNumber,
  StreakFireAnimation,
  ModalSpringWrapper,
  SuccessFeedback,
};
