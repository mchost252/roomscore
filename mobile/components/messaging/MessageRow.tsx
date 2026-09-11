import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import MessageStatus from './MessageStatus';

type MessageStatusType = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Reaction {
  emoji: string;
  count: number;
  reacted?: boolean;
}

interface MessageRowProps {
  isMine: boolean;
  status?: MessageStatusType;
  timestamp?: number;
  showTimestamp?: boolean;
  dateDivider?: string;
  reactions?: Reaction[];
  children: React.ReactNode;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

function MessageRow({
  isMine,
  status,
  timestamp,
  showTimestamp = true,
  dateDivider,
  reactions,
  children,
}: MessageRowProps) {
  const { isDark } = useTheme();

  const timeColor = isMine
    ? isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.65)'
    : isDark
    ? 'rgba(255,255,255,0.35)'
    : 'rgba(0,0,0,0.35)';

  // Date divider
  if (dateDivider) {
    return (
      <Animated.View entering={FadeInDown.duration(300)} style={styles.dateDividerRow}>
        <View style={[styles.dateDividerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
        <Text style={[styles.dateDividerText, { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }]}>
          {dateDivider}
        </Text>
        <View style={[styles.dateDividerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Bubble content */}
      {children}

      {/* Reactions row */}
      {reactions && reactions.length > 0 && (
        // Single shared background container for all reactions
        <View style={[styles.reactionGroupWrap, isMine ? styles.reactionsRowRight : styles.reactionsRowLeft]}>
          <View style={[styles.reactionGroup, { backgroundColor: isDark ? '#0b1220' : '#f3f4f6', borderColor: isDark ? '#111827' : '#e6e7eb' }]}>
            {reactions.map((r, i) => (
              <View
                key={`${r.emoji}-${i}`}
                style={[styles.reactionInnerItem, i < reactions.length - 1 && styles.reactionItemGap]}
              >
                <Text style={[styles.reactionEmoji, { color: r.reacted ? (isDark ? '#fff' : '#0f172a') : (isDark ? '#cbd5e1' : '#6b7280') }]}>{r.emoji}</Text>
                {r.count > 1 && (
                  <Text style={[styles.reactionCount, { color: r.reacted ? (isDark ? '#fff' : '#0f172a') : (isDark ? '#9ca3af' : '#6b7280') }]}>{r.count}</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Timestamp + status */}
      {showTimestamp && timestamp && (
        <View style={[styles.meta, isMine ? styles.metaRight : styles.metaLeft]}>
          <Text style={[styles.time, { color: timeColor }]}>
            {formatTime(timestamp)}
          </Text>
          {isMine && status && <MessageStatus status={status} />}
        </View>
      )}
    </View>
  );
}

export default memo(MessageRow);

const styles = StyleSheet.create({
  container: {
    marginVertical: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 18,
    marginTop: 2,
  },
  metaRight: {
    justifyContent: 'flex-end',
  },
  metaLeft: {
    justifyContent: 'flex-start',
  },
  time: {
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  reactionsRow: {
    // kept for compatibility but use the group wrapper instead
  },
  reactionGroupWrap: {
    paddingHorizontal: 6,
    marginTop: -3,
    zIndex: 3,
    alignSelf: 'flex-start',
  },
  reactionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 3,
    gap: 0,
  },
  reactionInnerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionItemGap: {
    marginRight: 5,
  },
  reactionEmoji: {
    fontSize: 13,
    marginRight: 2,
  },
  reactionCount: {
    fontSize: 11,
    fontWeight: '700',
  },
  reactionsRowRight: {
    alignSelf: 'flex-end',
  },
  reactionsRowLeft: {
    alignSelf: 'flex-start',
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    gap: 4,
    minHeight: 20,
  },
  dateDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 10,
  },
  dateDividerLine: {
    flex: 1,
    height: 1,
  },
  dateDividerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
