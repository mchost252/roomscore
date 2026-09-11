import React, { memo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export interface BubbleProps {
  isMine: boolean;
  children?: React.ReactNode;
  style?: ViewStyle;
}

const ACCENT_COLOR = '#6366f1';

// MinimalBubble — the default style.
// Structurally consistent with BubbleStyles variants: backgroundColor is set
// directly on the bubble View, no absoluteFill layers needed.
function MinimalBubble({ isMine, children, style }: BubbleProps) {
  const { isDark } = useTheme();

  const backgroundColor = isMine
    ? ACCENT_COLOR
    : isDark
    ? 'rgba(255,255,255,0.07)'
    : 'rgba(0,0,0,0.04)';

  const accentBarColor = isDark ? ACCENT_COLOR : '#818cf8';

  return (
    <View style={[styles.row, isMine ? styles.rowRight : styles.rowLeft]}>
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          { backgroundColor },
          style,
        ]}
      >
        {/* Accent bar on received messages only */}
        {!isMine && (
          <View style={[styles.accentBar, { backgroundColor: accentBarColor }]} />
        )}
        {children}
      </View>
    </View>
  );
}

export default memo(MinimalBubble);

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 14,
    marginVertical: 2,
  },
  rowRight: { alignItems: 'flex-end' },
  rowLeft: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    minWidth: 70,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    overflow: 'hidden',
  },
  bubbleMine: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 4,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
  },
});
