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
  CircularProgress,
  Alert
} from '@mui/material';
import {
  PersonAdd,
  Check,
  Close,
  Search,
  Message as MessageIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useDeviceType } from '../hooks/useDeviceType';
import { fetchAvatars, getCachedAvatar } from '../hooks/useAvatar';
import api from '../utils/api';
import { getErrorMessage } from '../utils/errorMessages';

const FriendsPage = () => {
  const navigate = useNavigate();
  const { isMobile } = useDeviceType();
  const [tab, setTab] = useState(0);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [avatars, setAvatars] = useState({});

  useEffect(() => {
    // Load from cache first for instant display
    const cachedFriends = sessionStorage.getItem('friends_cache');
    const cachedRequests = sessionStorage.getItem('friend_requests_cache');
    
    if (cachedFriends) {
      try {
        const parsed = JSON.parse(cachedFriends);
        if (Array.isArray(parsed)) {
          setFriends(parsed);
        }
      } catch (e) {}
    }
    
    if (cachedRequests) {
      try {
        const parsed = JSON.parse(cachedRequests);
        if (Array.isArray(parsed)) {
          setRequests(parsed);
        }
      } catch (e) {}
    }
    
    // Then load fresh data in background only if cache is old or empty
    const lastFetch = sessionStorage.getItem('friends_last_fetch');
    const now = Date.now();
    if (!lastFetch || now - parseInt(lastFetch) > 30000) { // 30 seconds
      loadFriends();
      loadRequests();
      sessionStorage.setItem('friends_last_fetch', now.toString());
    }
  }, []);

  const loadFriends = async () => {
    try {
      const res = await api.get('/friends');
      const friendsData = res.data.friends || [];
      setFriends(friendsData);
      // Cache for instant loading - strip large avatar data to prevent quota errors
      try {
        const cacheData = friendsData.map(f => ({
          _id: String(f._id), // Ensure ID is string for proper serialization
          username: f.username,
          email: f.email,
          totalPoints: f.totalPoints,
          currentStreak: f.currentStreak,
          friendsSince: f.friendsSince
          // avatar intentionally excluded - too large for storage
        }));
        sessionStorage.setItem('friends_cache', JSON.stringify(cacheData));
      } catch (e) {
        // Clear old caches if storage is full
        sessionStorage.removeItem('friends_cache');
      }
      
      // Load avatars on-demand after friends are loaded
      if (friendsData.length > 0) {
        const userIds = friendsData.map(f => String(f._id));
        const avatarMap = await fetchAvatars(userIds);
        const avatarObj = {};
        avatarMap.forEach((avatar, id) => {
          avatarObj[id] = avatar;
        });
        setAvatars(prev => ({ ...prev, ...avatarObj }));
      }
    } catch (err) {
      console.error('Error loading friends:', err);
    }
  };

  const loadRequests = async () => {
    try {
      const res = await api.get('/friends/requests');
      const requestsData = res.data.requests || [];
      setRequests(requestsData);
      // Cache for instant loading - strip avatar data
      try {
        const cacheData = requestsData.map(r => ({
          _id: r._id,
          requester: r.requester ? {
            _id: String(r.requester._id),
            username: r.requester.username,
            email: r.requester.email
          } : null,
          status: r.status,
          createdAt: r.createdAt
        }));
        sessionStorage.setItem('friend_requests_cache', JSON.stringify(cacheData));
      } catch (e) {
        sessionStorage.removeItem('friend_requests_cache');
      }
      
      // Load avatars for requesters
      if (requestsData.length > 0) {
        const userIds = requestsData
          .filter(r => r.requester?._id)
          .map(r => String(r.requester._id));
        if (userIds.length > 0) {
          const avatarMap = await fetchAvatars(userIds);
          const avatarObj = {};
          avatarMap.forEach((avatar, id) => {
            avatarObj[id] = avatar;
          });
          setAvatars(prev => ({ ...prev, ...avatarObj }));
        }
      }
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
      const users = res.data.users || [];
      setSearchResults(users);
      
      // Load avatars for search results
      if (users.length > 0) {
        const userIds = users.map(u => String(u._id));
        const avatarMap = await fetchAvatars(userIds);
        const avatarObj = {};
        avatarMap.forEach((avatar, id) => {
          avatarObj[id] = avatar;
        });
        setAvatars(prev => ({ ...prev, ...avatarObj }));
      }
    } catch (err) {
      console.error('Error searching users:', err);
      const { icon, message } = getErrorMessage(err, 'user');
      setError(`${icon} ${message}`);
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
      const { icon, message } = getErrorMessage(err, 'friend');
      setError(`${icon} ${message}`);
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
      const { icon, message } = getErrorMessage(err, 'friend');
      setError(`${icon} ${message}`);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleReject = async (requestId) => {
    try {
      await api.put(`/friends/reject/${requestId}`);
      loadRequests();
    } catch (err) {
      const { icon, message } = getErrorMessage(err, 'friend');
      setError(`${icon} ${message}`);
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
      const { icon, message } = getErrorMessage(err, 'friend');
      setError(`${icon} ${message}`);
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: isMobile ? 2 : 4, mb: isMobile ? 10 : 4, px: isMobile ? 1 : 3 }}>
      <Paper sx={{ p: isMobile ? 2 : 3 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Friends
        </Typography>

        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }} variant={isMobile ? "fullWidth" : "standard"}>
          <Tab label={`Friends (${friends.length})`} />
          <Tab label={`Requests (${requests.length})`} />
          <Tab label="Find" />
        </Tabs>

        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
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
                    sx={{ 
                      flexDirection: isMobile ? 'column' : 'row',
                      alignItems: isMobile ? 'stretch' : 'center',
                      gap: isMobile ? 1 : 0
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', width: isMobile ? '100%' : 'auto', flex: 1 }}>
                      <ListItemAvatar>
                        <Avatar src={avatars[String(friend._id)] || friend.avatar}>
                          {friend.username?.[0]?.toUpperCase()}
                        </Avatar>
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
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      gap: 1,
                      justifyContent: isMobile ? 'flex-end' : 'flex-start',
                      width: isMobile ? '100%' : 'auto',
                      pl: isMobile ? 7 : 0
                    }}>
                      <Button 
                        size="small" 
                        variant="outlined"
                        startIcon={<MessageIcon />}
                        onClick={() => navigate(`/messages/${friend._id}`)}
                        sx={{ flex: isMobile ? 1 : 'none' }}
                      >
                        Message
                      </Button>
                      <Button 
                        size="small" 
                        color="error" 
                        variant="outlined"
                        onClick={() => handleRemoveFriend(friend._id)}
                        sx={{ flex: isMobile ? 1 : 'none' }}
                      >
                        Remove
                      </Button>
                    </Box>
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
                      <Avatar src={avatars[String(req.requester?._id)] || req.requester?.avatar}>
                        {req.requester?.username?.[0]?.toUpperCase()}
                      </Avatar>
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
              placeholder="Search by username..."
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
                      <Avatar src={avatars[String(user._id)] || user.avatar}>
                        {user.username?.[0]?.toUpperCase()}
                      </Avatar>
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
