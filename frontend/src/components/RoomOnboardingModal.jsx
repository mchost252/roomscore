import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Typography,
  Box,
  useTheme,
  IconButton,
  alpha,
  Fade,
} from '@mui/material';
import {
  EmojiEvents,
  LocalFireDepartment,
  Star,
  Whatshot,
  Shield,
  NotificationsActive,
  Groups,
  TaskAlt,
  AdminPanelSettings,
  Close,
  ArrowForward,
  ArrowBack,
  CheckCircle,
} from '@mui/icons-material';

const steps = [
  {
    title: 'Welcome to Your Orbit! 🌟',
    subtitle: 'Here\'s what you can do in rooms',
    content: [
      {
        icon: <TaskAlt color="primary" />,
        title: 'Complete Tasks',
        description: 'Finish your daily tasks to earn points and maintain your streak.',
      },
      {
        icon: <LocalFireDepartment color="error" />,
        title: 'Build Streaks',
        description: 'Complete tasks daily to build both personal and room streaks.',
      },
      {
        icon: <EmojiEvents color="warning" />,
        title: 'Become MVP',
        description: 'The most consistent member each day earns the 👑 MVP crown.',
      },
    ],
  },
  {
    title: 'Show Appreciation 💫',
    subtitle: 'Recognize your teammates',
    content: [
      {
        icon: <Star sx={{ color: '#FFD700' }} />,
        title: '⭐ Star',
        description: 'Good effort / appreciated - for consistent contributors.',
      },
      {
        icon: <Whatshot color="error" />,
        title: '🔥 Fire',
        description: 'You really showed up today - for exceptional effort.',
      },
      {
        icon: <Shield color="info" />,
        title: '🛡️ Shield',
        description: 'Reliable / kept the streak alive - for dependable members.',
      },
    ],
    footer: 'You can give up to 3 appreciations per day.',
  },
  {
    title: 'Stay Connected 🔔',
    subtitle: 'Keep your orbit active',
    content: [
      {
        icon: <NotificationsActive color="primary" />,
        title: 'Send Nudges',
        description: 'Remind your team to complete their tasks (1 nudge per day).',
      },
      {
        icon: <Groups color="success" />,
        title: 'Daily Summary',
        description: 'See yesterday\'s activity and MVP each morning.',
      },
    ],
  },
  {
    title: 'Admin Powers 👑',
    subtitle: 'For room admins only',
    isAdminOnly: true,
    content: [
      {
        icon: <AdminPanelSettings color="primary" />,
        title: 'Manage Tasks',
        description: 'Create, edit, and delete room tasks for all members.',
      },
      {
        icon: <Groups color="info" />,
        title: 'Manage Members',
        description: 'Add or remove members, promote to admin.',
      },
    ],
    footer: 'Regular members can only complete tasks and participate.',
  },
];

/**
 * Room Onboarding Modal
 * Shows once when user enters a room for the first time ever
 * Can be re-opened via help icon in room header
 */
