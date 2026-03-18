/**
 * TaskFolderList - FlashList-based Task Folder Display
 * Shows Accepted Tasks (top) and Spectator Tasks (bottom)
 * 
 * Features:
 * - Neon cyan outer glow for accepted tasks
 * - Pulsing green rings on active user avatars
 * - Heat level color shifts at 80% completion
 * - 40% opacity for spectator tasks
 * - Staggered entrance animation on first entry
 * 
 * Styled to match reference: "Room task Thread.jpeg"
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  FadeInDown,
  Layout,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { EnhancedRoomTask } from '../../types';
import { COLORS, GLASS, RADIUS, SPACING, GLOWS, HEAT_COLORS } from '../../styles/glassmorphism';

interface TaskFolderListProps {
  tasks: EnhancedRoomTask[];
  currentUserId: string;
  onTaskPress: (taskId: string) => void;
  onTaskMenu: (taskId: string) => void;
  isFirstEntry?: boolean;
}

interface TaskFolderProps {
  task: EnhancedRoomTask;
  isAccepted: boolean;
  onPress: () => void;
  onMenu: () => void;
  isFirstEntry: boolean;
  index: number;
}

// Pulsing Avatar Ring Component
function PulsingAvatarRing({ userId, isActive }: { userId: string; isActive: boolean }) {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useMemo(() => {
    if (isActive) {
      pulseScale.value = withRepeat(
        withTiming(1.3, { duration: 1500 }),
        -1,
        true
      );
      pulseOpacity.value = withRepeat(
        withTiming(0, { duration: 1500 }),
        -1,
        true
      );
    }
  }, [isActive]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  return (
    <View style={styles.avatarWrapper}>
      {/* Pulsing ring for active users */}
      {isActive && (
        <Animated.View style={[styles.pulsingRing, pulseStyle]}>
          <View style={styles.pulsingRingInner} />
        </Animated.View>
      )}
      <Image
        source={{ uri: `https://api.dicebear.com/7.x/avataaars/png?seed=${userId}` }}
        style={styles.avatar}
      />
    </View>
  );
}

