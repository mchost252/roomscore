/**
 * RoomOnboardingModal — "Mission Selection" Checklist for First-Time Entry
 * 
 * Displays available tasks and allows new members to "Unlock" the room
 * by picking their initial missions.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
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

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Animated.View style={styles.scrim} entering={FadeIn} exiting={FadeOut}>
        {/* We use BlurView for the ultimate glassmorphism background */}
        <BlurView intensity={isDark ? 80 : 40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />

        <Animated.View 
          style={[
            styles.sheet, 
            { 
              backgroundColor: colors.surfaceElevated, 
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#D1D1D1',
              shadowColor: isDark ? '#000' : '#00000010',
              elevation: isDark ? 8 : 4,
            }
          ]} 
          entering={SlideInDown.springify().damping(18)} 
          exiting={SlideOutDown}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)' }]}>
              <Ionicons name="compass" size={26} color={colors.primary} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.title, { color: isDark ? '#fff' : '#1A1A1A' }]} numberOfLines={2}>
                Room Unlocked
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Select initial missions to engage
              </Text>
            </View>
          </View>

          {/* Body Checklist */}
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
            {tasks.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.bodyText, { color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center' }]}>
                  No active missions found. The room admin is drafting orders.
                </Text>
              </View>
            ) : (
              tasks.map(task => {
                const isSel = selectedIds.has(task.id);
                return (
                  <TouchableOpacity
                    key={task.id}
                    style={[
                      styles.taskRow,
                      {
                        backgroundColor: isSel ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)') : colors.surface,
                        borderColor: isSel ? colors.primary : (isDark ? 'rgba(255,255,255,0.05)' : '#E5E5E5'),
                        borderWidth: 1,
                      }
                    ]}
                    onPress={() => toggleTask(task.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, isSel ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}>
                      {isSel ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                    </View>
                    <View style={styles.taskContent}>
                      <Text style={[styles.taskTitle, { color: isDark ? '#fff' : '#1A1A1A' }]} numberOfLines={1}>
                        {task.title}
                      </Text>
                      <Text style={[styles.taskPoints, { color: colors.textTertiary }]}>
                        {task.points} PTS • {(task.taskType || 'daily').toUpperCase()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Footer Action */}
          <View style={[styles.footer, { borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : '#E5E5E5' }]}>
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
    justifyContent: 'center', // Center it like an onboarding card, rather than bottom sheet
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    maxHeight: '80%',
    overflow: 'hidden',
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  body: {
    paddingHorizontal: 24,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(150,150,150,0.5)',
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
    marginBottom: 4,
  },
  taskPoints: {
    fontSize: 11,
    fontWeight: '600',
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
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
