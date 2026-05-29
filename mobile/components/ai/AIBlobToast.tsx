import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
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
  const Surface: any = Platform.OS === 'android' ? View : BlurView;
  
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);
  const scale = useSharedValue(0.96);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 220 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
      scale.value = withSpring(1, { damping: 18, stiffness: 240 });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
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

  if (!visible && opacity.value === 0) return null;

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
    bottom: 113,
    left: 18,
    right: 18,
    zIndex: 1000,
    alignItems: 'center',
  },
  blur: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.20,
    shadowRadius: 18,
    elevation: 10,
  },
  edgeGlow: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    opacity: 0.9,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 10,
  },
  mark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  markGradient: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
    gap: 6,
    marginBottom: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  message: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  actionBtn: {
    maxWidth: 104,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 10,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
