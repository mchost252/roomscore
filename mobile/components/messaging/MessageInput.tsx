import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Platform, Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface MessageInputProps {
  isDark: boolean;
  onSend: (text: string) => void;
  onTyping?: (isTyping: boolean) => void;
  replyTo?: { id: string; text: string; username?: string } | null;
  onCancelReply?: () => void;
  disabled?: boolean;
}

const SPRING = { mass: 0.35, damping: 14, stiffness: 300 };
const ACCENT_COLOR = '#6366f1';
const VIOLET_ACCENT = '#8b5cf6';

export default function MessageInput({
  isDark, onSend, onTyping, replyTo, onCancelReply, disabled,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const sendScale = useSharedValue(0);
  const replyHeight = useSharedValue(0);
  const typingRef = useRef(false);

  const hasText = text.trim().length > 0;

  useEffect(() => {
    // Always show send button — just animate opacity/scale between states
    sendScale.value = withSpring(hasText ? 1 : 0.65, SPRING);
  }, [hasText]);

  useEffect(() => {
    replyHeight.value = withTiming(replyTo ? 44 : 0, { duration: 200 });
  }, [replyTo]);

  const handleSend = useCallback(() => {
    const msg = text.trim();
    if (!msg) return;
    onSend(msg);
    setText('');
    if (typingRef.current) {
      typingRef.current = false;
      onTyping?.(false);
    }
  }, [text, onSend, onTyping]);

  // Typing timeout ref — reset each keystroke so indicator stays alive
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChangeText = useCallback((val: string) => {
    setText(val);
    if (val.trim().length > 0) {
      // Always re-emit typing=true on each keystroke to keep indicator alive
      if (!typingRef.current) {
        typingRef.current = true;
        onTyping?.(true);
      } else {
        // Re-trigger to reset the server-side timeout
        onTyping?.(true);
      }
      // Auto-stop typing after 4s of no input
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        typingRef.current = false;
        onTyping?.(false);
      }, 4000);
    } else if (typingRef.current) {
      typingRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      onTyping?.(false);
    }
  }, [onTyping]);

  const sendAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(sendScale.value, [0.65, 1], [0.85, 1], Extrapolation.CLAMP) }],
    opacity: interpolate(sendScale.value, [0.65, 1], [0.4, 1], Extrapolation.CLAMP),
  }));

  const replyAnimStyle = useAnimatedStyle(() => ({
    height: replyHeight.value,
    opacity: interpolate(replyHeight.value, [0, 44], [0, 1]),
    overflow: 'hidden' as const,
  }));

  const bg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const placeholder = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)';

  return (
    <View style={styles.container}>
      {/* Reply preview bar */}
      <Animated.View style={[styles.replyBar, replyAnimStyle]}>
        {replyTo && (
          <View style={[styles.replyInner, { 
            backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)' 
          }]}>
            <View style={styles.replyContent}>
              <Text style={[styles.replyLabel, { color: ACCENT_COLOR }]}>
                Replying to {replyTo.username || 'message'}
              </Text>
              <Text
                style={[styles.replyText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }]}
                numberOfLines={1}
              >
                {replyTo.text}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={onCancelReply} 
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons 
                name="close-circle" 
                size={18} 
                color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} 
              />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Input row */}
      <View style={[styles.inputRow, { backgroundColor: bg, borderColor }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: textColor }]}
          placeholder="Message..."
          placeholderTextColor={placeholder}
          value={text}
          onChangeText={handleChangeText}
          multiline
          maxLength={2000}
          editable={!disabled}
          returnKeyType="default"
          blurOnSubmit={false}
        />

        {/* Send button */}
        <Animated.View style={[styles.sendWrap, sendAnimStyle]}>
          <TouchableOpacity
            onPress={handleSend}
            activeOpacity={0.8}
            disabled={!hasText || disabled}
            style={styles.sendBtn}
          >
            <LinearGradient
              colors={[ACCENT_COLOR, VIOLET_ACCENT] as any}
              style={styles.sendGrad}
            >
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'ios' ? 4 : 8,
    paddingTop: 4,
  },
  replyBar: {
    marginBottom: 4,
    marginHorizontal: 4,
  },
  replyInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT_COLOR,
  },
  replyContent: {
    flex: 1,
    marginRight: 8,
  },
  replyLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  replyText: {
    fontSize: 12,
    marginTop: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 4,
    minHeight: 46,
    maxHeight: 120,
  },
  input: {
    flex: 1,
    fontSize: 15.5,
    lineHeight: 21,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    maxHeight: 100,
  },
  sendWrap: {
    marginBottom: 2,
    marginLeft: 6,
  },
  sendBtn: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  sendGrad: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
