import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

interface Props {
  amount: number;
  onComplete?: () => void;
}

export default function XPReward({ amount, onComplete }: Props) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(1000),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -12, duration: 250, useNativeDriver: true }),
      ]),
    ]).start(() => { onComplete && onComplete(); });
  }, []);

  return (
    <Animated.View style={[styles.wrap, { opacity, transform: [{ translateY }, { scale }] }]} pointerEvents="none">
      <View style={styles.badge}>
        <Text style={styles.txt}>+{amount} XP</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 40, alignSelf: 'center', zIndex: 200 },
  badge: { backgroundColor: 'rgba(99,102,241,0.95)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14 },
  txt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
