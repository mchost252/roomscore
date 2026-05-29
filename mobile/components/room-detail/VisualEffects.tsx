import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Animated, { 
  useSharedValue, 
  withRepeat, 
  withTiming, 
  withSequence,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');

/**
 * 1. Tactical Ambient Background
 * Renders a completely clean background (Grid removed as requested).
 */
export const TacticalBackground = ({ isDark }: { isDark: boolean }) => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" />
  );
};

/**
 * 7. Ghost Empty States
 * A wireframe placeholder for when no tasks are present.
 */
export const GhostTaskCard = ({ isDark }: { isDark: boolean }) => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500 }),
        withTiming(0.3, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';

  return (
    <Animated.View style={[s.ghostCard, animatedStyle, { borderColor }]}>
      <View style={s.ghostContent}>
        <View style={[s.ghostCircle, { borderColor }]} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={[s.ghostLine, { width: '60%', backgroundColor: borderColor }]} />
          <View style={[s.ghostLine, { width: '40%', backgroundColor: borderColor }]} />
        </View>
      </View>
      <View style={s.ghostOverlay}>
        <Ionicons name="radio-outline" size={24} color={textColor} />
        <Text style={[s.ghostText, { color: textColor }]}>WAITING FOR COMMANDER BRIEFING...</Text>
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  vLine: { position: 'absolute', top: 0, bottom: 0, width: 0.5 },
  hLine: { position: 'absolute', left: 0, right: 0, height: 0.5 },
  ghostCard: {
    height: 100,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginHorizontal: 0,
    marginVertical: 8,
    padding: 16,
    justifyContent: 'center',
  },
  ghostContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    opacity: 0.5,
  },
  ghostCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  ghostLine: {
    height: 8,
    borderRadius: 4,
  },
  ghostOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ghostText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
