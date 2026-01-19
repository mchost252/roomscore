import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  IconButton,
  useTheme,
  useMediaQuery,
  Fade,
  alpha
} from '@mui/material';
import {
  Close as CloseIcon,
  RocketLaunch,
  Groups,
  EmojiEvents,
  Notifications,
  ArrowForward,
  ArrowBack,
  CheckCircle
} from '@mui/icons-material';

const onboardingSteps = [
  {
    title: 'Welcome to Krios!',
    emoji: '🚀',
    description: 'Your journey to better habits starts here. Build accountability with friends.',
    icon: RocketLaunch,
    color: '#5865F2', // Discord blurple
    features: [
      'Track daily tasks together',
      'Earn points & build streaks',
      'Real-time progress updates'
    ]
  },
  {
    title: 'Join Forces',
    emoji: '👥',
    description: 'Create rooms or join friends. Compete on leaderboards and chat in real-time.',
    icon: Groups,
    color: '#57F287', // Discord green
    features: [
      'Create & join rooms with codes',
      'Live leaderboards & rankings',
      'Built-in room chat'
    ]
  },
  {
    title: 'Crush Your Goals',
    emoji: '🏆',
    description: 'Complete tasks, earn points, and watch your streak grow day by day.',
    icon: EmojiEvents,
    color: '#FEE75C', // Discord yellow
    features: [
      'Daily, weekly & monthly tasks',
      'Points for every completion',
      'Streak tracking & rewards'
    ]
  },
  {
    title: 'Stay in the Loop',
    emoji: '🔔',
    description: 'Never miss a beat. Get notified when friends complete tasks.',
    icon: Notifications,
    color: '#EB459E', // Discord fuchsia
    features: [
      'Push notifications',
      'Direct messages',
      'Friend activity feed'
    ]
  }
];

const OnboardingModal = ({ open, onClose }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeStep, setActiveStep] = useState(0);

  const currentStep = onboardingSteps[activeStep];
  const IconComponent = currentStep.icon;

  const handleNext = () => {
    if (activeStep === onboardingSteps.length - 1) {
      onClose();
    } else {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {}}
      maxWidth="xs"
      fullWidth
      disableEscapeKeyDown
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
          minHeight: { xs: 'auto', sm: '480px' },
          maxHeight: { xs: '85vh', sm: '600px' },
          mx: { xs: 2, sm: 3 },
          overflow: 'hidden',
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
      {/* Skip button */}
      <IconButton
        onClick={handleSkip}
        sx={{
          position: 'absolute',
          right: 12,
          top: 12,
          color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
          zIndex: 1,
          minWidth: 36,
          minHeight: 36,
          '&:hover': {
            color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
            bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
          }
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      <DialogContent sx={{ 
        p: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        overflow: 'hidden'
      }}>
        {/* Colored header bar */}
        <Box
          sx={{
            height: 6,
            background: `linear-gradient(90deg, ${onboardingSteps.map(s => s.color).join(', ')})`,
          }}
        />

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            px: { xs: 3, sm: 4 },
            py: { xs: 3, sm: 4 },
            textAlign: 'center',
            overflow: 'auto'
          }}
        >
          <Fade in={true} timeout={400} key={activeStep}>
            <Box sx={{ width: '100%' }}>
              {/* Icon with glow effect */}
              <Box
                sx={{
                  width: { xs: 72, sm: 88 },
                  height: { xs: 72, sm: 88 },
                  borderRadius: '20px',
                  background: currentStep.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2.5,
                  boxShadow: `0 8px 32px ${alpha(currentStep.color, 0.4)}`,
                  transform: 'rotate(-5deg)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'rotate(0deg) scale(1.05)',
                  }
                }}
              >
                <IconComponent sx={{ fontSize: { xs: 36, sm: 44 }, color: 'white' }} />
              </Box>

              {/* Emoji + Title */}
              <Typography 
                variant="h5" 
                fontWeight={700}
                sx={{ 
                  mb: 1,
                  fontSize: { xs: '1.4rem', sm: '1.6rem' },
                  color: isDark ? '#fff' : '#1a1a1a'
                }}
              >
                {currentStep.emoji} {currentStep.title}
              </Typography>

              {/* Description */}
              <Typography
                variant="body2"
                sx={{ 
                  mb: 3, 
                  maxWidth: 320, 
                  mx: 'auto',
                  color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
                  fontSize: { xs: '0.9rem', sm: '0.95rem' },
                  lineHeight: 1.6
                }}
              >
                {currentStep.description}
              </Typography>

              {/* Features list - Discord style */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 1.5,
                maxWidth: 300,
                mx: 'auto'
              }}>
                {currentStep.features.map((feature, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      textAlign: 'left',
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        transform: 'translateX(4px)'
                      }
                    }}
                  >
                    <CheckCircle 
                      sx={{ 
                        fontSize: 20, 
                        color: currentStep.color,
                        flexShrink: 0
                      }} 
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)',
                        fontWeight: 500,
                        fontSize: '0.875rem'
                      }}
                    >
                      {feature}
                    </Typography>
                  </Box>
                ))}
              </Box>
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
            flexShrink: 0,
            bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
          }}
        >
          <Button
            onClick={activeStep === 0 ? handleSkip : handleBack}
            startIcon={activeStep > 0 && <ArrowBack />}
            sx={{ 
              minWidth: 80,
              minHeight: 40,
              fontSize: '0.875rem',
              color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'
              }
            }}
          >
            {activeStep === 0 ? 'Skip' : 'Back'}
          </Button>

          {/* Step indicators - dots */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {onboardingSteps.map((step, index) => (
              <Box
                key={index}
                sx={{
                  width: index === activeStep ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  bgcolor: index === activeStep 
                    ? currentStep.color 
                    : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: index === activeStep 
                      ? currentStep.color 
                      : isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'
                  }
                }}
                onClick={() => setActiveStep(index)}
              />
            ))}
          </Box>

          <Button
            variant="contained"
            onClick={handleNext}
            endIcon={activeStep < onboardingSteps.length - 1 && <ArrowForward />}
            sx={{ 
              minWidth: 100,
              minHeight: 40,
              fontSize: '0.875rem',
              fontWeight: 600,
              bgcolor: currentStep.color,
              color: currentStep.color === '#FEE75C' ? '#1a1a1a' : '#fff',
              borderRadius: 2,
              textTransform: 'none',
              boxShadow: `0 4px 14px ${alpha(currentStep.color, 0.4)}`,
              '&:hover': {
                bgcolor: currentStep.color,
                filter: 'brightness(1.1)',
                boxShadow: `0 6px 20px ${alpha(currentStep.color, 0.5)}`
              }
            }}
          >
            {activeStep === onboardingSteps.length - 1 ? "Let's Go!" : 'Next'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingModal;
