import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { usePremium } from '../context/PremiumContext';

/**
 * PremiumActivationModal - Big-brand style activation flow
 * Used for both Global Premium and Room Premium activation
 */
const PremiumActivationModal = ({ 
  open, 
  onClose, 
  type = 'global', // 'global' | 'room'
  roomId = null,
  roomName = null,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { 
    activateGlobalPremium, 
    activateRoomPremium,
    isGlobalPremium,
    isRoomPremium,
  } = usePremium();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isAlreadyActive = type === 'global' 
    ? isGlobalPremium 
    : roomId ? isRoomPremium(roomId) : false;

  const handleActivate = async () => {
    if (!code.trim()) {
      setError('Please enter an activation code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = type === 'global'
        ? await activateGlobalPremium(code)
        : await activateRoomPremium(roomId, code);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setCode('');
        }, 1500);
      } else {
        setError(result.message || 'Invalid activation code');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleActivate();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 60px rgba(96, 165, 250, 0.1)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Close button */}
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: 'text.secondary',
            zIndex: 1,
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* Header with gradient accent */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #60A5FA 0%, #F59E0B 100%)',
            py: 3,
            px: 3,
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Animated sparkles background */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              opacity: 0.3,
              background: `
                radial-gradient(circle at 20% 30%, rgba(255,255,255,0.3) 0%, transparent 50%),
                radial-gradient(circle at 80% 70%, rgba(255,255,255,0.2) 0%, transparent 50%)
              `,
            }}
          />
          
          <AutoAwesomeIcon 
            sx={{ 
              fontSize: 48, 
              color: 'white',
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))',
              mb: 1,
            }} 
          />
          
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: 'white',
              textShadow: '0 2px 10px rgba(0,0,0,0.2)',
            }}
          >
            {type === 'global' ? 'Unlock Premium Style' : `Premium for ${roomName || 'Room'}`}
          </Typography>
          
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255,255,255,0.9)',
              mt: 0.5,
            }}
          >
            {type === 'global' 
              ? 'Smooth animations & premium visuals app-wide'
              : 'Enhanced Daily Summary with beautiful animations'
            }
          </Typography>
        </Box>

        {/* Content */}
        <Box sx={{ p: 3 }}>
          {isAlreadyActive ? (
            <Alert 
              severity="success" 
              sx={{ 
                mb: 2,
                borderRadius: 2,
              }}
            >
              {type === 'global' ? 'Global Premium' : 'Room Premium'} is already active!
            </Alert>
          ) : (
            <>
              {/* Features preview */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {type === 'global' ? 'What you\'ll get:' : 'Daily Summary enhancements:'}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {type === 'global' ? (
                    <>
                      <FeatureItem text="Smooth page transitions & animations" />
                      <FeatureItem text="Animated numbers & progress bars" />
                      <FeatureItem text="Premium card effects & micro-interactions" />
                      <FeatureItem text="Nudge & appreciation animations" />
                    </>
                  ) : (
                    <>
                      <FeatureItem text="Animated card entrances" />
                      <FeatureItem text="Score count-up animations" />
                      <FeatureItem text="Glowing achievement highlights" />
                      <FeatureItem text="Animated progress rings" />
                    </>
                  )}
                </Box>
              </Box>

              {/* Activation code input */}
              <TextField
                fullWidth
                label="Activation Code"
                placeholder="Enter your code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                disabled={loading || success}
                error={!!error}
                helperText={error}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
                InputProps={{
                  sx: {
                    fontFamily: 'monospace',
                    letterSpacing: 1,
                  },
                }}
              />

              {/* Activate button */}
              <Button
                fullWidth
                variant="contained"
                onClick={handleActivate}
                disabled={loading || success || !code.trim()}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  fontSize: '1rem',
                  background: success 
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : 'linear-gradient(135deg, #60A5FA, #3B82F6)',
                  boxShadow: success
                    ? '0 4px 20px rgba(34, 197, 94, 0.4)'
                    : '0 4px 20px rgba(96, 165, 250, 0.4)',
                  '&:hover': {
                    background: success
                      ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                      : 'linear-gradient(135deg, #3B82F6, #2563EB)',
                  },
                  '&:disabled': {
                    background: isDark 
                      ? 'rgba(255,255,255,0.1)' 
                      : 'rgba(0,0,0,0.1)',
                  },
                }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : success ? (
                  '✓ Activated!'
                ) : (
                  'Activate'
                )}
              </Button>
            </>
          )}

          {/* Footer note */}
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{
              display: 'block',
              textAlign: 'center',
              mt: 2,
            }}
          >
            {type === 'global' 
              ? 'Premium can be deactivated anytime in Settings'
              : 'Room premium can be managed by room admin'
            }
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

// Feature item component
const FeatureItem = ({ text }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #60A5FA, #F59E0B)',
        }}
      />
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    </Box>
  );
};

export default PremiumActivationModal;
