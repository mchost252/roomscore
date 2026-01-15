import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Avatar,
  Badge,
  Divider,
  IconButton,
  Typography,
  useTheme,
  alpha,
  Backdrop,
} from '@mui/material';
import {
  Dashboard,
  Groups,
  People,
  Message,
  Person,
  Settings,
  Logout,
  Add,
  Brightness4,
  Brightness7,
  Menu as MenuIcon,
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useTheme as useCustomTheme } from '../context/ThemeContext';
import NotificationPopup from './NotificationPopup';

// Sidebar widths
const SIDEBAR_WIDTH_COLLAPSED = 72;
const SIDEBAR_WIDTH_EXPANDED = 240;
const SIDEBAR_WIDTH_MOBILE = 64;

// Navigation items
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Dashboard, path: '/dashboard' },
  { id: 'rooms', label: 'Rooms', icon: Groups, path: '/rooms' },
  { id: 'friends', label: 'Friends', icon: People, path: '/friends' },
  { id: 'messages', label: 'Messages', icon: Message, path: '/messages' },
];

const AppLayout = ({ children }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { mode, setThemeMode } = useCustomTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const isDark = mode === 'dark';
  const sidebarWidth = sidebarExpanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  // Sidebar content
  const SidebarContent = ({ isMobile = false }) => {
    const currentWidth = isMobile ? SIDEBAR_WIDTH_MOBILE : sidebarWidth;
    const isExpanded = !isMobile && sidebarExpanded;
    
    return (
    <Box
      sx={{
        width: currentWidth,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isExpanded ? 'flex-start' : 'center',
        py: 2,
        px: isExpanded ? 2 : 0,
        bgcolor: isDark 
          ? 'rgba(15, 23, 42, 0.95)' 
          : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        transition: 'width 0.3s ease, padding 0.3s ease',
        overflow: 'hidden',
      }}
    >
      {/* Logo and Toggle */}
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isExpanded ? 'space-between' : 'center',
          flexDirection: isExpanded ? 'row' : 'column',
          mb: 2,
          gap: isExpanded ? 0 : 1,
        }}
      >
        <Box
          onClick={() => navigate('/dashboard')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            cursor: 'pointer',
            transition: 'transform 0.2s ease',
            '&:hover': {
              transform: 'scale(1.05)',
            },
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <Box
              component="img"
              src="/icon-192x192.png"
              alt="Krios"
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </Box>
          {isExpanded && (
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #60A5FA 0%, #F59E0B 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                whiteSpace: 'nowrap',
              }}
            >
              Krios
            </Typography>
          )}
        </Box>
        
        {/* Expand/Collapse Toggle - Desktop only */}
        {!isMobile && (
          <IconButton
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            size="small"
            sx={{
              color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              },
            }}
          >
            {isExpanded ? <ChevronLeft /> : <ChevronRight />}
          </IconButton>
        )}
      </Box>

      <Divider sx={{ width: isExpanded ? '100%' : '60%', mb: 2, opacity: 0.3, alignSelf: 'center' }} />

      {/* Main Navigation */}
      <List sx={{ flex: 1, width: '100%', px: isExpanded ? 0 : 1 }}>
        {navItems.map((item) => {
          const active = isActive(item.path);
          const navButton = (
            <ListItem disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                  if (isExpanded) setSidebarExpanded(false);
                }}
                sx={{
                  minHeight: 48,
                  justifyContent: isExpanded ? 'flex-start' : 'center',
                  borderRadius: 2,
                  mx: isExpanded ? 0 : 'auto',
                  width: isExpanded ? '100%' : 48,
                  px: isExpanded ? 2 : 0,
                  bgcolor: active 
                    ? (isDark ? 'rgba(96, 165, 250, 0.2)' : 'rgba(59, 130, 246, 0.15)')
                    : 'transparent',
                  color: active 
                    ? (isDark ? '#60A5FA' : '#3B82F6')
                    : (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'),
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: active
                      ? (isDark ? 'rgba(96, 165, 250, 0.25)' : 'rgba(59, 130, 246, 0.2)')
                      : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                    transform: isExpanded ? 'none' : 'scale(1.05)',
                  },
                  // Active indicator
                  position: 'relative',
                  '&::before': active ? {
                    content: '""',
                    position: 'absolute',
                    left: isExpanded ? -16 : -8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 4,
                    height: 24,
                    borderRadius: '0 4px 4px 0',
                    bgcolor: isDark ? '#60A5FA' : '#3B82F6',
                  } : {},
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: isExpanded ? 40 : 0,
                    justifyContent: 'center',
                    color: 'inherit',
                  }}
                >
                  <item.icon sx={{ fontSize: 24 }} />
                </ListItemIcon>
                {isExpanded && (
                  <ListItemText 
                    primary={item.label}
                    sx={{
                      '& .MuiListItemText-primary': {
                        fontWeight: active ? 600 : 500,
                        fontSize: '0.95rem',
                      }
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
          
          return isExpanded ? (
            <Box key={item.id}>{navButton}</Box>
          ) : (
            <Tooltip key={item.id} title={item.label} placement="right" arrow>
              {navButton}
            </Tooltip>
          );
        })}

        {/* Create Room Button */}
        {(() => {
          const createButton = (
            <ListItem disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => {
                  navigate('/rooms/create');
                  if (isMobile) setMobileOpen(false);
                  if (isExpanded) setSidebarExpanded(false);
                }}
                sx={{
                  minHeight: 48,
                  justifyContent: isExpanded ? 'flex-start' : 'center',
                  borderRadius: 2,
                  mx: isExpanded ? 0 : 'auto',
                  width: isExpanded ? '100%' : 48,
                  px: isExpanded ? 2 : 0,
                  color: isDark ? '#F59E0B' : '#D97706',
                  border: `2px dashed ${isDark ? 'rgba(245, 158, 11, 0.5)' : 'rgba(217, 119, 6, 0.4)'}`,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(217, 119, 6, 0.1)',
                    borderColor: isDark ? '#F59E0B' : '#D97706',
                    transform: isExpanded ? 'none' : 'scale(1.05)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: isExpanded ? 40 : 0,
                    justifyContent: 'center',
                    color: 'inherit',
                  }}
                >
                  <Add sx={{ fontSize: 24 }} />
                </ListItemIcon>
                {isExpanded && (
                  <ListItemText 
                    primary="Create Room"
                    sx={{
                      '& .MuiListItemText-primary': {
                        fontWeight: 500,
                        fontSize: '0.95rem',
                      }
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
          
          return isExpanded ? createButton : (
            <Tooltip title="Create Room" placement="right" arrow>
              {createButton}
            </Tooltip>
          );
        })()}
      </List>

      {/* Bottom Section */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: isExpanded ? 'stretch' : 'center', 
        gap: 1,
        width: '100%',
        px: isExpanded ? 0 : 0,
      }}>
        {/* Notifications */}
        <NotificationPopup />

        {/* Theme Toggle */}
        {isExpanded ? (
          <ListItemButton
            onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
            sx={{
              minHeight: 44,
              borderRadius: 2,
              color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
              {isDark ? <Brightness7 /> : <Brightness4 />}
            </ListItemIcon>
            <ListItemText 
              primary={isDark ? 'Light Mode' : 'Dark Mode'}
              sx={{ '& .MuiListItemText-primary': { fontSize: '0.9rem' } }}
            />
          </ListItemButton>
        ) : (
          <Tooltip title={isDark ? 'Light Mode' : 'Dark Mode'} placement="right" arrow>
            <IconButton
              onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
              sx={{
                color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                },
              }}
            >
              {isDark ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Tooltip>
        )}

        <Divider sx={{ width: isExpanded ? '100%' : '60%', my: 1, opacity: 0.3, alignSelf: 'center' }} />

        {/* Profile */}
        {isExpanded ? (
          <ListItemButton
            onClick={() => {
              navigate('/profile');
              if (isMobile) setMobileOpen(false);
              setSidebarExpanded(false);
            }}
            sx={{
              minHeight: 48,
              borderRadius: 2,
              bgcolor: isActive('/profile') 
                ? (isDark ? 'rgba(96, 165, 250, 0.2)' : 'rgba(59, 130, 246, 0.15)')
                : 'transparent',
              '&:hover': {
                bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Avatar
                src={user?.avatar}
                alt={user?.username}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: isDark ? '#60A5FA' : '#3B82F6',
                  fontSize: '0.8rem',
                }}
              >
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
            </ListItemIcon>
            <ListItemText 
              primary={user?.username || 'Profile'}
              secondary="View profile"
              sx={{ 
                '& .MuiListItemText-primary': { 
                  fontSize: '0.9rem', 
                  fontWeight: 500,
                  color: isDark ? '#fff' : '#1e293b',
                },
                '& .MuiListItemText-secondary': { 
                  fontSize: '0.75rem',
                  color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                },
              }}
            />
          </ListItemButton>
        ) : (
          <Tooltip title="Profile" placement="right" arrow>
            <IconButton
              onClick={() => {
                navigate('/profile');
                if (isMobile) setMobileOpen(false);
              }}
              sx={{
                p: 0.5,
                border: isActive('/profile') 
                  ? `2px solid ${isDark ? '#60A5FA' : '#3B82F6'}`
                  : '2px solid transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
              }}
            >
              <Avatar
                src={user?.avatar}
                alt={user?.username}
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: isDark ? '#60A5FA' : '#3B82F6',
                  fontSize: '0.9rem',
                }}
              >
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>
        )}

        {/* Logout */}
        {isExpanded ? (
          <ListItemButton
            onClick={handleLogout}
            sx={{
              minHeight: 44,
              borderRadius: 2,
              color: isDark ? 'rgba(239, 68, 68, 0.8)' : 'rgba(220, 38, 38, 0.8)',
              '&:hover': {
                bgcolor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(220, 38, 38, 0.1)',
                color: isDark ? '#EF4444' : '#DC2626',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
              <Logout sx={{ fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText 
              primary="Logout"
              sx={{ '& .MuiListItemText-primary': { fontSize: '0.9rem' } }}
            />
          </ListItemButton>
        ) : (
          <Tooltip title="Logout" placement="right" arrow>
            <IconButton
              onClick={handleLogout}
              sx={{
                color: isDark ? 'rgba(239, 68, 68, 0.8)' : 'rgba(220, 38, 38, 0.8)',
                '&:hover': {
                  bgcolor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(220, 38, 38, 0.1)',
                  color: isDark ? '#EF4444' : '#DC2626',
                },
              }}
            >
              <Logout sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Backdrop overlay when sidebar is expanded - blocks interaction */}
      <Backdrop
        open={sidebarExpanded}
        onClick={() => setSidebarExpanded(false)}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer - 1,
          bgcolor: 'rgba(0, 0, 0, 0.5)',
          display: { xs: 'none', md: 'block' },
        }}
      />

      {/* Desktop Sidebar */}
      <Box
        component="nav"
        sx={{
          width: SIDEBAR_WIDTH_COLLAPSED,
          flexShrink: 0,
          display: { xs: 'none', md: 'block' },
        }}
      >
        <Drawer
          variant="permanent"
          sx={{
            '& .MuiDrawer-paper': {
              width: sidebarWidth,
              boxSizing: 'border-box',
              border: 'none',
              bgcolor: 'transparent',
              transition: 'width 0.3s ease',
              overflowX: 'hidden',
              zIndex: (theme) => theme.zIndex.drawer,
            },
          }}
        >
          <SidebarContent />
        </Drawer>
      </Box>

      {/* Mobile Sidebar */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH_MOBILE,
            boxSizing: 'border-box',
            border: 'none',
          },
        }}
      >
        <SidebarContent isMobile />
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: '100vh',
          bgcolor: isDark 
            ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
            : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          background: isDark 
            ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
            : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Mobile Header */}
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            display: { xs: 'flex', md: 'none' },
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            bgcolor: isDark 
              ? 'rgba(15, 23, 42, 0.95)' 
              : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            zIndex: (theme) => theme.zIndex.appBar,
          }}
        >
          {/* Left side - Menu + Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={() => setMobileOpen(true)}
              sx={{
                color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)',
              }}
            >
              <MenuIcon />
            </IconButton>
            
            <Box
              component="img"
              src="/icon-192x192.png"
              alt="Krios"
              onClick={() => navigate('/dashboard')}
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                cursor: 'pointer',
              }}
            />
          </Box>

          {/* Right side - Notifications + Profile */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationPopup />
            <Avatar
              src={user?.avatar}
              alt={user?.username}
              sx={{
                width: 32,
                height: 32,
                bgcolor: isDark ? '#60A5FA' : '#3B82F6',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
              onClick={() => navigate('/profile')}
            >
              {user?.username?.[0]?.toUpperCase()}
            </Avatar>
          </Box>
        </Box>

        {/* Page Content */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: { xs: 2, md: 3 },
            pt: { xs: '64px', md: 3 }, // Fixed header height
            pb: { xs: '72px', md: 3 }, // Bottom nav height
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default AppLayout;
