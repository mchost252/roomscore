import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  useTheme,
  Avatar,
  Chip,
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
const RoomOnboardingModal = ({ open, onClose, isAdmin = false }) => {
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
    // Mark room onboarding as seen
    localStorage.setItem('roomOnboardingSeen', 'true');
    onClose();
  };

  const currentStep = steps[activeStep];
  const isLastStep = activeStep === steps.length - 1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      sx={{
        '& .MuiDialog-container': {
          alignItems: 'center',
          justifyContent: 'center',
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          maxHeight: { xs: '85vh', sm: '80vh' },
          m: { xs: 2, sm: 3 },
        }
      }}
    >
      <DialogTitle sx={{ 
        textAlign: 'center', 
        pt: 3,
        pb: 1,
        background: isDark 
          ? 'linear-gradient(135deg, rgba(96, 165, 250, 0.1), rgba(59, 130, 246, 0.05))'
          : 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(96, 165, 250, 0.05))',
      }}>
        <Typography variant="h5" fontWeight={700}>
          {currentStep.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {currentStep.subtitle}
        </Typography>
        {currentStep.isAdminOnly && (
          <Chip 
            label="Admin Features" 
            size="small" 
            color="primary" 
            sx={{ mt: 1 }}
          />
        )}
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {/* Step indicator */}
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
          {steps.map((step, index) => (
            <Step key={index}>
              <StepLabel />
            </Step>
          ))}
        </Stepper>

        {/* Content */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {currentStep.content.map((item, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 2,
                p: 2,
                borderRadius: 2,
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                }}
              >
                {item.icon}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {item.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.description}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {currentStep.footer && (
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ 
              display: 'block', 
              textAlign: 'center', 
              mt: 2,
              fontStyle: 'italic',
            }}
          >
            {currentStep.footer}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
        <Button
          onClick={handleBack}
          disabled={activeStep === 0}
          sx={{ mr: 'auto' }}
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={handleNext}
        >
          {isLastStep ? 'Got it!' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoomOnboardingModal;
