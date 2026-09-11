import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onMore?: () => void;
  visible: boolean;
  selected?: string | null;
}

function ReactionPicker({ onSelect, onMore, visible, selected }: ReactionPickerProps) {
  const { isDark } = useTheme();

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(30)}
      exiting={FadeOut.duration(30)}
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(30,30,40,0.95)' : 'rgba(255,255,255,0.95)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        },
      ]}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <Animated.View key={emoji} entering={FadeIn.duration(30)}>
          <TouchableOpacity
            onPress={() => onSelect(emoji)}
            activeOpacity={0.7}
            style={[
              styles.emojiBtn,
              selected === emoji ? { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' } : undefined,
            ]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </TouchableOpacity>
        </Animated.View>
      ))}
      {onMore && (
        <Animated.View entering={FadeIn.duration(30)}>
          <TouchableOpacity
            onPress={onMore}
            activeOpacity={0.7}
            style={styles.moreBtn}
          >
            <Ionicons
              name="add-circle-outline"
              size={22}
              color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'}
            />
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );
}

export default memo(ReactionPicker);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 22,
  },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
