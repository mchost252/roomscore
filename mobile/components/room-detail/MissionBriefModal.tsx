import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={styles.scrim} entering={FadeIn} exiting={FadeOut}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        
        <Animated.View 
          style={[styles.sheet, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderColor }]} 
          entering={SlideInDown.springify().damping(18)} 
          exiting={SlideOutDown}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)' }]}>
              <Ionicons name="document-text" size={24} color={colors.primary} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                {task.title}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Mission Brief • {task.points} PTS
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DESCRIPTION</Text>
              <Text style={[styles.bodyText, { color: colors.text }]}>
                {task.description || "No specific mission details provided. Prepare for the unknown."}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>OPERATIVES ({task.participants?.length || 0})</Text>
              {task.participants && task.participants.length > 0 ? (
                <View style={styles.participantsRow}>
                  {task.participants.map((p, i) => (
                    <View key={p.id} style={[styles.avatar, { borderColor: colors.surfaceElevated, backgroundColor: 'rgba(99,102,241,0.2)', zIndex: 10 - i, marginLeft: i === 0 ? 0 : -8 }]}>
                      <Text style={[styles.avatarText, { color: colors.primary }]}>{p.username.charAt(0)}</Text>
                    </View>
                  ))}
                  <Text style={[styles.participantCount, { color: colors.textSecondary }]}>
                    {task.participants.length} Active
                  </Text>
                </View>
              ) : (
                <Text style={[styles.bodyText, { color: colors.textSecondary, fontStyle: 'italic' }]}>
                  No operatives have joined this mission yet. Be the first.
                </Text>
              )}
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={[styles.footer, { borderTopColor: colors.borderColor }]}>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
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
    textTransform: 'uppercase',
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
  },
  section: {
    marginBottom: 24,
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
