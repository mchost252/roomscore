import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { storage } from '../services/storage';

/**
 * Root index - handles onboarding and authentication routing
 * Prevents flash of wrong content with proper loading states
 */
export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);

  const checkRouting = useCallback(async () => {
    try {
      // Wait for auth to initialize
      if (authLoading) return;

      const hasCompletedOnboarding = await storage.getItem('hasCompletedOnboarding');
      const currentSegment = segments[0];
      
      // Routing logic
      if (!hasCompletedOnboarding) {
        // First time user - show onboarding
        router.replace('/(onboarding)/name-input');
        return;
      }

      // Onboarding complete, check auth state
      const inAuthGroup = currentSegment === '(auth)';
      const inOnboardingGroup = currentSegment === '(onboarding)';
      const inHomeGroup = currentSegment === '(home)';
      
      if (user) {
        // User is logged in
        if (!inHomeGroup) {
          router.replace('/(home)');
        }
      } else {
        // User is not logged in
        if (!inAuthGroup && !inOnboardingGroup) {
          router.replace('/(auth)/login');
        }
      }
    } catch (error) {
      console.error('Error in routing:', error);
      // Fallback to onboarding on error
      router.replace('/(onboarding)/name-input');
    } finally {
      setHasCheckedOnboarding(true);
      setIsReady(true);
    }
  }, [user, authLoading, segments, router]);

  useEffect(() => {
    checkRouting();
  }, [checkRouting]);

  // Show loading screen while checking auth/onboarding
  if (authLoading || !isReady || !hasCheckedOnboarding) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Return null when ready (router will handle navigation)
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
    gap: 16,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    marginTop: 8,
  },
});
