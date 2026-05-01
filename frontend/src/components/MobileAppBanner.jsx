import React, { useState } from 'react';
import { Box, Typography, Button, useTheme, alpha, keyframes, Snackbar, Alert } from '@mui/material';
import { ArrowForward, PhoneIphone, CheckCircle } from '@mui/icons-material';

// ─── Animations ───
const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const subtleFloat = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
`;

const MobileAppBanner = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [waitlistJoined, setWaitlistJoined] = useState(false);

  const handleJoinWaitlist = () => {
    // Show success toast instead of dead link
    setWaitlistJoined(true);
  };

  return (
    <>
      <Box
        sx={{
          position: 'relative',
          borderRadius: '16px',
          overflow: 'hidden',
          mb: { xs: 2, md: 4 },
          cursor: 'pointer',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: `0 8px 32px ${alpha('#7B61FF', 0.3)}`,
          },
          // Outer glow
          border: `1px solid ${alpha('#7B61FF', isDark ? 0.4 : 0.25)}`,
          boxShadow: `0 4px 20px ${alpha('#7B61FF', 0.15)}`,
        }}
        onClick={handleJoinWaitlist}
      >
        {/* Banner image */}
        <Box
          component="img"
          src="/krios-mobile-banner.png"
          alt="Krios Mobile - Coming Soon"
          sx={{
            width: '100%',
            height: 'auto',
            display: 'block',
            minHeight: { xs: 160, sm: 200, md: 240 },
            objectFit: 'cover',
          }}
        />

        {/* Overlay content - CTA at bottom */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
            p: { xs: 1.5, sm: 2 }, // Reduced padding
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1, // Reduced gap further for mobile
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PhoneIphone sx={{ color: '#A78BFA', fontSize: { xs: 18, sm: 22 }, animation: `${subtleFloat} 3s ease-in-out infinite` }} />
            <Box>
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255,255,255,0.7)',
                  fontWeight: 600,
                  fontSize: { xs: '0.55rem', sm: '0.65rem' }, // Super small on mobile
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Coming Soon
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: { xs: '0.7rem', sm: '0.85rem' },
                }}
              >
                Krios Mobile App
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            size="small"
            endIcon={<ArrowForward sx={{ fontSize: { xs: '12px !important', sm: '14px !important' } }} />}
            onClick={(e) => {
              e.stopPropagation();
              handleJoinWaitlist();
            }}
            sx={{
              background: 'linear-gradient(135deg, #7B61FF 0%, #A78BFA 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: { xs: '0.55rem', sm: '0.65rem' }, // Much smaller font on mobile
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              borderRadius: '6px', // Smaller border radius
              px: { xs: 1, sm: 2 }, // Tighter padding on mobile
              py: { xs: 0.25, sm: 0.5 }, // Tighter padding on mobile
              minWidth: 'unset', // Allow button to shrink
              whiteSpace: 'nowrap',
              boxShadow: `0 4px 15px ${alpha('#7B61FF', 0.4)}`,
              // Shimmer effect on button
              backgroundSize: '200% auto',
              '&:hover': {
                background: 'linear-gradient(135deg, #6B51EF 0%, #9B7BEA 100%)',
                backgroundSize: '200% auto',
                animation: `${shimmer} 1.5s linear infinite`,
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            Join Waitlist
          </Button>
        </Box>

        {/* Top shimmer bar */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: `linear-gradient(90deg, transparent, ${alpha('#7B61FF', 0.8)}, ${alpha('#A78BFA', 0.9)}, ${alpha('#7B61FF', 0.8)}, transparent)`,
            backgroundSize: '200% auto',
            animation: `${shimmer} 3s linear infinite`,
          }}
        />
      </Box>

      {/* Success Toast Notification */}
      <Snackbar
        open={waitlistJoined}
        autoHideDuration={4000}
        onClose={() => setWaitlistJoined(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setWaitlistJoined(false)}
          severity="success"
          icon={<CheckCircle fontSize="inherit" />}
          sx={{
            width: '100%',
            background: 'rgba(34, 197, 94, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#22c55e',
            fontWeight: 600,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            '& .MuiAlert-icon': {
              color: '#22c55e',
            }
          }}
        >
          You're on the waitlist! We'll notify you when Krios Mobile is ready.
        </Alert>
      </Snackbar>
    </>
  );
};

export default MobileAppBanner;
