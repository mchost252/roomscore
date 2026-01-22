import React, { useEffect, useState, useRef } from 'react';
import { Typography } from '@mui/material';
import { usePremium } from '../../context/PremiumContext';

/**
 * AnimatedNumber - Animates number counting up from 0 to target value
 * Only animates when premium is active
 */
const AnimatedNumber = ({ 
  value, 
  duration = 800, 
  prefix = '', 
  suffix = '',
  decimals = 0,
  ...typographyProps 
}) => {
  const { isGlobalPremium } = usePremium();
  const [displayValue, setDisplayValue] = useState(0);
  const animationRef = useRef(null);
  const startTimeRef = useRef(null);
  const startValueRef = useRef(0);

  useEffect(() => {
    const targetValue = typeof value === 'number' ? value : parseFloat(value) || 0;

    if (!isGlobalPremium) {
      setDisplayValue(targetValue);
      return;
    }

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    startValueRef.current = displayValue;
    startTimeRef.current = null;

    const animate = (timestamp) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = startValueRef.current + (targetValue - startValueRef.current) * easeOut;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, isGlobalPremium]);

  const formattedValue = decimals > 0 
    ? displayValue.toFixed(decimals) 
    : Math.round(displayValue);

  return (
    <Typography
      {...typographyProps}
      className={isGlobalPremium ? 'premium-number' : ''}
      sx={{
        ...typographyProps.sx,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {prefix}{formattedValue}{suffix}
    </Typography>
  );
};

export default AnimatedNumber;
