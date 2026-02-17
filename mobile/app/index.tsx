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

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
      
      if (!hasCompletedOnboarding) {
        // First time user - show onboarding
        router.replace('/(onboarding)/name-input');
      } else if (!user && !loading) {
        // Returning user, not logged in
        router.replace('/(auth)/login');
      } else if (user) {
        // Logged in user
        router.replace('/(home)');
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      router.replace('/(onboarding)/name-input');
    } finally {
      setCheckingOnboarding(false);
    }
  };

  useEffect(() => {
    if (loading || checkingOnboarding) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (user && (inAuthGroup || inOnboardingGroup)) {
      // User is logged in but still in auth/onboarding, redirect to main app
      router.replace('/(home)');
    }
  }, [user, loading, segments, checkingOnboarding]);

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
