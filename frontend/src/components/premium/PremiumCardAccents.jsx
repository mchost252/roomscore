import React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePremium } from '../../context/PremiumContext';

/**
 * PremiumCardAccents - Adds HUD-style corner brackets and coordinates
 * This component adds the "tech/cyber" aesthetic to cards
 */
const PremiumCardAccents = ({ showCoordinates = true, sector = null }) => {
  const { isGlobalPremium } = usePremium();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!isGlobalPremium) return null;

  // Generate random sector if not provided
  const sectorId = sector || `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 99) + 1}`;

  return (
    <>
      {/* Top-left corner bracket */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          width: 16,
          height: 16,
          borderTop: `2px solid ${isDark ? 'rgba(96, 165, 250, 0.4)' : 'rgba(99, 102, 241, 0.35)'}`,
          borderLeft: `2px solid ${isDark ? 'rgba(96, 165, 250, 0.4)' : 'rgba(99, 102, 241, 0.35)'}`,
          pointerEvents: 'none',
          zIndex: 3,
          opacity: 0.7,
        }}
      />

      {/* Top-right corner bracket */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 16,
          height: 16,
          borderTop: `2px solid ${isDark ? 'rgba(96, 165, 250, 0.4)' : 'rgba(99, 102, 241, 0.35)'}`,
          borderRight: `2px solid ${isDark ? 'rgba(96, 165, 250, 0.4)' : 'rgba(99, 102, 241, 0.35)'}`,
          pointerEvents: 'none',
          zIndex: 3,
          opacity: 0.7,
        }}
      />

      {/* Bottom-left corner bracket */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          width: 16,
          height: 16,
          borderBottom: `2px solid ${isDark ? 'rgba(96, 165, 250, 0.4)' : 'rgba(99, 102, 241, 0.35)'}`,
          borderLeft: `2px solid ${isDark ? 'rgba(96, 165, 250, 0.4)' : 'rgba(99, 102, 241, 0.35)'}`,
          pointerEvents: 'none',
          zIndex: 3,
          opacity: 0.7,
        }}
      />

      {/* Bottom-right corner bracket */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          width: 16,
          height: 16,
          borderBottom: `2px solid ${isDark ? 'rgba(96, 165, 250, 0.4)' : 'rgba(99, 102, 241, 0.35)'}`,
          borderRight: `2px solid ${isDark ? 'rgba(96, 165, 250, 0.4)' : 'rgba(99, 102, 241, 0.35)'}`,
          pointerEvents: 'none',
          zIndex: 3,
          opacity: 0.7,
        }}
      />

      {/* Coordinate label - top right */}
      {showCoordinates && (
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            right: 32,
            fontSize: '0.6rem',
            fontFamily: 'monospace',
            fontWeight: 600,
            color: isDark ? 'rgba(96, 165, 250, 0.5)' : 'rgba(99, 102, 241, 0.4)',
            letterSpacing: 1,
            pointerEvents: 'none',
            zIndex: 3,
            opacity: 0.6,
          }}
        >
          {sectorId}
        </Box>
      )}
    </>
  );
};

export default PremiumCardAccents;
