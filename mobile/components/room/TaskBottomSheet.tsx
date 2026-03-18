/**
 * TaskBottomSheet - Action Sheet for Task Options
 * Shows Join/Leave options, Proof submission, and Admin controls
 * 
 * Features:
 * - Join/Leave task for regular users
 * - Submit proof for verification
 * - Challenge auto-approved proofs
 * - Admin controls: Edit Task, Ban User, Justice Review
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Platform } from 'react-native';
import Animated, { 
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useHaptics } from '../../hooks';
import { EnhancedRoomTask, ProofStatus } from '../../types';
import { COLORS, GLASS, RADIUS, SPACING } from '../../styles/glassmorphism';

interface TaskBottomSheetProps {
  visible: boolean;
  task: EnhancedRoomTask | null;
  currentUserId: string;
  isRoomOwner: boolean;
  onClose: () => void;
  onJoin?: () => void;
  onLeave?: () => void;
  onSubmitProof?: () => void;
  onChallenge?: () => void;
  onEdit?: () => void;
  onBanUser?: () => void;
  onJusticeReview?: () => void;
  onViewProof?: () => void;
}

// Action item component
function ActionItem({
  icon,
  iconColor,
  iconBg,
  title,
  description,
  onPress,
  isDestructive = false,
}: {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  description?: string;
  onPress: () => void;
  isDestructive?: boolean;
}) {
  const { colors } = useTheme();
  
  return (
    <TouchableOpacity 
      style={[styles.actionItem, { backgroundColor: GLASS.background }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={styles.actionText}>
        <Text style={[
          styles.actionTitle, 
          { color: isDestructive ? COLORS.danger : colors.text }
        ]}>
          {title}
        </Text>
        {description && (
          <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
            {description}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

export default function TaskBottomSheet({
  visible,
  task,
  currentUserId,
  isRoomOwner,
  onClose,
  onJoin,
  onLeave,
  onSubmitProof,
  onChallenge,
  onEdit,
  onBanUser,
  onJusticeReview,
  onViewProof,
}: TaskBottomSheetProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();

  const handlePress = (action: () => void) => {
    haptics.selection();
    action();
    onClose();
  };

  if (!task) return null;

  const isParticipant = task.participants.includes(currentUserId);
  const hasProof = task.proof?.status === 'pending';
  const hasAutoApproved = task.proof?.status === 'auto_approved';
  const canChallenge = hasAutoApproved && task.proof?.challengeExpiresAt > Date.now();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View 
          entering={{ type: 'spring', damping: 20, stiffness: 200 }}
          style={[
            styles.sheet, 
            { 
              backgroundColor: isDark ? 'rgba(26,26,46,0.98)' : 'rgba(255,255,255,0.98)',
              borderColor: GLASS.border,
            }
          ]}
        >
          {/* Drag handle */}
          <View style={[styles.handle, { backgroundColor: colors.textTertiary }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryLight]}
                style={styles.taskIcon}
              >
                <Ionicons name="folder" size={20} color="#fff" />
              </LinearGradient>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {task.title}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {isParticipant ? 'You are participating' : 'You are spectating'}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={onClose} 
              style={[styles.closeBtn, { backgroundColor: GLASS.surface }]}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {/* User Actions */}
            {!isRoomOwner && (
              <>
                {isParticipant ? (
                  <>
                    {/* Submit Proof */}
                    <ActionItem
                      icon="camera-outline"
                      iconColor={COLORS.primary}
                      iconBg={`${COLORS.primary}15`}
                      title="Submit Proof"
                      description="Upload evidence of completion"
                      onPress={() => handlePress(onSubmitProof || (() => {}))}
                    />
                    
                    {/* View Proof Status */}
                    {hasProof && (
                      <ActionItem
                        icon="time-outline"
                        iconColor={COLORS.accent}
                        iconBg={`${COLORS.accent}15`}
                        title="Proof Under Review"
                        description="Awaiting admin verification"
                        onPress={() => handlePress(onViewProof || (() => {}))}
                      />
                    )}
                    
                    {/* Challenge Auto-Approval */}
                    {canChallenge && (
                      <ActionItem
                        icon="alert-circle-outline"
                        iconColor={COLORS.danger}
                        iconBg={`${COLORS.danger}15`}
                        title="Challenge Auto-Approval"
                        description="Dispute the automatic approval"
                        onPress={() => handlePress(onChallenge || (() => {}))}
                        isDestructive
                      />
                    )}
                    
                    {/* Leave Task */}
                    <ActionItem
                      icon="exit-outline"
                      iconColor={COLORS.danger}
                      iconBg={`${COLORS.danger}15`}
                      title="Leave Task"
                      description="Stop participating in this task"
                      onPress={() => handlePress(onLeave || (() => {}))}
                      isDestructive
                    />
                  </>
                ) : (
                  <ActionItem
                    icon="add-circle-outline"
                    iconColor={COLORS.secondary}
                    iconBg={`${COLORS.secondary}15`}
                    title="Join Task"
                    description="Start participating and earn points"
                    onPress={() => handlePress(onJoin || (() => {}))}
                  />
                )}
              </>
            )}

            {/* Admin Actions */}
            {isRoomOwner && (
              <>
                <View style={styles.divider}>
                  <Text style={[styles.dividerText, { color: colors.textSecondary }]}>
                    Admin Controls
                  </Text>
                </View>

                <ActionItem
                  icon="create-outline"
                  iconColor={COLORS.primary}
                  iconBg={`${COLORS.primary}15`}
                  title="Edit Task"
                  description="Modify task details and deadline"
                  onPress={() => handlePress(onEdit || (() => {}))}
                />

                <ActionItem
                  icon="shield-checkmark-outline"
                  iconColor={COLORS.primaryLight}
                  iconBg={`${COLORS.primaryLight}15`}
                  title="Review Proofs"
                  description="View and verify submissions"
                  onPress={() => handlePress(onViewProof || (() => {}))}
                />

                <ActionItem
                  icon="scales-outline"
                  iconColor="#a855f7"
                  iconBg="rgba(168,85,247,0.15)"
                  title="Justice Review"
                  description="Resolve challenge disputes"
                  onPress={() => handlePress(onJusticeReview || (() => {}))}
                />

                <ActionItem
                  icon="person-remove-outline"
                  iconColor={COLORS.danger}
                  iconBg={`${COLORS.danger}15`}
                  title="Manage Members"
                  description="Remove or ban users"
                  onPress={() => handlePress(onBanUser || (() => {}))}
                />
              </>
            )}
          </View>

          {/* Task Stats */}
          <View style={[styles.statsBar, { borderColor: GLASS.border }]}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={14} color={COLORS.accent} />
              <Text style={[styles.statValue, { color: colors.text }]}>{task.points}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>pts</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: GLASS.border }]} />
            <View style={styles.statItem}>
              <Ionicons name="people" size={14} color={COLORS.primary} />
              <Text style={[styles.statValue, { color: colors.text }]}>{task.participants.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>members</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: GLASS.border }]} />
            <View style={styles.statItem}>
              <Ionicons name="eye" size={14} color={colors.textSecondary} />
              <Text style={[styles.statValue, { color: colors.text }]}>{task.viewerIds.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>viewing</Text>
            </View>
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
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingBottom: 40,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  taskIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    gap: SPACING.xl,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 16,
  },
});
