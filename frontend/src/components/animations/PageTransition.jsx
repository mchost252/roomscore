import React, { useEffect, useState, useRef } from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { usePremium } from '../../context/PremiumContext';

/**
 * PageTransition - Wraps page content with premium fade + scale animation
 * Only applies animation when global premium is active
 */
const PageTransition = ({ children }) => {
  const { isGlobalPremium } = usePremium();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [animationClass, setAnimationClass] = useState('');
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (!isGlobalPremium) {
      setIsVisible(true);
      setAnimationClass('');
      return;
    }

    // If path changed, trigger exit then enter animation
    if (prevPathRef.current !== location.pathname) {
      setAnimationClass('premium-page-exit');
      
      const exitTimer = setTimeout(() => {
        setAnimationClass('premium-page-enter');
        prevPathRef.current = location.pathname;
      }, 250);

      return () => clearTimeout(exitTimer);
    } else {
      // Initial mount
      setAnimationClass('premium-page-enter');
    }

    setIsVisible(true);
  }, [location.pathname, isGlobalPremium]);

  if (!isGlobalPremium) {
    return <>{children}</>;
  }

  return (
    <Box
      className={animationClass}
      sx={{
        width: '100%',
        height: '100%',
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </Box>
  );
};

export default PageTransition;
