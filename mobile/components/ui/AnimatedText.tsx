import React, { useState, useEffect, useRef } from 'react';
import { Text, Animated, TextStyle } from 'react-native';

// ─── AnimatedText (Typewriter) ────────────────────────────────────────────────

interface AnimatedTextProps {
  text: string;
  speed?: number;
  style?: TextStyle;
  onComplete?: () => void;
  cursor?: boolean;
}

export default function AnimatedText({
  text,
  speed = 30,
  style,
  onComplete,
  cursor = false,
}: AnimatedTextProps) {
  const [displayed, setDisplayed] = useState('');
  const [showCursor, setShowCursor] = useState(cursor);
  const indexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cursorAnim = useRef(new Animated.Value(1)).current;

  // Reset and restart when text changes
  useEffect(() => {
    indexRef.current = 0;
    setDisplayed('');
    setShowCursor(cursor);

    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!text) {
      onComplete?.();
      return;
    }

    intervalRef.current = setInterval(() => {
      indexRef.current += 1;
      const next = text.slice(0, indexRef.current);
      setDisplayed(next);

      if (indexRef.current >= text.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setShowCursor(false);
        onComplete?.();
      }
    }, speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, speed]);

  // Blinking cursor animation
  useEffect(() => {
    if (!cursor || !showCursor) return;

    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorAnim, {
          toValue: 0,
          duration: 530,
          useNativeDriver: true,
        }),
        Animated.timing(cursorAnim, {
          toValue: 1,
          duration: 530,
          useNativeDriver: true,
        }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [cursor, showCursor, cursorAnim]);

  return (
    <Text style={style}>
      {displayed}
      {cursor && showCursor ? (
        <Animated.Text style={[style, { opacity: cursorAnim }]}>
          {'|'}
        </Animated.Text>
      ) : null}
    </Text>
  );
}

// ─── FadeText ─────────────────────────────────────────────────────────────────

interface FadeTextProps {
  text: string;
  duration?: number;
  delay?: number;
  style?: TextStyle;
  onComplete?: () => void;
}

export function FadeText({
  text,
  duration = 500,
  delay = 0,
  style,
  onComplete,
}: FadeTextProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.setValue(0);

    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      if (finished) onComplete?.();
    });

    return () => animation.stop();
  }, [text, duration, delay]);

  return (
    <Animated.Text style={[style, { opacity }]}>
      {text}
    </Animated.Text>
  );
}
