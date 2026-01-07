import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper
} from '@mui/material';
import { AssignmentInd, GroupWork } from '@mui/icons-material';

const OptionCard = ({ icon: Icon, title, subtitle, onClick, disabled }) => (
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
      borderColor: 'divider',
      '&:hover': disabled ? {} : { boxShadow: 4 }
    }}
  >
    <Box>
      <Icon color="primary" />
    </Box>
    <Box>
      <Typography variant="subtitle1" fontWeight="bold">{title}</Typography>
      <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
    </Box>
  </Paper>
);

const TaskTypeSelector = ({ open, onClose, onSelect, isOwner }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Select Task Type</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <OptionCard
            icon={AssignmentInd}
            title="Personal Task"
            subtitle="Only visible to you (coming soon)"
            onClick={() => onSelect && onSelect('personal')}
          />
          <OptionCard
            icon={GroupWork}
            title="Room Task"
            subtitle="Shared with this room"
            onClick={() => onSelect && onSelect('room')}
            disabled={!isOwner}
          />
          {!isOwner && (
            <Typography variant="caption" color="text.secondary">
              Only room owners can add room tasks.
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TaskTypeSelector;
