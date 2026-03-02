import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');

interface ConfettiPiece {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  scale: Animated.Value;
  color: string;
  shape: 'circle' | 'square' | 'triangle';
}

interface Props {
  show: boolean;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  onComplete?: () => void;
}

const COLORS: Record<string, string[]> = {
  urgent: ['#dc2626', '#ef4444', '#f97316', '#fbbf24'],
  high:   ['#ef4444', '#f97316', '#fbbf24', '#facc15'],
  medium: ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7'],
  low:    ['#10b981', '#14b8a6', '#06b6d4', '#0ea5e9'],
};

export default function ConfettiCelebration({ show, priority, onComplete }: Props) {
  const confettiPieces = useRef<ConfettiPiece[]>([]);
  const [isVisible, setIsVisible] = React.useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const pieceCount = priority === 'high' ? 50 : priority === 'medium' ? 30 : 15;
      const colors = COLORS[priority];

      // Generate confetti pieces
      confettiPieces.current = Array.from({ length: pieceCount }, (_, i) => {
        const startX = W / 2 + (Math.random() - 0.5) * 100;
        const startY = H / 2;
        return {
          id: i,
          x: new Animated.Value(startX),
          y: new Animated.Value(startY),
          rotate: new Animated.Value(0),
          scale: new Animated.Value(1),
          color: colors[Math.floor(Math.random() * colors.length)],
          shape: ['circle', 'square', 'triangle'][Math.floor(Math.random() * 3)] as any,
          startX,
          startY,
        };
      });

      // Animate all pieces
      const animations = confettiPieces.current.map((piece: any) => {
        const angle = Math.random() * Math.PI * 2;
        const velocity = 200 + Math.random() * 300;
        const endX = piece.startX + Math.cos(angle) * velocity;
        const endY = piece.startY + Math.sin(angle) * velocity + 400; // Gravity effect

        return Animated.parallel([
          Animated.timing(piece.x, {
            toValue: endX,
            duration: 1500 + Math.random() * 500,
            useNativeDriver: true,
          }),
          Animated.timing(piece.y, {
            toValue: endY,
            duration: 1500 + Math.random() * 500,
            useNativeDriver: true,
          }),
          Animated.timing(piece.rotate, {
            toValue: Math.random() > 0.5 ? 360 : -360,
            duration: 1000 + Math.random() * 1000,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(piece.scale, {
              toValue: 1.2,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(piece.scale, {
              toValue: 0,
              duration: 1300,
              useNativeDriver: true,
            }),
          ]),
        ]);
      });

      Animated.stagger(20, animations).start(() => {
        setIsVisible(false);
        onComplete?.();
      });
    }
  }, [show, priority]);

  if (!isVisible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {confettiPieces.current.map((piece) => (
        <Animated.View
          key={piece.id}
          style={[
            styles.piece,
            {
              backgroundColor: piece.color,
              width: piece.shape === 'circle' ? 12 : 10,
              height: 10,
              borderRadius: piece.shape === 'circle' ? 6 : piece.shape === 'triangle' ? 0 : 2,
              transform: [
                { translateX: piece.x },
                { translateY: piece.y },
                { rotate: piece.rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
                { scale: piece.scale },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
