/**
 * MissionBriefModal — Spectating task detail & accept flow
 *
 * v2: Solid opaque card, proper scrim via colors.overlay,
 *     theme tokens throughout, premium visual hierarchy.
 */
import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { Task } from '../../types/room';

interface MissionBriefModalProps {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onAcceptMission: (task: Task) => void;
}

export default function MissionBriefModal({ visible, task, onClose, onAcceptMission }: MissionBriefModalProps) {
  const { colors, isDark } = useTheme();

  if (!task) return null;

  const sheetBg = isDark ? '#141424' : '#ffffff';
  const iconBoxBg = isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)';
  const closeBtnBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const avatarBg = isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)';
  const sectionDivider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[styles.scrim, { backgroundColor: colors.overlay }]} entering={FadeIn} exiting={FadeOut}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />

        <Animated.View
          style={[styles.sheet, { backgroundColor: sheetBg }]}
          entering={SlideInDown.springify().damping(18)}
          exiting={SlideOutDown}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconBox, { backgroundColor: iconBoxBg }]}>
              <Ionicons name="document-text" size={24} color={colors.primary} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                {task.title}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Mission Brief  ·  {task.points} PTS
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: closeBtnBg }]}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>DESCRIPTION</Text>
              <Text style={[styles.bodyText, { color: colors.text }]}>
                {task.description || 'No specific mission details provided. Prepare for the unknown.'}
              </Text>
            </View>

            <View style={[styles.sectionDividerLine, { backgroundColor: sectionDivider }]} />

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
                OPERATIVES ({task.participants?.length || 0})
              </Text>
              {task.participants && task.participants.length > 0 ? (
                <View style={styles.participantsRow}>
                  {task.participants.map((p, i) => (
                    <View
                      key={p.id}
                      style={[styles.avatar, {
                        borderColor: sheetBg,
                        backgroundColor: avatarBg,
                        zIndex: 10 - i,
                        marginLeft: i === 0 ? 0 : -8,
                      }]}
                    >
                      <Text style={[styles.avatarText, { color: colors.primary }]}>
                        {p.username.charAt(0)}
                      </Text>
                    </View>
                  ))}
                  <Text style={[styles.participantCount, { color: colors.textSecondary }]}>
                    {task.participants.length} Active
                  </Text>
                </View>
              ) : (
                <Text style={[styles.bodyText, { color: colors.textTertiary, fontStyle: 'italic' }]}>
                  No operatives have joined this mission yet. Be the first.
                </Text>
              )}
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={[styles.footer, { borderTopColor: sectionDivider }]}>
            <TouchableOpacity
              style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
              onPress={() => onAcceptMission(task)}
              activeOpacity={0.8}
            >
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
              <Text style={styles.acceptBtnText}>Accept Mission</Text>
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
    maxHeight: '85%',
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
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionDividerLine: {
    height: 1,
    marginBottom: 20,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
  },
  participantCount: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 12,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
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
