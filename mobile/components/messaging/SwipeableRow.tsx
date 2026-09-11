/**
 * SwipeableRow — WhatsApp-style swipe-right-to-reply wrapper.
 *
 * Drop this around any message bubble. Swiping right reveals a reply arrow
 * and fires `onReply` once the threshold is crossed. The row snaps back
 * automatically. Works with react-native-gesture-handler v2 + reanimated v4.
 *
 * Usage:
 *   <SwipeableRow onReply={() => handleReply(msg)}>
 *     <ChatBubble ... />
 *   </SwipeableRow>
 */
import React, { memo, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const REPLY_THRESHOLD = 40;
const MAX_TRANSLATE = 100;
const SPRING_CONFIG = { damping: 24, stiffness: 350, mass: 0.4 };

interface SwipeableRowProps {
  onReply: () => void;
  enabled?: boolean;
  children: React.ReactNode;
}

function SwipeableRow({ onReply, enabled = true, children }: SwipeableRowProps) {
  const { isDark } = useTheme();
  const translateX = useSharedValue(0);
  const didTrigger = useSharedValue(false);

  // Keep latest onReply in a ref so the memoized gesture never goes stale
  // (recreating the gesture object mid-swipe would detach and kill it).
  const replyRef = useRef(onReply);
  replyRef.current = onReply;

  const fireReply = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    replyRef.current();
  }, []);

  const fireHapticTick = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const panGesture = useMemo(() => Gesture.Pan()
    // Rightward swipe only: activate past +18px. Leftward past -12px fails
    // fast so horizontal scrolls/lists aren't hijacked. Vertical past ±12px
    // fails so the chat list keeps vertical scrolling.
    .activeOffsetX([-1000, 8])
    .failOffsetX([-12, 1000])
    .failOffsetY([-12, 12])
    .enabled(enabled)
    .onUpdate((e) => {
      const clamped = Math.min(Math.max(e.translationX, 0), MAX_TRANSLATE);
      translateX.value = clamped;
      if (clamped >= REPLY_THRESHOLD && !didTrigger.value) {
        didTrigger.value = true;
        runOnJS(fireHapticTick)();
      } else if (clamped < REPLY_THRESHOLD) {
        didTrigger.value = false;
      }
    })
    .onEnd(() => {
      if (translateX.value >= REPLY_THRESHOLD) {
        runOnJS(fireReply)();
      }
      translateX.value = withSpring(0, SPRING_CONFIG);
      didTrigger.value = false;
    }), [enabled, translateX, didTrigger, fireReply, fireHapticTick]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const iconStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      translateX.value,
      [0, REPLY_THRESHOLD * 0.5, REPLY_THRESHOLD],
      [0, 0.6, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: progress,
      transform: [
        { scale: interpolate(progress, [0, 1], [0.4, 1], Extrapolation.CLAMP) },
        { rotate: `${interpolate(progress, [0, 1], [-45, 0], Extrapolation.CLAMP)}deg` },
      ],
    };
  });

  const iconColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)';

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        {/* Reply icon revealed behind the row */}
        <Animated.View style={[styles.iconWrap, iconStyle]} pointerEvents="none">
          <View style={[styles.iconCircle, {
            backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
          }]}>
            <Ionicons name="arrow-undo" size={18} color={iconColor} />
          </View>
        </Animated.View>

        {/* Message content slides right */}
        <Animated.View style={rowStyle}>
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export default memo(SwipeableRow);

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  iconWrap: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
