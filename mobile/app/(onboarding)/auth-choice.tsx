import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../../src/constants/theme';

export default function AuthChoiceScreen() {
  const [userName, setUserName] = useState('');
  const router = useRouter();

  // Entrance animations (UI thread)
  const screenOpacity = useSharedValue(0);
  const screenSlide = useSharedValue(30);
  const logoScale = useSharedValue(0.8);
  const pillsOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);
  const buttonsSlide = useSharedValue(20);

  useEffect(() => {
    AsyncStorage.getItem('userName').then((n) => setUserName(n || 'there'));

    // Staggered entrance: logo → content → pills → buttons
    logoScale.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
    screenOpacity.value = withTiming(1, { duration: 600 });
    screenSlide.value = withTiming(0, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
    pillsOpacity.value = withDelay(350, withTiming(1, { duration: 400 }));
    buttonsOpacity.value = withDelay(550, withTiming(1, { duration: 500 }));
    buttonsSlide.value = withDelay(
      550,
      withTiming(0, {
        duration: 450,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, []);

  const handleLogin = useCallback(async () => {
    await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    router.replace('/(auth)/login');
  }, [router]);

  const handleSignup = useCallback(async () => {
    await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    router.replace('/(auth)/signup');
  }, [router]);

  // --- Animated styles ---
  const contentStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ translateY: screenSlide.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const pillsStyle = useAnimatedStyle(() => ({
    opacity: pillsOpacity.value,
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: buttonsSlide.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Background */}
      <LinearGradient
        colors={[colors.background, colors.backgroundSecondary, colors.background]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow */}
      <View style={styles.glowContainer}>
        <View style={[styles.glow, styles.glow1]} />
        <View style={[styles.glow, styles.glow2]} />
      </View>

      <Animated.View style={[styles.content, contentStyle]}>
        {/* Logo */}
        <Animated.View style={[styles.logoSection, logoStyle]}>
          <View style={styles.logoWrapper}>
            <View style={styles.logoGlow} />
            <Image
              source={require('../../assets/krios-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Welcome text */}
        <View style={styles.welcomeSection}>
          <Text style={styles.greeting}>Welcome, {userName}</Text>
          <Text style={styles.subtext}>
            Ready to start building better habits?
          </Text>
        </View>

        {/* Feature pills */}
        <Animated.View style={[styles.featurePills, pillsStyle]}>
          <View style={styles.pill}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={styles.pillText}>Free forever</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={styles.pillText}>No credit card</Text>
          </View>
        </Animated.View>

        {/* Auth buttons */}
        <Animated.View style={[styles.buttonsContainer, buttonsStyle]}>
          {/* Sign Up — Primary */}
          <TouchableOpacity
            onPress={handleSignup}
            activeOpacity={0.8}
            style={styles.signupButton}
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.signupGradient}
            >
              <View style={styles.buttonContent}>
                <View style={styles.buttonIconBg}>
                  <Ionicons name="rocket" size={20} color="#fff" />
                </View>
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.signupTitle}>Create Account</Text>
                  <Text style={styles.signupSubtitle}>
                    Start your orbit journey
                  </Text>
                </View>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color="rgba(255,255,255,0.5)"
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Login — Secondary */}
          <TouchableOpacity
            onPress={handleLogin}
            activeOpacity={0.7}
            style={styles.loginButton}
          >
            <View style={styles.loginContent}>
              <View style={[styles.buttonIconBg, styles.loginIconBg]}>
                <Ionicons name="log-in-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.buttonTextContainer}>
                <Text style={styles.loginTitle}>Sign In</Text>
                <Text style={styles.loginSubtitle}>Welcome back</Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Terms */}
        <Text style={styles.terms}>
          By continuing, you agree to our{' '}
          <Text style={styles.link}>Terms</Text> and{' '}
          <Text style={styles.link}>Privacy</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    borderRadius: 300,
    opacity: 0.12,
  },
  glow1: {
    width: 400,
    height: 400,
    backgroundColor: colors.primary,
    top: -150,
    right: -100,
  },
  glow2: {
    width: 300,
    height: 300,
    backgroundColor: colors.secondary,
    bottom: -100,
    left: -50,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoWrapper: {
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    top: -20,
    left: -20,
  },
  logo: {
    width: 100,
    height: 100,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  featurePills: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  pillText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  buttonsContainer: {
    gap: 14,
  },
  signupButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  signupGradient: {
    padding: 3,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 14,
  },
  buttonIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonTextContainer: {
    flex: 1,
  },
  signupTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  signupSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  loginButton: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  loginContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 14,
  },
  loginIconBg: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  loginTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  loginSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  terms: {
    fontSize: 12,
    color: colors.textHint,
    textAlign: 'center',
    marginTop: 'auto',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    lineHeight: 20,
  },
  link: {
    color: colors.primary,
  },
});
