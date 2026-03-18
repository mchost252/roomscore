/**
 * SubwayTimeline - Task Thread Visualization
 * Shows chronological task activities like a subway map
 * With stations representing key events and connecting lines
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withDelay,
  FadeInUp,
  Layout,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { TaskActivity, TaskActivityType } from '../../types';

interface SubwayTimelineProps {
  activities: TaskActivity[];
  onActivityPress?: (activityId: string) => void;
  isFirstEntry?: boolean;
}

interface TimelineStationProps {
  activity: TaskActivity;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
  index: number;
  isFirstEntry: boolean;
}

// Activity type to icon mapping
const getActivityIcon = (type: TaskActivityType): { name: string; color: string } => {
  switch (type) {
    case 'task_created':
      return { name: 'add-circle', color: '#6366f1' };
    case 'task_joined':
      return { name: 'person-add', color: '#22c55e' };
    case 'task_left':
      return { name: 'exit', color: '#f97316' };
    case 'task_completed':
      return { name: 'checkmark-circle', color: '#22c55e' };
    case 'milestone_reached':
      return { name: 'flag', color: '#fbbf24' };
    case 'challenge_started':
      return { name: 'flame', color: '#ef4444' };
    case 'challenge_failed':
      return { name: 'close-circle', color: '#ef4444' };
    case 'challenge_succeeded':
      return { name: 'trophy', color: '#fbbf24' };
    case 'point_earned':
      return { name: 'star', color: '#fbbf24' };
    case 'comment_added':
      return { name: 'chatbubble', color: '#3b82f6' };
    case 'attachment_added':
      return { name: 'attach', color: '#8b5cf6' };
    case 'mention':
      return { name: 'at', color: '#06b6d4' };
    case 'reminder':
      return { name: 'notifications', color: '#f59e0b' };
    case 'deadline_approaching':
      return { name: 'time', color: '#ef4444' };
    case 'user_banned':
      return { name: 'ban', color: '#dc2626' };
    default:
      return { name: 'ellipse', color: '#94a3b8' };
  }
};

// Format relative time
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

// Single Timeline Station
const TimelineStation = React.memo(function TimelineStation({
  activity,
  isFirst,
  isLast,
  onPress,
  index,
  isFirstEntry,
}: TimelineStationProps) {
  const { colors, isDark } = useTheme();
  const iconMap = getActivityIcon(activity.type);

  // Pulse animation for recent activities
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={isFirstEntry ? FadeInUp.delay(index * 80).springify() : undefined}
      layout={Layout.springify()}
      style={styles.stationContainer}
    >
      {/* Timeline Line */}
      <View style={styles.lineContainer}>
        {!isFirst && (
          <View 
            style={[
              styles.lineTop, 
              { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }
            ]} 
          />
        )}
        {!isLast && (
          <View 
            style={[
              styles.lineBottom, 
              { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }
            ]} 
          />
        )}
      </View>

      {/* Station Node */}
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <Animated.View style={[styles.nodeWrapper, animatedStyle]}>
          {/* Outer ring */}
          <View 
            style={[
              styles.nodeOuter, 
              { borderColor: iconMap.color }
            ]}
          >
            {/* Inner circle */}
            <LinearGradient
              colors={[iconMap.color, `${iconMap.color}99`]}
              style={styles.nodeInner}
            >
              <Ionicons 
                name={iconMap.name as any} 
                size={14} 
                color="#fff" 
              />
            </LinearGradient>
          </View>
        </Animated.View>
      </TouchableOpacity>

      {/* Activity Card */}
      <TouchableOpacity 
        style={[
          styles.activityCard,
          { 
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          }
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {/* User Info */}
        <View style={styles.activityHeader}>
          {activity.userAvatar ? (
            <Image 
              source={{ uri: activity.userAvatar }} 
              style={styles.userAvatar}
            />
          ) : (
            <View style={[styles.userAvatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Ionicons name="person" size={12} color="#fff" />
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {activity.userName || 'Anonymous'}
            </Text>
            <Text style={[styles.activityType, { color: iconMap.color }]}>
              {activity.type.replace(/_/g, ' ')}
            </Text>
          </View>
          <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
            {formatRelativeTime(activity.timestamp)}
          </Text>
        </View>

        {/* Activity Content */}
        <View style={styles.activityContent}>
          <Text style={[styles.activityText, { color: colors.text }]} numberOfLines={2}>
            {activity.description}
          </Text>

          {/* Points earned badge */}
          {activity.pointsEarned && activity.pointsEarned > 0 && (
            <View style={[styles.pointsBadge, { backgroundColor: 'rgba(251,191,36,0.15)' }]}>
              <Ionicons name="star" size={12} color="#fbbf24" />
              <Text style={[styles.pointsText, { color: '#fbbf24' }]}>
                +{activity.pointsEarned}
              </Text>
            </View>
          )}
        </View>

        {/* Attachments/Comments indicator */}
        {(activity.attachmentUrl || activity.commentCount) && (
          <View style={styles.activityFooter}>
            {activity.attachmentUrl && (
              <View style={[styles.footerItem, { backgroundColor: colors.surface }]}>
                <Ionicons name="attach" size={12} color={colors.textSecondary} />
              </View>
            )}
            {activity.commentCount && activity.commentCount > 0 && (
              <View style={[styles.footerItem, { backgroundColor: colors.surface }]}>
                <Ionicons name="chatbubble-ellipses" size={12} color={colors.textSecondary} />
                <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                  {activity.commentCount}
                </Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function SubwayTimeline({
  activities,
  onActivityPress,
  isFirstEntry = false,
}: SubwayTimelineProps) {
  const { colors } = useTheme();

  // Sort activities by timestamp (newest first)
  const sortedActivities = useMemo(() => 
    [...activities].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ), 
    [activities]
  );

  const renderStation = useCallback(
    ({ item, index }: { item: TaskActivity; index: number }) => (
      <TimelineStation
        activity={item}
        isFirst={index === 0}
        isLast={index === sortedActivities.length - 1}
        onPress={() => onActivityPress?.(item.id)}
        index={index}
        isFirstEntry={isFirstEntry}
      />
    ),
    [sortedActivities.length, onActivityPress, isFirstEntry]
  );

  if (!activities || activities.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="git-network-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No activity yet
        </Text>
        <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
          Join a task to start the timeline
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Timeline Header */}
      <View style={styles.timelineHeader}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Activity Timeline
        </Text>
        <View style={[styles.headerBadge, { backgroundColor: colors.surface }]}>
          <Text style={[styles.headerCount, { color: colors.text }]}>
            {activities.length}
          </Text>
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.timeline}>
        {sortedActivities.map((activity, index) => (
          <TimelineStation
            key={activity.id}
            activity={activity}
            isFirst={index === 0}
            isLast={index === sortedActivities.length - 1}
            onPress={() => onActivityPress?.(activity.id)}
            index={index}
            isFirstEntry={isFirstEntry}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  timeline: {
    paddingTop: 8,
  },
  stationContainer: {
    flexDirection: 'row',
    minHeight: 80,
    marginBottom: 4,
  },
  lineContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  lineTop: {
    width: 2,
    flex: 1,
    marginBottom: -2,
  },
  lineBottom: {
    width: 2,
    flex: 1,
    marginTop: -2,
  },
  nodeWrapper: {
    zIndex: 1,
  },
  nodeOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  nodeInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCard: {
    flex: 1,
    marginLeft: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
  },
  userAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
  },
  activityType: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
    marginTop: 1,
  },
  timestamp: {
    fontSize: 11,
    fontWeight: '500',
  },
  activityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
    gap: 4,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 13,
  },
});
