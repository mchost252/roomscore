import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  Dimensions,
  ScrollView,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import theme from '../../src/constants/theme';

const { width, height } = Dimensions.get('window');

export default function NameInputScreen() {
  const [name, setName] = useState('');
  const router = useRouter();
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;
  const inputFocusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(logoAnim, {
          toValue: 1,
          tension: 45,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    // Animate input border on focus
    Animated.timing(inputFocusAnim, {
      toValue: name.trim() ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [name]);

  const handleContinue = async () => {
    if (name.trim()) {
      await AsyncStorage.setItem('userName', name.trim());
      Keyboard.dismiss();
      router.replace('/(onboarding)/landing');
    }
  };

  const borderColor = inputFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.1)', '#6366f1'],
  });

  return (
    <View style={styles.container}>
      {/* Professional Dark Background */}
      <LinearGradient
        colors={['#0a0a0f', '#12121a', '#0a0a0f']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Subtle gradient overlay */}
      <View style={styles.gradientOverlay} />
      
      {/* Subtle mesh effect */}
      <View style={styles.meshContainer}>
        <View style={[styles.meshDot, styles.mesh1]} />
        <View style={[styles.meshDot, styles.mesh2]} />
        <View style={[styles.meshDot, styles.mesh3]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <Animated.View 
            style={[
              styles.logoSection,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: logoAnim }
                ],
              }
            ]}
          >
            {/* Logo Container with subtle glow */}
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

          {/* Input Section */}
          <Animated.View 
            style={[
              styles.inputSection,
              { opacity: fadeAnim }
            ]}
          >
            {/* Greeting */}
            <Text style={styles.greeting}>Let's get acquainted</Text>
            <Text style={styles.subGreeting}>What should I call you?</Text>

            {/* Custom Input */}
            <Animated.View 
              style={[
                styles.inputWrapper,
                { borderColor }
              ]}
            >
              <TextInput
                style={[styles.input, {
                  outlineStyle: 'none',
                  borderWidth: 0,
                } as any]}
                placeholder="your name"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
              {name.trim() && (
                <TouchableOpacity 
                  onPress={() => setName('')}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* Character hint */}
            {name.trim() && (
              <View style={styles.nameHint}>
                <Text style={styles.nameHintText}>
                  Nice to meet you, <Text style={styles.nameHighlight}>{name.trim()}</Text> ✨
                </Text>
              </View>
            )}

            {/* Continue Button */}
            <TouchableOpacity
              onPress={handleContinue}
              disabled={!name.trim()}
              activeOpacity={0.8}
              style={styles.continueButton}
            >
              <LinearGradient
                colors={name.trim() 
                  ? ['#6366f1', '#8b5cf6'] 
                  : ['rgba(99,102,241,0.3)', 'rgba(139,92,246,0.3)']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.continueGradient,
                  !name.trim() && styles.continueDisabled
                ]}
              >
                <Text style={[
                  styles.continueText,
                  !name.trim() && styles.continueTextDisabled
                ]}>
                  Continue
                </Text>
                {name.trim() && (
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                )}
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
    backgroundColor: '#0a0a0f',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    opacity: 0.8,
  },
  meshContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  meshDot: {
    position: 'absolute',
    borderRadius: 100,
    opacity: 0.15,
  },
  mesh1: {
    width: 300,
    height: 300,
    backgroundColor: '#6366f1',
    top: -100,
    right: -50,
  },
  mesh2: {
    width: 200,
    height: 200,
    backgroundColor: '#8b5cf6',
    bottom: 100,
    left: -30,
  },
  mesh3: {
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
    right: -10,
    bottom: -10,
  },
  logo: {
    width: 100,
    height: 100,
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
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
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subGreeting: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputWrapper: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.03)',
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
    color: '#ffffff',
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
    color: 'rgba(255,255,255,0.5)',
  },
  nameHighlight: {
    color: '#6366f1',
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
    color: '#ffffff',
  },
  continueTextDisabled: {
    color: 'rgba(255,255,255,0.5)',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
  },
});
