import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Alert,
  Skeleton,
  InputAdornment
} from '@mui/material';
import {
  Add,
  Search,
  Groups,
  Lock,
  Public,
  EmojiEvents,
  PersonAdd
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import cacheManager from '../utils/cache';
import { getErrorMessage } from '../utils/errorMessages';
import useVisibilityRefresh from '../hooks/useVisibilityRefresh';

const RoomListPage = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [myRooms, setMyRooms] = useState([]);
  const [publicRooms, setPublicRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasMounted = useRef(false);
  const lastFetchTime = useRef(0);

  // Refresh data when user returns to the tab/app
  useVisibilityRefresh(() => {
    loadRooms(true);
  }, 30000); // Minimum 30 seconds between visibility refreshes

  // Load from cache first for instant display
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      loadFromCacheFirst();
    }
  }, []);

  // Load cached data first, then revalidate
  const loadFromCacheFirst = useCallback(() => {
    const cacheKey = cacheManager.generateKey('/rooms');
    const cached = cacheManager.getWithStale(cacheKey);
    
    if (cached.data?.rooms && cached.data.rooms.length > 0) {
      // Show cached data immediately
      setMyRooms(cached.data.rooms);
      setLoading(false);
      
      // Always refresh in background to get latest data
      loadRooms(true);
    } else {
      // No cache - do full load
      loadRooms(false);
    }
  }, []);

  // Listen for real-time room updates
  useEffect(() => {
    if (!socket) return;

    // When current user leaves a room, remove it from list
    const handleMemberLeft = (data) => {
      if (data.userId === user?.id) {
        setMyRooms(prev => prev.filter(room => room._id !== data.roomId));
      }
    };

    // When current user is kicked from a room
    const handleMemberKicked = (data) => {
      if (data.userId === user?.id) {
        setMyRooms(prev => prev.filter(room => room._id !== data.roomId));
      }
    };

    // When a room is deleted/disbanded
    const handleRoomDeleted = (data) => {
      setMyRooms(prev => prev.filter(room => room._id !== data.roomId));
    };

    // When current user joins a room (via approval)
    const handleJoinApproved = (data) => {
      if (data.room) {
        setMyRooms(prev => [data.room, ...prev]);
      }
    };

    socket.on('member:left', handleMemberLeft);
    socket.on('member:kicked', handleMemberKicked);
    socket.on('room:deleted', handleRoomDeleted);
    socket.on('room:joinApproved', handleJoinApproved);

    return () => {
      socket.off('member:left', handleMemberLeft);
      socket.off('member:kicked', handleMemberKicked);
      socket.off('room:deleted', handleRoomDeleted);
      socket.off('room:joinApproved', handleJoinApproved);
    };
  }, [socket, user?.id]);

  const loadRooms = useCallback(async (silentRefresh = false) => {
    // Debounce: prevent multiple rapid calls
    const now = Date.now();
    if (silentRefresh && now - lastFetchTime.current < 2000) {
      console.log('⏳ Skipping fetch - too soon since last fetch');
      return;
    }
    lastFetchTime.current = now;

    try {
      if (!silentRefresh) {
        setLoading(true);
        setError(null);
      } else {
        setIsRefreshing(true);
      }
      
      // Fetch both in parallel for speed, with individual error handling
      // Force bypass cache for fresh data on non-silent refresh
      const headers = silentRefresh ? {} : { 'x-bypass-cache': 'true' };
      const results = await Promise.allSettled([
        api.get('/rooms', { headers }),
        api.get('/rooms?type=public', { headers })
      ]);
      
      // Handle my rooms result
      if (results[0].status === 'fulfilled') {
        const freshMyRooms = results[0].value.data.rooms || [];

        // IMPORTANT: never wipe existing rooms during silent refresh.
        if (silentRefresh && freshMyRooms.length === 0 && myRooms.length > 0) {
          console.warn('⚠️ Silent refresh returned 0 rooms; keeping existing rooms');
          // Don't retry automatically - just keep showing current data
        } else {
          setMyRooms(freshMyRooms);
        }
      } else {
        console.error('Error loading my rooms:', results[0].reason);
        // Keep existing rooms on error during silent refresh
        if (!silentRefresh && myRooms.length === 0) {
          const { icon, message } = getErrorMessage(results[0].reason, 'room');
          setError(`${icon} ${message}`);
        }
      }
      
      // Handle public rooms result
      if (results[1].status === 'fulfilled') {
        setPublicRooms(results[1].value.data.rooms || []);
      } else {
        console.error('Error loading public rooms:', results[1].reason);
      }
    } catch (err) {
      console.error('Error loading rooms:', err);
      if (!silentRefresh && myRooms.length === 0) {
        const { icon, message } = getErrorMessage(err, 'room');
        setError(`${icon} ${message}`);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [myRooms.length]);

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      setError('Please enter a join code');
      return;
    }

    try {
      setJoiningRoom(true);
      setError(null);
      
      const response = await api.post('/rooms/join', {
        joinCode: joinCode.trim().toUpperCase()
      });

      setJoinDialogOpen(false);
      setJoinCode('');
      
      // Check if join request is pending approval
      if (response.data.pending) {
        setSuccess(response.data.message || 'Request sent! Waiting for owner approval.');
        // Don't navigate - user is not a member yet
        return;
      }

      setSuccess('Successfully joined room!');
      
      // Navigate to the newly joined room
      setTimeout(() => {
        navigate(`/rooms/${response.data.room._id}`);
      }, 1000);
    } catch (err) {
      console.error('Error joining room:', err);
      const { icon, message } = getErrorMessage(err, 'room');
      setError(`${icon} ${message}`);
    } finally {
      setJoiningRoom(false);
    }
  };

  const filteredMyRooms = myRooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPublicRooms = publicRooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const RoomCard = ({ room, isMember = false }) => {
    const isOwner = room.owner._id === user?.id || room.owner === user?.id;
    const memberCount = room.members?.length || 0;
    const myMember = room.members?.find(m => 
      m.userId._id === user?.id || m.userId === user?.id
    );

    const handleCardClick = async (e) => {
      // Only navigate if already a member
      if (isMember) {
        navigate(`/rooms/${room._id}`);
      }
      // Don't auto-join on card click - user must use the join button
    };

    const handleJoinPublicRoom = async (e) => {
      e.stopPropagation();
      try {
        setError(null);
        const response = await api.post('/rooms/join', {
          joinCode: room.joinCode
        });

        // Check if join request is pending approval
        if (response.data.pending) {
          setSuccess(response.data.message || 'Request sent! Waiting for owner approval.');
          // Refresh room lists to update UI
          loadRooms(true);
          return;
        }

        setSuccess('Successfully joined room!');
        // Navigate to the newly joined room after short delay
        setTimeout(() => {
          navigate(`/rooms/${response.data.room._id}`);
        }, 1000);
      } catch (err) {
        console.error('Error joining room:', err);
        const { icon, message } = getErrorMessage(err, 'room');
        setError(`${icon} ${message}`);
      }
    };

    // Check if room has premium
    const isPremiumRoom = room.isPremium === true;

    return (
      <Card 
        sx={{ 
          height: '100%',
          cursor: isMember ? 'pointer' : 'default',
          transition: 'transform 0.2s, box-shadow 0.2s',
          overflow: 'hidden',
          // Golden premium styling
          ...(isPremiumRoom && {
            position: 'relative',
            border: '2px solid',
            borderColor: 'transparent',
            background: (theme) => theme.palette.mode === 'dark'
              ? `linear-gradient(${theme.palette.background.paper}, ${theme.palette.background.paper}) padding-box,
                 linear-gradient(135deg, #B8860B 0%, #FFD700 50%, #DAA520 100%) border-box`
              : `linear-gradient(${theme.palette.background.paper}, ${theme.palette.background.paper}) padding-box,
                 linear-gradient(135deg, #B8860B 0%, #FFD700 50%, #DAA520 100%) border-box`,
            boxShadow: (theme) => theme.palette.mode === 'dark'
              ? '0 0 20px rgba(255, 215, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.3)'
              : '0 0 15px rgba(218, 165, 32, 0.25), 0 4px 12px rgba(0, 0, 0, 0.1)',
          }),
          '&:hover': isMember ? {
            transform: 'translateY(-4px)',
            boxShadow: isPremiumRoom 
              ? (theme) => theme.palette.mode === 'dark'
                ? '0 0 30px rgba(255, 215, 0, 0.5), 0 8px 20px rgba(0, 0, 0, 0.4)'
                : '0 0 25px rgba(218, 165, 32, 0.35), 0 8px 20px rgba(0, 0, 0, 0.15)'
              : 6
          } : {}
        }}
        onClick={isMember ? handleCardClick : undefined}
      >
        {/* Gradient Header - Golden for Premium */}
        <Box 
          sx={{ 
            background: isPremiumRoom
              ? (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.25) 50%, rgba(217, 119, 6, 0.2) 100%)'
                : 'linear-gradient(135deg, rgba(254, 243, 199, 0.8) 0%, rgba(253, 230, 138, 0.9) 50%, rgba(252, 211, 77, 0.8) 100%)'
              : (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(99,102,241,0.15) 50%, rgba(139,92,246,0.15) 100%)'
                : 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(99,102,241,0.08) 50%, rgba(139,92,246,0.08) 100%)',
            borderBottom: isPremiumRoom
              ? (theme) => theme.palette.mode === 'dark'
                ? '1px solid rgba(251, 191, 36, 0.4)'
                : '1px solid rgba(217, 119, 6, 0.3)'
              : (theme) => theme.palette.mode === 'dark'
                ? '1px solid rgba(96,165,250,0.2)'
                : '1px solid rgba(59,130,246,0.15)',
            p: { xs: 1.5, md: 2 },
            pb: { xs: 1, md: 1.5 }
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1 }}>
              <Typography 
                variant="h6" 
                fontWeight="bold" 
                gutterBottom
                sx={{
                  fontSize: { xs: '1rem', md: '1.25rem' },
                  background: isPremiumRoom
                    ? (theme) => theme.palette.mode === 'dark'
                      ? 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 50%, #D97706 100%)'
                      : 'linear-gradient(135deg, #B45309 0%, #92400E 50%, #78350F 100%)'
                    : (theme) => theme.palette.mode === 'dark'
                      ? 'linear-gradient(135deg, #60A5FA 0%, #818CF8 50%, #A78BFA 100%)'
                      : 'linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                {room.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {isPremiumRoom && (
                  <Chip 
                    label="✨ Premium" 
                    size="small" 
                    sx={{
                      height: { xs: 20, md: 24 },
                      fontSize: { xs: '0.7rem', md: '0.8125rem' }, 
                      background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.15) 100%)',
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                      color: '#FBBF24',
                      fontWeight: 600,
                      '& .MuiChip-label': { px: 1 }
                    }}
                  />
                )}
                {isOwner && <Chip label="Owner" size="small" color="primary" sx={{ height: { xs: 20, md: 24 }, fontSize: { xs: '0.7rem', md: '0.8125rem' } }} />}
                {room.isPublic ? (
                  <Chip icon={<Public sx={{ fontSize: { xs: 14, md: 18 } }} />} label="Public" size="small" color="success" sx={{ height: { xs: 20, md: 24 }, fontSize: { xs: '0.7rem', md: '0.8125rem' } }} />
                ) : (
                  <Chip icon={<Lock sx={{ fontSize: { xs: 14, md: 18 } }} />} label="Private" size="small" sx={{ height: { xs: 20, md: 24 }, fontSize: { xs: '0.7rem', md: '0.8125rem' } }} />
                )}
              </Box>
            </Box>
          </Box>
        </Box>

        <CardContent sx={{ pt: { xs: 1.5, md: 2 }, px: { xs: 1.5, md: 2 }, pb: { xs: 1.5, md: 2 } }}>

          {room.description && (
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ mb: { xs: 1.5, md: 2 }, minHeight: { xs: '30px', md: '40px' }, fontSize: { xs: '0.8rem', md: '0.875rem' } }}
            >
              {room.description.length > 120 
                ? `${room.description.substring(0, 120)}...` 
                : room.description}
            </Typography>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: { xs: 1.5, md: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Groups sx={{ fontSize: { xs: 16, md: 20 } }} color="action" />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                  {memberCount}/{room.maxMembers || 50}
                </Typography>
              </Box>
              
              {myMember && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <EmojiEvents sx={{ fontSize: { xs: 16, md: 20 } }} color="warning" />
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                    {myMember.points} pts
                  </Typography>
                </Box>
              )}
            </Box>

            {room.tasks && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                {room.tasks.filter(t => t.isActive).length} tasks
              </Typography>
            )}
          </Box>

          {!isMember && room.isPublic && (
            <Box sx={{ mt: { xs: 1.5, md: 2 }, pt: { xs: 1.5, md: 2 }, borderTop: '1px solid', borderColor: 'divider' }}>
              {memberCount >= (room.maxMembers || 50) ? (
                <Button 
                  variant="outlined" 
                  size="small" 
                  fullWidth
                  disabled
                  color="error"
                >
                  Room Full ({memberCount}/{room.maxMembers || 50})
                </Button>
              ) : (
                <Button 
                  variant="contained" 
                  size="small" 
                  fullWidth
                  startIcon={<PersonAdd />}
                  onClick={handleJoinPublicRoom}
                >
                  {room.requireApproval ? 'Request to Join' : 'Join Room'}
                </Button>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4, px: { xs: 2, sm: 3, md: 4 } }}>
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={200} />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4, px: { xs: 2, sm: 3, md: 4 } }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom fontWeight="bold">
          Rooms
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Join or create habit tracking rooms
        </Typography>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Actions Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: { xs: 'stretch', md: 'flex-end' } }}>
              <Button
                variant="outlined"
                startIcon={<PersonAdd />}
                onClick={() => setJoinDialogOpen(true)}
                fullWidth
                sx={{ maxWidth: { md: 200 } }}
              >
                Join with Code
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/rooms/create')}
                fullWidth
                sx={{ maxWidth: { md: 200 } }}
              >
                Create Room
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label={`My Rooms (${myRooms.length})`} />
          <Tab label={`Public Rooms (${publicRooms.length})`} />
        </Tabs>
      </Box>

      {/* My Rooms Tab */}
      {tabValue === 0 && (
        <>
          {filteredMyRooms.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <Groups sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {searchQuery ? 'No rooms found' : 'No rooms yet'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {searchQuery 
                  ? 'Try adjusting your search query' 
                  : 'Create a room or join one with a code to get started'}
              </Typography>
              {!searchQuery && (
                <>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => navigate('/rooms/create')}
                    sx={{ mr: 2 }}
                  >
                    Create Room
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PersonAdd />}
                    onClick={() => setJoinDialogOpen(true)}
                  >
                    Join with Code
                  </Button>
                </>
              )}
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {filteredMyRooms.map((room) => (
                <Grid item xs={12} sm={6} md={4} key={room._id}>
                  <RoomCard room={room} isMember={true} />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* Public Rooms Tab */}
      {tabValue === 1 && (
        <>
          {filteredPublicRooms.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <Public sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No public rooms available
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Create a public room for others to discover and join
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/rooms/create')}
              >
                Create Public Room
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {filteredPublicRooms.map((room) => (
                <Grid item xs={12} sm={6} md={4} key={room._id}>
                  <RoomCard room={room} isMember={false} />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* Join Room Dialog */}
      <Dialog 
        open={joinDialogOpen} 
        onClose={() => !joiningRoom && setJoinDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Join Room with Code</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the room code shared by the room owner
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Room Code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g., ABC12345"
            disabled={joiningRoom}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleJoinRoom();
              }
            }}
            inputProps={{ style: { textTransform: 'uppercase' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJoinDialogOpen(false)} disabled={joiningRoom}>
            Cancel
          </Button>
          <Button 
            onClick={handleJoinRoom} 
            variant="contained"
            disabled={joiningRoom || !joinCode.trim()}
          >
            {joiningRoom ? 'Joining...' : 'Join Room'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default RoomListPage;
