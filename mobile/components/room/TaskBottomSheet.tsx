/**
 * TaskBottomSheet - Action Sheet for Task Options
 * Shows Join/Leave options and Admin controls for owners
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  FadeIn,
  SlideInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { EnhancedRoomTask } from '../../types';

interface TaskBottomSheetProps {
  visible: boolean;
  task: EnhancedRoomTask | null;
  currentUserId: string;
  isRoomOwner: boolean;
  onClose: () => void;
  onJoin?: () => void;
  onLeave?: () => void;
  onEdit?: () => void;
  onBanUser?: () => void;
  onJusticeReview?: () => void;
}

export default function TaskBottomSheet({
  visible,
  task,
  currentUserId,
  isRoomOwner,
  onClose,
  onJoin,
  onLeave,
  onEdit,
  onBanUser,
  onJusticeReview,
}: TaskBottomSheetProps) {
  const { colors, isDark } = useTheme();

  const isParticipant = task?.participants.includes(currentUserId);
  const isOwner = task?.participants.includes(currentUserId) && isRoomOwner;

  const handleJoin = () => {
    onJoin?.();
    onClose();
  };

  const handleLeave = () => {
    onLeave?.();
    onClose();
  };

  const handleEdit = () => {
    onEdit?.();
    onClose();
  };

  const handleBanUser = () => {
    onBanUser?.();
    onClose();
  };

  const handleJusticeReview = () => {
    onJusticeReview?.();
    onClose();
  };

  if (!task) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View 
          entering={SlideInDown.springify().damping(18)}
          style={[styles.sheet, { backgroundColor: isDark ? '#1a1a2e' : '#ffffff' }]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border.primary }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {task.title}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {/* Join/Leave for regular users */}
            {!isRoomOwner && (
              <>
                {isParticipant ? (
                  <TouchableOpacity 
                    style={[styles.actionItem, { backgroundColor: colors.surface }]}
                    onPress={handleLeave}
                  >
                    <View style={[styles.iconBox, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                      <Ionicons name="exit-outline" size={20} color="#ef4444" />
                    </View>
                    <View style={styles.actionText}>
                      <Text style={[styles.actionTitle, { color: colors.text }]}>Leave Task</Text>
                      <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                        Stop participating in this task
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={[styles.actionItem, { backgroundColor: colors.surface }]}
                    onPress={handleJoin}
                  >
                    <View style={[styles.iconBox, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                      <Ionicons name="add-circle-outline" size={20} color="#22c55e" />
                    </View>
                    <View style={styles.actionText}>
                      <Text style={[styles.actionTitle, { color: colors.text }]}>Join Task</Text>
                      <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                        Participate and earn points
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Admin Actions for Room Owner */}
            {isRoomOwner && (
              <>
                <TouchableOpacity 
                  style={[styles.actionItem, { backgroundColor: colors.surface }]}
                  onPress={handleEdit}
                >
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                    <Ionicons name="create-outline" size={20} color="#6366f1" />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>Edit Task</Text>
                    <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                      Modify task details and deadline
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionItem, { backgroundColor: colors.surface }]}
                  onPress={handleBanUser}
                >
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Ionicons name="person-remove-outline" size={20} color="#ef4444" />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>Ban User</Text>
                    <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                      Remove user from this task
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionItem, { backgroundColor: colors.surface }]}
                  onPress={handleJusticeReview}
                >
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(168,85,247,0.1)' }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#a855f7" />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>Justice Review</Text>
                    <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                      Review challenge disputes
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  closeBtn: {
    padding: 4,
  },
  actions: {
    paddingTop: 16,
    gap: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 14,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 13,
  },
});
