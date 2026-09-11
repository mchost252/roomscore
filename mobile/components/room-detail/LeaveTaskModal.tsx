/**
 * LeaveTaskModal — Confirmation modal for leaving a task
 *
 * Styled to match MissionBriefModal with friendly wording and clear action.
 */
import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { Task } from '../../types/room';

interface LeaveTaskModalProps {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onConfirmLeave: (task: Task) => void;
}

export default function LeaveTaskModal({ visible, task, onClose, onConfirmLeave }: LeaveTaskModalProps) {
  const { colors, isDark } = useTheme();

  if (!task) return null;

  const sheetBg = isDark ? '#141424' : '#ffffff';
  const iconBoxBg = isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.06)';
  const closeBtnBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const sectionDivider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

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
              <Ionicons name="exit-outline" size={24} color="#f59e0b" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                {task.title}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Leave task
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: closeBtnBg }]}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <View style={styles.section}>
              <Text style={[styles.message, { color: colors.text }]}>
                Are you sure you want to leave this task? You can rejoin anytime.
              </Text>
            </View>
          </View>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: sectionDivider }]}>
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.inputBg }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelBtnText, { color: colors.text }]}>Keep Participating</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.leaveBtn, { backgroundColor: '#f59e0b' }]}
              onPress={() => {
                onConfirmLeave(task);
                onClose();
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="exit" size={16} color="#fff" />
              <Text style={styles.leaveBtnText}>Leave Task</Text>
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
    maxHeight: '70%',
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
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
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
    paddingBottom: 16,
  },
  section: {
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  leaveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
