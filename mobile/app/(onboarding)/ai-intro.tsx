import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  FadeInDown,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { colors } from '../../src/constants/theme';

const { width } = Dimensions.get('window');

interface Message {
  id: number;
  text: string;
  delay: number;
}

const MESSAGES: Message[] = [
  { id: 1, text: "Hey there! I'm Krios", delay: 500 },
  {
    id: 2,
    text: 'Think of me as your personal habit companion — here to help you build consistency and crush your goals.',
    delay: 1800,
  },
  {
    id: 3,
    text: 'Rooms are your accountability circles. You and friends join together to track habits and motivate each other.',
    delay: 3800,
  },
  {
    id: 4,
    text: 'Complete tasks daily, keep your streaks alive, and celebrate wins together!',
    delay: 6000,
  },
  { id: 5, text: 'Ready to start your journey?', delay: 8500 },
];

// ─── Animated Typing Dots (matches TypingIndicator.tsx pattern) ──
const TypingDots = memo(() => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const pulse = (delay: number) =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, {
              duration: 400,
              easing: Easing.inOut(Easing.ease),
            }),
            withTiming(0, {
              duration: 400,
              easing: Easing.inOut(Easing.ease),
            }),
          ),
          -1,
          false,
        ),
      );

    dot1.value = pulse(0);
    dot2.value = pulse(150);
    dot3.value = pulse(300);
  }, []);

  const useDotStyle = (sv: SharedValue<number>) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({
      opacity: 0.4 + sv.value * 0.6,
      transform: [{ translateY: -sv.value * 4 }, { scale: 1 + sv.value * 0.15 }],
    }));

  const d1 = useDotStyle(dot1);
  const d2 = useDotStyle(dot2);
  const d3 = useDotStyle(dot3);

  return (
    <View style={styles.typingIndicator}>
      <Animated.View style={[styles.typingDot, d1]} />
      <Animated.View style={[styles.typingDot, d2]} />
      <Animated.View style={[styles.typingDot, d3]} />
    </View>
  );
});

// ─── Message Bubble ──────────────────────────────────────────
interface BubbleProps {
  msg: Message;
  index: number;
}

const MessageBubble = memo(({ msg, index }: BubbleProps) => (
  <Animated.View
    entering={FadeInDown.duration(400).delay(50)}
    style={styles.messageRow}
  >
    {/* Avatar */}
    <View style={styles.avatarContainer}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={styles.avatar}
      >
        <Ionicons name="planet" size={16} color="#fff" />
      </LinearGradient>
    </View>

    {/* Bubble */}
    <View style={styles.messageBubble}>
      <View style={styles.messageHeader}>
        <Text style={styles.senderName}>Krios</Text>
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      </View>
      <Text style={styles.messageText}>{msg.text}</Text>
    </View>
  </Animated.View>
));

// ─── Main Screen ─────────────────────────────────────────────
export default function AIIntroScreen() {
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [showButton, setShowButton] = useState(false);
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  // Entrance
  const screenOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 600 });

    // Sequential message reveal
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    MESSAGES.forEach((msg, index) => {
      const t = setTimeout(() => {
        setVisibleMessages((prev) => [...prev, msg.id]);
        // Auto-scroll after short layout delay
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);

        // Show button after last message
        if (index === MESSAGES.length - 1) {
          const btn = setTimeout(() => {
            setShowButton(true);
            buttonScale.value = withTiming(1, {
              duration: 400,
              easing: Easing.out(Easing.cubic),
            });
            buttonOpacity.value = withTiming(1, { duration: 300 });
          }, 800);
          timeouts.push(btn);
        }
      }, msg.delay);
      timeouts.push(t);
    });

    return () => timeouts.forEach(clearTimeout);
  }, []);

  const handleContinue = useCallback(async () => {
    await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    router.replace('/(onboarding)/auth-choice');
  }, [router]);

  // Animated styles
  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const btnStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ scale: buttonScale.value }],
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
        <View style={styles.glow} />
      </View>

      <Animated.View style={[styles.content, screenStyle]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/krios-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerDivider} />
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Meet Krios</Text>
          <Text style={styles.subtitle}>Your habit companion</Text>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messageScroll}
          contentContainerStyle={styles.messageContent}
          showsVerticalScrollIndicator={false}
        >
          {MESSAGES.map(
            (msg, index) =>
              visibleMessages.includes(msg.id) && (
                <MessageBubble key={msg.id} msg={msg} index={index} />
              ),
          )}

          {/* Typing indicator — visible while there are remaining messages */}
          {visibleMessages.length < MESSAGES.length && (
            <View style={styles.messageRow}>
              <View style={styles.avatarContainer}>
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  style={styles.avatar}
                >
                  <Ionicons name="planet" size={16} color="#fff" />
                </LinearGradient>
              </View>
              <View style={[styles.messageBubble, styles.typingBubble]}>
                <TypingDots />
              </View>
            </View>
          )}
        </ScrollView>

        {/* CTA */}
        {showButton && (
          <Animated.View style={[styles.buttonContainer, btnStyle]}>
            <TouchableOpacity
              onPress={handleContinue}
              activeOpacity={0.8}
              style={styles.button}
            >
              <LinearGradient
                colors={[colors.success, '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Let's Go</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
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
    left: width / 2 - 200,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  logoContainer: {
    width: 32,
    height: 32,
  },
  logo: {
    width: 32,
    height: 32,
  },
  headerDivider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 16,
  },
  titleSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  messageScroll: {
    flex: 1,
  },
  messageContent: {
    padding: 24,
    paddingBottom: 40,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  typingBubble: {
    paddingVertical: 16,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  aiBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.secondary,
  },
  messageText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 24,
  },
  typingIndicator: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 50,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  buttonGradient: {
    flexDirection: 'row',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
