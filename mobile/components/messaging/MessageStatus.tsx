import React, { memo } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

interface MessageStatusProps {
  status: MessageStatus;
  size?: number;
}

/**
 * Per the rebuild plan's "MESSAGE STATUS SYSTEM" section:
 * Read messages use the same light-blue double tick as the frontend room chat.
 */
const SEEN_TICK = '#53bdeb';

/**
 * The web room chat uses the simple WhatsApp-style Unicode double tick.
 * Keep mobile consistent with that shared visual language.
 */
function MessageStatusIcon({ status, size = 12 }: MessageStatusProps) {
  const { isDark } = useTheme();
  const muted = isDark ? 'rgba(255,255,255,0.58)' : 'rgba(15,23,42,0.65)';

  // Per the plan's icon list:
  //   sending   🕐
  //   sent      ✓✓ muted
  //   delivered ✓✓ muted
  //   seen      ✓✓ blue
  const renderIcon = () => {
    switch (status) {
      case 'sending':
        return <Text style={[styles.symbol, { color: muted, fontSize: size }]}>🕐</Text>;
      case 'sent':
      case 'delivered':
        return <Text style={[styles.symbol, { color: muted, fontSize: size }]}>✓✓</Text>;
      case 'read':
        return <Text style={[styles.symbol, { color: SEEN_TICK, fontSize: size }]}>✓✓</Text>;
      case 'failed':
      default:
        return <Ionicons name="alert-circle" size={size} color="#ef4444" />;
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      {renderIcon()}
    </Animated.View>
  );
}

export default memo(MessageStatusIcon);

const styles = StyleSheet.create({
  container: {
    marginLeft: 2,
  },
  symbol: {
    fontWeight: '600',
    includeFontPadding: false,
    lineHeight: 14,
  },
});