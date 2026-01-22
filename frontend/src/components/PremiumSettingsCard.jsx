import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Switch,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { usePremium } from '../context/PremiumContext';
import PremiumActivationModal from './PremiumActivationModal';

/**
 * PremiumSettingsCard - Settings card for managing premium status
 * Shows in ProfilePage settings tab
 */
const PremiumSettingsCard = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { 
    isGlobalPremium, 
    globalPremium,
    deactivateGlobalPremium,
  } = usePremium();
  
  const [activationOpen, setActivationOpen] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const handleToggle = async () => {
    if (isGlobalPremium) {
      setConfirmDeactivate(true);
    } else {
      setActivationOpen(true);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    await deactivateGlobalPremium();
    setDeactivating(false);
    setConfirmDeactivate(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <>
      <Card
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          background: isGlobalPremium
            ? isDark
              ? 'linear-gradient(135deg, rgba(96, 165, 250, 0.1), rgba(245, 158, 11, 0.1))'
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(217, 119, 6, 0.08))'
            : isDark
              ? 'rgba(30, 41, 59, 0.5)'
              : 'rgba(255, 255, 255, 0.8)',
          border: isGlobalPremium
            ? `1px solid ${isDark ? 'rgba(96, 165, 250, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`
            : `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isGlobalPremium
                    ? 'linear-gradient(135deg, #60A5FA, #F59E0B)'
                    : isDark
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.05)',
                }}
              >
                <AutoAwesomeIcon
                  sx={{
                    fontSize: 24,
                    color: isGlobalPremium ? 'white' : 'text.secondary',
                  }}
                />
              </Box>
              
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Premium Style
                  </Typography>
                  {isGlobalPremium && (
                    <Chip
                      label="Active"
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                        color: 'white',
                      }}
                    />
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {isGlobalPremium
                    ? `Activated ${formatDate(globalPremium.activatedAt)}`
                    : 'Smooth animations & premium visuals'
                  }
                </Typography>
              </Box>
            </Box>

            <Switch
              checked={isGlobalPremium}
              onChange={handleToggle}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: '#60A5FA',
                  '&:hover': {
                    backgroundColor: 'rgba(96, 165, 250, 0.1)',
                  },
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: '#60A5FA',
                },
              }}
            />
          </Box>

          {/* Feature list when inactive */}
          {!isGlobalPremium && (
            <Box sx={{ mt: 2, pl: 7 }}>
              <Typography variant="caption" color="text.disabled">
                Includes: Page transitions • Animated numbers • Card effects • Micro-interactions
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Activation Modal */}
      <PremiumActivationModal
        open={activationOpen}
        onClose={() => setActivationOpen(false)}
        type="global"
      />

      {/* Deactivation Confirmation */}
      <Dialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          Deactivate Premium Style?
        </DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Premium animations and visual effects will be disabled. You can reactivate anytime with your code.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => setConfirmDeactivate(false)}
            disabled={deactivating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeactivate}
            variant="contained"
            color="error"
            disabled={deactivating}
          >
            {deactivating ? 'Deactivating...' : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PremiumSettingsCard;
