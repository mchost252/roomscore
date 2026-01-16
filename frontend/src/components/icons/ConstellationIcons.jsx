import React from 'react';
import { useTheme as useMuiTheme } from '@mui/material/styles';

/**
 * Constellation-themed SVG icons for Krios gamification system
 * Inspired by the app logo - stars connected by luminous lines
 * 
 * Color scheme:
 * - Cyan/Blue glow (#60A5FA) - Active states, cool highlights
 * - Gold/Amber glow (#F59E0B) - Achievements, warm highlights
 * - Deep navy background (#0f172a) - Space theme
 */

// Animated glow filter for SVG elements
const GlowFilter = ({ id, color = '#60A5FA', intensity = 1 }) => (
  <defs>
    <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation={2 * intensity} result="blur" />
      <feFlood floodColor={color} floodOpacity={0.8} result="color" />
      <feComposite in="color" in2="blur" operator="in" result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <radialGradient id={`${id}-gradient`} cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
      <stop offset="40%" stopColor={color} stopOpacity="0.9" />
      <stop offset="100%" stopColor={color} stopOpacity="0" />
    </radialGradient>
  </defs>
);

// ============================================
// 🌟 ORBIT SUMMARY ICON - Shows orbital rings with stars
// ============================================
export const OrbitSummaryIcon = ({ size = 24, active = true, animated = false }) => {
  const theme = useMuiTheme();
  const primaryColor = active ? '#60A5FA' : theme.palette.text.secondary;
  const secondaryColor = active ? '#F59E0B' : theme.palette.text.disabled;
  
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <GlowFilter id="orbit-glow" color={primaryColor} />
      
      {/* Orbital rings */}
      <ellipse 
        cx="24" cy="24" rx="20" ry="8" 
        stroke={primaryColor} 
        strokeWidth="1.5" 
        strokeOpacity="0.4"
        fill="none"
        transform="rotate(-20 24 24)"
      />
      <ellipse 
        cx="24" cy="24" rx="16" ry="16" 
        stroke={primaryColor} 
        strokeWidth="1" 
        strokeOpacity="0.3"
        fill="none"
        strokeDasharray="4 4"
      />
      
      {/* Center star (main) */}
      <circle 
        cx="24" cy="24" r="4" 
        fill={`url(#orbit-glow-gradient)`}
        filter="url(#orbit-glow)"
      />
      
      {/* Orbiting stars */}
      <circle 
        cx="40" cy="20" r="2.5" 
        fill={secondaryColor}
        filter="url(#orbit-glow)"
        style={animated ? { animation: 'orbit-pulse 2s ease-in-out infinite' } : {}}
      />
      <circle 
        cx="8" cy="28" r="2" 
        fill={primaryColor}
        filter="url(#orbit-glow)"
        style={animated ? { animation: 'orbit-pulse 2s ease-in-out infinite 0.5s' } : {}}
      />
      <circle 
        cx="30" cy="38" r="1.5" 
        fill={primaryColor}
        filter="url(#orbit-glow)"
        style={animated ? { animation: 'orbit-pulse 2s ease-in-out infinite 1s' } : {}}
      />
      
      {/* Connection lines */}
      <line x1="24" y1="24" x2="40" y2="20" stroke={primaryColor} strokeWidth="0.5" strokeOpacity="0.5" />
      <line x1="24" y1="24" x2="8" y2="28" stroke={primaryColor} strokeWidth="0.5" strokeOpacity="0.5" />
      
      <style>
        {`
          @keyframes orbit-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.2); }
          }
        `}
      </style>
    </svg>
  );
};

