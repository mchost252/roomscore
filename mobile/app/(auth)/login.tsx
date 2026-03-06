import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { validateInput, loginSchema } from '../../utils/validation';
import { authHaptics } from '../../utils/haptics';

const { width: screenWidth } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const router = useRouter();
  const { login } = useAuth();
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Input refs for focus management
  const passwordInputRef = useRef<TextInput>(null);

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

  // Shake animation for errors
  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, []);

  const validateForm = useCallback(() => {
    const result = validateInput(loginSchema, { email, password });
    if (!result.success) {
      setErrors(result.errors);
      triggerShake();
      authHaptics.error();
      return false;
    }
    setErrors({});
    return true;
  }, [email, password, triggerShake]);

  const handleLogin = async () => {
    Keyboard.dismiss();
    
    if (!validateForm()) return;

    setLoading(true);
    authHaptics.buttonPress();

    try {
      const result = await login(email.trim(), password);
      if (result.success) {
        authHaptics.success();
        setTimeout(() => {
          router.replace('/(home)');
        }, 300);
      } else {
        setErrors({ general: result.message || 'Login failed' });
        authHaptics.error();
        triggerShake();
      }
    } catch (err: any) {
      setErrors({ general: err.message || 'An error occurred' });
      authHaptics.error();
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const getInputStyle = (field: string) => ({
    ...styles.inputWrapper,
    borderColor: errors[field] ? '#ef4444' : 'rgba(255,255,255,0.1)',
    backgroundColor: errors[field] ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255,255,255,0.03)',
  });

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        {/* Background */}
        <LinearGradient colors={['#0a0a0f', '#12121a', '#0a0a0f']} style={StyleSheet.absoluteFill} />
        
        {/* Glow */}
        <View style={styles.glowContainer}>
          <View style={styles.glow} />
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.keyboardView}
        >
          <Animated.View style={[
            styles.content,
            { 
              opacity: fadeAnim, 
              transform: [{ translateY: slideAnim }, { translateX: shakeAnim }] 
            }
          ]}>
            {/* Logo */}
            <Animated.View style={[styles.logoSection, { transform: [{ scale: logoScale }] }]}>
              <View style={styles.logoWrapper}>
                <View style={styles.logoGlow} />
                <Image 
                  source={require('../../assets/krios-logo.png')} 
                  style={styles.logo} 
                  resizeMode="contain"
                  accessibilityLabel="Krios Logo"
                />
              </View>
            </Animated.View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to continue</Text>
            </View>

            {/* General Error */}
            {errors.general ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color="#ef4444" />
                <Text style={styles.errorText}>{errors.general}</Text>
              </View>
            ) : null}

            {/* Form */}
            <View style={styles.form}>
              {/* Email */}
              <View>
                <View style={getInputStyle('email')}>
                  <View style={styles.inputIcon}>
                    <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.4)" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    onFocus={() => authHaptics.inputFocus()}
                    accessibilityLabel="Email input"
                    accessibilityHint="Enter your email address"
                  />
                  {email ? (
                    <TouchableOpacity onPress={() => setEmail('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
              </View>

              {/* Password */}
              <View>
                <View style={getInputStyle('password')}>
                  <View style={styles.inputIcon}>
                    <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.4)" />
                  </View>
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                    }}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    onFocus={() => authHaptics.inputFocus()}
                    accessibilityLabel="Password input"
                    accessibilityHint="Enter your password"
                  />
                  <TouchableOpacity 
                    onPress={() => setShowPassword(!showPassword)} 
                    hitSlop={8}
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  >
                    <Ionicons 
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'} 
                      size={18} 
                      color="rgba(255,255,255,0.4)" 
                    />
                  </TouchableOpacity>
                </View>
                {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
              </View>

              {/* Forgot */}
              <TouchableOpacity 
                style={styles.forgotButton}
                onPress={() => router.push('/(auth)/forgot-password')}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* Login Button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
                style={styles.loginButton}
                accessibilityLabel="Sign in button"
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={!loading ? ['#6366f1', '#8b5cf6'] : ['rgba(99,102,241,0.3)', 'rgba(139,92,246,0.3)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.loginGradient, loading && styles.loginDisabled]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.loginText}>Sign In</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Sign Up */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                <Text style={styles.signupLink}>Create one</Text>
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
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
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
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    top: -150,
    left: screenWidth / 2 - 200,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
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
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    top: -15,
    left: -15,
    right: -15,
    bottom: -15,
  },
  logo: {
    width: 90,
    height: 90,
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
    // Remove default outlines
    borderWidth: 0,
    outlineWidth: 0,
  },
  fieldError: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  forgotText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  loginGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 10,
  },
  loginDisabled: {
    opacity: 0.5,
  },
  loginText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  footerText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
  },
  signupLink: {
    color: '#6366f1',
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
