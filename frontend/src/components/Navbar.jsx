import React, { useState } from 'react';
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
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useDeviceType } from '../hooks/useDeviceType';
import NotificationPopup from './NotificationPopup';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isMobile } = useDeviceType();
  const [anchorEl, setAnchorEl] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getNavValue = () => {
    if (location.pathname === '/dashboard') return 0;
    if (location.pathname.startsWith('/rooms')) return 1;
    if (location.pathname === '/profile') return 2;
    return 0;
  };

  // Mobile bottom navigation
  if (isMobile) {
    return (
      <>
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
          }}
          elevation={3}
        >
          <BottomNavigation
            value={getNavValue()}
            onChange={(event, newValue) => {
              if (newValue === 0) navigate('/dashboard');
              if (newValue === 1) navigate('/rooms');
              if (newValue === 2) navigate('/profile');
            }}
            showLabels
          >
            <BottomNavigationAction label="Dashboard" icon={<Dashboard />} />
            <BottomNavigationAction label="Rooms" icon={<Groups />} />
            <BottomNavigationAction label="Profile" icon={<AccountCircle />} />
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
          RoomScore
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

export default Navbar;
