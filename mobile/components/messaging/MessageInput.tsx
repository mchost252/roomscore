import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, TextInput, StyleSheet, TouchableOpacity,
  Platform, Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming,
  interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import ReplyBar from './ReplyBar';
import PlusTray from './PlusTray';

/**
 * MessageInput — the universal composer, used by every message surface.
 *
 * Layout (per the rebuild plan, line 697: "Input: plus button (left), text
 * input, emoji icon, send button (right)"):
 *
 *   ⊕   [ Message...              ☺  🎤 ]   ➤
 *   │     └─ text field pill ──────────┘     │
 *   └─ outside-left                outside-right
 *
 * Two deliberate rules:
 *
 * 1. Send is ALWAYS in its slot — dimmed and disabled when there is no text,
 *    never replaced. The previous version swapped send ↔ mic in the same
 *    position, so the button's meaning changed under the user's thumb as they
 *    typed. That is a mis-tap source, and worse on low-end devices where a
 *    dropped frame hides the transition.
 *
 * 2. Controls that modify the text you are composing (emoji, mic) live INSIDE
 *    the pill. The control that attaches something other than text (+) lives
 *    outside on the left, deliberately far from send.
 */

interface ReplyPreview {
  id: string;
  text: string;
  username?: string;
}

/**
 * Visual tone. 'default' uses the indigo app accent; 'room' uses the violet
 * room-chat palette so room-chat.tsx keeps its own look while sharing this
 * component instead of hand-rolling a second composer.
 */
export type ComposerTone = 'default' | 'room';

interface MessageInputProps {
  onSend: (text: string) => void;
  onTyping?: (isTyping: boolean) => void;
  onPlusPress?: () => void;
  replyTo?: ReplyPreview | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  tone?: ComposerTone;
  showPlus?: boolean;
}

const ACCENT = '#6366f1';
const ROOM_ACCENT = '#7c3aed';
const ROOM_ACCENT_LIGHT = '#a78bfa';

