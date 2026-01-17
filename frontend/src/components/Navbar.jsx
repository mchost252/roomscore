import React, { useState, useEffect, memo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Dashboard,
  Groups,
  Notifications,
  AccountCircle,
  Menu as MenuIcon,
  Add,
  Logout,
  Settings,
  People,
  Message,
  MoreVert,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useDeviceType } from '../hooks/useDeviceType';
import NotificationPopup from './NotificationPopup';
import api from '../utils/api';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const { isMobile } = useDeviceType();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Fetch unread message count on mount and listen for updates
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await api.get('/direct-messages/unread-count');
        setUnreadMessages(res.data.unreadCount || 0);
      } catch (err) {
        console.error('Error fetching unread count:', err);
      }
    };

    if (user) {
      fetchUnreadCount();
    }
  }, [user]);

  // Listen for socket events to update unread count
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      // Only increment if we're not currently viewing messages from this sender
      const senderId = message.sender?._id || message.sender?.id;
      if (senderId !== user?.id && !location.pathname.includes('/messages/')) {
        setUnreadMessages(prev => prev + 1);
      }
    };

    const handleMessagesRead = () => {
      // Refetch count when messages are marked as read
      api.get('/direct-messages/unread-count')
        .then(res => setUnreadMessages(res.data.unreadCount || 0))
        .catch(() => {});
    };

    socket.on('new_direct_message', handleNewMessage);
    socket.on('dm:read', handleMessagesRead);

    return () => {
      socket.off('new_direct_message', handleNewMessage);
      socket.off('dm:read', handleMessagesRead);
    };
  }, [socket, user, location.pathname]);

  // Clear unread count when visiting messages page
  useEffect(() => {
    if (location.pathname.startsWith('/messages/')) {
      // Small delay to allow read marking to happen
      setTimeout(() => {
        api.get('/direct-messages/unread-count')
          .then(res => setUnreadMessages(res.data.unreadCount || 0))
          .catch(() => {});
      }, 500);
    }
  }, [location.pathname]);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMobileMenuOpen = (event) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null);
  };

  const handleLogout = async () => {
    handleMobileMenuClose();
    handleMenuClose();
    await logout();
    navigate('/login');
  };

  const getNavValue = () => {
    if (location.pathname === '/dashboard') return 0;
    if (location.pathname.startsWith('/rooms')) return 1;
    if (location.pathname === '/friends') return 2;
    if (location.pathname.startsWith('/messages')) return 3;
    // Profile is no longer in bottom nav
    return -1;
  };

  // Mobile bottom navigation
  if (isMobile) {
    return (
      <>
        {/* Mobile Top App Bar - matches theme */}
        <AppBar 
          position="fixed"
          elevation={1}
          sx={{ 
            bgcolor: 'background.paper',
            color: 'text.primary',
            zIndex: (theme) => theme.zIndex.drawer + 1
          }}
        >
          <Toolbar sx={{ minHeight: 56 }}>
            <Typography
              variant="h6"
              component="div"
              sx={{ flexGrow: 1, fontWeight: 'bold', cursor: 'pointer' }}
              onClick={() => navigate('/dashboard')}
            >
              Krios
            </Typography>
            <NotificationPopup />
            <IconButton
              color="inherit"
              onClick={(e) => {
                e.stopPropagation();
                handleMobileMenuOpen(e);
              }}
              sx={{ ml: 0.5 }}
            >
              <MoreVert />
            </IconButton>
            
            {/* Mobile 3-dot Menu */}
            <Menu
              anchorEl={mobileMenuAnchor}
              open={Boolean(mobileMenuAnchor)}
              onClose={() => {
                handleMobileMenuClose();
                // Blur active element to avoid focus re-opening the menu on mobile
                if (document.activeElement && document.activeElement.blur) {
                  document.activeElement.blur();
                }
              }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              disableScrollLock={true}
              keepMounted
              disablePortal
              MenuListProps={{ autoFocus: false }}
              PaperProps={{
                sx: {
                  minWidth: 180,
                  mt: 1
                }
              }}
            >
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {user?.username}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {user?.email}
                </Typography>
              </Box>
              <Divider />
              <MenuItem
                onClick={() => {
                  navigate('/profile');
                  handleMobileMenuClose();
                }}
              >
                <ListItemIcon>
                  <AccountCircle fontSize="small" />
                </ListItemIcon>
                Profile
              </MenuItem>
              <MenuItem
                onClick={() => {
                  navigate('/profile');
                  handleMobileMenuClose();
                }}
              >
                <ListItemIcon>
                  <Settings fontSize="small" />
                </ListItemIcon>
                Settings
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <Logout fontSize="small" />
                </ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Mobile Bottom Navigation - 4 tabs only */}
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: (theme) => theme.zIndex.drawer + 1,
          }}
          elevation={3}
        >
          <BottomNavigation
            value={getNavValue()}
            onChange={(event, newValue) => {
              if (newValue === 0) navigate('/dashboard');
              if (newValue === 1) navigate('/rooms');
              if (newValue === 2) navigate('/friends');
              if (newValue === 3) navigate('/messages');
            }}
            showLabels
          >
            <BottomNavigationAction label="Dashboard" icon={<Dashboard />} />
            <BottomNavigationAction label="Rooms" icon={<Groups />} />
            <BottomNavigationAction label="Friends" icon={<People />} />
            <BottomNavigationAction 
              label="Messages" 
              icon={
                <Badge badgeContent={unreadMessages} color="error" max={99}>
                  <Message />
                </Badge>
              } 
            />
          </BottomNavigation>
        </Paper>
      </>
    );
  }

  // Desktop navigation
  return (
    <AppBar position="sticky" color="default">
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 0, mr: 4, fontWeight: 700, cursor: 'pointer' }}
          onClick={() => navigate('/dashboard')}
        >
          Krios
        </Typography>

        <Box sx={{ flexGrow: 1, display: 'flex', gap: 2 }}>
          <MenuItem
            onClick={() => navigate('/dashboard')}
            selected={location.pathname === '/dashboard'}
          >
            <Dashboard sx={{ mr: 1 }} />
            Dashboard
          </MenuItem>
          <MenuItem
            onClick={() => navigate('/rooms')}
            selected={location.pathname.startsWith('/rooms')}
          >
            <Groups sx={{ mr: 1 }} />
            Rooms
          </MenuItem>
          <MenuItem
            onClick={() => navigate('/friends')}
            selected={location.pathname === '/friends'}
          >
            <People sx={{ mr: 1 }} />
            Friends
          </MenuItem>
          <MenuItem
            onClick={() => navigate('/messages')}
            selected={location.pathname.startsWith('/messages')}
          >
            <Badge badgeContent={unreadMessages} color="error" max={99} sx={{ mr: 1 }}>
              <Message />
            </Badge>
            Messages
          </MenuItem>
        </Box>

        <IconButton color="inherit" onClick={() => navigate('/rooms/create')}>
          <Add />
        </IconButton>

        <NotificationPopup />

        <IconButton onClick={handleMenuOpen} sx={{ ml: 1 }}>
          <Avatar
            src={user?.avatar}
            alt={user?.username}
            sx={{ width: 32, height: 32 }}
          >
            {user?.username?.[0]?.toUpperCase()}
          </Avatar>
        </IconButton>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          onClick={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          disableScrollLock={true}
          PaperProps={{
            sx: {
              overflow: 'hidden',
              mt: 1.5
            }
          }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {user?.username}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.email}
            </Typography>
          </Box>
          <Divider />
          <MenuItem
            onClick={() => {
              navigate('/profile');
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <AccountCircle fontSize="small" />
            </ListItemIcon>
            Profile
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleLogout();
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default memo(Navbar);
