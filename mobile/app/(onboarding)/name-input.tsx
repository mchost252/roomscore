import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  interpolateColor,
  FadeIn,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../../src/constants/theme';

export default function NameInputScreen() {
  const [name, setName] = useState('');
  const router = useRouter();

  // Entrance animations (UI thread)
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentSlide = useSharedValue(30);
  // Interactive — border glow reacts to name input
  const inputGlow = useSharedValue(0);

  useEffect(() => {
    // Staggered entrance: logo first, then content
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    logoScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 90 }));
    contentOpacity.value = withDelay(500, withTiming(1, { duration: 700 }));
    contentSlide.value = withDelay(
      500,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  useEffect(() => {
    inputGlow.value = withTiming(name.trim() ? 1 : 0, { duration: 250 });
  }, [name]);

  const handleContinue = useCallback(async () => {
    if (name.trim()) {
      await AsyncStorage.setItem('userName', name.trim());
      Keyboard.dismiss();
      router.replace('/(onboarding)/landing');
    }
  }, [name, router]);

  // --- Animated styles (all on UI thread) ---
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentSlide.value }],
  }));

  const inputBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      inputGlow.value,
      [0, 1],
      [colors.borderLight, colors.primary],
    ),
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.background, colors.backgroundSecondary, colors.background]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow orbs */}
      <View style={styles.orbContainer}>
        <View style={[styles.orb, styles.orb1]} />
        <View style={[styles.orb, styles.orb2]} />
        <View style={[styles.orb, styles.orb3]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
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
            <Text style={styles.appName}>Krios</Text>
            <Text style={styles.tagline}>Your Orbit Companion</Text>
          </Animated.View>

          {/* Input section */}
          <Animated.View style={[styles.inputSection, contentStyle]}>
            <Text style={styles.greeting}>Let's get acquainted</Text>
            <Text style={styles.subGreeting}>What should I call you?</Text>

            <Animated.View style={[styles.inputWrapper, inputBorderStyle]}>
              <TextInput
                style={[
                  styles.input,
                  { outlineStyle: 'none', borderWidth: 0 } as any,
                ]}
                placeholder="your name"
                placeholderTextColor={colors.textHint}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
              {name.trim() ? (
                <TouchableOpacity
                  onPress={() => setName('')}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </Animated.View>

            {/* Live greeting */}
            {name.trim() ? (
              <Animated.View entering={FadeIn.duration(300)} style={styles.nameHint}>
                <Text style={styles.nameHintText}>
                  Nice to meet you,{' '}
                  <Text style={styles.nameHighlight}>{name.trim()}</Text>
                </Text>
              </Animated.View>
            ) : null}

            {/* Continue */}
            <TouchableOpacity
              onPress={handleContinue}
              disabled={!name.trim()}
              activeOpacity={0.8}
              style={styles.continueButton}
            >
              <LinearGradient
                colors={
                  name.trim()
                    ? [colors.primary, colors.secondary]
                    : ['rgba(99,102,241,0.2)', 'rgba(139,92,246,0.2)']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.continueGradient,
                  !name.trim() && styles.continueDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.continueText,
                    !name.trim() && styles.continueTextDisabled,
                  ]}
                >
                  Continue
                </Text>
                {name.trim() ? (
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                ) : null}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By continuing, you agree to our Terms & Privacy
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  orbContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 100,
    opacity: 0.15,
  },
  orb1: {
    width: 300,
    height: 300,
    backgroundColor: colors.primary,
    top: -100,
    right: -50,
  },
  orb2: {
    width: 200,
    height: 200,
    backgroundColor: colors.secondary,
    bottom: 100,
    left: -30,
  },
  orb3: {
    width: 150,
    height: 150,
    backgroundColor: '#a855f7',
    top: '40%',
    right: -20,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
  },
  logoWrapper: {
    position: 'relative',
    marginBottom: 24,
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    top: -10,
    left: -10,
  },
  logo: {
    width: 100,
    height: 100,
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  inputSection: {
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subGreeting: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  inputWrapper: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: colors.textPrimary,
    paddingVertical: 16,
    letterSpacing: 1,
  },
  clearButton: {
    padding: 4,
  },
  nameHint: {
    marginBottom: 20,
  },
  nameHintText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  nameHighlight: {
    color: colors.primary,
    fontWeight: '600',
  },
  continueButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  continueDisabled: {
    opacity: 0.5,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  continueTextDisabled: {
    color: colors.textSecondary,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: colors.textHint,
    textAlign: 'center',
  },
});
