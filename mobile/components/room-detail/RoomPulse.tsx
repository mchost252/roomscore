/**
 * RoomPulse — Live Activity Pill (v4)
 *
 * Matches reference mockup:
 *   - Green dot + time (e.g. "11m") + username + action + "View activity >" link
 *   - Cycles through recent completions every 5 seconds
 *   - No dismiss, no progress insight banner — just the simple pill
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Task, RoomMember } from '../../types/room';

interface PulseItem {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
}

function getTimeAgo(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

interface RoomPulseProps {
  tasks: Task[];
  members: RoomMember[];
  currentUserId?: string;
  onViewActivity?: () => void;
}

const RoomPulse: React.FC<RoomPulseProps> = ({ tasks, members, currentUserId, onViewActivity }) => {
  const { isDark } = useTheme();

  const pulseItems = useMemo<PulseItem[]>(() => {
    const items: PulseItem[] = [];
    for (const task of tasks) {
      if (task.completions && task.completions.length > 0) {
        for (const c of task.completions) {
          items.push({
            id: `${task.id}_${c.userId || c.id}`,
            username: c.userId === currentUserId ? 'You' : (c.user?.username || 'Someone'),
            message: `completed ${task.title}`,
            timestamp: c.completedAt ? new Date(c.completedAt) : new Date(),
          });
        }
      }
    }
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return items.slice(0, 10);
  }, [tasks, currentUserId]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pulseItems.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % pulseItems.length);
    }, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [pulseItems.length]);

  const item = pulseItems[currentIndex];

  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const textMuted = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';

  if (!item) return null;

  return (
    <View style={styles.container}>
      <Animated.View
        key={item.id}
        entering={FadeInRight.duration(250)}
        exiting={FadeOutLeft.duration(180)}
        style={styles.pill}
      >
        {/* Green dot */}
        <View style={styles.greenDot} />

        {/* Time */}
        <Text style={[styles.time, { color: '#22c55e' }]}>
          {getTimeAgo(item.timestamp)}
        </Text>

        {/* Message */}
        <Text style={[styles.message, { color: textSecondary }]} numberOfLines={1}>
          <Text style={styles.username}>{item.username}</Text> {item.message}
        </Text>

        {/* View activity link */}
        {onViewActivity && (
          <TouchableOpacity onPress={onViewActivity} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.viewLink, { color: '#6366f1' }]}>View activity{'>'}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 28,
    paddingHorizontal: 4,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22c55e',
  },
  time: {
    fontSize: 12,
    fontWeight: '700',
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  username: {
    fontWeight: '700',
  },
  viewLink: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default React.memo(RoomPulse);
