import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolation,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { colors } from '../../src/constants/theme';

const { width } = Dimensions.get('window');

interface Slide {
  id: number;
  icon: string;
  title: string;
  description: string;
  color: string;
}

const SLIDES: Slide[] = [
  {
    id: 1,
    icon: 'planet',
    title: 'Your Personal Orbit',
    description:
      'Track habits, build streaks, and transform your daily routine into something extraordinary.',
    color: colors.primary,
  },
  {
    id: 2,
    icon: 'people',
    title: 'Together We Rise',
    description:
      'Connect with friends in accountability circles. Motivate each other and celebrate progress.',
    color: colors.secondary,
  },
  {
    id: 3,
    icon: 'flame',
    title: 'Ignite Your Streak',
    description:
      'Never break the chain. Watch your streaks grow as consistency becomes second nature.',
    color: colors.warning,
  },
  {
    id: 4,
    icon: 'notifications',
    title: 'Gentle Reminders',
    description:
      'Smart notifications that nudge you at the right moment. Never miss a habit again.',
    color: colors.accent.pink,
  },
];

// ─── Pagination Dot ──────────────────────────────────────────
interface DotProps {
  index: number;
  scrollX: SharedValue<number>;
}

const Dot = memo(({ index, scrollX }: DotProps) => {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

  const dotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      inputRange,
      [0.25, 1, 0.25],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scaleX: interpolate(
          scrollX.value,
          inputRange,
          [1, 2.8, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return <Animated.View style={[styles.dot, dotStyle]} />;
});

// ─── Slide Item (proper component — safe for hooks) ──────────
interface SlideItemProps {
  item: Slide;
  index: number;
  scrollX: SharedValue<number>;
}

const SlideItem = memo(({ item, index, scrollX }: SlideItemProps) => {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
  const iconAnim = useSharedValue(0);

  // Icon-specific looping animation (runs on UI thread)
  useEffect(() => {
    switch (item.icon) {
      case 'planet':
        iconAnim.value = withRepeat(
          withTiming(1, { duration: 4000, easing: Easing.linear }),
          -1,
          false,
        );
        break;
      case 'people':
        iconAnim.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        );
        break;
      case 'flame':
        iconAnim.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 150 }),
            withTiming(0, { duration: 150 }),
            withTiming(0.5, { duration: 100 }),
            withTiming(0, { duration: 200 }),
          ),
          -1,
          false,
        );
        break;
      case 'notifications':
        iconAnim.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 300 }),
            withTiming(-1, { duration: 600 }),
            withTiming(0, { duration: 300 }),
            withDelay(1000, withTiming(0, { duration: 1 })),
          ),
          -1,
          false,
        );
        break;
    }
  }, []);

  // Scroll-driven slide fade + scale
  const slideStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      inputRange,
      [0.3, 1, 0.3],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          scrollX.value,
          inputRange,
          [0.85, 1, 0.85],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const iconStyle = useAnimatedStyle(() => {
    'worklet';
    switch (item.icon) {
      case 'planet':
        return {
          transform: [
            {
              rotate: `${interpolate(iconAnim.value, [0, 1], [0, 360])}deg`,
            },
          ],
        };
      case 'people':
        return {
          transform: [
            { scale: interpolate(iconAnim.value, [0, 1], [1, 1.12]) },
          ],
        };
      case 'flame':
        return {
          transform: [
            { translateX: interpolate(iconAnim.value, [0, 1], [0, 2]) },
            {
              translateY: interpolate(
                iconAnim.value,
                [0, 0.5, 1],
                [0, -3, 0],
              ),
            },
          ],
        };
      case 'notifications':
        return {
          transform: [
            {
              rotate: `${interpolate(
                iconAnim.value,
                [-1, 0, 1],
                [-15, 0, 15],
              )}deg`,
            },
          ],
        };
      default:
        return {};
    }
  });

  return (
    <Animated.View style={[styles.slide, slideStyle]}>
      {/* Icon with layered glow */}
      <View style={styles.iconWrapper}>
        <View
          style={[
            styles.glowLayer,
            styles.glowOuter,
            { backgroundColor: item.color + '15' },
          ]}
        />
        <View
          style={[
            styles.glowLayer,
            styles.glowMiddle,
            { backgroundColor: item.color + '25' },
          ]}
        />
        <View
          style={[
            styles.glowLayer,
            styles.glowInner,
            { backgroundColor: item.color + '35' },
          ]}
        />

        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: item.color + '20',
              shadowColor: item.color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 20,
            },
          ]}
        >
          <LinearGradient
            colors={[item.color, item.color + '80']}
            style={styles.iconGradient}
          >
            <Animated.View style={iconStyle}>
              <Ionicons name={item.icon as any} size={44} color="#fff" />
            </Animated.View>
          </LinearGradient>
        </View>
      </View>

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </Animated.View>
  );
});

