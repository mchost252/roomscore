/**
 * AvatarStack — Overlapping avatar circles with high-quality glowing status rings
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  interpolate
} from 'react-native-reanimated';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';

interface AvatarStackProps {
  members: { id: string; userId?: string; avatar?: string; username: string }[];
  max?: number;
  size?: number;
  memberStatuses?: Record<string, 'completed' | 'active' | 'spectating'>;
}

const AvatarStack: React.FC<AvatarStackProps> = ({
  members,
  max = 3,
  size = 32,
  memberStatuses = {},
}) => {
  const { isDark } = useTheme();
  const visible = members.slice(0, max);
  const overflow = members.length - max;
  const overlap = size * 0.35;

  // Pulse animation for high-quality glow rings
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      true
    );
  }, []);

  const getStatusColor = (userId: string) => {
    const status = memberStatuses[userId];
    if (status === 'completed') return '#22c55e'; // Green
    if (status === 'active') return '#6366f1';    // Indigo
    return 'transparent';
  };

  return (
    <View style={styles.container}>
      {visible.map((m, i) => {
        const userId = m.userId || m.id;
        const color = getStatusColor(userId);
        const isCompleted = memberStatuses[userId] === 'completed';
        const isActive = memberStatuses[userId] === 'active';
        const hasStatus = isCompleted || isActive;

        const animatedGlowStyle = useAnimatedStyle(() => {
          if (!isCompleted) return { opacity: 0.6 };
          return {
            opacity: interpolate(pulse.value, [0, 1], [0.4, 0.8]),
            transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.2]) }],
          };
        });

        return (
          <View key={userId || i} style={{ marginLeft: i === 0 ? 0 : -overlap, zIndex: max - i }}>
            {/* Glow Layer (Behind Avatar) */}
            {hasStatus && (
              <Animated.View 
                style={[
                  styles.glowRing, 
                  { 
                    width: size + 4, 
                    height: size + 4, 
                    borderRadius: (size + 4) / 2, 
                    backgroundColor: color,
                    left: -2,
                    top: -2,
                  },
                  animatedGlowStyle
                ]} 
              />
            )}

            {/* Avatar Surface */}
            <View
              style={[
                styles.avatarWrap,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderColor: hasStatus ? color : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                  backgroundColor: isDark ? '#0a0a16' : '#ffffff',
                  borderWidth: hasStatus ? 1.5 : 1,
                }
              ]}
            >
              {m.avatar ? (
                <ExpoImage
                  source={{ uri: m.avatar }}
                  style={{ width: '100%', height: '100%', borderRadius: size / 2 }}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.fallback, { backgroundColor: isDark ? '#1e1b4b' : '#e0e7ff' }]}>
                  <Text style={[styles.initial, { fontSize: size * 0.4, color: isDark ? '#c4b5fd' : '#4f46e5' }]}>
                    {(m.username || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        );
      })}

      {overflow > 0 && (
        <View
          style={[
            styles.overflowBadge,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -overlap,
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            },
          ]}
        >
          <Text style={[styles.overflowText, { fontSize: size * 0.35, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)' }]}>
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glowRing: { position: 'absolute', zIndex: -1 },
  fallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '800' },
  overflowBadge: { borderWidth: 1, alignItems: 'center', justifyContent: 'center', zIndex: 0 },
  overflowText: { fontWeight: '700' },
});

export default React.memo(AvatarStack);
