import React, { useEffect, useRef, useCallback } from 'react';
import { View, Animated, Dimensions, StyleSheet, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';

const { width: W, height: H } = Dimensions.get('window');

interface ConfettiPiece {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  color: string;
  shape: 'circle' | 'square' | 'line';
  sway: Animated.Value;
}

interface Props {
  show: boolean;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  onComplete?: () => void;
}

const KRIOS_COLORS = {
  purple: '#8b5cf6',
  indigo: '#6366f1',
  gold: '#f59e0b',
  emerald: '#10b981',
  crimson: '#ef4444',
};

const COLORS: Record<string, string[]> = {
  urgent: [KRIOS_COLORS.crimson, KRIOS_COLORS.gold, '#f97316'],
  high:   [KRIOS_COLORS.gold, KRIOS_COLORS.indigo, '#fb923c'],
  medium: [KRIOS_COLORS.indigo, KRIOS_COLORS.purple, '#a78bfa'],
  low:    [KRIOS_COLORS.emerald, '#06b6d4', '#14b8a6'],
};

const PIECE_COUNTS: Record<string, number> = {
  urgent: 70,
  high: 50,
  medium: 35,
  low: 20,
};

export default React.memo(function ConfettiCelebration({ show, priority, onComplete }: Props) {
  const confettiPieces = useRef<ConfettiPiece[]>([]);
  const [isVisible, setIsVisible] = React.useState(false);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const cleanup = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
    confettiPieces.current = [];
    shakeAnim.setValue(0);
  }, []);

  useEffect(() => {
    if (!show) return;

    cleanup();
    setIsVisible(true);

    const pieceCount = PIECE_COUNTS[priority] || 35;
    const colors = COLORS[priority] || COLORS.medium;

    confettiPieces.current = Array.from({ length: pieceCount }, (_, i) => ({
      id: i,
      x: new Animated.Value(Math.random() * W),
      y: new Animated.Value(-100 - Math.random() * 200),
      rotate: new Animated.Value(0),
      scale: new Animated.Value(0.4 + Math.random() * 0.8),
      opacity: new Animated.Value(0),
      sway: new Animated.Value(0),
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: (['circle', 'square', 'line'] as const)[Math.floor(Math.random() * 3)],
    }));

    // Impact Haptics
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const shake = Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]);

    const animations = confettiPieces.current.map((piece) => {
      const duration = 2800 + Math.random() * 2000;
      const swayAmount = 25 + Math.random() * 55;
      const swayDuration = 700 + Math.random() * 700;
      const iterations = Math.ceil(duration / (swayDuration * 2));

      const fallAnim = Animated.timing(piece.y, {
        toValue: H + 120,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      });

      // FINITE sway instead of infinite loop to prevent freezing
      const swayAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(piece.sway, { toValue: swayAmount, duration: swayDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(piece.sway, { toValue: -swayAmount, duration: swayDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        { iterations }
      );

      const opacityAnim = Animated.sequence([
        Animated.timing(piece.opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(piece.opacity, { toValue: 0, duration: 600, delay: duration - 1200, useNativeDriver: true }),
      ]);

      const rotateAnim = Animated.timing(piece.rotate, {
        toValue: 1,
        duration: duration * 0.9,
        easing: Easing.linear,
        useNativeDriver: true,
      });

      return Animated.parallel([fallAnim, swayAnim, opacityAnim, rotateAnim]);
    });

    const finalAnimation = Animated.parallel([
      shake,
      Animated.stagger(12, animations),
    ]);

    animationRef.current = finalAnimation;
    finalAnimation.start(({ finished }) => {
      if (finished) {
        setIsVisible(false);
        onComplete?.();
      }
    });

    return cleanup;
  }, [show, priority, cleanup, onComplete]);

  if (!isVisible) return null;

  return (
    <Animated.View 
      style={[styles.container, { transform: [{ translateX: shakeAnim }] }]} 
      pointerEvents="none"
    >
      {confettiPieces.current.map((piece) => (
        <Animated.View
          key={piece.id}
          style={[
            styles.piece,
            {
              backgroundColor: piece.color,
              width: piece.shape === 'line' ? 3 : 10,
              height: piece.shape === 'line' ? 14 : 10,
              borderRadius: piece.shape === 'circle' ? 5 : 1,
              opacity: piece.opacity,
              transform: [
                { translateX: piece.x },
                { translateY: piece.y },
                { translateX: piece.sway },
                { rotate: piece.rotate.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${720 + Math.random() * 1440}deg`],
                }) },
                { scale: piece.scale },
              ],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
  },
  piece: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
