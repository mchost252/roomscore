/**
 * AI Task Note Component
 *
 * Renders the structured AI-generated note inside a task thread.
 * This is NOT a chat — it's a living document:
 *   - Summary header
 *   - Step-by-step flow (collapsible)
 *   - Interest hook card
 *   - Resource card (tappable)
 *   - Milestone checkboxes
 *
 * Designed to sit pinned at the top of the task thread,
 * above user notes.
 */

import React, { useState } from 'react';
import {
  Animated,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { AINote, AIMilestone, saveMilestones } from '../services/aiNoteService';

interface Props {
  note: AINote;
  onMilestonesChange?: (milestones: AIMilestone[]) => void;
  isLoading?: boolean;
  fromCache?: boolean;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
function AINoteSkeleton({ isDark }: { isDark: boolean }) {
  const pulse = React.useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const bg = isDark ? '#1E1E30' : '#EEEEEE';
  return (
    <Animated.View style={[styles.skeletonWrap, { opacity: pulse }]}>
      <View style={[styles.skeletonLine, { backgroundColor: bg, width: '40%', height: 10, marginBottom: 10 }]} />
      <View style={[styles.skeletonLine, { backgroundColor: bg, width: '90%', height: 8 }]} />
      <View style={[styles.skeletonLine, { backgroundColor: bg, width: '75%', height: 8, marginTop: 6 }]} />
      <View style={[styles.skeletonLine, { backgroundColor: bg, width: '80%', height: 8, marginTop: 6 }]} />
      <View style={{ marginTop: 14 }}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[styles.skeletonLine, { backgroundColor: bg, width: '100%', height: 36, marginBottom: 8, borderRadius: 10 }]} />
        ))}
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function AITaskNote({ note, onMilestonesChange, isLoading, fromCache }: Props) {
  const { isDark } = useTheme();
  const [flowExpanded, setFlowExpanded] = useState(true);
  const [milestones, setMilestones] = useState<AIMilestone[]>(note.milestones || []);

  const colors = {
    bg: isDark ? '#13132A' : '#F8F6FF',
    border: isDark ? '#2A2A4A' : '#D8D0F0',
    accent: '#7C5CBF',
    accentLight: isDark ? '#1E1540' : '#EDE7F6',
    text: isDark ? '#E8E8FF' : '#1A1A2E',
    subtext: isDark ? '#8888BB' : '#666699',
    hookBg: isDark ? '#1A1A35' : '#FFF8E7',
    hookBorder: isDark ? '#3A3A20' : '#F0E0A0',
    hookText: isDark ? '#DDDDAA' : '#7A6010',
    resourceBg: isDark ? '#0E1E30' : '#E8F4FE',
    resourceBorder: isDark ? '#1A3A55' : '#B0D8F5',
    resourceText: isDark ? '#88BBDD' : '#1565C0',
    checkDone: '#7C5CBF',
    checkUndone: isDark ? '#2A2A4A' : '#DDDDEE',
    stepNum: isDark ? '#5A4A8A' : '#C5B8E8',
    stepBg: isDark ? '#1A1530' : '#F3EFFE',
  };

  if (isLoading) return <AINoteSkeleton isDark={isDark} />;

  const handleMilestoneToggle = async (id: number) => {
    const updated = milestones.map(m =>
      m.id === id ? { ...m, completed: !m.completed } : m
    );
    setMilestones(updated);
    onMilestonesChange?.(updated);
    await saveMilestones(note.taskId, updated);
  };

  const handleResourcePress = () => {
    if (note.resource?.url) {
      Linking.openURL(note.resource.url).catch(() => {});
    }
  };

  const completedCount = milestones.filter(m => m.completed).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      {/* AI Header */}
      <View style={styles.aiHeader}>
        <View style={[styles.aiBadge, { backgroundColor: colors.accentLight }]}>
          <Text style={[styles.aiBadgeText, { color: colors.accent }]}>✦ Krios AI</Text>
        </View>
        {fromCache && (
          <Text style={[styles.cacheLabel, { color: colors.subtext }]}>cached</Text>
        )}
        {note.estimatedTime ? (
          <Text style={[styles.timeLabel, { color: colors.subtext }]}>
            ⏱ {note.estimatedTime}
          </Text>
        ) : null}
      </View>

      {/* Summary */}
      {note.summary ? (
        <Text style={[styles.summary, { color: colors.text }]}>{note.summary}</Text>
      ) : null}

      {/* Milestones */}
      {milestones.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: colors.accent }]}>Milestones</Text>
            <Text style={[styles.sectionMeta, { color: colors.subtext }]}>
              {completedCount}/{milestones.length}
            </Text>
          </View>
          {milestones.map(m => (
            <TouchableOpacity
              key={m.id}
              style={styles.milestoneRow}
              onPress={() => handleMilestoneToggle(m.id)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  { backgroundColor: m.completed ? colors.checkDone : 'transparent',
                    borderColor: m.completed ? colors.checkDone : colors.checkUndone },
                ]}
              >
                {m.completed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text
                style={[
                  styles.milestoneLabel,
                  { color: m.completed ? colors.subtext : colors.text,
                    textDecorationLine: m.completed ? 'line-through' : 'none' },
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Flow steps */}
      {note.flow && note.flow.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setFlowExpanded(p => !p)}
            activeOpacity={0.7}
          >
            <Text style={[styles.sectionLabel, { color: colors.accent }]}>
              How to approach it
            </Text>
            <Text style={[styles.chevron, { color: colors.subtext }]}>
              {flowExpanded ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {flowExpanded && (
            <View style={styles.flowList}>
              {note.flow.map(step => (
                <View
                  key={step.step}
                  style={[styles.stepRow, { backgroundColor: colors.stepBg }]}
                >
                  <View style={[styles.stepNum, { backgroundColor: colors.stepNum }]}>
                    <Text style={styles.stepNumText}>{step.step}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepTitle, { color: colors.text }]}>{step.title}</Text>
                    <Text style={[styles.stepDetail, { color: colors.subtext }]}>{step.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Hook / Interest card */}
      {note.hook ? (
        <View style={[styles.hookCard, { backgroundColor: colors.hookBg, borderColor: colors.hookBorder }]}>
          <Text style={styles.hookEmoji}>💡</Text>
          <Text style={[styles.hookText, { color: colors.hookText }]}>{note.hook}</Text>
        </View>
      ) : null}

      {/* Resource card */}
      {note.resource ? (
        <TouchableOpacity
          style={[styles.resourceCard, { backgroundColor: colors.resourceBg, borderColor: colors.resourceBorder }]}
          onPress={handleResourcePress}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.resourceName, { color: colors.resourceText }]}>
              🔗 {note.resource.name}
            </Text>
            <Text style={[styles.resourceDesc, { color: colors.subtext }]}>
              {note.resource.description}
            </Text>
          </View>
          <Text style={[styles.resourceArrow, { color: colors.resourceText }]}>→</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  aiBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  aiBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cacheLabel: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  timeLabel: {
    fontSize: 12,
    marginLeft: 'auto',
  },
  summary: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
    fontWeight: '400',
  },
  section: {
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionMeta: {
    fontSize: 12,
  },
  chevron: {
    fontSize: 11,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  milestoneLabel: {
    fontSize: 14,
    flex: 1,
    lineHeight: 19,
  },
  flowList: {
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  stepDetail: {
    fontSize: 12,
    lineHeight: 17,
  },
  hookCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  hookEmoji: {
    fontSize: 16,
    marginTop: 1,
  },
  hookText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  resourceName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  resourceDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  resourceArrow: {
    fontSize: 18,
    fontWeight: '300',
  },
  // Skeleton
  skeletonWrap: {
    padding: 16,
  },
  skeletonLine: {
    borderRadius: 6,
    height: 8,
  },
});
