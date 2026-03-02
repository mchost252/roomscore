import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

/**
 * Root index - handles onboarding and authentication routing
 */
export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Single unified effect for all routing logic
  useEffect(() => {
    const handleRouting = async () => {
      try {
        const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
        
        if (!hasCompletedOnboarding) {
          // First time user - show onboarding
          router.replace('/(onboarding)/name-input');
          return;
        }
        
        // Wait for auth to finish loading
        if (loading) {
          return;
        }
        
        const inAuthGroup = segments[0] === '(auth)';
        const inOnboardingGroup = segments[0] === '(onboarding)';
        const segmentLen = (segments as string[]).length;
        const atRoot = segmentLen === 0 || (segmentLen === 1 && (segments as string[])[0] === 'index');
        
        if (user && (inAuthGroup || inOnboardingGroup || atRoot)) {
          // User is logged in but not in home - redirect
          router.replace('/(home)');
        } else if (!user && !inAuthGroup && !inOnboardingGroup) {
          // Not logged in and not in auth/onboarding - go to login
          router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error('Error in routing:', error);
        router.replace('/(onboarding)/name-input');
      } finally {
        setCheckingOnboarding(false);
      }
    };
    
    handleRouting();
  }, [user, loading, segments]);

  if (loading || checkingOnboarding) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});
