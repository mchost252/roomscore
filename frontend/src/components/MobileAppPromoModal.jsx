import React, { useState, useEffect } from 'react';
import {
  Dialog,
  Box,
  IconButton,
  Typography,
  Fade,
  Zoom,
  keyframes,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

// ─── Keyframe animations (game-ad style) ───
const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(123, 97, 255, 0.4), 0 0 60px rgba(123, 97, 255, 0.1); }
  50% { box-shadow: 0 0 30px rgba(123, 97, 255, 0.7), 0 0 80px rgba(123, 97, 255, 0.2); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const floatIn = keyframes`
  0% { transform: scale(0.7) translateY(40px); opacity: 0; }
  60% { transform: scale(1.03) translateY(-5px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
`;

const closeButtonPulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
`;

const MobileAppPromoModal = ({ open, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [showClose, setShowClose] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Game-ad style: show close button after 3 second countdown
  useEffect(() => {
    if (!open) {
      setShowClose(false);
      setCountdown(3);
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowClose(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={showClose ? onClose : undefined}
      maxWidth={false}
      disableEscapeKeyDown={!showClose}
      PaperProps={{
        sx: {
          background: 'transparent',
          boxShadow: 'none',
          overflow: 'visible',
          m: { xs: 1, sm: 2 },
          maxWidth: { xs: '95vw', sm: '85vw', md: '900px' },
          maxHeight: { xs: '90vh', sm: '85vh' },
          borderRadius: '20px',
        },
      }}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
          },
        },
      }}
    >
      <Zoom in={open} timeout={500} style={{ transitionDelay: '100ms' }}>
        <Box
          sx={{
            position: 'relative',
            borderRadius: '20px',
            overflow: 'hidden',
            // Combine animations into a single shorthand to avoid conflicts
            animation: `${floatIn} 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, ${pulseGlow} 2s ease-in-out infinite`,
            // Outer glow border
            border: '2px solid rgba(123, 97, 255, 0.5)',
            minHeight: '200px',
            minWidth: '300px',
            backgroundColor: '#0a0a0f', // Dark background in case image fails/loads slow
          }}
        >
          {/* Close button / countdown - top right */}
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 10,
            }}
          >
            {showClose ? (
              <Fade in={showClose}>
                <IconButton
                  onClick={onClose}
                  sx={{
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    color: '#fff',
                    width: 40,
                    height: 40,
                    animation: `${closeButtonPulse} 1.5s ease-in-out 3`,
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      border: '2px solid rgba(255, 255, 255, 0.6)',
                      transform: 'scale(1.15)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Fade>
            ) : (
              // Countdown circle
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  border: '2px solid rgba(123, 97, 255, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography
                  sx={{
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                  }}
                >
                  {countdown}
                </Typography>
              </Box>
            )}
          </Box>

          {/* The ad image */}
          <Box
            component="img"
            src="/krios-mobile-ad.png"
            alt="Krios Mobile - Coming Soon"
            sx={{
              width: '100%',
              height: 'auto',
              display: 'block',
              maxHeight: { xs: '80vh', sm: '75vh' },
              objectFit: 'contain',
            }}
          />

          {/* Bottom shimmer bar - like game ads have */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: `linear-gradient(90deg, transparent, rgba(123, 97, 255, 0.8), rgba(167, 139, 250, 0.9), rgba(123, 97, 255, 0.8), transparent)`,
              backgroundSize: '200% auto',
              animation: `${shimmer} 2s linear infinite`,
            }}
          />
        </Box>
      </Zoom>
    </Dialog>
  );
};

export default MobileAppPromoModal;
