/**
 * TaskThreadModal - Full Screen Task Command Center
 * 
 * Features:
 * - Memory Wall with pinned images (horizontal scroll, angled thumbnails)
 * - Subway Timeline with neon violet line
 * - System messages in deep-purple pills
 * - Proof submission and challenge UI
 * - Ghost Approval countdown
 * 
 * Opens as full screen modal when tapping a task folder
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeInUp,
  SlideInUp,
  SlideOutDown,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useHaptics } from '../../hooks';
import { EnhancedRoomTask, TaskActivity, TaskProof, ProofStatus } from '../../types';
import { COLORS, GLASS, RADIUS, SPACING, GLOWS } from '../../styles/glassmorphism';
import { AURA_CONFIG } from '../../services/roomDataService';

interface TaskThreadModalProps {
  visible: boolean;
  task: EnhancedRoomTask | null;
  activities: TaskActivity[];
  proofs: TaskProof[];
  currentUserId: string;
  isRoomOwner: boolean;
  onClose: () => void;
  onSubmitProof?: (imageUrl: string) => void;
  onChallenge?: (proofId: string) => void;
  onApproveProof?: (proofId: string) => void;
}

// Activity type to icon/color mapping
const getActivityIcon = (type: string): { name: string; color: string; bg: string } => {
  const icons: Record<string, { name: string; color: string; bg: string }> = {
    task_created: { name: 'add-circle', color: COLORS.primary, bg: `${COLORS.primary}15` },
    task_joined: { name: 'person-add', color: COLORS.secondary, bg: `${COLORS.secondary}15` },
    task_left: { name: 'exit', color: COLORS.warning, bg: `${COLORS.warning}15` },
    task_completed: { name: 'checkmark-circle', color: COLORS.secondary, bg: `${COLORS.secondary}15` },
    milestone_reached: { name: 'flag', color: COLORS.accent, bg: `${COLORS.accent}15` },
    challenge_started: { name: 'flame', color: COLORS.danger, bg: `${COLORS.danger}15` },
    point_earned: { name: 'star', color: COLORS.accent, bg: `${COLORS.accent}15` },
    comment_added: { name: 'chatbubble', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    attachment_added: { name: 'attach', color: COLORS.primaryLight, bg: `${COLORS.primaryLight}15` },
    system: { name: 'information-circle', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
  };
  return icons[type] || { name: 'ellipse', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' };
};

// Format relative time
const formatTime = (date: Date): string => {
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

// Memory Wall Component
function MemoryWall({ images }: { images: { id: string; url: string }[] }) {
  const { colors } = useTheme();
  
  if (images.length === 0) return null;

  return (
    <View style={styles.memoryWall}>
      <View style={styles.memoryWallHeader}>
        <Ionicons name="images" size={14} color={colors.textSecondary} />
        <Text style={[styles.memoryWallTitle, { color: colors.textSecondary }]}>
          Pinned Memories
        </Text>
        <Text style={[styles.memoryWallCount, { color: colors.textTertiary }]}>
          {images.length}
        </Text>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.memoryWallScroll}
      >
        {images.map((img, index) => (
          <Animated.View
            key={img.id}
            entering={FadeIn.delay(index * 50)}
            style={[
              styles.memoryThumbnail,
              { transform: [{ rotate: `${(index % 2 === 0 ? -3 : 3)}deg` }] },
            ]}
          >
            <Image source={{ uri: img.url }} style={styles.memoryImage} />
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

// System Message Pill
function SystemMessage({ message }: { message: string }) {
  return (
    <Animated.View entering={FadeInUp} style={styles.systemMessage}>
      <Ionicons name="shield-checkmark" size={14} color="#a855f7" />
      <Text style={styles.systemMessageText}>{message}</Text>
    </Animated.View>
  );
}

// Proof Status Card
function ProofCard({
  proof,
  currentUserId,
  isRoomOwner,
  onChallenge,
  onApprove,
}: {
  proof: TaskProof;
  currentUserId: string;
  isRoomOwner: boolean;
  onChallenge: () => void;
  onApprove: () => void;
}) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  
  const getStatusColor = (status: ProofStatus) => {
    switch (status) {
      case 'pending': return COLORS.accent;
      case 'approved': return COLORS.secondary;
      case 'challenged': return COLORS.danger;
      case 'auto_approved': return '#a855f7';
      default: return colors.textSecondary;
    }
  };

  const getStatusLabel = (status: ProofStatus) => {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'challenged': return 'Under Challenge';
      case 'auto_approved': return 'Auto-Approved';
      default: return status;
    }
  };

  // Calculate countdown for auto-approval
  const getCountdown = () => {
    if (proof.status !== 'auto_approved') return null;
    const remaining = proof.challengeExpiresAt - Date.now();
    if (remaining <= 0) return null;
    
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    return `${hours}h ${minutes}m left to challenge`;
  };

  const countdown = getCountdown();
  const statusColor = getStatusColor(proof.status);

  return (
    <View style={[styles.proofCard, { backgroundColor: GLASS.background, borderColor: `${statusColor}40` }]}>
      <View style={styles.proofHeader}>
        <View style={[styles.proofStatus, { backgroundColor: `${statusColor}20` }]}>
          <Ionicons 
            name={proof.status === 'approved' ? 'checkmark-circle' : 'time'} 
            size={14} 
            color={statusColor} 
          />
          <Text style={[styles.proofStatusText, { color: statusColor }]}>
            {getStatusLabel(proof.status)}
          </Text>
        </View>
      </View>

      {/* Proof Image */}
      {proof.imageUrl && (
        <Image source={{ uri: proof.imageUrl }} style={styles.proofImage} />
      )}

      {/* Countdown for auto-approval */}
      {countdown && (
        <View style={[styles.countdownBadge, { backgroundColor: `${COLORS.danger}15` }]}>
          <Ionicons name="alert-circle" size={14} color={COLORS.danger} />
          <Text style={[styles.countdownText, { color: COLORS.danger }]}>{countdown}</Text>
        </View>
      )}

      {/* Actions */}
      {(proof.status === 'auto_approved' || proof.status === 'pending') && (
        <View style={styles.proofActions}>
          {proof.status === 'auto_approved' && (
            <TouchableOpacity
              style={[styles.proofAction, { backgroundColor: `${COLORS.danger}15` }]}
              onPress={onChallenge}
            >
              <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={[styles.proofActionText, { color: COLORS.danger }]}>Challenge</Text>
            </TouchableOpacity>
          )}
          {isRoomOwner && proof.status === 'pending' && (
            <TouchableOpacity
              style={[styles.proofAction, { backgroundColor: `${COLORS.secondary}15` }]}
              onPress={onApprove}
            >
              <Ionicons name="checkmark-circle" size={16} color={COLORS.secondary} />
              <Text style={[styles.proofActionText, { color: COLORS.secondary }]}>Approve</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// Timeline Node Component
function TimelineNode({
  activity,
  isFirst,
  isLast,
}: {
  activity: TaskActivity;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { colors, isDark } = useTheme();
  const icon = getActivityIcon(activity.type);

  return (
    <Animated.View entering={FadeInUp} style={styles.timelineNode}>
      {/* Timeline line */}
      <View style={styles.timelineLineContainer}>
        {!isFirst && (
          <View style={[styles.lineTop, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} />
        )}
        {/* Neon node */}
        <View style={[styles.nodeOuter, { borderColor: icon.color }]}>
          <LinearGradient
            colors={[icon.color, `${icon.color}99`]}
            style={styles.nodeInner}
          >
            <Ionicons name={icon.name as any} size={12} color="#fff" />
          </LinearGradient>
        </View>
        {!isLast && (
          <View style={[styles.lineBottom, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} />
        )}
      </View>

      {/* Activity card */}
      <View style={[styles.activityCard, { backgroundColor: GLASS.background, borderColor: GLASS.border }]}>
        <View style={styles.activityHeader}>
          <View style={[styles.activityIcon, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name as any} size={14} color={icon.color} />
          </View>
          <View style={styles.activityContent}>
            <Text style={[styles.activityTitle, { color: colors.text }]}>
              {activity.userName}
            </Text>
            <Text style={[styles.activityType, { color: icon.color }]}>
              {activity.type.replace(/_/g, ' ')}
            </Text>
          </View>
          <Text style={[styles.activityTime, { color: colors.textTertiary }]}>
            {formatTime(activity.timestamp)}
          </Text>
        </View>
        
        {activity.description && (
          <Text style={[styles.activityDesc, { color: colors.textSecondary }]}>
            {activity.description}
          </Text>
        )}

        {/* Points earned */}
        {activity.pointsEarned && activity.pointsEarned > 0 && (
          <View style={[styles.pointsBadge, { backgroundColor: `${COLORS.accent}15` }]}>
            <Ionicons name="star" size={12} color={COLORS.accent} />
            <Text style={[styles.pointsText, { color: COLORS.accent }]}>+{activity.pointsEarned}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function TaskThreadModal({
  visible,
  task,
  activities,
  proofs,
  currentUserId,
  isRoomOwner,
  onClose,
  onSubmitProof,
  onChallenge,
  onApproveProof,
}: TaskThreadModalProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const screenHeight = Dimensions.get('window').height;

  const handleClose = () => {
    haptics.selection();
    onClose();
  };

  if (!task) return null;

  // Mock pinned images for demo
  const pinnedImages = [
    { id: '1', url: 'https://picsum.photos/200/200?random=1' },
    { id: '2', url: 'https://picsum.photos/200/200?random=2' },
    { id: '3', url: 'https://picsum.photos/200/200?random=3' },
  ];

  // Filter system messages
  const systemMessages = activities.filter(a => a.type === 'system');
  const regularActivities = activities.filter(a => a.type !== 'system');

  // User's proof for this task
  const userProof = proofs.find(p => p.userId === currentUserId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { backgroundColor: isDark ? 'rgba(15,15,25,1)' : '#f8fafc' }]}>
        {/* Header */}
        <View style={[styles.header, { 
          backgroundColor: isDark ? 'rgba(26,26,46,0.95)' : 'rgba(255,255,255,0.95)',
          borderColor: GLASS.border,
        }]}>
          <TouchableOpacity 
            onPress={handleClose} 
            style={[styles.backBtn, { backgroundColor: GLASS.surface }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {task.title}
            </Text>
            <View style={[styles.headerBadge, { backgroundColor: `${COLORS.primary}15` }]}>
              <Ionicons name="star" size={10} color={COLORS.primary} />
              <Text style={[styles.headerBadgeText, { color: COLORS.primary }]}>{task.points} pts</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.menuBtn, { backgroundColor: GLASS.surface }]}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Memory Wall */}
          <MemoryWall images={pinnedImages} />

          {/* Proof Status Card */}
          {userProof && (
            <ProofCard
              proof={userProof}
              currentUserId={currentUserId}
              isRoomOwner={isRoomOwner}
              onChallenge={() => onChallenge?.(userProof.id)}
              onApprove={() => onApproveProof?.(userProof.id)}
            />
          )}

          {/* Submit Proof Button (if no proof yet) */}
          {!userProof && task.participants.includes(currentUserId) && (
            <TouchableOpacity
              style={styles.submitProofBtn}
              onPress={() => onSubmitProof?.('')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryLight]}
                style={styles.submitProofGradient}
              >
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.submitProofText}>Submit Proof</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* System Messages */}
          {systemMessages.map((msg, i) => (
            <SystemMessage key={msg.id} message={msg.description} />
          ))}

          {/* Subway Timeline */}
          <View style={styles.timelineHeader}>
            <Text style={[styles.timelineTitle, { color: colors.text }]}>Activity</Text>
            <Text style={[styles.timelineCount, { color: colors.textSecondary }]}>
              {regularActivities.length} updates
            </Text>
          </View>

          {/* Neon timeline line */}
          <View style={styles.neonLine}>
            <LinearGradient
              colors={[COLORS.primaryLight, `${COLORS.primaryLight}00`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.neonLineGradient}
            />
          </View>

          {/* Timeline Activities */}
          {regularActivities.map((activity, index) => (
            <TimelineNode
              key={activity.id}
              activity={activity}
              isFirst={index === 0}
              isLast={index === regularActivities.length - 1}
            />
          ))}

          {/* Empty state */}
          {regularActivities.length === 0 && (
            <View style={styles.emptyTimeline}>
              <Ionicons name="git-network-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No activity yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                Activity will appear here as the task progresses
              </Text>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },
  // Memory Wall
  memoryWall: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  memoryWallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  memoryWallTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memoryWallCount: {
    fontSize: 11,
  },
  memoryWallScroll: {
    gap: SPACING.sm,
    paddingRight: SPACING.lg,
  },
  memoryThumbnail: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  memoryImage: {
    width: '100%',
    height: '100%',
  },
  // Proof Card
  proofCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  proofHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: SPACING.sm,
  },
  proofStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  proofStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  proofImage: {
    width: '100%',
    height: 150,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '600',
  },
  proofActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  proofAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  proofActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Submit Proof Button
  submitProofBtn: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  submitProofGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  submitProofText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  // System Message
  systemMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168,85,247,0.1)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  systemMessageText: {
    fontSize: 12,
    color: '#a855f7',
    fontWeight: '500',
  },
  // Timeline
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timelineCount: {
    fontSize: 12,
  },
  neonLine: {
    position: 'absolute',
    left: 32,
    top: 200,
    bottom: 100,
    width: 2,
    overflow: 'hidden',
  },
  neonLineGradient: {
    flex: 1,
    width: '100%',
  },
  // Timeline Node
  timelineNode: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  timelineLineContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  lineTop: {
    width: 2,
    flex: 1,
  },
  lineBottom: {
    width: 2,
    flex: 1,
  },
  nodeOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    zIndex: 1,
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
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  activityType: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
  activityTime: {
    fontSize: 11,
  },
  activityDesc: {
    fontSize: 13,
    marginTop: SPACING.sm,
    lineHeight: 18,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    gap: 4,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Empty State
  emptyTimeline: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: SPACING.sm,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
  },
});
