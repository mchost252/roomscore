import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  Snackbar,
  Alert
} from '@mui/material';
import { SystemUpdate, Refresh, NewReleases } from '@mui/icons-material';
import { Capacitor } from '@capacitor/core';
import liveUpdateManager from '../utils/liveUpdate';

const UpdatePrompt = () => {
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [majorUpdate, setMajorUpdate] = useState(null);
  const [showMajorDialog, setShowMajorDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Check for updates on app launch (native only)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const checkUpdates = async () => {
      // Initialize live update manager
      await liveUpdateManager.initialize();
      
      // Small delay to let app fully load
      setTimeout(async () => {
        await performUpdateCheck();
      }, 3000);
    };

    checkUpdates();
  }, []);

  const performUpdateCheck = async () => {
    setChecking(true);
    
    const result = await liveUpdateManager.checkForUpdate({
      onUpdateAvailable: (bundleId) => {
        console.log('Update available:', bundleId);
        setUpdateAvailable(true);
      },
      onMajorUpdate: (version) => {
        return new Promise((resolve) => {
          setMajorUpdate(version);
          setShowMajorDialog(true);
          // Store the resolve function to call when user decides
          window._updateResolve = resolve;
        });
      },
      onComplete: () => {
        setSnackbar({
          open: true,
          message: 'Update downloaded! Restart to apply.',
          severity: 'success'
        });
      },
      onError: (error) => {
        console.error('Update error:', error);
      }
    });

    setChecking(false);
    return result;
  };

  const handleMajorUpdateAccept = () => {
    setShowMajorDialog(false);
    if (window._updateResolve) {
      window._updateResolve(true);
      delete window._updateResolve;
    }
  };

  const handleMajorUpdateDecline = () => {
    setShowMajorDialog(false);
    if (window._updateResolve) {
      window._updateResolve(false);
      delete window._updateResolve;
    }
    setSnackbar({
      open: true,
      message: 'Update skipped. You can update later from settings.',
      severity: 'info'
    });
  };

  const handleApplyUpdate = async () => {
    setSnackbar({
      open: true,
      message: 'Applying update...',
      severity: 'info'
    });
    await liveUpdateManager.applyUpdate();
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Don't render anything on web
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  return (
    <>
      {/* Major Update Dialog */}
      <Dialog 
        open={showMajorDialog} 
        onClose={handleMajorUpdateDecline}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NewReleases color="primary" />
          Major Update Available
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            A new major version <strong>v{majorUpdate}</strong> is available with significant improvements and new features.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Would you like to update now? The app will restart after the update.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleMajorUpdateDecline} color="inherit">
            Later
          </Button>
          <Button 
            onClick={handleMajorUpdateAccept} 
            variant="contained" 
            startIcon={<SystemUpdate />}
          >
            Update Now
          </Button>
        </DialogActions>
      </Dialog>

      {/* Update Ready Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.severity === 'success' ? null : 4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          action={
            snackbar.severity === 'success' && updateAvailable ? (
              <Button 
                color="inherit" 
                size="small" 
                onClick={handleApplyUpdate}
                startIcon={<Refresh />}
              >
                Restart
              </Button>
            ) : null
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Checking indicator (subtle) */}
      {checking && (
        <Box 
          sx={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            zIndex: 9999 
          }}
        >
          <LinearProgress sx={{ height: 2 }} />
        </Box>
      )}
    </>
  );
};

export default UpdatePrompt;
