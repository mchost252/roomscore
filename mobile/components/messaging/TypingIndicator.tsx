import React, { useEffect, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withDelay, withSequence, Easing,
  type SharedValue,
} from 'react-native-reanimated';

interface TypingIndicatorProps {
  isDark: boolean;
  visible: boolean;
  username?: string;
}

function TypingIndicator({ isDark, visible, username }: TypingIndicatorProps) {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);
  const containerOpacity = useSharedValue(0);

  useEffect(() => {
    containerOpacity.value = withTiming(visible ? 1 : 0, { duration: 200 });

    if (visible) {
      const pulse = (delay: number) =>
        withDelay(
          delay,
          withRepeat(
            withSequence(
              withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
              withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            false,
          ),
        );

      dot1.value = pulse(0);
      dot2.value = pulse(150);
      dot3.value = pulse(300);
    } else {
      dot1.value = withTiming(0, { duration: 100 });
      dot2.value = withTiming(0, { duration: 100 });
      dot3.value = withTiming(0, { duration: 100 });
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerOpacity.value }],
  }));

  const makeDotStyle = (sv: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: 0.4 + sv.value * 0.6,
      transform: [{ translateY: -sv.value * 3 }, { scale: 1 + sv.value * 0.15 }],
    }));

  const d1Style = makeDotStyle(dot1);
  const d2Style = makeDotStyle(dot2);
  const d3Style = makeDotStyle(dot3);

  if (!visible) return null;

  const dotColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)';
  const bubbleBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const accentColor = isDark ? '#6366f1' : '#818cf8';

  return (
    <Animated.View style={[styles.wrapper, containerStyle]}>
      <View style={[styles.bubble, { backgroundColor: bubbleBg }]}>
        {/* Left accent bar like received messages */}
        <View style={[styles.accent, { backgroundColor: accentColor }]} />
        <View style={styles.dots}>
          <Animated.View style={[styles.dot, { backgroundColor: dotColor }, d1Style]} />
          <Animated.View style={[styles.dot, { backgroundColor: dotColor }, d2Style]} />
          <Animated.View style={[styles.dot, { backgroundColor: dotColor }, d3Style]} />
        </View>
      </View>
    </Animated.View>
  );
}

export default memo(TypingIndicator);

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    alignItems: 'flex-start',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    minWidth: 60,
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
