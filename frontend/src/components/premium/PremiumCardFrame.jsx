import React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePremium } from '../../context/PremiumContext';

/**
 * PremiumCardFrame - Ornate decorative frame for important cards
 * Based on the decorative frame image (images 11)
 * Styles: 'elegant', 'ornate', 'tech', 'minimal'
 */
const PremiumCardFrame = ({ 
  children, 
  style = 'elegant', // 'elegant' | 'ornate' | 'tech' | 'minimal'
  color = 'primary', // 'primary' | 'secondary' | 'accent' | 'gold'
  ...boxProps 
}) => {
  const { isGlobalPremium } = usePremium();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!isGlobalPremium) {
    return <Box {...boxProps}>{children}</Box>;
  }

  const colorMap = {
    primary: isDark ? '#60A5FA' : '#3B82F6',
    secondary: isDark ? '#8B5CF6' : '#7C3AED',
    accent: '#F59E0B',
    gold: '#FBBF24',
  };

  const frameColor = colorMap[color] || colorMap.primary;

  // SVG frame patterns
  const elegantFrame = (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
      viewBox="0 0 200 200"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="frameGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={frameColor} stopOpacity="0.8" />
          <stop offset="50%" stopColor={frameColor} stopOpacity="0.5" />
          <stop offset="100%" stopColor={frameColor} stopOpacity="0.8" />
        </linearGradient>
      </defs>
      
      {/* Top border with center ornament */}
      <path
        d="M 10 10 L 90 10 Q 100 10 100 5 Q 100 10 110 10 L 190 10"
        stroke="url(#frameGradient)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="100" cy="10" r="4" fill={frameColor} opacity="0.6" />
      
      {/* Right border with middle inward-outward curve */}
      <path
        d="M 190 10 L 190 90 Q 190 95 185 100 Q 190 105 190 110 L 190 190"
        stroke="url(#frameGradient)"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="185" cy="100" r="2" fill={frameColor} opacity="0.5" />
      
      {/* Bottom border */}
      <path
        d="M 190 190 L 10 190"
        stroke="url(#frameGradient)"
        strokeWidth="1.5"
        fill="none"
      />
      
      {/* Left border with middle inward-outward curve */}
      <path
        d="M 10 190 L 10 110 Q 10 105 15 100 Q 10 95 10 90 L 10 10"
        stroke="url(#frameGradient)"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="15" cy="100" r="2" fill={frameColor} opacity="0.5" />
      
      {/* Corner ornaments */}
      <circle cx="10" cy="10" r="2" fill={frameColor} opacity="0.8" />
      <circle cx="190" cy="10" r="2" fill={frameColor} opacity="0.8" />
      <circle cx="190" cy="190" r="2" fill={frameColor} opacity="0.8" />
      <circle cx="10" cy="190" r="2" fill={frameColor} opacity="0.8" />
    </svg>
  );

  const ornateFrame = (
    <svg
      style={{
        position: 'absolute',
        inset: '-5px',
        width: 'calc(100% + 10px)',
        height: 'calc(100% + 10px)',
        pointerEvents: 'none',
        zIndex: 1,
      }}
      viewBox="0 0 210 210"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="ornateGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={frameColor} stopOpacity="0.9" />
          <stop offset="50%" stopColor={frameColor} stopOpacity="0.6" />
          <stop offset="100%" stopColor={frameColor} stopOpacity="0.9" />
        </linearGradient>
      </defs>
      
      {/* Ornate top border */}
      <path
        d="M 15 15 L 75 15 Q 85 15 90 10 L 95 15 Q 100 10 105 15 L 110 10 Q 115 15 120 15 L 195 15"
        stroke="url(#ornateGradient)"
        strokeWidth="2"
        fill="none"
      />
      
      {/* Decorative top corners */}
      <path
        d="M 15 15 Q 10 15 10 20 M 195 15 Q 200 15 200 20"
        stroke="url(#ornateGradient)"
        strokeWidth="2"
        fill="none"
      />
      
      {/* Right border with middle inward-outward curve */}
      <path
        d="M 200 20 L 200 95 Q 200 100 194 105 Q 200 110 200 115 L 200 190 Q 200 195 195 195"
        stroke="url(#ornateGradient)"
        strokeWidth="2"
        fill="none"
      />
      <circle cx="194" cy="105" r="2.5" fill={frameColor} opacity="0.6" />
      
      {/* Bottom border */}
      <path
        d="M 195 195 L 15 195 Q 10 195 10 190"
        stroke="url(#ornateGradient)"
        strokeWidth="2"
        fill="none"
      />
      
      {/* Left border with middle inward-outward curve */}
      <path
        d="M 10 190 L 10 115 Q 10 110 16 105 Q 10 100 10 95 L 10 20"
        stroke="url(#ornateGradient)"
        strokeWidth="2"
        fill="none"
      />
      <circle cx="16" cy="105" r="2.5" fill={frameColor} opacity="0.6" />
      
      {/* Corner decorations */}
      <circle cx="15" cy="15" r="3" fill={frameColor} opacity="0.7" />
      <circle cx="105" cy="12" r="4" fill={frameColor} opacity="0.8" />
      <circle cx="195" cy="15" r="3" fill={frameColor} opacity="0.7" />
      <circle cx="195" cy="195" r="3" fill={frameColor} opacity="0.7" />
      <circle cx="15" cy="195" r="3" fill={frameColor} opacity="0.7" />
    </svg>
  );

  const techFrame = (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
      viewBox="0 0 200 200"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="techGradient">
          <stop offset="0%" stopColor={frameColor} stopOpacity="0.8" />
          <stop offset="100%" stopColor={frameColor} stopOpacity="0.3" />
        </linearGradient>
      </defs>
      
      {/* Tech corners - L-shaped brackets */}
      <path d="M 8 8 L 8 25 M 8 8 L 25 8" stroke="url(#techGradient)" strokeWidth="2" />
      <path d="M 192 8 L 192 25 M 192 8 L 175 8" stroke="url(#techGradient)" strokeWidth="2" />
      <path d="M 192 192 L 192 175 M 192 192 L 175 192" stroke="url(#techGradient)" strokeWidth="2" />
      <path d="M 8 192 L 8 175 M 8 192 L 25 192" stroke="url(#techGradient)" strokeWidth="2" />
      
      {/* Scan lines */}
      <line x1="30" y1="8" x2="80" y2="8" stroke={frameColor} strokeWidth="1" opacity="0.4" />
      <line x1="120" y1="8" x2="170" y2="8" stroke={frameColor} strokeWidth="1" opacity="0.4" />
      
      {/* Small indicator dots */}
      <circle cx="15" cy="15" r="1.5" fill={frameColor}>
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="185" cy="15" r="1.5" fill={frameColor}>
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" begin="0.5s" />
      </circle>
    </svg>
  );

  const frames = {
    elegant: elegantFrame,
    ornate: ornateFrame,
    tech: techFrame,
    minimal: elegantFrame, // Use elegant but simpler
  };

  return (
    <Box
      {...boxProps}
      sx={{
        position: 'relative',
        ...boxProps.sx,
      }}
    >
      {frames[style]}
      <Box sx={{ position: 'relative', zIndex: 0 }}>
        {children}
      </Box>
    </Box>
  );
};

export default PremiumCardFrame;