// ============================================
// 👑 MVP CROWN ICON - Constellation crown with stars
// ============================================
export const MVPCrownIcon = ({ size = 24, glowing = true, animated = false }) => {
  const goldColor = '#F59E0B';
  const goldLight = '#FBBF24';
  
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="crown-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feFlood floodColor={goldColor} floodOpacity="0.6" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="crown-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={goldLight} />
          <stop offset="100%" stopColor={goldColor} />
        </linearGradient>
        <radialGradient id="crown-star-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor={goldLight} />
          <stop offset="100%" stopColor={goldColor} />
        </radialGradient>
      </defs>
      
      {/* Crown base shape - constellation style */}
      <path 
        d="M8 36 L12 18 L18 26 L24 12 L30 26 L36 18 L40 36 Z"
        fill="url(#crown-gradient)"
        stroke={goldLight}
        strokeWidth="1.5"
        filter={glowing ? "url(#crown-glow)" : undefined}
        style={animated ? { animation: 'crown-shimmer 3s ease-in-out infinite' } : {}}
      />
      
      {/* Star points on crown peaks */}
      <circle cx="24" cy="12" r="3" fill="url(#crown-star-gradient)" filter="url(#crown-glow)" />
      <circle cx="12" cy="18" r="2" fill="url(#crown-star-gradient)" filter="url(#crown-glow)" />
      <circle cx="36" cy="18" r="2" fill="url(#crown-star-gradient)" filter="url(#crown-glow)" />
      
      {/* Connection lines (constellation effect) */}
      <line x1="12" y1="18" x2="24" y2="12" stroke={goldLight} strokeWidth="1" strokeOpacity="0.6" />
      <line x1="36" y1="18" x2="24" y2="12" stroke={goldLight} strokeWidth="1" strokeOpacity="0.6" />
      
      {/* Small accent stars */}
      <circle cx="18" cy="26" r="1.5" fill={goldLight} />
      <circle cx="30" cy="26" r="1.5" fill={goldLight} />
      
      <style>
        {`
          @keyframes crown-shimmer {
            0%, 100% { filter: url(#crown-glow) brightness(1); }
            50% { filter: url(#crown-glow) brightness(1.2); }
          }
        `}
      </style>
    </svg>
  );
};

// ============================================
// 🔥 STREAK FLAME ICON - Constellation fire
// ============================================
export const StreakFlameIcon = ({ size = 24, streak = 0, animated = false }) => {
  const theme = useMuiTheme();
  const isActive = streak > 0;
  const intensity = Math.min(streak / 7, 1); // Max intensity at 7+ days
  const orangeColor = isActive ? '#F59E0B' : theme.palette.text.disabled;
  const redColor = isActive ? '#EF4444' : theme.palette.text.disabled;
  
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="flame-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={1.5 + intensity} result="blur" />
          <feFlood floodColor={orangeColor} floodOpacity={0.5 + intensity * 0.3} result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="flame-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={redColor} />
          <stop offset="50%" stopColor={orangeColor} />
          <stop offset="100%" stopColor="#FBBF24" />
        </linearGradient>
      </defs>
      
      {/* Main flame shape - stylized as connected stars */}
      <path 
        d="M24 6 C24 6 32 16 32 26 C32 32 28 38 24 42 C20 38 16 32 16 26 C16 16 24 6 24 6 Z"
        fill="url(#flame-gradient)"
        filter={isActive ? "url(#flame-glow)" : undefined}
        opacity={isActive ? 1 : 0.4}
        style={animated && isActive ? { animation: 'flame-flicker 1.5s ease-in-out infinite' } : {}}
      />
      
      {/* Star points representing flame tips */}
      {isActive && (
        <>
          <circle cx="24" cy="10" r="2" fill="#FBBF24" filter="url(#flame-glow)" />
          <circle cx="20" cy="20" r="1.5" fill={orangeColor} opacity="0.8" />
          <circle cx="28" cy="18" r="1.5" fill={orangeColor} opacity="0.8" />
        </>
      )}
      
      {/* Inner core */}
      <ellipse 
        cx="24" cy="30" rx="4" ry="6" 
        fill={isActive ? '#FBBF24' : theme.palette.text.disabled}
        opacity={isActive ? 0.8 : 0.3}
      />
      
      <style>
        {`
          @keyframes flame-flicker {
            0%, 100% { transform: scaleY(1) translateY(0); }
            25% { transform: scaleY(1.03) translateY(-1px); }
            50% { transform: scaleY(0.97) translateY(1px); }
            75% { transform: scaleY(1.02) translateY(-0.5px); }
          }
        `}
      </style>
    </svg>
  );
};

// ============================================
// ⭐ STAR APPRECIATION ICON
// ============================================
export const StarAppreciationIcon = ({ size = 24, filled = true, glowing = true }) => {
  const blueColor = '#60A5FA';
  
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="star-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feFlood floodColor={blueColor} floodOpacity="0.6" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="star-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor={blueColor} />
        </radialGradient>
      </defs>
      
      {/* Five-pointed star */}
      <path 
        d="M24 4 L28 18 L44 18 L31 28 L36 44 L24 34 L12 44 L17 28 L4 18 L20 18 Z"
        fill={filled ? "url(#star-gradient)" : "none"}
        stroke={blueColor}
        strokeWidth="2"
        filter={glowing ? "url(#star-glow)" : undefined}
      />
      
      {/* Center glow point */}
      {filled && <circle cx="24" cy="22" r="4" fill="#ffffff" opacity="0.6" />}
    </svg>
  );
};

