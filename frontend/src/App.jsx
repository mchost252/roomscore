import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import { useAuth } from './context/AuthContext';

// Components
import AppLayout from './components/AppLayout';
import LoadingScreen from './components/LoadingScreen';
import PushNotificationPrompt from './components/PushNotificationPrompt';

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
  return (
    <>
      <CssBaseline />
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