const RoomOnboardingModal = ({ open, onClose, isAdmin = false, roomId, userId }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleFinish = () => {
    // Mark room onboarding as seen for THIS user and THIS room
    if (userId && roomId) {
      localStorage.setItem(`roomOnboardingSeen_${userId}_${roomId}`, 'true');
      console.log('[RoomOnboarding] Saved: roomOnboardingSeen_' + userId + '_' + roomId);
    }
    onClose();
  };
  
  // Also save when skipping - user shouldn't see it again
  const handleSkipAndSave = () => {
    if (userId && roomId) {
      localStorage.setItem(`roomOnboardingSeen_${userId}_${roomId}`, 'true');
      console.log('[RoomOnboarding] Skipped & Saved: roomOnboardingSeen_' + userId + '_' + roomId);
    }
    onClose();
  };

  const currentStep = steps[activeStep];
  const isLastStep = activeStep === steps.length - 1;

  // Colors for each step
  const stepColors = ['#5865F2', '#57F287', '#FEE75C', '#ED4245'];
  const currentColor = stepColors[activeStep] || stepColors[0];
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      disablePortal={false}
      sx={{
        zIndex: 1400,
        '& .MuiDialog-container': {
          alignItems: 'center',
        },
      }}
      slotProps={{
        backdrop: {
          sx: { 
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)'
          }
        }
      }}
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          maxHeight: { xs: '85vh', sm: '600px' },
          mx: { xs: 2, sm: 3 },
          background: isDark 
            ? 'linear-gradient(180deg, #1e1f22 0%, #2b2d31 100%)'
            : 'linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%)',
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
          boxShadow: isDark 
            ? '0 8px 32px rgba(0,0,0,0.5)' 
            : '0 8px 32px rgba(0,0,0,0.15)',
        }
      }}
    >
      {/* Skip/Close button */}
      <IconButton
        onClick={handleSkipAndSave}
        sx={{
          position: 'absolute',
          right: 12,
          top: 12,
          color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
          zIndex: 1,
          '&:hover': {
            color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
            bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
          }
        }}
      >
        <Close fontSize="small" />
      </IconButton>

      {/* Colored header bar */}
      <Box sx={{ height: 6, background: `linear-gradient(90deg, ${stepColors.join(', ')})` }} />

      <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: 1, overflow: 'auto', px: { xs: 3, sm: 4 }, py: 3 }}>
          <Fade in={true} timeout={400} key={activeStep}>
            <Box sx={{ textAlign: 'center' }}>
              {/* Icon */}
              <Box
                sx={{
                  width: { xs: 64, sm: 80 },
                  height: { xs: 64, sm: 80 },
                  borderRadius: '18px',
                  background: currentColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                  boxShadow: `0 8px 32px ${alpha(currentColor, 0.4)}`,
                  transform: 'rotate(-5deg)',
                  transition: 'transform 0.3s ease',
                  '&:hover': { transform: 'rotate(0deg) scale(1.05)' }
                }}
              >
                {activeStep === 0 && <Groups sx={{ fontSize: { xs: 32, sm: 40 }, color: 'white' }} />}
                {activeStep === 1 && <Star sx={{ fontSize: { xs: 32, sm: 40 }, color: 'white' }} />}
                {activeStep === 2 && <NotificationsActive sx={{ fontSize: { xs: 32, sm: 40 }, color: 'white' }} />}
                {activeStep === 3 && <AdminPanelSettings sx={{ fontSize: { xs: 32, sm: 40 }, color: 'white' }} />}
              </Box>

              {/* Title */}
              <Typography 
                variant="h5" 
                fontWeight={700}
                sx={{ 
                  mb: 1,
                  fontSize: { xs: '1.3rem', sm: '1.5rem' },
                  color: isDark ? '#fff' : '#1a1a1a'
                }}
              >
                {currentStep.title}
              </Typography>

              {/* Subtitle */}
              <Typography
                variant="body2"
                sx={{ 
                  mb: 3, 
                  color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
                  fontSize: '0.9rem'
                }}
              >
                {currentStep.subtitle}
                {currentStep.isAdminOnly && (
                  <Box component="span" sx={{ 
                    display: 'inline-block', 
                    ml: 1, 
                    px: 1, 
                    py: 0.25, 
                    borderRadius: 1, 
                    bgcolor: currentColor,
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    Admin
                  </Box>
                )}
              </Typography>

              {/* Features list */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 1.5,
                maxWidth: 340,
                mx: 'auto',
                textAlign: 'left'
              }}>
                {currentStep.content.map((item, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                        transform: 'translateX(4px)'
                      }
                    }}
                  >
                    <Box sx={{ 
                      p: 0.75, 
                      borderRadius: 1.5, 
                      bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                      display: 'flex'
                    }}>
                      {item.icon}
                    </Box>
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 600,
                          color: isDark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.85)',
                          fontSize: '0.875rem'
                        }}
                      >
                        {item.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)',
                          lineHeight: 1.4
                        }}
                      >
                        {item.description}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>

              {/* Footer note */}
              {currentStep.footer && (
                <Typography
                  variant="caption"
                  sx={{ 
                    display: 'block',
                    mt: 2,
                    color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                    fontStyle: 'italic'
                  }}
                >
                  {currentStep.footer}
                </Typography>
              )}
            </Box>
          </Fade>
        </Box>

        {/* Navigation - Discord style */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: { xs: 3, sm: 4 },
            py: 2.5,
            borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
            bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
          }}
        >
          <Button
            onClick={activeStep === 0 ? handleSkipAndSave : handleBack}
            startIcon={activeStep > 0 && <ArrowBack />}
            sx={{ 
              minWidth: 80,
              color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'
              }
            }}
          >
            {activeStep === 0 ? 'Skip' : 'Back'}
          </Button>

          {/* Step dots */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {steps.map((_, index) => (
              <Box
                key={index}
                sx={{
                  width: index === activeStep ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  bgcolor: index === activeStep 
                    ? currentColor 
                    : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveStep(index)}
              />
            ))}
          </Box>

          <Button
            variant="contained"
            onClick={handleNext}
            endIcon={!isLastStep && <ArrowForward />}
            sx={{ 
              minWidth: 100,
              fontWeight: 600,
              bgcolor: currentColor,
              color: currentColor === '#FEE75C' ? '#1a1a1a' : '#fff',
              borderRadius: 2,
              textTransform: 'none',
              boxShadow: `0 4px 14px ${alpha(currentColor, 0.4)}`,
              '&:hover': {
                bgcolor: currentColor,
                filter: 'brightness(1.1)',
              }
            }}
          >
            {isLastStep ? "Got it!" : 'Next'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default RoomOnboardingModal;
