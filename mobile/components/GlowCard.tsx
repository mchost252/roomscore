import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewProps, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../constants/theme';

interface GlowCardProps extends ViewProps {
  children: React.ReactNode;
  glowIntensity?: 'subtle' | 'medium' | 'strong';
  animated?: boolean;
  style?: any;
}

/**
 * Gemini-style Glow Card Component
 * Smooth glowing effect without Flutter - using React Native Animated API
 */
export const GlowCard: React.FC<GlowCardProps> = ({
  children,
  glowIntensity = 'medium',
  animated = true,
  style,
  ...viewProps
}) => {
  const { colors, isDark, shadows, borderRadius } = useTheme();
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;

    // Smooth breathing glow animation (Gemini-style)
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [animated]);

  // Interpolate glow opacity based on intensity
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: glowIntensity === 'subtle' 
      ? [0.3, 0.5] 
      : glowIntensity === 'strong' 
      ? [0.6, 1] 
      : [0.4, 0.7],
  });

  return (
    <View style={[styles.container, style]} {...viewProps}>
      {/* Outer glow effect */}
      {animated && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: glowOpacity,
              borderRadius: borderRadius.card,
            },
          ]}
        >
          <LinearGradient
            colors={
              isDark
                ? ['rgba(96, 165, 250, 0.15)', 'rgba(245, 158, 11, 0.1)', 'rgba(96, 165, 250, 0.15)']
                : ['rgba(37, 99, 235, 0.08)', 'rgba(217, 119, 6, 0.05)', 'rgba(37, 99, 235, 0.08)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              borderRadius: borderRadius.card,
              transform: [{ scale: 1.02 }],
            }}
          />
        </Animated.View>
      )}

      {/* Main card with glassmorphism */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? colors.background.elevated : colors.background.elevated,
            borderColor: colors.border.primary,
            borderRadius: borderRadius.card,
            ...shadows.md,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});

export default GlowCard;
