import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface AIBlobToastProps {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}

export default function AIBlobToast({ 
  visible, 
  message, 
  actionLabel, 
  onAction, 
  onClose 
}: AIBlobToastProps) {
  const { colors, isDark } = useTheme();
  const Surface: any = Platform.OS === 'android' ? View : BlurView
  const [shouldRender, setShouldRender] = useState(visible)
  
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);
  const scale = useSharedValue(0.96);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      opacity.value = withTiming(1, { duration: 220 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
      scale.value = withSpring(1, { damping: 18, stiffness: 240 });
    } else {
      opacity.value = withTiming(0, { duration: 180 }, (finished) => {
        if (finished) runOnJS(setShouldRender)(false);
      });
      translateY.value = withTiming(18, { duration: 180 });
      scale.value = withTiming(0.96, { duration: 180 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  if (!shouldRender) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Surface
        {...(Platform.OS === 'android' ? {} : { intensity: isDark ? 52 : 82, tint: isDark ? 'dark' : 'light' })}
        style={[
          styles.blur,
          {
            borderColor: isDark ? 'rgba(129,140,248,0.34)' : 'rgba(79,70,229,0.18)',
            backgroundColor: isDark ? 'rgba(12,14,28,0.96)' : 'rgba(255,255,255,0.96)',
          }
        ]}
      >
        <LinearGradient
          colors={isDark
            ? ['rgba(129,140,248,0.18)', 'rgba(168,85,247,0.08)', 'rgba(6,182,212,0.05)']
            : ['rgba(99,102,241,0.10)', 'rgba(168,85,247,0.05)', 'rgba(255,255,255,0.22)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.edgeGlow, { backgroundColor: colors.primary }]} />
        <View style={styles.content}>
          <View style={[styles.mark, { backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)' }]}>
            <LinearGradient
              colors={['#22d3ee', '#818cf8', '#a855f7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.markGradient}
            >
              <Ionicons name="sparkles" size={13} color="#fff" />
            </LinearGradient>
          </View>
          
          <View style={styles.textContainer}>
            <View style={styles.eyebrowRow}>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>Krios AI</Text>
              <View style={[styles.liveDot, { backgroundColor: '#22d3ee' }]} />
            </View>
            <Text style={[styles.message, { color: colors.text }]} numberOfLines={1}>
              {message}
            </Text>
          </View>

          {actionLabel && (
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(99,102,241,0.22)' : 'rgba(79,70,229,0.10)', borderColor: colors.primary }]}
              onPress={onAction}
              activeOpacity={0.78}
            >
              <Text style={[styles.actionText, { color: colors.primary }]} numberOfLines={1}>{actionLabel}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Ionicons name="close" size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </Surface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    zIndex: 1000,
    alignItems: 'center',
  },
  blur: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  edgeGlow: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    opacity: 0.9,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 8,
  },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  markGradient: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 1,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  liveDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  message: {
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 15,
  },
  actionBtn: {
    maxWidth: 88,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 8,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '800',
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 3,
  },
});




