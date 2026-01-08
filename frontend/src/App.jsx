import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, Box } from '@mui/material';
import { useAuth } from './context/AuthContext';
import { useTheme as useCustomTheme } from './context/ThemeContext';

// Components (loaded immediately)
import Navbar from './components/Navbar';
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

function App() {
  const { mode } = useCustomTheme();
  const { user } = useAuth();

  return (
    <>
      <CssBaseline />
      {/* Show push notification prompt for logged-in users */}
      {user && <PushNotificationPrompt />}
      <Box sx={{ 
        minHeight: '100vh',
        bgcolor: 'background.default',
        pb: { xs: 8, sm: 0 }
      }}>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            } />
            <Route path="/signup" element={
              <PublicRoute>
                <SignupPage />
              </PublicRoute>
            } />

            {/* Protected Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Navbar />
                <DashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/rooms" element={
              <ProtectedRoute>
                <Navbar />
                <RoomListPage />
              </ProtectedRoute>
            } />
            <Route path="/rooms/create" element={
              <ProtectedRoute>
                <Navbar />
                <CreateRoomPage />
              </ProtectedRoute>
            } />
            <Route path="/rooms/:roomId" element={
              <ProtectedRoute>
                <Navbar />
                <RoomDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Navbar />
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/friends" element={
              <ProtectedRoute>
                <Navbar />
                <FriendsPage />
              </ProtectedRoute>
            } />
            <Route path="/messages" element={
              <ProtectedRoute>
                <Navbar />
                <MessagesPage />
              </ProtectedRoute>
            } />
            <Route path="/messages/:friendId" element={
              <ProtectedRoute>
                <Navbar />
                <MessagesPage />
              </ProtectedRoute>
            } />
            <Route path="/changelog" element={
              <ProtectedRoute>
                <Navbar />
                <ChangelogPage />
              </ProtectedRoute>
            } />

            {/* Default Route */}
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Suspense>

      </Box>
    </>
  );
}

export default App;