export default function MessageInput({
  onSend, onTyping, onPlusPress,
  replyTo, onCancelReply, disabled, placeholder = 'Message...',
  value: externalValue, onChangeText: externalOnChangeText,
  onFocus,
  onBlur,
  tone = 'default',
  showPlus = true,
}: MessageInputProps) {
  const { isDark } = useTheme();
  const [internalText, setInternalText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const sendProgress = useSharedValue(0);
  const replyHeight = useSharedValue(0);
  const typingRef = useRef(false);
  const [showTray, setShowTray] = useState(false);

  const isControlled = externalValue !== undefined;
  const text = isControlled ? externalValue : internalText;
  const setText = isControlled ? (externalOnChangeText ?? (() => {})) : setInternalText;
  const hasText = text.trim().length > 0;

  useEffect(() => {
    sendProgress.value = withTiming(hasText ? 1 : 0, { duration: 140 });
  }, [hasText]);

  useEffect(() => {
    replyHeight.value = withTiming(replyTo ? 44 : 0, { duration: 200 });
  }, [replyTo]);

  const handleSend = useCallback(() => {
    const msg = text.trim();
    if (!msg) return;
    onSend(msg);
    if (!isControlled) setInternalText('');
    if (typingRef.current) {
      typingRef.current = false;
      onTyping?.(false);
    }
  }, [text, onSend, onTyping, isControlled]);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); };
  }, []);

  const handleBlur = useCallback(() => {
    if (typingRef.current) {
      typingRef.current = false;
      onTyping?.(false);
    }
    onBlur?.();
  }, [onBlur, onTyping]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = Keyboard.addListener('keyboardDidHide', () => inputRef.current?.blur());
    return () => subscription.remove();
  }, []);

  const handleChangeText = useCallback((val: string) => {
    setText(val);
    if (val.trim().length > 0) {
      if (!typingRef.current) {
        typingRef.current = true;
        onTyping?.(true);
      }
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

  const handlePlusPress = useCallback(() => {
    if (onPlusPress) {
      onPlusPress();
      return;
    }
    setShowTray(prev => {
      const next = !prev;
      // The tray and the keyboard are mutually exclusive: they occupy the same
      // screen region, and allowing both left the chat squeezed between them.
      // Opening the tray dismisses the keyboard; closing it returns focus to the
      // field so the user can keep typing without an extra tap.
      if (next) Keyboard.dismiss();
      else inputRef.current?.focus();
      return next;
    });
  }, [onPlusPress]);

  const handleFocus = useCallback(() => {
    // Typing wins over the tray — bringing up the keyboard closes it.
    setShowTray(false);
    onFocus?.();
  }, [onFocus]);

  const sendIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sendProgress.value, [0, 1], [0.4, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(sendProgress.value, [0, 1], [0.9, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  const replyAnimStyle = useAnimatedStyle(() => ({
    height: replyHeight.value,
    opacity: interpolate(replyHeight.value, [0, 44], [0, 1]),
    overflow: 'hidden' as const,
  }));

  const isRoom = tone === 'room';
  const accent = isRoom ? ROOM_ACCENT : ACCENT;
  const iconAccent = isRoom ? ROOM_ACCENT_LIGHT : ACCENT;

  const t = isRoom
    ? {
        pillBg: '#21153d',
        pillBorder: 'rgba(139,92,246,0.35)',
        text: '#e2e8f0',
        placeholder: 'rgba(167,139,250,0.35)',
        plusBg: '#21153d',
        plusBorder: 'rgba(139,92,246,0.35)',
      }
    : isDark
      ? {
          pillBg: '#1b1b29',
          pillBorder: 'rgba(99,102,241,0.2)',
          text: '#f1f5f9',
          placeholder: 'rgba(255,255,255,0.3)',
          plusBg: '#24243a',
          plusBorder: 'transparent',
        }
      : {
          pillBg: '#ffffff',
          pillBorder: 'rgba(99,102,241,0.18)',
          text: '#1e293b',
          placeholder: 'rgba(0,0,0,0.35)',
          plusBg: '#ffffff',
          plusBorder: 'transparent',
        };

  const plusIcon = !onPlusPress && showTray ? 'close' : 'add';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#12121e' : '#f8f9ff' }]}>
      {replyTo && (
        <Animated.View style={[styles.replyBar, replyAnimStyle]}>
          <ReplyBar replyTo={replyTo} onCancel={onCancelReply!} />
        </Animated.View>
      )}

      <View style={styles.row}>
        {/* ── Plus — outside left. Attaches something other than text, and is
               kept deliberately far from send. ── */}
        {showPlus && (
          <TouchableOpacity
            onPress={handlePlusPress}
            activeOpacity={0.7}
            style={[
              styles.plusBtn,
              { backgroundColor: t.plusBg, borderColor: t.plusBorder },
            ]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name={plusIcon} size={22} color={iconAccent} />
          </TouchableOpacity>
        )}

        {/* ── Text pill — contains the field plus the controls that act on the
               text being composed (emoji, mic). ── */}
        <View style={[styles.pill, { backgroundColor: t.pillBg, borderColor: t.pillBorder }]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: t.text }]}
            placeholder={placeholder}
            placeholderTextColor={t.placeholder}
            value={text}
            onChangeText={handleChangeText}
            multiline
            maxLength={2000}
            editable={!disabled}
            onFocus={handleFocus}
            onBlur={handleBlur}
            returnKeyType="default"
            blurOnSubmit={false}
          />

        </View>

        <TouchableOpacity
          onPress={handleSend}
          activeOpacity={0.8}
          disabled={disabled || !hasText}
          style={[styles.sendBtn, { backgroundColor: accent, shadowColor: accent }]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Animated.View style={[styles.actionIcon, sendIconStyle]}>
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {!onPlusPress && (
        <PlusTray
          visible={showTray}
          tone={tone}
          onSelect={() => setShowTray(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 4 : 8,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,160,0.18)',
  },
  replyBar: {
    marginBottom: 4,
    marginHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    // flex-end so the plus and send buttons stay aligned to the bottom of the
    // pill as it grows with multiline text, rather than drifting to its centre.
    alignItems: 'flex-end',
    gap: 8,
  },
  plusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 22,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 40,
    maxHeight: 120,
  },
  input: {
    flex: 1,
    fontSize: 15.5,
    lineHeight: 21,
    paddingVertical: Platform.OS === 'ios' ? 9 : 7,
    paddingRight: 6,
    maxHeight: 108,
  },
  pillIcon: {
    // Fixed height matching the collapsed pill so icons stay bottom-aligned
    // while the field grows upward.
    height: 38,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  // Both action icons are absolutely stacked so they can crossfade in place.
  actionIcon: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
