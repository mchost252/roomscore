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
import theme from '../../src/constants/theme';

const { width: screenWidth } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  const router = useRouter();
  const { login } = useAuth();
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  
  // Button press animation
  const buttonScale = useRef(new Animated.Value(1)).current;
  
  // Success animation
  const successScale = useRef(new Animated.Value(0)).current;
  const successRotate = useRef(new Animated.Value(0)).current;
  
  // Input refs for focus management
  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: theme.animations.spring.entrance.tension,
        friction: theme.animations.spring.entrance.friction,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: theme.animations.duration.entrance,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: theme.animations.duration.normal,
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

  // Button press handlers
  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      tension: theme.animations.spring.bouncy.tension,
      friction: theme.animations.spring.bouncy.friction,
      useNativeDriver: true,
    }).start();
  };

  // Success celebration
  const triggerSuccess = () => {
    setIsSuccess(true);
    authHaptics.success();
    
    Animated.parallel([
      Animated.spring(successScale, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(successRotate, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

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
        triggerSuccess();
        setTimeout(() => {
          router.replace('/(home)');
        }, 800);
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

  const getInputStyle = (field: string, isFocused: boolean) => {
    const borderColor = isFocused 
      ? theme.colors.primary 
      : (errors[field] ? theme.colors.error : theme.colors.border);
    
    return {
      ...styles.inputWrapper,
      borderColor,
      backgroundColor: errors[field] ? 'rgba(239, 68, 68, 0.05)' : theme.colors.surface,
    };
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        {/* Background */}
        <LinearGradient 
          colors={theme.gradients.background} 
          style={StyleSheet.absoluteFill} 
        />
        
        {/* Glow */}
        <View style={styles.glowContainer}>
          <View style={styles.glow} />
        </View>

        {/* Success Overlay */}
        {isSuccess && (
          <Animated.View 
            style={[
              styles.successOverlay,
              { 
                opacity: successScale,
                transform: [{ scale: successScale }] 
              }
            ]}
          >
            <View style={styles.successCircle}>
              <Animated.View
                style={{
                  transform: [{
                    rotate: successRotate.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  }],
                }}
              >
                <Ionicons name="checkmark" size={48} color={theme.colors.success} />
              </Animated.View>
            </View>
            <Text style={styles.successText}>Welcome back!</Text>
          </Animated.View>
        )}

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
                <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
                <Text style={styles.errorText}>{errors.general}</Text>
              </View>
            ) : null}

            {/* Form */}
            <View style={styles.form}>
              {/* Email */}
              <View style={getInputStyle('email', emailFocused)}>
                <View style={styles.inputIcon}>
                  <Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={theme.colors.textHint}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  onFocus={() => {
                    setEmailFocused(true);
                    authHaptics.inputFocus();
                  }}
                  onBlur={() => setEmailFocused(false)}
                  accessibilityLabel="Email input"
                  accessibilityHint="Enter your email address"
                />
                {email ? (
                  <TouchableOpacity onPress={() => setEmail('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}

              {/* Password */}
              <View style={getInputStyle('password', passwordFocused)}>
                <View style={styles.inputIcon}>
                  <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />
                </View>
                <TextInput
                  ref={passwordInputRef}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={theme.colors.textHint}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                  }}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  onFocus={() => {
                    setPasswordFocused(true);
                    authHaptics.inputFocus();
                  }}
                  onBlur={() => setPasswordFocused(false)}
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
                      color={theme.colors.textMuted} 
                    />
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

              {/* Remember Me & Forgot Row */}
              <View style={styles.rememberRow}>
                <TouchableOpacity 
                  style={styles.rememberMe}
                  onPress={() => {
                    setRememberMe(!rememberMe);
                    authHaptics.buttonPress();
                  }}
                  hitSlop={8}
                >
                  <Animated.View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && (
                      <Animated.View>
                        <Ionicons name="checkmark" size={12} color={theme.colors.textPrimary} />
                      </Animated.View>
                    )}
                  </Animated.View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.forgotButton}
                  onPress={() => router.push('/(auth)/forgot-password')}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
            
              {/* Login Button */}
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  onPress={handleLogin}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  disabled={loading}
                  activeOpacity={1}
                  style={styles.loginButton}
                  accessibilityLabel="Sign in button"
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={!loading ? theme.gradients.primary : ['rgba(99,102,241,0.3)', 'rgba(139,92,246,0.3)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.loginGradient, loading && styles.loginDisabled]}
                  >
                    {loading ? (
                      <ActivityIndicator color={theme.colors.textPrimary} />
                    ) : (
                      <>
                        <Text style={styles.loginText}>Sign In</Text>
                        <Ionicons name="arrow-forward" size={18} color={theme.colors.textPrimary} />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
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
              <Ionicons name="arrow-back" size={16} color={theme.colors.textMuted} />
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
    backgroundColor: theme.colors.background,
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
    paddingHorizontal: theme.spacing.xl,
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
    width: theme.dimensions.logoLarge,
    height: theme.dimensions.logoLarge,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: theme.spacing.md,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorText: {
    flex: 1,
    ...theme.typography.bodySmall,
    color: theme.colors.errorLight,
  },
  form: {
    gap: theme.spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: theme.spacing.xs,
  },
  inputIcon: {
    paddingHorizontal: theme.spacing.md,
  },
  input: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    paddingVertical: theme.spacing.lg,
    letterSpacing: 0.5,
  },
  fieldError: {
    color: theme.colors.error,
    ...theme.typography.caption,
    marginTop: 2,
    marginLeft: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  rememberMe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.sm,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  rememberText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },
  forgotButton: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    color: theme.colors.primary,
    ...theme.typography.bodySmall,
    fontWeight: '500',
  },
  loginButton: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  loginGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: theme.spacing.xl,
    gap: 10,
  },
  loginDisabled: {
    opacity: 0.5,
  },
  loginText: {
    ...theme.typography.button,
    color: theme.colors.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.xl,
  },
  footerText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  signupLink: {
    ...theme.typography.body,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: 6,
  },
  backText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  // Success overlay
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  successText: {
    ...theme.typography.h2,
    color: theme.colors.success,
  },
});
