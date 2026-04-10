import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { useEffect } from 'react';
import { Platform, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

// Tactical UI components
import { ErrorBoundary } from '../components/ErrorBoundary';
// import TacticalTouchOverlay from '../components/TacticalTouchOverlay'; // <-- UNCOMMENT TO ACTIVATE TACTICAL TOUCH EFFECTS

export default function RootLayout() {
  useEffect(() => {
    console.log('App starting on platform:', Platform.OS);
    
    // Suppress specific warnings in development
    LogBox.ignoreLogs([
      'Unable to activate keep awake',
      'keep awake',
      'Non-serializable values were found in the navigation state',
    ]);
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <ErrorBoundary>
                {/* ── TACTICAL TOUCH OVERLAY ───────────────────────────────────────────
                    Uncomment the line below to activate global tactical touch pings.
                    This uses Skia + Reanimated for zero-lag hardware accelerated feedback.
                */}
                {/* <TacticalTouchOverlay /> */}

                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(onboarding)" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(home)" />
                </Stack>
              </ErrorBoundary>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

