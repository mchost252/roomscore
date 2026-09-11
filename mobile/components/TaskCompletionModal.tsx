/**
 * TaskCompletionModal — Confirm & complete a task
 *
 * Design language: matches MissionBriefModal (bottom sheet, spring entrance,
 * solid opaque card, icon header, hairline footer with glowing CTA).
 */
import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import type { Task } from '../types/room';

interface TaskCompletionModalProps {
  visible: boolean;
  onClose: () => void;
  task: Task | null;
  onComplete: (task: Task) => void;
}

export function TaskCompletionModal({
  visible,
  onClose,
  task,
  onComplete,
}: TaskCompletionModalProps) {
  const { colors, isDark } = useTheme();

  if (!task) return null;

  const sheetBg = isDark ? '#141424' : '#ffffff';
  const iconBoxBg = isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)';
  const closeBtnBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const sectionDivider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const successGreen = '#22c55e';

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete(task);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[styles.scrim, { backgroundColor: colors.overlay }]} entering={FadeIn} exiting={FadeOut}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />

        <Animated.View
          style={[styles.sheet, { backgroundColor: sheetBg }]}
          entering={SlideInDown.duration(250)}
          exiting={SlideOutDown}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconBox, { backgroundColor: iconBoxBg }]}>
              <Ionicons name="checkmark-circle" size={24} color={successGreen} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                {task.title}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                +{task.points || 10} PTS  ·  {(task.taskType || 'daily').toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: closeBtnBg }]}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
              CONFIRM COMPLETION
            </Text>
            <Text style={[styles.bodyText, { color: colors.text }]}>
              {task.description
                ? 'Log this task as done and secure your points for today.'
                : 'Log this task as done and secure your points for today.'}
            </Text>
          </View>

          {/* Footer Action */}
          <View style={[styles.footer, { borderTopColor: sectionDivider }]}>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: successGreen }]}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.confirmBtnText}>Complete Task</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default TaskCompletionModal;
