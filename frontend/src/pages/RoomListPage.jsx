import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    loadRooms();
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

  const loadRooms = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch user's rooms
      const myRoomsResponse = await api.get('/rooms');
      setMyRooms(myRoomsResponse.data.rooms || []);

      // Fetch public rooms
      const publicRoomsResponse = await api.get('/rooms?type=public');
      setPublicRooms(publicRoomsResponse.data.rooms || []);
    } catch (err) {
      console.error('Error loading rooms:', err);
      setError(err.response?.data?.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

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
      setError(err.response?.data?.message || 'Failed to join room');
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
      // If already a member, just navigate to the room
      if (isMember) {
        navigate(`/rooms/${room._id}`);
        return;
      }

      // If public room and not a member, join first then navigate
      if (room.isPublic) {
        try {
          setLoading(true);
          const response = await api.post('/rooms/join', { joinCode: room.joinCode });
          
          // Check if join request is pending approval
          if (response.data.pending) {
            setSuccess(response.data.message || 'Request sent! Waiting for owner approval.');
            // Don't navigate - user is not a member yet
            return;
          }
          
          setSuccess(`Joined ${room.name}!`);
          setTimeout(() => {
            navigate(`/rooms/${room._id}`);
          }, 500);
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to join room');
          setTimeout(() => setError(null), 5000);
        } finally {
          setLoading(false);
        }
      }
    };

    return (
      <Card 
        sx={{ 
          height: '100%',
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 6
          }
        }}
        onClick={handleCardClick}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                {room.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {isOwner && <Chip label="Owner" size="small" color="primary" />}
                {room.isPublic ? (
                  <Chip icon={<Public />} label="Public" size="small" color="success" />
                ) : (
                  <Chip icon={<Lock />} label="Private" size="small" />
                )}
              </Box>
            </Box>
          </Box>

          {room.description && (
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ mb: 2, minHeight: '40px' }}
            >
              {room.description.length > 120 
                ? `${room.description.substring(0, 120)}...` 
                : room.description}
            </Typography>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Groups fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {memberCount}/{room.maxMembers || 50}
                </Typography>
              </Box>
              
              {myMember && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <EmojiEvents fontSize="small" color="warning" />
                  <Typography variant="body2" color="text.secondary">
                    {myMember.points} pts
                  </Typography>
                </Box>
              )}
            </Box>

            {room.tasks && (
              <Typography variant="caption" color="text.secondary">
                {room.tasks.filter(t => t.isActive).length} tasks
              </Typography>
            )}
          </Box>

          {!isMember && room.isPublic && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button 
                variant="contained" 
                size="small" 
                fullWidth
                startIcon={<PersonAdd />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardClick(e);
                }}
              >
                Join Room
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
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
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
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
