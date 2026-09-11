import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface ReplyPreview {
  id: string;
  text: string;
  username?: string;
}

interface ReplyBarProps {
  replyTo: ReplyPreview;
  onCancel: () => void;
}

const ACCENT_COLOR = '#6366f1';

function ReplyBar({ replyTo, onCancel }: ReplyBarProps) {
  const { isDark } = useTheme();

  return (
    <Animated.View entering={FadeInDown.duration(180)} style={styles.container}>
      <View
        style={[
          styles.inner,
          {
            backgroundColor: isDark ? '#1b1b29' : '#ffffff',
            borderLeftColor: ACCENT_COLOR,
          },
        ]}
      >
        <View style={styles.content}>
          <Text style={[styles.label, { color: ACCENT_COLOR }]}>
            Replying to {replyTo.username || 'message'}
          </Text>
          <Text
            style={[
              styles.text,
              { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' },
            ]}
            numberOfLines={1}
          >
            {replyTo.text}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onCancel}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="close-circle"
            size={18}
            color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export default memo(ReplyBar);

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
    marginHorizontal: 4,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderLeftWidth: 3,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  text: {
    fontSize: 12,
    marginTop: 1,
  },
});
