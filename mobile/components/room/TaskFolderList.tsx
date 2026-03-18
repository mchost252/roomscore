/**
 * TaskFolderList - FlashList-based Task Folder Display
 * Shows Accepted Tasks (top) and Spectator Tasks (bottom)
 * With glassmorphic styling and avatar stacks
 */

import React, { useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  FadeIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { EnhancedRoomTask, User } from '../../types';

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

// Animated avatar stack with pulsing ring
function AvatarStack({ userIds }: { userIds: string[] }) {
  const { colors } = useTheme();
  const maxVisible = 3;
  const visible = userIds.slice(0, maxVisible);
  const extra = userIds.length - maxVisible;

  return (
    <View style={styles.avatarStack}>
      {visible.map((userId, index) => (
        <View
          key={userId}
          style={[
            styles.avatarWrapper,
            { marginLeft: index > 0 ? -10 : 0, zIndex: maxVisible - index },
          ]}
        >
          {/* Pulsing ring for active users */}
          <View style={[styles.pulsingRing, { borderColor: '#22c55e' }]}>
            <Image
              source={{ uri: `https://api.dicebear.com/7.x/avataaars/png?seed=${userId}` }}
              style={styles.avatar}
            />
          </View>
        </View>
      ))}
      {extra > 0 && (
        <View style={[styles.extraAvatar, { backgroundColor: colors.surface }]}>
          <Text style={[styles.extraText, { color: colors.textSecondary }]}>+{extra}</Text>
        </View>
      )}
    </View>
  );
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

  // Heat level color
  const getHeatColor = () => {
    if (task.heatLevel >= 80) return '#ef4444';
    if (task.heatLevel >= 60) return '#f97316';
    if (task.heatLevel >= 40) return '#eab308';
    return null;
  };

  const heatColor = getHeatColor();

  return (
    <Animated.View
      entering={isFirstEntry ? FadeIn.delay(index * 100).springify() : undefined}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.folderContainer}
      >
        {/* Glow border for accepted tasks */}
        {isAccepted && (
          <LinearGradient
            colors={heatColor ? [heatColor, 'transparent'] : ['#6366f1', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.glowBorder,
              {
                borderColor: heatColor || colors.primary,
                opacity: isAccepted ? 1 : 0.3,
              },
            ]}
          />
        )}

        <View
          style={[
            styles.folderCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              opacity: isAccepted ? 1 : 0.4,
            },
          ]}
        >
          {/* Folder Icon */}
          <View style={styles.folderIconContainer}>
            <LinearGradient
              colors={isAccepted 
                ? (heatColor ? [heatColor, '#ef4444'] : ['#6366f1', '#8b5cf6'])
                : ['#94a3b8', '#64748b']
              }
              style={styles.folderIcon}
            >
              <Ionicons
                name={task.status === 'completed' ? 'checkmark-circle' : 'folder'}
                size={24}
                color="#fff"
              />
            </LinearGradient>
            {task.status === 'completed' && (
              <View style={[styles.completedBadge, { backgroundColor: '#22c55e' }]}>
                <Ionicons name="checkmark" size={10} color="#fff" />
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

            <View style={styles.folderMeta}>
              {/* Points */}
              <View style={[styles.pointsBadge, { backgroundColor: colors.surface }]}>
                <Ionicons name="star" size={12} color="#fbbf24" />
                <Text style={[styles.pointsText, { color: colors.text }]}>
                  {task.points} pts
                </Text>
              </View>

              {/* Status */}
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
              style={[styles.menuBtn, { backgroundColor: colors.surface }]}
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
  const { colors } = useTheme();

  // Separate accepted and spectator tasks
  const acceptedTasks = tasks.filter(t => t.status === 'accepted' || t.status === 'completed');
  const spectatorTasks = tasks.filter(t => t.status === 'spectator');

  const renderAcceptedTask = useCallback(
    ({ item, index }: { item: EnhancedRoomTask; index: number }) => (
      <TaskFolder
        task={item}
        isAccepted={true}
        onPress={() => onTaskPress(item.id)}
        onMenu={() => onTaskMenu(item.id)}
        isFirstEntry={isFirstEntry}
        index={index}
      />
    ),
    [onTaskPress, onTaskMenu, isFirstEntry]
  );

  const renderSpectatorTask = useCallback(
    ({ item, index }: { item: EnhancedRoomTask; index: number }) => (
      <TaskFolder
        task={item}
        isAccepted={false}
        onPress={() => onTaskPress(item.id)}
        onMenu={() => onTaskMenu(item.id)}
        isFirstEntry={isFirstEntry}
        index={index}
      />
    ),
    [onTaskPress, onTaskMenu, isFirstEntry]
  );

  const keyExtractor = useCallback((item: EnhancedRoomTask) => item.id, []);

  const ListHeader = () => (
    <>
      {acceptedTasks.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Active Tasks
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
            {acceptedTasks.length}
          </Text>
        </View>
      )}
    </>
  );

  const ListSubHeader = () => (
    <>
      {spectatorTasks.length > 0 && acceptedTasks.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Spectating
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
            {spectatorTasks.length}
          </Text>
        </View>
      )}
    </>
  );

  // Combined list with sections
  const combinedTasks = [...acceptedTasks, ...spectatorTasks];

  return (
    <View style={styles.container}>
      <FlashList
        data={combinedTasks}
        renderItem={({ item, index }) => {
          const isAccepted = item.status === 'accepted' || item.status === 'completed';
          return (
            <TaskFolder
              task={item}
              isAccepted={isAccepted}
              onPress={() => onTaskPress(item.id)}
              onMenu={() => onTaskMenu(item.id)}
              isFirstEntry={isFirstEntry}
              index={index}
            />
          );
        }}
        keyExtractor={keyExtractor}
        estimatedItemSize={90}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No tasks yet
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  folderContainer: {
    marginBottom: 12,
    position: 'relative',
  },
  glowBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 1,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  folderIconContainer: {
    position: 'relative',
    marginRight: 14,
  },
  folderIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderContent: {
    flex: 1,
  },
  folderTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  folderDesc: {
    fontSize: 13,
    marginBottom: 6,
  },
  folderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  spectatorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  spectatorText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  folderRight: {
    alignItems: 'flex-end',
    gap: 10,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  pulsingRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
