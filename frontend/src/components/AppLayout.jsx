import React, { useState, useEffect, useCallback } from 'react';
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
  useMediaQuery,
} from '@mui/material';
import {
  Dashboard,
  Groups,
  People,
  Message,
  Logout,
  Add,
  Brightness4,
  Brightness7,
  ChevronLeft,
  ChevronRight,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useTheme as useCustomTheme } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { usePremium } from '../context/PremiumContext';
import NotificationPopup from './NotificationPopup';
import { PremiumBackground } from './premium';
import { PremiumBadge } from './premium';
import api from '../utils/api';

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
  const { socket } = useSocket();
  const { isGlobalPremium } = usePremium();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDark = mode === 'dark';
  const sidebarWidth = sidebarExpanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED;

  // Fetch unread message count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get('/direct-messages/unread-count');
      setUnreadMessages(res.data.unreadCount || 0);
    } catch (err) {
      // Silent fail
    }
  }, [user]);

  // Fetch on mount and when user changes
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [user, fetchUnreadCount]);

  // Listen for socket events to update unread count
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      // Extract sender ID from various possible formats
      const senderId = message.sender?._id || message.sender?.id || message.fromUserId || message.fromUser?.id;
      const currentUserId = user?._id || user?.id;
      
      // Check if we're currently viewing messages from this sender
      const isViewingMessages = location.pathname.startsWith('/messages');
      const isViewingThisSender = location.pathname.includes(`/messages/${senderId}`);
      
      // Increment unread count if not viewing this conversation
      if (senderId && senderId !== currentUserId && !isViewingThisSender) {
        setUnreadMessages(prev => prev + 1);
      }
    };

    const handleMessagesRead = () => {
      fetchUnreadCount();
    };

    // Also listen for when we mark messages as read
    const handleConversationRead = () => {
      fetchUnreadCount();
    };

    socket.on('new_direct_message', handleNewMessage);
    socket.on('dm:read', handleMessagesRead);
    socket.on('dm:conversation_read', handleConversationRead);

    return () => {
      socket.off('new_direct_message', handleNewMessage);
      socket.off('dm:read', handleMessagesRead);
      socket.off('dm:conversation_read', handleConversationRead);
    };
  }, [socket, user, location.pathname, fetchUnreadCount]);

  // Clear unread count when visiting messages page
  useEffect(() => {
    if (location.pathname.startsWith('/messages/')) {
      setTimeout(() => {
        api.get('/direct-messages/unread-count')
          .then(res => setUnreadMessages(res.data.unreadCount || 0))
          .catch(() => {});
      }, 500);
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  // Sidebar content
  const SidebarContent = ({ isMobileDrawer = false }) => {
    const currentWidth = isMobileDrawer ? SIDEBAR_WIDTH_MOBILE : sidebarWidth;
    const isExpanded = isMobileDrawer ? false : sidebarExpanded;
    
    return (
    <Box
      sx={{
        width: currentWidth,
        height: '100dvh',
        maxHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isExpanded ? 'flex-start' : 'center',
        py: 2,
        px: isExpanded ? 2 : 0,
        bgcolor: isGlobalPremium
          ? (isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.92)')
          : (isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)'),
        backdropFilter: 'blur(10px)',
        borderRight: `1px solid ${
          isGlobalPremium 
            ? (isDark ? 'rgba(96, 165, 250, 0.15)' : 'rgba(99, 102, 241, 0.1)')
            : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')
        }`,
        transition: 'width 0.3s ease, padding 0.3s ease',
        overflowX: 'hidden',
        overflowY: 'auto',
        position: 'relative',
        zIndex: 10,
        // Premium glow effect on sidebar
        ...(isGlobalPremium && {
          boxShadow: isDark 
            ? '4px 0 30px rgba(96, 165, 250, 0.08), 0 0 60px rgba(139, 92, 246, 0.05)'
            : '4px 0 20px rgba(99, 102, 241, 0.05)',
        }),
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  background: isGlobalPremium
                    ? 'linear-gradient(135deg, #60A5FA 0%, #8B5CF6 50%, #F59E0B 100%)'
                    : 'linear-gradient(135deg, #60A5FA 0%, #F59E0B 100%)',
                  backgroundSize: isGlobalPremium ? '200% auto' : 'auto',
                  animation: isGlobalPremium ? 'nebulaShift 4s ease infinite' : 'none',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  whiteSpace: 'nowrap',
                  filter: isGlobalPremium ? 'drop-shadow(0 0 8px rgba(96, 165, 250, 0.4))' : 'none',
                }}
              >
                Krios
              </Typography>
              {isGlobalPremium && <PremiumBadge size="small" showText={false} />}
            </Box>
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
                  if (isMobileDrawer) setMobileOpen(false);
                  else if (isExpanded) setSidebarExpanded(false);
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
                  // Premium glow on active nav item
                  ...(isGlobalPremium && active && {
                    boxShadow: isDark 
                      ? '0 0 20px rgba(96, 165, 250, 0.2), inset 0 0 15px rgba(96, 165, 250, 0.05)'
                      : '0 0 15px rgba(59, 130, 246, 0.15)',
                    '& .MuiSvgIcon-root': {
                      filter: 'drop-shadow(0 0 6px rgba(96, 165, 250, 0.6))',
                    },
                  }),
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
                    minWidth: 0,
                    width: 48,
                    justifyContent: 'center',
                    color: 'inherit',
                    flexShrink: 0,
                  }}
                >
                  {item.id === 'messages' && unreadMessages > 0 ? (
                    <Badge badgeContent={unreadMessages} color="error" max={99}>
                      <item.icon sx={{ fontSize: 24 }} />
                    </Badge>
                  ) : (
                    <item.icon sx={{ fontSize: 24 }} />
                  )}
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
                  if (isMobileDrawer) setMobileOpen(false);
                  else if (isExpanded) setSidebarExpanded(false);
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
                    minWidth: 0,
                    width: 48,
                    justifyContent: 'center',
                    color: 'inherit',
                    flexShrink: 0,
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
            <ListItemIcon sx={{ minWidth: 0, width: 48, justifyContent: 'center', color: 'inherit', flexShrink: 0 }}>
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
              if (isMobileDrawer) setMobileOpen(false);
              else setSidebarExpanded(false);
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
            <ListItemIcon sx={{ minWidth: 0, width: 48, justifyContent: 'center', flexShrink: 0 }}>
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
                if (isMobileDrawer) setMobileOpen(false);
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
            <ListItemIcon sx={{ minWidth: 0, width: 48, justifyContent: 'center', color: 'inherit', flexShrink: 0 }}>
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
    <Box sx={{ display: 'flex', height: '100dvh', overflow: 'hidden', position: 'relative', bgcolor: isDark ? '#0f172a' : '#f8fafc' }}>
      {/* Premium Background - Nebula & Stars - BEHIND everything */}
      {isGlobalPremium && <PremiumBackground />}

      {/* Backdrop overlay when desktop sidebar is expanded */}
      <Backdrop
        open={sidebarExpanded && !isMobile}
        onClick={() => setSidebarExpanded(false)}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer - 1,
          bgcolor: isGlobalPremium ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.5)',
          backdropFilter: isGlobalPremium ? 'blur(4px)' : 'none',
        }}
      />

      {/* Mobile Header */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          display: { xs: 'flex', md: 'none' },
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          bgcolor: isGlobalPremium
            ? (isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.92)')
            : (isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)'),
          backdropFilter: 'blur(12px)',
          zIndex: 100,
          borderBottom: `1px solid ${
            isGlobalPremium 
              ? (isDark ? 'rgba(96, 165, 250, 0.15)' : 'rgba(99, 102, 241, 0.1)')
              : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')
          }`,
          zIndex: (theme) => theme.zIndex.appBar,
          // Premium glow on mobile header
          ...(isGlobalPremium && {
            boxShadow: isDark 
              ? '0 4px 30px rgba(96, 165, 250, 0.1), 0 0 60px rgba(139, 92, 246, 0.05)'
              : '0 4px 20px rgba(99, 102, 241, 0.08)',
          }),
        }}
      >
        {/* Hamburger Menu + App Name */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            onClick={() => setMobileOpen(true)}
            sx={{ 
              color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)',
              ...(isGlobalPremium && {
                '&:hover': {
                  background: isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(99, 102, 241, 0.08)',
                },
              }),
            }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                background: isGlobalPremium
                  ? 'linear-gradient(135deg, #60A5FA 0%, #8B5CF6 50%, #F59E0B 100%)'
                  : 'linear-gradient(135deg, #60A5FA 0%, #F59E0B 100%)',
                backgroundSize: isGlobalPremium ? '200% auto' : 'auto',
                animation: isGlobalPremium ? 'nebulaShift 4s ease infinite' : 'none',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: isGlobalPremium ? 'drop-shadow(0 0 6px rgba(96, 165, 250, 0.4))' : 'none',
              }}
            >
              Krios
            </Typography>
            {isGlobalPremium && <PremiumBadge size="small" showText={false} />}
          </Box>
        </Box>

        {/* Notifications */}
        <NotificationPopup />
      </Box>

      {/* Mobile Drawer - Temporary (collapsed icons only) */}
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
            position: 'fixed',
            top: 0,
            height: '100dvh',
            maxHeight: '100dvh',
          },
        }}
      >
        <SidebarContent isMobileDrawer={true} />
      </Drawer>

      {/* Desktop Sidebar - Permanent & Fixed */}
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
              position: 'fixed',
              top: 0,
              height: '100dvh',
              maxHeight: '100dvh',
              zIndex: (theme) => theme.zIndex.drawer,
            },
          }}
        >
          <SidebarContent isMobileDrawer={false} />
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          height: '100dvh',
          overflow: 'hidden',
          // Make background transparent/semi-transparent when premium to show nebula
          bgcolor: 'transparent',
          background: isGlobalPremium
            ? (isDark 
                ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.5) 0%, rgba(30, 41, 59, 0.6) 100%)'
                : 'linear-gradient(135deg, rgba(248, 250, 252, 0.7) 0%, rgba(226, 232, 240, 0.7) 100%)')
            : (isDark 
                ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
                : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'),
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Page Content */}
        <Box
          className={isGlobalPremium ? 'premium-scrollbar' : ''}
          sx={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            p: { xs: 1.5, md: 3 },
            pt: { xs: 'calc(56px + 12px)', md: 3 }, // Account for mobile header
            minHeight: 0,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default AppLayout;
