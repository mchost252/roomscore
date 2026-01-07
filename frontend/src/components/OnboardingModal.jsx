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
    title: 'Welcome to RoomScore! 👋',
    subtitle: 'Navigation',
    description: 'This is your home. Tasks, rooms, messages, and your progress live here.',
    icon: DashboardIcon,
    features: [
      { label: 'Dashboard', desc: 'Your daily overview' },
      { label: 'Rooms', desc: 'Shared task spaces' },
      { label: 'Messages', desc: 'Stay connected' },
      { label: 'Profile', desc: 'Track your progress' }
    ]
  },
  {
    title: 'Join Rooms 🏠',
    subtitle: 'Rooms',
    description: 'Join rooms to complete shared tasks and earn points together.',
    icon: GroupIcon,
    features: [
      { label: 'Create Rooms', desc: 'Start your own habit group' },
      { label: 'Join Rooms', desc: 'Use invite codes' },
      { label: 'Team Progress', desc: 'See everyone\'s achievements' }
    ]
  },
  {
    title: 'Complete Tasks 📝',
    subtitle: 'Tasks',
    description: 'Tasks earn you points and build your streak.',
    icon: TaskIcon,
    features: [
      { label: 'Personal Tasks', desc: 'Private to you' },
      { label: 'Room Tasks', desc: 'Shared with your team' },
      { label: 'Daily Streaks', desc: 'Build momentum' }
    ]
  },
  {
    title: 'Stay Connected 💬',
    subtitle: 'Social',
    description: 'Chat in rooms or message friends to stay accountable.',
    icon: ChatIcon,
    features: [
      { label: 'Room Chat', desc: 'Discuss with teammates' },
      { label: 'Private Messages', desc: 'Connect with friends' },
      { label: 'Encouragement', desc: 'Support each other' }
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
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          minHeight: isMobile ? '100vh' : '500px'
        }
      }}
    >
      <IconButton
        onClick={handleSkip}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: 'text.secondary',
          zIndex: 1
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Stepper */}
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
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
            borderTop: 1,
            borderColor: 'divider'
          }}
        >
          <Button
            onClick={activeStep === 0 ? handleSkip : handleBack}
            startIcon={activeStep > 0 && <ArrowBack />}
            sx={{ minWidth: 100 }}
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
            sx={{ minWidth: 100 }}
          >
            {activeStep === onboardingSteps.length - 1 ? 'Start' : 'Next'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingModal;
