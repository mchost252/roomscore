import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Avatar,
  Box,
  Typography,
  IconButton,
  Chip,
  Divider,
  CircularProgress
} from '@mui/material';
import { Close, LocalFireDepartment, EmojiEvents, TrendingUp } from '@mui/icons-material';
import api from '../utils/api';

const UserProfileDialog = ({ open, onClose, userId }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && userId) {
      loadUserProfile();
    }
  }, [open, userId]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      // Fetch user profile
      // Prefer friends list (includes streak/points), fallback to lightweight avatar endpoint
      const res = await api.get('/friends');
      const friend = (res.data.friends || []).find(f => f._id === userId || f.id === userId);
      if (friend) {
        setUser(friend);
        return;
      }
      // Fallback: try avatar endpoint so at least profile pic shows
      const avatarRes = await api.get(`/auth/avatar/${userId}`);
      setUser({ _id: userId, username: 'User', avatar: avatarRes.data.avatar || null });
    } catch (err) {
      console.error('Error loading user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      disablePortal={false}
      sx={{
        '& .MuiDialog-container': {
          alignItems: 'center',
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: 2,
          mx: { xs: 2, sm: 3 },
          my: 'auto',
          maxHeight: { xs: '85vh', sm: '80vh' },
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Profile</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : user ? (
          <Box>
            {/* Avatar and Username */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
              <Avatar
                src={user.avatar}
                sx={{ width: 100, height: 100, mb: 2 }}
              >
                {user.username?.[0]?.toUpperCase()}
              </Avatar>
              <Typography variant="h5" fontWeight="bold">
                {user.username}
              </Typography>
              {user.bio && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                  {user.bio}
                </Typography>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Stats */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Streak */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <LocalFireDepartment color="error" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Current Streak
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {user.currentStreak || 0} days
                  </Typography>
                </Box>
              </Box>

              {/* Total Points */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <EmojiEvents color="primary" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Points
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {user.totalPoints || 0} pts
                  </Typography>
                </Box>
              </Box>

              {/* Longest Streak */}
              {user.longestStreak !== undefined && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <TrendingUp color="success" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Longest Streak
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {user.longestStreak || 0} days
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>

            {/* Friends Since */}
            {user.friendsSince && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Friends since {new Date(user.friendsSince).toLocaleDateString()}
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Unable to load user profile
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileDialog;
