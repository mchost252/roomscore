import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

// Conditionally import Skia only on native platforms
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Canvas: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Circle: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Group: any;
if (Platform.OS !== 'web') {
  try {
    const Skia = require('@shopify/react-native-skia');
    Canvas = Skia.Canvas;
    Circle = Skia.Circle;
    Group = Skia.Group;
  } catch (e) {
    // Skia not available
  }
}

interface CosmicAvatarProps {
  username: string;
  size?: number;
  level?: number;
  premium?: boolean;
}

export function CosmicAvatar({ username, size = 100, level = 1, premium = false }: CosmicAvatarProps) {
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);
  const particleScale = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );

    pulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    particleScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const rotatingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const particles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * 360) / 8;
    const radius = size / 2 + 20;
    const x = Math.cos((angle * Math.PI) / 180) * radius;
    const y = Math.sin((angle * Math.PI) / 180) * radius;
    return { x, y, color: i % 2 === 0 ? '#6366f1' : '#a855f7' };
  });

  return (
    <View style={[styles.container, { width: size + 60, height: size + 60 }]}>
      {/* Rotating Constellation Ring */}
      {Platform.OS !== 'web' && Canvas ? (
        <Animated.View style={[styles.ringContainer, rotatingStyle]}>
          <Canvas style={{ width: size + 60, height: size + 60 }}>
            <Group>
              {particles.map((particle, index) => (
                <Circle
                  key={index}
                  cx={size / 2 + 30 + particle.x}
                  cy={size / 2 + 30 + particle.y}
                  r={3}
                  color={particle.color}
                  opacity={0.6}
                />
              ))}
            </Group>
          </Canvas>
        </Animated.View>
      ) : (
        // Fallback for web: Simple rotating dots
        <Animated.View style={[styles.ringContainer, rotatingStyle]}>
          <View style={{ width: size + 60, height: size + 60 }}>
            {particles.map((particle, index) => (
              <View
                key={index}
                style={[
                  styles.fallbackParticle,
                  {
                    left: size / 2 + 30 + particle.x - 3,
                    top: size / 2 + 30 + particle.y - 3,
                    backgroundColor: particle.color,
                  },
                ]}
              />
            ))}
          </View>
        </Animated.View>
      )}

      {/* Main Avatar with Pulse */}
      <Animated.View style={[styles.avatarContainer, pulseStyle]}>
        {premium && (
          <LinearGradient
            colors={['#fbbf24', '#f59e0b', '#d97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.premiumRing, { width: size + 16, height: size + 16, borderRadius: (size + 16) / 2 }]}
          />
        )}
        
        <View style={[styles.glowRing, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }]}>
          <LinearGradient
            colors={premium ? ['#fbbf24', '#a855f7'] : ['#6366f1', '#8b5cf6', '#a855f7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.avatarGradient, { width: size, height: size, borderRadius: size / 2 }]}
          >
            <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
              {username?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </LinearGradient>
        </View>

        {/* Level Badge */}
        <View style={styles.levelBadge}>
          <LinearGradient
            colors={['#6366f1', '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.levelGradient}
          >
            <Text style={styles.levelText}>LV {level}</Text>
          </LinearGradient>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringContainer: {
    position: 'absolute',
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumRing: {
    position: 'absolute',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  glowRing: {
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 6,
  },
  avatarGradient: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
  },
  levelGradient: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  levelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  fallbackParticle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.6,
  },
});
