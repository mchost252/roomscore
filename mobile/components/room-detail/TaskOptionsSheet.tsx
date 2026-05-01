/**
 * TaskOptionsSheet — Context-aware bottom sheet for task actions
 *
 * Smart menu logic:
 *   IF currentUserId === task.createdBy  → [Edit Task, Delete Task]
 *   IF user is a participant             → [Leave Task]
 *   IF user is NOT a participant         → [Join Task]
 *
 * v2: Solid opaque background, proper scrim, theme tokens,
 *     premium styling with accent-colored action rows.
 */
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Task } from '../../types/room';

interface TaskOptionsSheetProps {
  visible: boolean;
  task: Task | null;
  currentUserId: string;
  isRoomOwner: boolean;
  isParticipant: boolean;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onLeave?: (task: Task) => void;
  onJoin?: (task: Task) => void;
}

interface OptionItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  destructive?: boolean;
  action: () => void;
}

const TaskOptionsSheet: React.FC<TaskOptionsSheetProps> = ({
  visible,
  task,
  currentUserId,
  isRoomOwner,
  isParticipant,
  onClose,
  onEdit,
  onDelete,
  onLeave,
  onJoin,
}) => {
  const { colors, isDark } = useTheme();

  if (!task) return null;

  const options: OptionItem[] = [];

  const isTaskCreator = !!task.createdBy && task.createdBy === currentUserId;

  if (isTaskCreator || isRoomOwner) {
    options.push({
      icon: 'create-outline',
      label: 'Edit Task',
      color: colors.primary,
      action: () => { onEdit?.(task); onClose(); },
    });
    options.push({
      icon: 'trash-outline',
      label: 'Delete Task',
      color: colors.error || '#ef4444',
      destructive: true,
      action: () => { onDelete?.(task); onClose(); },
    });
  }

  if (isParticipant && !isTaskCreator && !isRoomOwner) {
    options.push({
      icon: 'exit-outline',
      label: 'Leave Task',
      color: colors.warning || '#f59e0b',
      action: () => { onLeave?.(task); onClose(); },
    });
  }

  if (!isParticipant) {
    options.push({
      icon: 'enter-outline',
      label: 'Join Task',
      color: colors.success || '#22c55e',
      action: () => { onJoin?.(task); onClose(); },
    });
  }

  if (isParticipant && (isTaskCreator || isRoomOwner)) {
    options.push({
      icon: 'exit-outline',
      label: 'Leave Task',
      color: colors.warning || '#f59e0b',
      action: () => { onLeave?.(task); onClose(); },
    });
  }

  // Solid backgrounds
  const sheetBg = isDark ? '#141424' : '#ffffff';
  const handleBarColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const cancelBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableOpacity
        style={[styles.scrim, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={styles.sheetContainer}>
        <View style={[styles.sheet, { backgroundColor: sheetBg }]}>
          {/* Handle bar */}
          <View style={[styles.handleBar, { backgroundColor: handleBarColor }]} />

          {/* Task title */}
          <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={1}>
            {task.title}
          </Text>

          {/* Role indicator */}
          <Text style={[styles.roleHint, { color: colors.textSecondary }]}>
            {isTaskCreator
              ? 'You created this task'
              : isRoomOwner
                ? 'You own this room'
                : isParticipant
                  ? 'You are a participant'
                  : 'You are spectating'}
          </Text>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />

          {/* Options */}
          {options.map((opt, i) => (
            <TouchableOpacity
              key={`${opt.label}-${i}`}
              style={styles.optionRow}
              onPress={opt.action}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIcon, { backgroundColor: opt.color + '12' }]}>
                <Ionicons name={opt.icon} size={18} color={opt.color} />
              </View>
              <Text
                style={[
                  styles.optionLabel,
                  { color: opt.destructive ? opt.color : colors.text },
                ]}
              >
                {opt.label}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}

          {/* Cancel */}
          <TouchableOpacity
            style={[styles.cancelRow, { backgroundColor: cancelBg }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 34,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  roleHint: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 4,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  cancelRow: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default TaskOptionsSheet;
