import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, Box, CircularProgress, GlobalStyles } from '@mui/material';
import { useAuth } from './context/AuthContext';
import { usePremium } from './context/PremiumContext';
import { useTheme } from '@mui/material/styles';

// Components
import AppLayout from './components/AppLayout';
import LoadingScreen from './components/LoadingScreen';
import PushNotificationPrompt from './components/PushNotificationPrompt';
import { PremiumTransitionOverlay } from './components/animations';

// Pages (lazy loaded for code splitting)
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RoomListPage = lazy(() => import('./pages/RoomListPage'));
const RoomDetailPage = lazy(() => import('./pages/RoomDetailPage'));
const CreateRoomPage = lazy(() => import('./pages/CreateRoomPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'));

// Inline loading spinner for content area only (doesn't cover sidebar)
const ContentLoadingFallback = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '50vh',
      width: '100%',
    }}
  >
    <CircularProgress size={40} />
  </Box>
);

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  return user ? children : <Navigate to="/login" />;
};

// Public Route Component (redirect to dashboard if logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  return user ? <Navigate to="/dashboard" /> : children;
};

// Layout wrapper for protected routes - Suspense is INSIDE the layout
const ProtectedLayout = ({ children }) => {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Suspense fallback={<ContentLoadingFallback />}>
          {children}
        </Suspense>
        {/* Push notification prompt - shows once for new users */}
        <PushNotificationPrompt />
      </AppLayout>
    </ProtectedRoute>
  );
};