// Avatar Stack with Pulsing Rings
function AvatarStack({ userIds, maxVisible = 3 }: { userIds: string[]; maxVisible?: number }) {
  const { colors } = useTheme();
  const visible = userIds.slice(0, maxVisible);
  const extra = userIds.length - maxVisible;

  return (
    <View style={styles.avatarStack}>
      {visible.map((userId, index) => (
        <PulsingAvatarRing
          key={userId}
          userId={userId}
          isActive={true}
        />
      ))}
      {extra > 0 && (
        <View style={[styles.extraAvatar, { backgroundColor: isDark ? GLASS.surface : 'rgba(0,0,0,0.08)' }]}>
          <Text style={[styles.extraText, { color: colors.textSecondary }]}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

// Get heat color based on completion percentage
function getHeatColor(heatLevel: number): string | null {
  if (heatLevel >= 80) return HEAT_COLORS.critical;
  if (heatLevel >= 60) return HEAT_COLORS.hot;
  if (heatLevel >= 40) return HEAT_COLORS.warm;
  return null;
}

// Single Task Folder Card
const TaskFolder = React.memo(function TaskFolder({
  task,
  isAccepted,
  onPress,
  onMenu,
  isFirstEntry,
  index,
}: TaskFolderProps) {
  const { colors, isDark } = useTheme();
  const heatColor = getHeatColor(task.heatLevel);

  // Determine gradient colors based on heat
  const getGradientColors = (): [string, string] => {
    if (!isAccepted) return ['#64748b', '#475569']; // Muted gray for spectator
    if (heatColor) return [heatColor, `${heatColor}cc`]; // Heat color
    return [COLORS.primary, COLORS.primaryLight]; // Default purple
  };

  const gradientColors = getGradientColors();

  return (
    <Animated.View
      entering={isFirstEntry ? FadeInDown.delay(index * 100).springify().damping(15) : undefined}
      layout={Layout.springify()}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={styles.folderContainer}
      >
        {/* Neon glow border for accepted tasks */}
        {isAccepted && (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.glowBorder,
              { opacity: 0.6 },
            ]}
          />
        )}

        {/* Main card */}
        <View
          style={[
            styles.folderCard,
            {
              backgroundColor: isDark ? GLASS.background : 'rgba(255,255,255,0.95)',
              borderColor: isAccepted ? GLASS.border : 'rgba(255,255,255,0.05)',
              opacity: isAccepted ? 1 : 0.4,
            },
          ]}
        >
          {/* Folder Icon with Heat Glow */}
          <View style={styles.folderIconContainer}>
            <LinearGradient
              colors={gradientColors}
              style={[
                styles.folderIcon,
                heatColor && {
                  shadowColor: heatColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 12,
                  ...Platform.select({ android: { elevation: 8 } }),
                },
              ]}
            >
              <Ionicons
                name={task.status === 'completed' ? 'checkmark-circle' : 'folder'}
                size={24}
                color="#fff"
              />
            </LinearGradient>
            
            {/* Completed badge */}
            {task.status === 'completed' && (
              <View style={[styles.completedBadge, { backgroundColor: COLORS.secondary }]}>
                <Ionicons name="checkmark" size={10} color="#fff" />
              </View>
            )}
            
            {/* Heat indicator */}
            {heatColor && task.heatLevel >= 80 && (
              <View style={[styles.heatBadge, { backgroundColor: heatColor }]}>
                <Ionicons name="flame" size={10} color="#fff" />
              </View>
            )}
          </View>

          {/* Folder Content */}
          <View style={styles.folderContent}>
            <Text
              style={[
                styles.folderTitle,
                { color: colors.text },
              ]}
              numberOfLines={1}
            >
              {task.title}
            </Text>

            {task.description && (
              <Text
                style={[styles.folderDesc, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {task.description}
              </Text>
            )}

            {/* Meta row */}
            <View style={styles.folderMeta}>
              {/* Points */}
              <View style={[styles.pointsBadge, { backgroundColor: isDark ? GLASS.surface : 'rgba(0,0,0,0.05)' }]}>
                <Ionicons name="star" size={12} color={COLORS.accent} />
                <Text style={[styles.pointsText, { color: colors.text }]}>
                  {task.points} pts
                </Text>
              </View>

              {/* Heat level bar */}
              {task.heatLevel > 0 && (
                <View style={[styles.heatBar, { backgroundColor: isDark ? GLASS.surface : 'rgba(0,0,0,0.05)' }]}>
                  <View
                    style={[
                      styles.heatBarFill,
                      {
                        width: `${task.heatLevel}%`,
                        backgroundColor: heatColor || COLORS.primary,
                      },
                    ]}
                  />
                </View>
              )}

              {/* Spectator badge */}
              {!isAccepted && (
                <View style={[styles.spectatorBadge, { backgroundColor: 'rgba(148,163,184,0.2)' }]}>
                  <Text style={[styles.spectatorText, { color: '#94a3b8' }]}>
                    Viewing Only
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Right Section */}
          <View style={styles.folderRight}>
            {/* Avatar Stack */}
            {task.participants.length > 0 && (
              <AvatarStack userIds={task.participants} />
            )}

            {/* 3-dot Menu */}
            <TouchableOpacity
              onPress={onMenu}
              style={[styles.menuBtn, { backgroundColor: isDark ? GLASS.surface : 'rgba(0,0,0,0.05)' }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function TaskFolderList({
  tasks,
  currentUserId,
  onTaskPress,
  onTaskMenu,
  isFirstEntry = false,
}: TaskFolderListProps) {
  const { colors, isDark } = useTheme();

  // Separate accepted and spectator tasks
  const { acceptedTasks, spectatorTasks } = useMemo(() => {
    const accepted = tasks.filter(t => t.status === 'accepted' || t.status === 'completed');
    const spectator = tasks.filter(t => t.status === 'spectator');
    return { acceptedTasks: accepted, spectatorTasks: spectator };
  }, [tasks]);

  const keyExtractor = useCallback((item: EnhancedRoomTask) => item.id, []);

  // Section headers
  const ListHeader = () => (
    <>
      {acceptedTasks.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Active Tasks
          </Text>
          <View style={[styles.sectionBadge, { backgroundColor: `${COLORS.primary}20` }]}>
            <Text style={[styles.sectionCount, { color: COLORS.primary }]}>
              {acceptedTasks.length}
            </Text>
          </View>
        </View>
      )}
    </>
  );

  const ListSpectatorHeader = () => (
    <>
      {spectatorTasks.length > 0 && acceptedTasks.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Spectating
          </Text>
          <View style={[styles.sectionBadge, { backgroundColor: isDark ? GLASS.surface : 'rgba(0,0,0,0.05)' }]}>
            <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
              {spectatorTasks.length}
            </Text>
          </View>
        </View>
      )}
    </>
  );

  // Combined list
  const combinedTasks = [...acceptedTasks, ...spectatorTasks];

  const renderItem = useCallback(
    ({ item, index }: { item: EnhancedRoomTask; index: number }) => {
      const isAccepted = item.status === 'accepted' || item.status === 'completed';
      const acceptedCount = acceptedTasks.length;
      const actualIndex = isAccepted ? index : index - acceptedCount;
      
      return (
        <>
          {!isAccepted && index === acceptedCount && <ListSpectatorHeader />}
          <TaskFolder
            task={item}
            isAccepted={isAccepted}
            onPress={() => onTaskPress(item.id)}
            onMenu={() => onTaskMenu(item.id)}
            isFirstEntry={isFirstEntry}
            index={actualIndex}
          />
        </>
      );
    },
    [onTaskPress, onTaskMenu, isFirstEntry, acceptedTasks.length]
  );

  if (tasks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <LinearGradient
          colors={[`${COLORS.primary}20`, 'transparent']}
          style={styles.emptyIcon}
        >
          <Ionicons name="folder-open-outline" size={48} color={colors.textTertiary} />
        </LinearGradient>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No tasks yet
        </Text>
        <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
          Tasks will appear here when added to the room
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={combinedTasks}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={100}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
      />
    </View>
  );
}

const isDark = false; // Placeholder, will use from theme

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  folderContainer: {
    marginBottom: SPACING.md,
    position: 'relative',
  },
  glowBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  folderIconContainer: {
    position: 'relative',
    marginRight: SPACING.lg,
  },
  folderIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  heatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  folderContent: {
    flex: 1,
  },
  folderTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  folderDesc: {
    fontSize: 13,
    marginBottom: SPACING.sm,
  },
  folderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heatBar: {
    width: 60,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  heatBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  spectatorBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  spectatorText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  folderRight: {
    alignItems: 'flex-end',
    gap: SPACING.md,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginLeft: -8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
  },
  pulsingRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  pulsingRingInner: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    opacity: 0.3,
  },
  extraAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  extraText: {
    fontSize: 11,
    fontWeight: '700',
  },
  menuBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: SPACING.md,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
