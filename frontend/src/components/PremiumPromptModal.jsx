import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  IconButton,
  Slide,
  Snackbar,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { usePremium } from '../context/PremiumContext';
import PremiumActivationModal from './PremiumActivationModal';

// Slide up transition
const SlideTransition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

/**
 * PremiumPromptModal - Smart, non-annoying prompt for premium
 * Shows after user engagement milestones (3 nudges, 3 daily summaries)
 */
const PremiumPromptModal = ({ open, onClose }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { dismissPrompt, shouldShowPremiumPrompt } = usePremium();
  const [showActivation, setShowActivation] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [showPreviewMessage, setShowPreviewMessage] = useState(false);

  // Auto-dismiss tracking
  useEffect(() => {
    if (open) {
      // Record that we showed the prompt
    }
  }, [open]);

  const handleDismiss = () => {
    dismissPrompt();
    onClose();
  };

  const handleActivate = () => {
    setShowActivation(true);
  };

  const handlePreview = () => {
    // Show message that preview is not available yet
    setShowPreviewMessage(true);
  };

  return (
    <>
      <Dialog
        open={open && !showActivation}
        onClose={handleDismiss}
        TransitionComponent={SlideTransition}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            background: isDark
              ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            boxShadow: isDark
              ? '0 -10px 40px rgba(96, 165, 250, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              : '0 -10px 40px rgba(59, 130, 246, 0.1), 0 25px 50px -12px rgba(0, 0, 0, 0.15)',
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            m: 0,
            maxHeight: '80vh',
            width: 'calc(100% - 32px)',
            maxWidth: 400,
            mb: 2,
          },
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          {/* Close button */}
          <IconButton
            onClick={handleDismiss}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              color: 'text.secondary',
              zIndex: 1,
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>

          {/* Visual preview mockup */}
          <Box
            sx={{
              height: 120,
              background: isDark
                ? 'linear-gradient(135deg, rgba(96, 165, 250, 0.1), rgba(245, 158, 11, 0.1))'
                : 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(217, 119, 6, 0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Animated mock UI elements */}
            <Box
              sx={{
                display: 'flex',
                gap: 1.5,
                alignItems: 'center',
              }}
            >
              {/* Mock cards with stagger animation */}
              {[0, 1, 2].map((i) => (
                <Box
                  key={i}
                  sx={{
                    width: 60,
                    height: 70,
                    borderRadius: 2,
                    background: isDark 
                      ? 'rgba(255,255,255,0.1)' 
                      : 'rgba(0,0,0,0.05)',
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
                    animation: previewMode 
                      ? `premiumCardSlideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards`
                      : 'none',
                    animationDelay: `${i * 100}ms`,
                    opacity: previewMode ? 0 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: i === 1 
                        ? 'linear-gradient(135deg, #F59E0B, #FBBF24)'
                        : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                    }}
                  />
                  <Box
                    sx={{
                      width: '60%',
                      height: 4,
                      borderRadius: 2,
                      background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                    }}
                  />
                </Box>
              ))}
            </Box>

            {/* Sparkle icon */}
            <AutoAwesomeIcon
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                fontSize: 24,
                color: '#F59E0B',
                opacity: 0.8,
                animation: 'premiumSoftPulse 2s ease-in-out infinite',
              }}
            />
          </Box>

          {/* Content */}
          <Box sx={{ p: 3, pt: 2.5 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                mb: 0.5,
                background: isDark
                  ? 'linear-gradient(135deg, #60A5FA, #F59E0B)'
                  : 'linear-gradient(135deg, #3B82F6, #D97706)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Upgrade Your Experience
            </Typography>
            
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 3 }}
            >
              Unlock smooth animations, premium visuals, and delightful micro-interactions.
            </Typography>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="outlined"
                onClick={handlePreview}
                sx={{
                  flex: 1,
                  borderRadius: 2,
                  borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                  color: 'text.secondary',
                  '&:hover': {
                    borderColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  },
                }}
              >
                Preview
              </Button>
              
              <Button
                variant="contained"
                onClick={handleActivate}
                sx={{
                  flex: 1,
                  borderRadius: 2,
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #60A5FA, #3B82F6)',
                  boxShadow: '0 4px 15px rgba(96, 165, 250, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                  },
                }}
              >
                Activate
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Activation modal */}
      <PremiumActivationModal
        open={showActivation}
        onClose={() => {
          setShowActivation(false);
          onClose();
        }}
        type="global"
      />
      
      {/* Preview not available message */}
      <Snackbar
        open={showPreviewMessage}
        autoHideDuration={4000}
        onClose={() => setShowPreviewMessage(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setShowPreviewMessage(false)} 
          severity="info"
          variant="filled"
          sx={{
            background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
            '& .MuiAlert-icon': {
              color: '#fff'
            }
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            Preview not available yet
          </Typography>
          <Typography variant="caption">
            Activate premium to experience the full constellation mode! ✨
          </Typography>
        </Alert>
      </Snackbar>
    </>
  );
};

export default PremiumPromptModal;
