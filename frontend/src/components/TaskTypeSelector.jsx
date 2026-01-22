import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  useTheme
} from '@mui/material';
import { AssignmentInd, GroupWork } from '@mui/icons-material';
import { usePremium } from '../context/PremiumContext';

const OptionCard = ({ icon: Icon, title, subtitle, onClick, disabled, isPremium, isDark }) => (
  <Paper
    elevation={disabled ? 0 : 2}
    onClick={!disabled ? onClick : undefined}
    sx={{
      p: 2,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      border: '1px solid',
      borderColor: isPremium ? (isDark ? 'rgba(251, 191, 36, 0.3)' : 'rgba(251, 191, 36, 0.2)') : 'divider',
      background: isPremium 
        ? (isDark 
          ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%)'
          : 'linear-gradient(135deg, rgba(251, 191, 36, 0.05) 0%, rgba(139, 92, 246, 0.03) 100%)')
        : 'inherit',
      transition: 'all 0.2s ease',
      '&:hover': disabled ? {} : { 
        boxShadow: isPremium ? `0 0 20px rgba(251, 191, 36, 0.2)` : 4,
        borderColor: isPremium ? (isDark ? 'rgba(251, 191, 36, 0.5)' : 'rgba(251, 191, 36, 0.4)') : 'primary.main',
        transform: 'translateY(-2px)',
      }
    }}
  >
    <Box>
      <Icon sx={{ color: isPremium ? '#FBBF24' : 'primary.main' }} />
    </Box>
    <Box>
      <Typography variant="subtitle1" fontWeight="bold">{title}</Typography>
      <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
    </Box>
  </Paper>
);

const TaskTypeSelector = ({ open, onClose, onSelect, isOwner, roomId }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { isGlobalPremium, isRoomPremium } = usePremium();
  const isPremiumActive = isGlobalPremium || (roomId && isRoomPremium(roomId));

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xs" 
      fullWidth
      PaperProps={{
        sx: isPremiumActive ? {
          background: isDark
            ? 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)'
            : 'linear-gradient(180deg, #ffffff 0%, #fefce8 50%, #ffffff 100%)',
          border: `1px solid ${isDark ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.15)'}`,
          boxShadow: isDark
            ? '0 0 40px rgba(251, 191, 36, 0.15), 0 25px 50px rgba(0, 0, 0, 0.5)'
            : '0 0 30px rgba(251, 191, 36, 0.1), 0 25px 50px rgba(0, 0, 0, 0.15)',
        } : {}
      }}
    >
      <DialogTitle sx={isPremiumActive ? {
        background: isDark
          ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(139, 92, 246, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%)',
        borderBottom: `1px solid ${isDark ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.15)'}`,
        color: isDark ? '#FBBF24' : '#D97706',
      } : {}}>
        {isPremiumActive ? '✨ Select Task Type' : 'Select Task Type'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <OptionCard
            icon={AssignmentInd}
            title="Personal Task"
            subtitle="Only visible to you (coming soon)"
            onClick={() => onSelect && onSelect('personal')}
            isPremium={isPremiumActive}
            isDark={isDark}
          />
          <OptionCard
            icon={GroupWork}
            title="Room Task"
            subtitle="Shared with this room"
            onClick={() => onSelect && onSelect('room')}
            disabled={!isOwner}
            isPremium={isPremiumActive}
            isDark={isDark}
          />
          {!isOwner && (
            <Typography variant="caption" color="text.secondary">
              Only room owners can add room tasks.
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={onClose}
          sx={isPremiumActive ? {
            color: isDark ? '#FBBF24' : '#D97706',
          } : {}}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TaskTypeSelector;
