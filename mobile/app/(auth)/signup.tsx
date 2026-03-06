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
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { validateInput, signupSchema } from '../../utils/validation';
import { authHaptics } from '../../utils/haptics';

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
  const colors = ['#ef4444', '#f87171', '#fbbf24', '#34d399', '#6366f1', '#8b5cf6'];
  
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
  
  const router = useRouter();
  const { signup } = useAuth();
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Input refs
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

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

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, []);

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
        authHaptics.success();
        // User is already logged in via AuthContext, go to home
        router.replace('/(home)');
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
                <Text style={styles.subtitle}>Start your orbit journey</Text>
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
                {/* Name */}
                <View>
                  <View style={getInputStyle('name')}>
                    <View style={styles.inputIcon}>
                      <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.4)" />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Full name"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={name}
                      onChangeText={(text) => {
                        setName(text);
                        if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                      }}
                      autoCapitalize="words"
                      returnKeyType="next"
                      onSubmitEditing={() => emailInputRef.current?.focus()}
                      onFocus={() => authHaptics.inputFocus()}
                      accessibilityLabel="Full name input"
                    />
                    {name ? (
                      <TouchableOpacity onPress={() => setName('')} hitSlop={8}>
                        <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}
                </View>

                {/* Email */}
                <View>
                  <View style={getInputStyle('email')}>
                    <View style={styles.inputIcon}>
                      <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.4)" />
                    </View>
                    <TextInput
                      ref={emailInputRef}
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
                      returnKeyType="next"
                      onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                      onFocus={() => authHaptics.inputFocus()}
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
                        color="rgba(255,255,255,0.4)" 
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
                  
                  {/* Password Strength Indicator */}
                  {password.length > 0 && (
                    <View style={styles.strengthContainer}>
                      <View style={styles.strengthBar}>
                        <View style={[
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
                </View>

                {/* Confirm Password */}
                <View>
                  <View style={getInputStyle('confirmPassword')}>
                    <View style={styles.inputIcon}>
                      <Ionicons name="shield-checkmark-outline" size={18} color="rgba(255,255,255,0.4)" />
                    </View>
                    <TextInput
                      ref={confirmPasswordInputRef}
                      style={styles.input}
                      placeholder="Confirm password"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={confirmPassword}
                      onChangeText={(text) => {
                        setConfirmPassword(text);
                        if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' }));
                      }}
                      secureTextEntry={!showConfirmPassword}
                      returnKeyType="done"
                      onSubmitEditing={handleSignup}
                      onFocus={() => authHaptics.inputFocus()}
                      accessibilityLabel="Confirm password input"
                    />
                    <TouchableOpacity 
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)} 
                      hitSlop={8}
                    >
                      <Ionicons 
                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} 
                        size={18} 
                        color="rgba(255,255,255,0.4)" 
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.confirmPassword ? <Text style={styles.fieldError}>{errors.confirmPassword}</Text> : null}
                </View>

                {/* Signup Button */}
                <TouchableOpacity
                  onPress={handleSignup}
                  disabled={loading}
                  activeOpacity={0.8}
                  style={styles.signupButton}
                  accessibilityLabel="Create account button"
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={!loading ? ['#8b5cf6', '#a855f7'] : ['rgba(139,92,246,0.3)', 'rgba(168,85,247,0.3)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.signupGradient, loading && styles.signupDisabled]}
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
    borderWidth: 0,
    outlineWidth: 0,
  },
  fieldError: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  strengthContainer: {
    marginTop: 8,
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
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
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
