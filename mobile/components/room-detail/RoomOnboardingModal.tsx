/**
 * RoomOnboardingModal — "Mission Selection" for first-time room entry
 *
 * v2: Solid opaque card, proper scrim with fallback for Android (no BlurView
 * dependency for visual integrity), theme tokens, premium checklist styling.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { Task } from '../../types/room';

interface RoomOnboardingModalProps {
  visible: boolean;
  tasks: Task[];
  onComplete: (selectedTaskIds: string[]) => void;
}

export default function RoomOnboardingModal({ visible, tasks, onComplete }: RoomOnboardingModalProps) {
  const { colors, isDark } = useTheme();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleTask = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  if (!visible) return null;

  // Solid opaque backgrounds — no transparency dependency
  const cardBg = isDark ? '#141424' : '#ffffff';
  const taskRowBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const taskRowSelectedBg = isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)';
  const taskRowBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const taskRowSelectedBorder = colors.primary;
  const iconBoxBg = isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)';
  const checkboxBorder = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
  const footerBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Animated.View style={[styles.scrim, { backgroundColor: colors.overlay }]} entering={FadeIn} exiting={FadeOut}>
        <Animated.View
          style={[styles.card, {
            backgroundColor: cardBg,
            shadowColor: isDark ? '#000' : 'rgba(0,0,0,0.15)',
          }]}
          entering={SlideInDown.springify().damping(18)}
          exiting={SlideOutDown}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconBox, { backgroundColor: iconBoxBg }]}>
              <Ionicons name="compass" size={26} color={colors.primary} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                Room Unlocked
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Select initial missions to engage
              </Text>
            </View>
          </View>

          {/* Body Checklist */}
          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {tasks.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={36} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No active missions found.{'\n'}The room admin is drafting orders.
                </Text>
              </View>
            ) : (
              tasks.map(task => {
                const isSel = selectedIds.has(task.id);
                return (
                  <TouchableOpacity
                    key={task.id}
                    style={[styles.taskRow, {
                      backgroundColor: isSel ? taskRowSelectedBg : taskRowBg,
                      borderColor: isSel ? taskRowSelectedBorder : taskRowBorder,
                    }]}
                    onPress={() => toggleTask(task.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.checkbox,
                      isSel
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { borderColor: checkboxBorder },
                    ]}>
                      {isSel && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <View style={styles.taskContent}>
                      <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={1}>
                        {task.title}
                      </Text>
                      <Text style={[styles.taskPoints, { color: colors.textTertiary }]}>
                        {task.points} PTS  ·  {(task.taskType || 'daily').toUpperCase()}
                      </Text>
                    </View>
                    {isSel && (
                      <View style={[styles.selectedDot, { backgroundColor: colors.primary }]} />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Footer Action */}
          <View style={[styles.footer, { borderTopColor: footerBorder }]}>
            <TouchableOpacity
              style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
              onPress={() => onComplete(Array.from(selectedIds))}
              activeOpacity={0.8}
            >
              <Ionicons name="power" size={18} color="#fff" />
              <Text style={styles.acceptBtnText}>
                {selectedIds.size > 0 ? `Initialize (${selectedIds.size})` : 'Enter as Spectator'}
              </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    maxHeight: '80%',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
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
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  body: {
    paddingHorizontal: 24,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  taskPoints: {
    fontSize: 11,
    fontWeight: '600',
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
