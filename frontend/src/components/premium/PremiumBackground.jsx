import React, { useMemo, useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePremium } from '../../context/PremiumContext';

/**
 * PremiumBackground - Animated space/nebula background with floating stars
 * Renders subtle nebula gradients and twinkling star particles
 * Performance optimized for mobile devices
 */
const PremiumBackground = () => {
  const { isGlobalPremium } = usePremium();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [isVisible, setIsVisible] = useState(false);

  // Fade in when premium activates
  useEffect(() => {
    if (isGlobalPremium) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isGlobalPremium]);

  // Generate random stars - memoized for performance
  const stars = useMemo(() => {
    if (!isGlobalPremium) return [];
    
    // Check if window is available (client-side)
    if (typeof window === 'undefined') return [];
    
    const starCount = window.innerWidth < 600 ? 40 : 70; // More stars!
    return Array.from({ length: starCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() > 0.6 ? 'large' : 'normal', // More large stars
      type: Math.random() > 0.6 ? (Math.random() > 0.5 ? 'blue' : 'gold') : 'white', // More colored stars
      delay: Math.random() * 5,
      duration: 2 + Math.random() * 3,
    }));
  }, [isGlobalPremium]);

  // Generate shooting stars occasionally
  const [shootingStar, setShootingStar] = useState(null);

  useEffect(() => {
    if (!isGlobalPremium) return;

    const createShootingStar = () => {
      setShootingStar({
        id: Date.now(),
        x: 20 + Math.random() * 60,
        y: Math.random() * 30,
      });

      // Clear after animation
      setTimeout(() => setShootingStar(null), 1000);
    };

    // Random shooting star every 8-15 seconds
    const interval = setInterval(() => {
      if (Math.random() > 0.5) {
        createShootingStar();
      }
    }, 8000 + Math.random() * 7000);

    return () => clearInterval(interval);
  }, [isGlobalPremium]);

  if (!isGlobalPremium) return null;

  return (
    <>
      {/* Nebula gradient layer with parallax */}
      <Box
        className={`premium-nebula-bg ${isDark ? 'premium-nebula-bg--dark' : 'premium-nebula-bg--light'}`}
        sx={{
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.8s ease-in-out',
          zIndex: 0,
          // Add subtle drift for "moving" effect
          '&::before': {
            animation: 'nebulaRotate 120s linear infinite, nebulaDrift 60s ease-in-out infinite',
          },
        }}
      />

      {/* Stars layer */}
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

        {/* Shooting star */}
        {shootingStar && (
          <Box
            key={shootingStar.id}
            sx={{
              position: 'absolute',
              left: `${shootingStar.x}%`,
              top: `${shootingStar.y}%`,
              width: '2px',
              height: '2px',
              background: 'white',
              borderRadius: '50%',
              boxShadow: '0 0 6px #fff, 0 0 10px #60A5FA',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: '50%',
                right: '100%',
                width: '50px',
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8))',
                transform: 'translateY(-50%)',
              },
              animation: 'shootingStar 1s ease-out forwards',
            }}
          />
        )}
      </Box>

      {/* Second nebula layer for parallax depth - moves differently */}
      <Box
        sx={{
          position: 'fixed',
          inset: '-20%',
          width: '140%',
          height: '140%',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: isVisible ? 0.5 : 0,
          transition: 'opacity 0.8s ease-in-out',
          background: isDark
            ? `radial-gradient(ellipse at 60% 40%, rgba(139, 92, 246, 0.2) 0%, transparent 40%),
               radial-gradient(ellipse at 25% 75%, rgba(236, 72, 153, 0.18) 0%, transparent 45%)`
            : `radial-gradient(ellipse at 60% 40%, rgba(139, 92, 246, 0.1) 0%, transparent 40%),
               radial-gradient(ellipse at 25% 75%, rgba(236, 72, 153, 0.08) 0%, transparent 45%)`,
          animation: 'nebulaDrift 45s ease-in-out infinite reverse',
        }}
      />

      {/* Third layer - slower, adds more depth */}
      <Box
        sx={{
          position: 'fixed',
          inset: '-30%',
          width: '160%',
          height: '160%',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: isVisible ? 0.3 : 0,
          transition: 'opacity 0.8s ease-in-out',
          background: isDark
            ? `radial-gradient(ellipse at 80% 20%, rgba(56, 189, 248, 0.15) 0%, transparent 35%),
               radial-gradient(ellipse at 10% 60%, rgba(251, 146, 60, 0.12) 0%, transparent 40%)`
            : `radial-gradient(ellipse at 80% 20%, rgba(56, 189, 248, 0.08) 0%, transparent 35%),
               radial-gradient(ellipse at 10% 60%, rgba(251, 146, 60, 0.06) 0%, transparent 40%)`,
          animation: 'nebulaDrift 80s ease-in-out infinite',
        }}
      />

      {/* Subtle vignette for depth */}
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          background: isDark
            ? 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)'
            : 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.08) 100%)',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 1s ease-in-out',
        }}
      />
    </>
  );
};

export default PremiumBackground;
