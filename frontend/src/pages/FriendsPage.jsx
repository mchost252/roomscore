import React, { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Tabs,
  Tab,
  Chip,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import {
  PersonAdd,
  Check,
  Close,
  Search,
  Message as MessageIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const FriendsPage = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadFriends();
    loadRequests();
  }, []);

  const loadFriends = async () => {
    try {
      const res = await api.get('/friends');
      setFriends(res.data.friends || []);
    } catch (err) {
      console.error('Error loading friends:', err);
    }
  };

  const loadRequests = async () => {
    try {
      const res = await api.get('/friends/requests');
      setRequests(res.data.requests || []);
    } catch (err) {
      console.error('Error loading requests:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/friends/search?query=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data.users || []);
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users');
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId) => {
    try {
      await api.post('/friends/request', { recipientId: userId });
      setSuccess('Friend request sent!');
      setTimeout(() => setSuccess(null), 2000);
      setSearchResults([]);
      setSearchQuery('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send request');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      await api.put(`/friends/accept/${requestId}`);
      setSuccess('Friend request accepted!');
      setTimeout(() => setSuccess(null), 2000);
      loadFriends();
      loadRequests();
    } catch (err) {
      setError('Failed to accept request');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleReject = async (requestId) => {
    try {
      await api.put(`/friends/reject/${requestId}`);
      loadRequests();
    } catch (err) {
      setError('Failed to reject request');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      await api.delete(`/friends/${friendId}`);
      setSuccess('Friend removed');
      setTimeout(() => setSuccess(null), 2000);
      loadFriends();
    } catch (err) {
      setError('Failed to remove friend');
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Friends
        </Typography>

        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label={`Friends (${friends.length})`} />
          <Tab label={`Requests (${requests.length})`} />
          <Tab label="Find Friends" />
        </Tabs>

        {success && (
          <Box sx={{ mb: 2, p: 1, bgcolor: 'success.light', borderRadius: 1 }}>
            <Typography variant="body2" color="success.dark">{success}</Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ mb: 2, p: 1, bgcolor: 'error.light', borderRadius: 1 }}>
            <Typography variant="body2" color="error.dark">{error}</Typography>
          </Box>
        )}

        {/* Friends List */}
        {tab === 0 && (
          <>
            {friends.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  No friends yet. Find and add friends to start messaging!
                </Typography>
                <Button variant="contained" onClick={() => setTab(2)} sx={{ mt: 2 }}>
                  Find Friends
                </Button>
              </Box>
            ) : (
              <List>
                {friends.map((friend) => (
                  <ListItem
                    key={friend._id}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton onClick={() => navigate(`/messages/${friend._id}`)}>
                          <MessageIcon />
                        </IconButton>
                        <Button size="small" color="error" onClick={() => handleRemoveFriend(friend._id)}>
                          Remove
                        </Button>
                      </Box>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar src={friend.avatar}>{friend.username[0]}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={friend.username}
                      secondary={
                        <>
                          <Chip label={`${friend.totalPoints || 0} pts`} size="small" sx={{ mr: 1 }} />
                          <Chip label={`${friend.currentStreak || 0} day streak`} size="small" />
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </>
        )}

        {/* Friend Requests */}
        {tab === 1 && (
          <>
            {requests.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  No pending friend requests
                </Typography>
              </Box>
            ) : (
              <List>
                {requests.map((req) => (
                  <ListItem
                    key={req._id}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton color="success" onClick={() => handleAccept(req._id)}>
                          <Check />
                        </IconButton>
                        <IconButton color="error" onClick={() => handleReject(req._id)}>
                          <Close />
                        </IconButton>
                      </Box>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar src={req.requester.avatar}>{req.requester.username[0]}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={req.requester.username}
                      secondary="Wants to be your friend"
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </>
        )}

        {/* Find Friends */}
        {tab === 2 && (
          <>
            <TextField
              fullWidth
              placeholder="Search by username or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleSearch} disabled={loading}>
                      {loading ? <CircularProgress size={20} /> : <Search />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{ mb: 2 }}
            />

            {searchResults.length === 0 && searchQuery.trim().length > 0 && !loading && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No users found
                </Typography>
              </Box>
            )}

            {searchResults.length > 0 && (
              <List>
                {searchResults.map((user) => (
                  <ListItem
                    key={user._id}
                    secondaryAction={
                      <Button
                        variant="contained"
                        startIcon={<PersonAdd />}
                        onClick={() => handleSendRequest(user._id)}
                      >
                        Add Friend
                      </Button>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar src={user.avatar}>{user.username[0]}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={user.username}
                      secondary={
                        <>
                          <Chip label={`${user.totalPoints || 0} pts`} size="small" sx={{ mr: 1 }} />
                          <Chip label={`${user.currentStreak || 0} day streak`} size="small" />
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </>
        )}
      </Paper>
    </Container>
  );
};

export default FriendsPage;
