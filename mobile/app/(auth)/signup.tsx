import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { signup } = useAuth();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  // Input focus animations
  const nameFocus = useRef(new Animated.Value(0)).current;
  const emailFocus = useRef(new Animated.Value(0)).current;
  const passwordFocus = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(nameFocus, {
      toValue: name ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [name]);

  useEffect(() => {
    Animated.timing(emailFocus, {
      toValue: email ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [email]);

  useEffect(() => {
    Animated.timing(passwordFocus, {
      toValue: password ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [password]);

  const isFormValid = name.trim() && email.trim() && password.length >= 6;

  const getBorderColor = (focusAnim: Animated.Value) => {
    return focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(255,255,255,0.1)', '#8b5cf6'],
    });
  };

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setError('');
    setLoading(true);
    
    try {
      const result = await signup(name.trim(), email.trim(), password);
      
      if (result.success) {
        router.replace('/(auth)/login');
      } else {
        setError(result.message || 'Could not create account');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background */}
      <LinearGradient
        colors={['#0a0a0f', '#12121a', '#0a0a0f']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Glow */}
      <View style={styles.glowContainer}>
        <View style={styles.glow} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View 
            style={[
              styles.content, 
              { 
                opacity: fadeAnim, 
                transform: [{ translateY: slideAnim }] 
              }
            ]}
          >
            {/* Logo */}
            <Animated.View 
              style={[
                styles.logoSection, 
                { transform: [{ scale: logoScale }] }
              ]}
            >
              <View style={styles.logoWrapper}>
                <View style={styles.logoGlow} />
                <Image
                  source={require('../../assets/krios-logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Start your orbit journey</Text>
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Form */}
            <View style={styles.form}>
              {/* Name */}
              <Animated.View 
                style={[
                  styles.inputWrapper,
                  { borderColor: getBorderColor(nameFocus) }
                ]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.4)" />
                </View>
                <TextInput
                  style={[styles.input, {
                    outlineStyle: 'none',
                    borderWidth: 0,
                  } as any]}
                  placeholder="full name"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    setError('');
                  }}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                {name ? (
                  <TouchableOpacity onPress={() => setName('')}>
                    <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                ) : null}
              </Animated.View>

              {/* Email */}
              <Animated.View 
                style={[
                  styles.inputWrapper,
                  { borderColor: getBorderColor(emailFocus) }
                ]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.4)" />
                </View>
                <TextInput
                  style={[styles.input, {
                    outlineStyle: 'none',
                    borderWidth: 0,
                  } as any]}
                  placeholder="email"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError('');
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                />
                {email ? (
                  <TouchableOpacity onPress={() => setEmail('')}>
                    <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                ) : null}
              </Animated.View>

              {/* Password */}
              <Animated.View 
                style={[
                  styles.inputWrapper,
                  { borderColor: getBorderColor(passwordFocus) }
                ]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.4)" />
                </View>
                <TextInput
                  style={[styles.input, {
                    outlineStyle: 'none',
                    borderWidth: 0,
                  } as any]}
                  placeholder="password"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError('');
                  }}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleSignup}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color="rgba(255,255,255,0.4)"
                  />
                </TouchableOpacity>
              </Animated.View>

              {/* Password hint */}
              <View style={styles.passwordHint}>
                <Ionicons
                  name={password.length >= 6 ? 'checkmark-circle' : 'ellipse-outline'}
                  size={14}
                  color={password.length >= 6 ? '#10b981' : 'rgba(255,255,255,0.25)'}
                />
                <Text style={[
                  styles.hintText,
                  password.length >= 6 && styles.hintTextActive
                ]}>
                  At least 6 characters
                </Text>
              </View>

              {/* Signup Button */}
              <TouchableOpacity
                onPress={handleSignup}
                disabled={loading || !isFormValid}
                activeOpacity={0.8}
                style={styles.signupButton}
              >
                <LinearGradient
                  colors={
                    isFormValid
                      ? ['#8b5cf6', '#a855f7']
                      : ['rgba(139,92,246,0.3)', 'rgba(168,85,247,0.3)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.signupGradient, !isFormValid && styles.signupDisabled]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.signupText}>Create Account</Text>
                      <Ionicons name="rocket" size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Terms */}
              <Text style={styles.terms}>
                By signing up, you agree to our{' '}
                <Text style={styles.link}>Terms</Text> and{' '}
                <Text style={styles.link}>Privacy</Text>
              </Text>
            </View>

            {/* Login Link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.loginLink}>Sign in</Text>
              </TouchableOpacity>
            </View>

            {/* Back */}
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.replace('/(onboarding)/auth-choice')}
            >
              <Ionicons name="arrow-back" size={16} color="rgba(255,255,255,0.3)" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </Animated.View>
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
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    top: -150,
    left: screenWidth / 2 - 200,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 30,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrapper: {
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
  },
  logo: {
    width: 76,
    height: 76,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 6,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#fca5a5',
  },
  form: {
    gap: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 4,
  },
  inputIcon: {
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
    paddingVertical: 16,
    letterSpacing: 0.5,
  },
  passwordHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    marginLeft: 4,
  },
  hintText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
  },
  hintTextActive: {
    color: '#10b981',
  },
  signupButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  signupGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 10,
  },
  signupDisabled: {
    opacity: 0.5,
  },
  signupText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  terms: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  link: {
    color: '#8b5cf6',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
  },
  loginLink: {
    color: '#8b5cf6',
    fontSize: 15,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 12,
    gap: 6,
  },
  backText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },
});
