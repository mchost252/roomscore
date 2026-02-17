import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GlowingCardProps {
  children: React.ReactNode;
  glowColor?: string;
  style?: ViewStyle;
  intensity?: 'low' | 'medium' | 'high';
}

export const GlowingCard: React.FC<GlowingCardProps> = ({
  children,
  glowColor = '#60a5fa',
  style,
  intensity = 'medium',
}) => {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
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
    ).start();
  }, []);

  const intensityMap = {
    low: { elevation: 8, shadowOpacity: 0.3 },
    medium: { elevation: 16, shadowOpacity: 0.5 },
    high: { elevation: 24, shadowOpacity: 0.7 },
  };

  const { elevation, shadowOpacity } = intensityMap[intensity];

  return (
    <Animated.View
      style={[
        styles.card,
        {
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity,
          shadowRadius: 20,
          elevation,
        },
        style,
      ]}
    >
      {/* Glass effect overlay */}
      <View style={styles.glassOverlay} />
      
      {/* Shine effect */}
      <LinearGradient
        colors={['rgba(255,255,255,0.1)', 'transparent', 'rgba(255,255,255,0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(30, 30, 46, 0.7)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
});
