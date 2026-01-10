import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  useTheme,
  useMediaQuery,
  Fade,
  Slide
} from '@mui/material';
import {
  Close as CloseIcon,
  Dashboard as DashboardIcon,
  Group as GroupIcon,
  Assignment as TaskIcon,
  Chat as ChatIcon,
  ArrowForward,
  ArrowBack
} from '@mui/icons-material';

const onboardingSteps = [
  {
    title: 'Welcome to Krios! 👋',
    subtitle: 'Overview',
    description: 'Build better habits with friends! Track tasks, earn points, and stay accountable together.',
    icon: DashboardIcon,
    features: [
      { label: 'Dashboard', desc: 'Your daily overview & stats' },
      { label: 'Rooms', desc: 'Collaborative habit spaces' },
      { label: 'Friends', desc: 'Connect & message friends' },
      { label: 'Notifications', desc: 'Real-time updates & alerts' }
    ]
  },
  {
    title: 'Create & Join Rooms 🏠',
    subtitle: 'Rooms',
    description: 'Rooms are shared spaces where you and your friends complete tasks together.',
    icon: GroupIcon,
    features: [
      { label: 'Create Rooms', desc: 'Set up habit groups (up to 1 month)' },
      { label: 'Join via Code', desc: 'Use invite codes to join' },
      { label: 'Leaderboards', desc: 'Compete with room members' },
      { label: 'Room Chat', desc: 'Discuss progress together' }
    ]
  },
  {
    title: 'Complete Tasks & Earn Points 📝',
    subtitle: 'Tasks',
    description: 'Complete daily, weekly, or monthly tasks to earn points and build streaks.',
    icon: TaskIcon,
    features: [
      { label: 'Room Tasks', desc: 'Visible to all room members' },
      { label: 'Points System', desc: 'Earn points for completions' },
      { label: 'Daily Streaks', desc: 'Build consistency over time' },
      { label: 'See Who Completed', desc: 'Track team progress' }
    ]
  },
  {
    title: 'Stay Connected 💬',
    subtitle: 'Social',
    description: 'Add friends, send messages, and get instant notifications when things happen.',
    icon: ChatIcon,
    features: [
      { label: 'Add Friends', desc: 'Search & send friend requests' },
      { label: 'Direct Messages', desc: 'Private chats with friends' },
      { label: 'Push Notifications', desc: 'Never miss an update' },
      { label: 'Online Status', desc: 'See who\'s active' }
    ]
  }
];

const OnboardingModal = ({ open, onClose }) => {
  const theme = useTheme();
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
      onClose={handleSkip}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          minHeight: isMobile ? '100vh' : '500px',
          maxHeight: isMobile ? '100vh' : '90vh',
          // iOS safe area support
          paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 20px)' : 0,
          paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : 0
        }
      }}
    >
      <IconButton
        onClick={handleSkip}
        sx={{
          position: 'absolute',
          right: 8,
          top: isMobile ? 'calc(8px + env(safe-area-inset-top, 0px))' : 8,
          color: 'text.secondary',
          zIndex: 1,
          // Larger touch target for mobile
          minWidth: 44,
          minHeight: 44
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent sx={{ 
        p: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        overflow: 'auto',
        // Ensure content is scrollable on small screens
        WebkitOverflowScrolling: 'touch'
      }}>
        {/* Stepper */}
        <Box sx={{ px: 3, pt: isMobile ? 4 : 3, pb: 2 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {onboardingSteps.map((step, index) => (
              <Step key={index}>
                <StepLabel>{step.subtitle}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            px: 3,
            py: 4,
            textAlign: 'center'
          }}
        >
          <Fade in={true} timeout={500} key={activeStep}>
            <Box sx={{ width: '100%' }}>
              {/* Icon */}
              <Box
                sx={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                }}
              >
                <IconComponent sx={{ fontSize: 50, color: 'white' }} />
              </Box>

              {/* Title */}
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                {currentStep.title}
              </Typography>

              {/* Description */}
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}
              >
                {currentStep.description}
              </Typography>

              {/* Features */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                {currentStep.features.map((feature, index) => (
                  <Slide
                    key={index}
                    direction="up"
                    in={true}
                    timeout={300 + index * 100}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        textAlign: 'left',
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'action.hover',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          bgcolor: 'action.selected',
                          transform: 'translateX(5px)'
                        }
                      }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: 'primary.main',
                          mr: 2
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {feature.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {feature.desc}
                        </Typography>
                      </Box>
                    </Box>
                  </Slide>
                ))}
              </Box>
            </Box>
          </Fade>
        </Box>

        {/* Navigation Buttons */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 3,
            py: 2,
            // Extra padding for iOS safe area
            pb: isMobile ? 'calc(16px + env(safe-area-inset-bottom, 20px))' : 2,
            borderTop: 1,
            borderColor: 'divider',
            // Ensure buttons are always visible
            flexShrink: 0,
            backgroundColor: 'background.paper',
            // Sticky at bottom
            position: 'sticky',
            bottom: 0,
            mt: 'auto'
          }}
        >
          <Button
            onClick={activeStep === 0 ? handleSkip : handleBack}
            startIcon={activeStep > 0 && <ArrowBack />}
            sx={{ 
              minWidth: isMobile ? 90 : 100,
              // Larger touch target for mobile
              minHeight: 48,
              fontSize: isMobile ? '0.9rem' : '0.875rem'
            }}
          >
            {activeStep === 0 ? 'Skip' : 'Back'}
          </Button>

          <Typography variant="caption" color="text.secondary">
            {activeStep + 1} / {onboardingSteps.length}
          </Typography>

          <Button
            variant="contained"
            onClick={handleNext}
            endIcon={activeStep < onboardingSteps.length - 1 && <ArrowForward />}
            sx={{ 
              minWidth: isMobile ? 90 : 100,
              // Larger touch target for mobile
              minHeight: 48,
              fontSize: isMobile ? '0.9rem' : '0.875rem',
              // Make Next/Start button more prominent
              fontWeight: 'bold'
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