// ─── Main Screen ─────────────────────────────────────────────
export default function LandingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [userName, setUserName] = useState('');
  const router = useRouter();
  const scrollViewRef = useRef<any>(null);

  // Shared values
  const scrollX = useSharedValue(0);
  const headerOpacity = useSharedValue(0);
  const buttonSlide = useSharedValue(40);
  const buttonOpacity = useSharedValue(0);
  const logoScale = useSharedValue(1);

  useEffect(() => {
    AsyncStorage.getItem('userName').then((n) => setUserName(n || 'there'));

    // Staggered entrance
    headerOpacity.value = withTiming(1, { duration: 800 });
    buttonOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
    buttonSlide.value = withDelay(
      400,
      withSpring(0, { damping: 14, stiffness: 100 }),
    );

    // Logo breathe
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.08, {
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, {
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
  }, []);

  // Scroll tracking (UI thread)
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  // React-state update for button label / progress text
  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setCurrentSlide(Math.round(e.nativeEvent.contentOffset.x / width));
    },
    [],
  );

  const handleNext = useCallback(() => {
    if (currentSlide < SLIDES.length - 1) {
      const next = currentSlide + 1;
      scrollViewRef.current?.scrollTo({ x: next * width, animated: true });
      setCurrentSlide(next);
    } else {
      router.replace('/(onboarding)/ai-intro');
    }
  }, [currentSlide, router]);

  const handleSkip = useCallback(() => {
    router.replace('/(onboarding)/ai-intro');
  }, [router]);

  const isLastSlide = currentSlide === SLIDES.length - 1;

  // --- Animated styles ---
  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const bottomStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonSlide.value }],
  }));

  // Orb parallax driven by scroll
  const orb1Style = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          SLIDES.map((_, i) => i * width),
          [0, 50, 100, 50],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const orb2Style = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          SLIDES.map((_, i) => i * width),
          [0, -30, -60, -30],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.background, colors.backgroundSecondary, colors.background]}
        style={StyleSheet.absoluteFill}
      />

      {/* Parallax orbs */}
      <View style={styles.orbContainer}>
        <Animated.View style={[styles.orb, styles.orb1, orb1Style]} />
        <Animated.View style={[styles.orb, styles.orb2, orb2Style]} />
      </View>

      {/* Header */}
      <Animated.View style={[styles.header, headerStyle]}>
        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <Image
            source={require('../../assets/krios-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Welcome label */}
      <Animated.View style={[styles.welcomeSection, headerStyle]}>
        <Text style={styles.welcomeText}>Welcome, {userName}</Text>
      </Animated.View>

      {/* Horizontal slide carousel */}
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {SLIDES.map((item) => (
          <View key={item.id} style={styles.slideContainer}>
            <SlideItem item={item} index={item.id - 1} scrollX={scrollX} />
          </View>
        ))}
      </Animated.ScrollView>

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {SLIDES.map((_, index) => (
          <Dot key={index} index={index} scrollX={scrollX} />
        ))}
      </View>

      {/* Bottom action */}
      <Animated.View style={[styles.bottomSection, bottomStyle]}>
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.8}
          style={styles.nextButton}
        >
          <LinearGradient
            colors={
              isLastSlide
                ? [colors.success, '#059669']
                : [colors.primary, colors.secondary]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.nextButtonGradient}
          >
            <Text style={styles.nextButtonText}>
              {isLastSlide ? 'Get Started' : 'Next'}
            </Text>
            <Ionicons
              name={isLastSlide ? 'checkmark' : 'arrow-forward'}
              size={20}
              color="#fff"
            />
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.progressText}>
          {currentSlide + 1} of {SLIDES.length}
        </Text>
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
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
    borderRadius: 200,
    opacity: 0.15,
  },
  orb1: {
    width: 400,
    height: 400,
    backgroundColor: colors.primary,
    top: -150,
    right: -100,
  },
  orb2: {
    width: 300,
    height: 300,
    backgroundColor: colors.secondary,
    bottom: -100,
    left: -50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  logoContainer: {
    width: 36,
    height: 36,
  },
  logo: {
    width: 36,
    height: 36,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  welcomeSection: {
    paddingHorizontal: 24,
    marginTop: 16,
  },
  welcomeText: {
    fontSize: 14,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  scrollView: {
    flex: 1,
  },
  slideContainer: {
    width: width,
    paddingHorizontal: 24,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  iconWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  glowLayer: {
    position: 'absolute',
    borderRadius: 100,
  },
  glowOuter: {
    width: 200,
    height: 200,
    opacity: 0.3,
  },
  glowMiddle: {
    width: 170,
    height: 170,
    opacity: 0.4,
  },
  glowInner: {
    width: 150,
    height: 150,
    opacity: 0.5,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 50,
  },
  nextButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  progressText: {
    fontSize: 12,
    color: colors.textHint,
    textAlign: 'center',
    marginTop: 16,
  },
});