function App() {
  const { isGlobalPremium } = usePremium();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <>
      <CssBaseline />
      
      {/* Global Premium Styles - Apply to ALL components */}
      {isGlobalPremium && (
        <GlobalStyles styles={{
          // Add subtle noise texture to body for premium feel
          'body::before': {
            content: '""',
            position: 'fixed',
            inset: 0,
            background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.03\'/%3E%3C/svg%3E")',
            pointerEvents: 'none',
            zIndex: 9999,
            mixBlendMode: 'overlay',
          },
          // Apply premium styling to ALL MUI Cards - NO ANIMATIONS FOR PERFORMANCE
          '.MuiCard-root': {
            background: isDark
              ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%) !important'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.99) 100%) !important',
            backdropFilter: 'blur(12px) saturate(150%) !important',
            WebkitBackdropFilter: 'blur(12px) saturate(150%) !important',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderImage: isDark
              ? 'linear-gradient(135deg, rgba(96, 165, 250, 0.3), rgba(139, 92, 246, 0.2), rgba(96, 165, 250, 0.3)) 1'
              : 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.25)) 1',
            boxShadow: isDark
              ? '0 0 15px rgba(96, 165, 250, 0.12), 0 2px 8px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.3), 0 16px 48px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important'
              : '0 0 18px rgba(99, 102, 241, 0.15), 0 2px 6px rgba(0, 0, 0, 0.1), 0 8px 20px rgba(0, 0, 0, 0.08), 0 16px 40px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9) !important',
            position: 'relative',
            overflow: 'hidden',
            transition: 'box-shadow 0.2s ease, border 0.2s ease !important',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '1px',
              background: `linear-gradient(90deg, transparent, ${isDark ? 'rgba(96, 165, 250, 0.6)' : 'rgba(99, 102, 241, 0.5)'}, transparent)`,
              zIndex: 1,
            },
            // Border sweep effect - subtle white glow on edges (no rotation)
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              pointerEvents: 'none',
              zIndex: 2,
              boxShadow: `inset 0 1px 0 0 ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'}`,
            },
            '&:hover': {
              borderImage: isDark
                ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(236, 72, 153, 0.3), rgba(139, 92, 246, 0.5)) 1'
                : 'linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(168, 85, 247, 0.25), rgba(139, 92, 246, 0.4)) 1',
              boxShadow: isDark
                ? '0 0 30px rgba(96, 165, 250, 0.25), 0 0 60px rgba(139, 92, 246, 0.15), 0 4px 12px rgba(0, 0, 0, 0.5), 0 12px 36px rgba(0, 0, 0, 0.4), 0 24px 60px rgba(0, 0, 0, 0.2) !important'
                : '0 0 28px rgba(99, 102, 241, 0.22), 0 0 50px rgba(139, 92, 246, 0.15), 0 4px 10px rgba(0, 0, 0, 0.12), 0 12px 30px rgba(0, 0, 0, 0.1), 0 24px 50px rgba(0, 0, 0, 0.06) !important',
            },
          },
          // Premium buttons with VISIBLE shine
          '.MuiButton-contained': {
            background: 'linear-gradient(135deg, #60A5FA, #8B5CF6) !important',
            boxShadow: isDark
              ? '0 0 25px rgba(96, 165, 250, 0.4), 0 4px 15px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important'
              : '0 0 20px rgba(96, 165, 250, 0.35), 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4) !important',
            border: '1px solid rgba(96, 165, 250, 0.4)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-50%',
              left: '-60%',
              width: '40%',
              height: '200%',
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent)',
              transform: 'rotate(25deg)',
              animation: 'buttonShine 4s ease-in-out infinite',
            },
            '&:hover': {
              background: 'linear-gradient(135deg, #3B82F6, #7C3AED) !important',
              boxShadow: isDark
                ? '0 0 35px rgba(96, 165, 250, 0.6), 0 0 60px rgba(139, 92, 246, 0.3), 0 6px 20px rgba(0, 0, 0, 0.4) !important'
                : '0 0 30px rgba(96, 165, 250, 0.5), 0 0 50px rgba(139, 92, 246, 0.25), 0 6px 18px rgba(0, 0, 0, 0.2) !important',
              '&::before': {
                animationDuration: '2s',
              },
            },
          },
          // Premium chips
          '.MuiChip-root': {
            background: isDark
              ? 'rgba(96, 165, 250, 0.15) !important'
              : 'rgba(99, 102, 241, 0.1) !important',
            border: `1px solid ${isDark ? 'rgba(96, 165, 250, 0.3)' : 'rgba(99, 102, 241, 0.2)'} !important`,
            boxShadow: `0 0 10px ${isDark ? 'rgba(96, 165, 250, 0.2)' : 'rgba(99, 102, 241, 0.15)'} !important`,
          },
          // Premium avatars - add glow
          '.MuiAvatar-root': {
            boxShadow: isDark
              ? '0 0 15px rgba(96, 165, 250, 0.3), 0 0 30px rgba(139, 92, 246, 0.15) !important'
              : '0 0 10px rgba(99, 102, 241, 0.2), 0 0 20px rgba(139, 92, 246, 0.1) !important',
            border: `2px solid ${isDark ? 'rgba(96, 165, 250, 0.3)' : 'rgba(99, 102, 241, 0.2)'} !important`,
          },
          // Premium text - make large numbers glow
          '.MuiTypography-h1, .MuiTypography-h2, .MuiTypography-h3': {
            textShadow: isDark
              ? '0 0 20px rgba(96, 165, 250, 0.4), 0 0 40px rgba(139, 92, 246, 0.2)'
              : '0 0 15px rgba(99, 102, 241, 0.3), 0 0 30px rgba(139, 92, 246, 0.15)',
          },
          // Premium icons - add glow
          '.MuiSvgIcon-root': {
            filter: isDark
              ? 'drop-shadow(0 0 4px rgba(96, 165, 250, 0.3))'
              : 'drop-shadow(0 0 3px rgba(99, 102, 241, 0.2))',
          },
          // Neumorphic list items / nav buttons
          '.MuiListItemButton-root': {
            borderRadius: '12px !important',
            margin: '4px 8px !important',
            background: isDark
              ? 'linear-gradient(145deg, #1e2940, #1a2332)'
              : 'linear-gradient(145deg, #f5f8fc, #e0e5ec)',
            boxShadow: isDark
              ? '3px 3px 6px rgba(10, 15, 25, 0.5), -3px -3px 6px rgba(40, 50, 70, 0.3)'
              : '3px 3px 6px rgba(180, 190, 200, 0.5), -3px -3px 6px rgba(255, 255, 255, 0.7)',
            transition: 'all 0.15s ease !important',
            '&:hover': {
              background: isDark
                ? 'linear-gradient(145deg, #212c3e, #1c2738)'
                : 'linear-gradient(145deg, #ffffff, #eaeff5)',
              boxShadow: isDark
                ? '4px 4px 8px rgba(10, 15, 25, 0.6), -4px -4px 8px rgba(40, 50, 70, 0.4), 0 0 10px rgba(96, 165, 250, 0.15)'
                : '4px 4px 8px rgba(180, 190, 200, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.8), 0 0 8px rgba(99, 102, 241, 0.1)',
            },
            '&.Mui-selected': {
              background: isDark
                ? 'linear-gradient(145deg, #1a2332, #1e2940) !important'
                : 'linear-gradient(145deg, #e0e5ec, #f5f8fc) !important',
              boxShadow: isDark
                ? 'inset 3px 3px 6px rgba(10, 15, 25, 0.6), inset -3px -3px 6px rgba(40, 50, 70, 0.3), 0 0 15px rgba(96, 165, 250, 0.2) !important'
                : 'inset 3px 3px 6px rgba(180, 190, 200, 0.6), inset -3px -3px 6px rgba(255, 255, 255, 0.8), 0 0 12px rgba(99, 102, 241, 0.15) !important',
            },
          },
          // Premium Paper components - simplified for performance
          '.MuiPaper-root': {
            background: isDark
              ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%) !important'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.99) 100%) !important',
            border: `1px solid ${isDark ? 'rgba(96, 165, 250, 0.15)' : 'rgba(99, 102, 241, 0.1)'} !important`,
            boxShadow: isDark
              ? '0 4px 20px rgba(0, 0, 0, 0.3) !important'
              : '0 4px 15px rgba(0, 0, 0, 0.08) !important',
          },
          // Premium text fields & inputs
          '.MuiOutlinedInput-root': {
            borderColor: isDark ? 'rgba(96, 165, 250, 0.3) !important' : 'rgba(99, 102, 241, 0.2) !important',
            '&:hover': {
              boxShadow: `0 0 15px ${isDark ? 'rgba(96, 165, 250, 0.2)' : 'rgba(99, 102, 241, 0.15)'} !important`,
            },
            '&.Mui-focused': {
              boxShadow: `0 0 20px ${isDark ? 'rgba(96, 165, 250, 0.3)' : 'rgba(99, 102, 241, 0.2)'} !important`,
            },
          },
          // Neumorphic IconButtons - 3D pressed effect
          '.MuiIconButton-root': {
            background: isDark
              ? 'linear-gradient(145deg, #1e2940, #1a2332)'
              : 'linear-gradient(145deg, #f5f8fc, #e0e5ec)',
            boxShadow: isDark
              ? '4px 4px 8px rgba(10, 15, 25, 0.6), -4px -4px 8px rgba(40, 50, 70, 0.4)'
              : '4px 4px 8px rgba(180, 190, 200, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.8)',
            transition: 'all 0.15s ease !important',
            '&:hover': {
              background: isDark
                ? 'linear-gradient(145deg, #212c3e, #1a2332)'
                : 'linear-gradient(145deg, #ffffff, #e8ecf2)',
              boxShadow: isDark
                ? '6px 6px 12px rgba(10, 15, 25, 0.7), -6px -6px 12px rgba(40, 50, 70, 0.5), 0 0 15px rgba(96, 165, 250, 0.2)'
                : '6px 6px 12px rgba(180, 190, 200, 0.7), -6px -6px 12px rgba(255, 255, 255, 0.9), 0 0 12px rgba(99, 102, 241, 0.15)',
            },
            '&:active': {
              boxShadow: isDark
                ? 'inset 4px 4px 8px rgba(10, 15, 25, 0.7), inset -4px -4px 8px rgba(40, 50, 70, 0.4)'
                : 'inset 4px 4px 8px rgba(180, 190, 200, 0.7), inset -4px -4px 8px rgba(255, 255, 255, 0.8)',
            },
          },
          // Make badges glow
          '.MuiBadge-badge': {
            boxShadow: isDark
              ? '0 0 10px rgba(239, 68, 68, 0.6), 0 0 20px rgba(239, 68, 68, 0.3) !important'
              : '0 0 8px rgba(220, 38, 38, 0.5), 0 0 15px rgba(220, 38, 38, 0.2) !important',
            animation: 'badgePulse 2s ease-in-out infinite !important',
          },
          // Make tabs glow when selected
          '.MuiTab-root.Mui-selected': {
            color: '#60A5FA !important',
            textShadow: '0 0 10px rgba(96, 165, 250, 0.6) !important',
          },
          // Progress bars
          '.MuiLinearProgress-bar': {
            background: 'linear-gradient(90deg, #60A5FA, #8B5CF6, #EC4899) !important',
            boxShadow: '0 0 15px rgba(96, 165, 250, 0.5) !important',
          },
        }} />
      )}
      
      {/* Premium transition overlay for activation/deactivation */}
      <PremiumTransitionOverlay />
      <Box sx={{ 
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}>
        <Routes>
          {/* Public Routes - still need Suspense for lazy loaded pages */}
          <Route path="/login" element={
            <PublicRoute>
              <Suspense fallback={<LoadingScreen />}>
                <LoginPage />
              </Suspense>
            </PublicRoute>
          } />
          <Route path="/signup" element={
            <PublicRoute>
              <Suspense fallback={<LoadingScreen />}>
                <SignupPage />
              </Suspense>
            </PublicRoute>
          } />

          {/* Protected Routes with AppLayout - Suspense is inside ProtectedLayout */}
          <Route path="/dashboard" element={
            <ProtectedLayout>
              <DashboardPage />
            </ProtectedLayout>
          } />
          <Route path="/rooms" element={
            <ProtectedLayout>
              <RoomListPage />
            </ProtectedLayout>
          } />
          <Route path="/rooms/create" element={
            <ProtectedLayout>
              <CreateRoomPage />
            </ProtectedLayout>
          } />
          <Route path="/rooms/:roomId" element={
            <ProtectedLayout>
              <RoomDetailPage />
            </ProtectedLayout>
          } />
          <Route path="/profile" element={
            <ProtectedLayout>
              <ProfilePage />
            </ProtectedLayout>
          } />
          <Route path="/friends" element={
            <ProtectedLayout>
              <FriendsPage />
            </ProtectedLayout>
          } />
          <Route path="/messages" element={
            <ProtectedLayout>
              <MessagesPage />
            </ProtectedLayout>
          } />
          <Route path="/messages/:friendId" element={
            <ProtectedLayout>
              <MessagesPage />
            </ProtectedLayout>
          } />
          <Route path="/changelog" element={
            <ProtectedLayout>
              <ChangelogPage />
            </ProtectedLayout>
          } />

          {/* Default Route */}
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Box>
    </>
  );
}

export default App;