// ============================================
// 🛡️ SHIELD APPRECIATION ICON
// ============================================
export const ShieldAppreciationIcon = ({ size = 24, filled = true, glowing = true }) => {
  const blueColor = '#60A5FA';
  const cyanColor = '#22D3EE';
  
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shield-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feFlood floodColor={cyanColor} floodOpacity="0.5" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="shield-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={cyanColor} />
          <stop offset="100%" stopColor={blueColor} />
        </linearGradient>
      </defs>
      
      {/* Shield shape */}
      <path 
        d="M24 4 L40 10 L40 24 C40 34 32 42 24 46 C16 42 8 34 8 24 L8 10 Z"
        fill={filled ? "url(#shield-gradient)" : "none"}
        stroke={cyanColor}
        strokeWidth="2"
        filter={glowing ? "url(#shield-glow)" : undefined}
      />
      
      {/* Inner star constellation */}
      {filled && (
        <>
          <circle cx="24" cy="18" r="2" fill="#ffffff" opacity="0.8" />
          <circle cx="18" cy="26" r="1.5" fill="#ffffff" opacity="0.6" />
          <circle cx="30" cy="26" r="1.5" fill="#ffffff" opacity="0.6" />
          <line x1="24" y1="18" x2="18" y2="26" stroke="#ffffff" strokeWidth="1" opacity="0.4" />
          <line x1="24" y1="18" x2="30" y2="26" stroke="#ffffff" strokeWidth="1" opacity="0.4" />
          <line x1="18" y1="26" x2="30" y2="26" stroke="#ffffff" strokeWidth="1" opacity="0.4" />
        </>
      )}
    </svg>
  );
};

// ============================================
// 🔥 FIRE APPRECIATION ICON (different from streak)
// ============================================
export const FireAppreciationIcon = ({ size = 24, filled = true, glowing = true }) => {
  const orangeColor = '#F59E0B';
  const redColor = '#EF4444';
  
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="fire-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feFlood floodColor={orangeColor} floodOpacity="0.6" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="fire-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={redColor} />
          <stop offset="60%" stopColor={orangeColor} />
          <stop offset="100%" stopColor="#FBBF24" />
        </linearGradient>
      </defs>
      
      {/* Flame shape */}
      <path 
        d="M24 4 C18 12 14 18 14 26 C14 34 18 40 24 44 C30 40 34 34 34 26 C34 18 30 12 24 4 Z M24 14 C28 18 30 22 30 28 C30 32 27 36 24 38 C21 36 18 32 18 28 C18 22 20 18 24 14 Z"
        fill={filled ? "url(#fire-gradient)" : "none"}
        stroke={orangeColor}
        strokeWidth="2"
        filter={glowing ? "url(#fire-glow)" : undefined}
        fillRule="evenodd"
      />
      
      {/* Inner bright core */}
      {filled && (
        <ellipse cx="24" cy="30" rx="4" ry="6" fill="#FBBF24" opacity="0.9" />
      )}
    </svg>
  );
};

// ============================================
// 🌑 INACTIVE/DIM ICON - For inactive members
// ============================================
export const InactiveStarIcon = ({ size = 24 }) => {
  const theme = useMuiTheme();
  const dimColor = theme.palette.mode === 'dark' ? '#475569' : '#94a3b8';
  
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Dim circular shape */}
      <circle 
        cx="24" cy="24" r="16" 
        fill="none"
        stroke={dimColor}
        strokeWidth="2"
        strokeDasharray="4 4"
        opacity="0.5"
      />
      
      {/* Faded star in center */}
      <circle cx="24" cy="24" r="6" fill={dimColor} opacity="0.3" />
      <circle cx="24" cy="24" r="2" fill={dimColor} opacity="0.5" />
    </svg>
  );
};

