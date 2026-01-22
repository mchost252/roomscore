import React, { useEffect, useState } from 'react';
import { Card, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePremium } from '../../context/PremiumContext';

/**
 * AnimatedCard - Card with premium slide-up entrance and glass effect
 * Supports staggered animation with delay prop
 */
const AnimatedCard = ({ 
  children, 
  delay = 0, 
  staggerIndex = 0,
  enableHover = true,
  glassEffect = true,
  ...cardProps 
}) => {
  const { isGlobalPremium } = usePremium();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [isVisible, setIsVisible] = useState(!isGlobalPremium);

  useEffect(() => {
    if (!isGlobalPremium) {
      setIsVisible(true);
      return;
    }

    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay + (staggerIndex * 80));

    return () => clearTimeout(timer);
  }, [delay, staggerIndex, isGlobalPremium]);

  const baseClass = isGlobalPremium && isVisible ? 'premium-card-enter' : '';
  const hoverClass = isGlobalPremium && enableHover ? 'premium-card-hover' : '';
  const glassClass = isGlobalPremium && glassEffect 
    ? (isDark ? 'premium-card-glass' : 'premium-card-glass-light')
    : '';

  return (
    <Card
      {...cardProps}
      className={`${baseClass} ${hoverClass} ${glassClass} ${cardProps.className || ''}`}
      sx={{
        opacity: isGlobalPremium ? (isVisible ? 1 : 0) : 1,
        animationDelay: isGlobalPremium ? `${delay + (staggerIndex * 80)}ms` : '0ms',
        transition: isGlobalPremium 
          ? 'transform 0.2s ease, box-shadow 0.2s ease, opacity 0.4s ease' 
          : 'none',
        ...cardProps.sx,
      }}
    >
      {children}
    </Card>
  );
};

export default AnimatedCard;
