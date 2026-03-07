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
  ScrollView, 
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { validateInput, signupSchema } from '../../utils/validation';
import { authHaptics } from '../../utils/haptics';
import theme from '../../src/constants/theme';

const { width: screenWidth } = Dimensions.get('window');

// Password strength checker
const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
  let strength = 0;
  if (password.length >= 8) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/[a-z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^A-Za-z0-9]/.test(password)) strength += 1;

  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = [theme.colors.error, '#f87171', theme.colors.warning, '#34d399', theme.colors.primary, theme.colors.secondary];
  
  return {
    strength,
    label: labels[strength],
    color: colors[strength],
  };
};

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  
  const router = useRouter();
  const { signup } = useAuth();
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  
  // Button press animation
  const buttonScale = useRef(new Animated.Value(1)).current;
  
  // Success animation
  const successScale = useRef(new Animated.Value(0)).current;
  
  // Input refs
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

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

  // Load user's name from onboarding
  useEffect(() => {
    const loadUserName = async () => {
      try {
        const savedName = await AsyncStorage.getItem('userName');
        if (savedName) {
          setName(savedName);
        }
      } catch (error) {
        console.log('Error loading username:', error);
      }
    };
    loadUserName();
  }, []);

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
    
    Animated.spring(successScale, {
      toValue: 1,
      tension: 50,
      friction: 6,
      useNativeDriver: true,
    }).start();
  };

  const passwordStrength = getPasswordStrength(password);

  const validateForm = useCallback(() => {
    const result = validateInput(signupSchema, { name, email, password, confirmPassword });
    if (!result.success) {
      setErrors(result.errors);
      triggerShake();
      authHaptics.error();
      return false;
    }
    setErrors({});
    return true;
  }, [name, email, password, confirmPassword, triggerShake]);

  const handleSignup = async () => {
    Keyboard.dismiss();
    
    if (!validateForm()) return;

    setLoading(true);
    authHaptics.buttonPress();

    try {
      const result = await signup(name.trim(), email.trim(), password);
      if (result.success) {
        triggerSuccess();
        setTimeout(() => {
          router.replace('/(home)');
        }, 800);
      } else {
        setErrors({ general: result.message || 'Could not create account' });
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
              <Animated.View>
                <Ionicons name="checkmark-done" size={48} color={theme.colors.success} />
              </Animated.View>
            </View>
            <Text style={styles.successText}>Welcome to Krios!</Text>
            <Text style={styles.successSubtext}>Setting up your account...</Text>
          </Animated.View>
        )}

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Start your journey with Krios</Text>
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
                {/* Name */}
                <Animated.View style={getInputStyle('name', nameFocused)}>
                  <View style={styles.inputIcon}>
                    <Ionicons name="person-outline" size={18} color={theme.colors.textMuted} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Full name"
                    placeholderTextColor={theme.colors.textHint}
                    value={name}
                    onChangeText={(text) => {
                      setName(text);
                      if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                    }}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => emailInputRef.current?.focus()}
                    onFocus={() => {
                      setNameFocused(true);
                      authHaptics.inputFocus();
                    }}
                    onBlur={() => setNameFocused(false)}
                    accessibilityLabel="Full name input"
                  />
                  {name ? (
                    <TouchableOpacity onPress={() => setName('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </Animated.View>
                {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}

                {/* Email */}
                <Animated.View style={getInputStyle('email', emailFocused)}>
                  <View style={styles.inputIcon}>
                    <Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} />
                  </View>
                  <TextInput
                    ref={emailInputRef}
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
                  />
                  {email ? (
                    <TouchableOpacity onPress={() => setEmail('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </Animated.View>
                {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}

                {/* Password */}
                <Animated.View style={getInputStyle('password', passwordFocused)}>
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
                    returnKeyType="next"
                    onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                    onFocus={() => {
                      setPasswordFocused(true);
                      authHaptics.inputFocus();
                    }}
                    onBlur={() => setPasswordFocused(false)}
                    accessibilityLabel="Password input"
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
                </Animated.View>
                {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
                
                {/* Password Strength Indicator */}
                {password.length > 0 && (
                  <View style={styles.strengthContainer}>
                    <View style={styles.strengthBar}>
                      <Animated.View style={[
                        styles.strengthFill, 
                        { 
                          width: `${(passwordStrength.strength / 5) * 100}%`,
                          backgroundColor: passwordStrength.color 
                        }
                      ]} />
                    </View>
                    <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                      {passwordStrength.label}
                    </Text>
                  </View>
                )}

                {/* Confirm Password */}
                <Animated.View style={getInputStyle('confirmPassword', confirmFocused)}>
                  <View style={styles.inputIcon}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.textMuted} />
                  </View>
                  <TextInput
                    ref={confirmPasswordInputRef}
                    style={styles.input}
                    placeholder="Confirm password"
                    placeholderTextColor={theme.colors.textHint}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' }));
                    }}
                    secureTextEntry={!showConfirmPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSignup}
                    onFocus={() => {
                      setConfirmFocused(true);
                      authHaptics.inputFocus();
                    }}
                    onBlur={() => setConfirmFocused(false)}
                    accessibilityLabel="Confirm password input"
                  />
                  <TouchableOpacity 
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)} 
                    hitSlop={8}
                  >
                    <Ionicons 
                      name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} 
                      size={18} 
                      color={theme.colors.textMuted} 
                    />
                  </TouchableOpacity>
                </Animated.View>
                {errors.confirmPassword ? <Text style={styles.fieldError}>{errors.confirmPassword}</Text> : null}

                {/* Signup Button */}
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    onPress={handleSignup}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={loading}
                    activeOpacity={1}
                    style={styles.signupButton}
                    accessibilityLabel="Create account button"
                    accessibilityRole="button"
                  >
                    <LinearGradient
                      colors={!loading ? theme.gradients.primary : ['rgba(99,102,241,0.3)', 'rgba(139,92,246,0.3)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.signupGradient, loading && styles.signupDisabled]}
                    >
                      {loading ? (
                        <ActivityIndicator color={theme.colors.textPrimary} />
                      ) : (
                        <>
                          <Text style={styles.signupText}>Create Account</Text>
                          <Ionicons name="rocket" size={18} color={theme.colors.textPrimary} />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>

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
                <Ionicons name="arrow-back" size={16} color={theme.colors.textMuted} />
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
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
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 30,
    paddingBottom: 30,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
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
  strengthContainer: {
    marginTop: theme.spacing.sm,
    marginLeft: 4,
  },
  strengthBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    ...theme.typography.caption,
    marginTop: 4,
    fontWeight: '500',
  },
  signupButton: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  signupGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: theme.spacing.xl,
    gap: 10,
  },
  signupDisabled: {
    opacity: 0.5,
  },
  signupText: {
    ...theme.typography.button,
    color: theme.colors.textPrimary,
  },
  terms: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    lineHeight: 20,
  },
  link: {
    color: theme.colors.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  footerText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  loginLink: {
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
  successSubtext: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
});