// ============================================
// ✨ ORBIT STABLE ICON - Room has activity
// ============================================
export const OrbitStableIcon = ({ size = 24, animated = false }) => {
  const blueColor = '#60A5FA';
  const goldColor = '#F59E0B';
  
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="stable-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
          <feFlood floodColor={blueColor} floodOpacity="0.5" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      {/* Orbital ring */}
      <circle 
        cx="24" cy="24" r="18" 
        fill="none"
        stroke={blueColor}
        strokeWidth="2"
        opacity="0.6"
      />
      
      {/* Center bright star */}
      <circle cx="24" cy="24" r="6" fill={goldColor} filter="url(#stable-glow)" />
      <circle cx="24" cy="24" r="3" fill="#ffffff" opacity="0.8" />
      
      {/* Orbiting stars */}
      <g style={animated ? { animation: 'orbit-rotate 8s linear infinite', transformOrigin: '24px 24px' } : {}}>
        <circle cx="42" cy="24" r="3" fill={blueColor} filter="url(#stable-glow)" />
        <circle cx="6" cy="24" r="2.5" fill={blueColor} filter="url(#stable-glow)" />
      </g>
      
      {/* Checkmark overlay */}
      <path 
        d="M18 24 L22 28 L30 18" 
        stroke="#22c55e" 
        strokeWidth="3" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        fill="none"
      />
      
      <style>
        {`
          @keyframes orbit-rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </svg>
  );
};

// ============================================
// 🌑 ORBIT DIMMED ICON - Room had no activity
// ============================================
export const OrbitDimmedIcon = ({ size = 24 }) => {
  const theme = useMuiTheme();
  const dimColor = theme.palette.mode === 'dark' ? '#475569' : '#94a3b8';
  
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Dim orbital ring */}
      <circle 
        cx="24" cy="24" r="18" 
        fill="none"
        stroke={dimColor}
        strokeWidth="2"
        strokeDasharray="6 4"
        opacity="0.4"
      />
      
      {/* Dim center */}
      <circle cx="24" cy="24" r="8" fill={dimColor} opacity="0.2" />
      <circle cx="24" cy="24" r="4" fill={dimColor} opacity="0.4" />
      
      {/* Moon crescent to indicate "dimmed" */}
      <path 
        d="M28 16 C22 18 20 24 22 30 C18 28 16 24 18 18 C20 14 26 14 28 16 Z"
        fill={dimColor}
        opacity="0.5"
      />
    </svg>
  );
};

// ============================================
// 🔔 NUDGE ICON - Constellation bell
// ============================================
export const NudgeIcon = ({ size = 24, active = true }) => {
  const theme = useMuiTheme();
  const color = active ? '#60A5FA' : theme.palette.text.disabled;
  
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="nudge-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
          <feFlood floodColor={color} floodOpacity="0.5" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      {/* Bell shape */}
      <path 
        d="M24 6 C24 6 26 6 26 8 L26 10 C32 12 36 18 36 24 L36 32 L40 36 L8 36 L12 32 L12 24 C12 18 16 12 22 10 L22 8 C22 6 24 6 24 6 Z"
        fill={color}
        filter={active ? "url(#nudge-glow)" : undefined}
        opacity={active ? 1 : 0.4}
      />
      
      {/* Bell clapper */}
      <circle cx="24" cy="40" r="4" fill={color} opacity={active ? 1 : 0.4} />
      
      {/* Star accents */}
      {active && (
        <>
          <circle cx="40" cy="14" r="2" fill="#F59E0B" filter="url(#nudge-glow)" />
          <circle cx="8" cy="18" r="1.5" fill="#F59E0B" filter="url(#nudge-glow)" />
        </>
      )}
    </svg>
  );
};

// ============================================
// 🏆 ACHIEVEMENT BADGE ICON (Future/Locked)
// ============================================
export const LockedBadgeIcon = ({ size = 24 }) => {
  const theme = useMuiTheme();
  const dimColor = theme.palette.mode === 'dark' ? '#475569' : '#94a3b8';
  
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Hexagon badge shape */}
      <path 
        d="M24 4 L42 14 L42 34 L24 44 L6 34 L6 14 Z"
        fill="none"
        stroke={dimColor}
        strokeWidth="2"
        strokeDasharray="4 4"
        opacity="0.5"
      />
      
      {/* Lock icon in center */}
      <rect x="18" y="22" width="12" height="10" rx="2" fill={dimColor} opacity="0.4" />
      <path 
        d="M20 22 L20 18 C20 14 28 14 28 18 L28 22"
        stroke={dimColor}
        strokeWidth="2"
        fill="none"
        opacity="0.4"
      />
      
      {/* Question mark */}
      <text x="24" y="30" textAnchor="middle" fill={dimColor} fontSize="8" fontWeight="bold" opacity="0.6">?</text>
    </svg>
  );
};

export default {
  OrbitSummaryIcon,
  MVPCrownIcon,
  StreakFlameIcon,
  StarAppreciationIcon,
  ShieldAppreciationIcon,
  FireAppreciationIcon,
  InactiveStarIcon,
  OrbitStableIcon,
  OrbitDimmedIcon,
  NudgeIcon,
  LockedBadgeIcon,
};
