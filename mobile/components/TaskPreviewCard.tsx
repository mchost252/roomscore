/**
 * TaskPreviewCard
 *
 * Shown inside AI chat when Krios detects task creation intent.
 * User sees the full task details before confirming.
 * All fields are editable inline before adding.
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { TaskSuggestion, formatDueLabel, priorityEmoji, taskTypeLabel } from '../services/aiChatService';

interface Props {
  suggestion: TaskSuggestion;
  onConfirm: (task: TaskSuggestion) => void;
  onDismiss: () => void;
}

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const TASK_TYPES = ['one-time', 'daily', 'weekly'] as const;
const BUCKETS = ['inbox', 'work', 'health', 'reading', 'learning', 'personal', 'finance', 'social'];

export default function TaskPreviewCard({ suggestion, onConfirm, onDismiss }: Props) {
  const { isDark, colors } = useTheme();
  const [task, setTask] = useState<TaskSuggestion>({ ...suggestion });
  const [editingTitle, setEditingTitle] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const c = {
    bg:           isDark ? '#141428' : '#FFFFFF',
    border:       isDark ? '#2A2A4A' : '#E0DCF5',
    accent:       '#7C5CBF',
    accentLight:  isDark ? '#1E1540' : '#EDE7F6',
    text:         isDark ? '#E8E8FF' : '#1A1A2E',
    textSub:      isDark ? '#8888BB' : '#666699',
    chipActive:   '#7C5CBF',
    chipInactive: isDark ? '#1E1E32' : '#F0EEF8',
    chipActiveTxt:'#FFFFFF',
    chipInactiveTxt: isDark ? '#AAAACC' : '#555577',
    inputBg:      isDark ? '#1A1A30' : '#F5F3FF',
    success:      '#22c55e',
    danger:       '#ef4444',
  };

  const dueLabel = formatDueLabel(task.dueDate, task.dueTime);

  return (
    <View style={[styles.card, { backgroundColor: c.bg, borderColor: c.border }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: c.accentLight }]}>
          <Text style={[styles.badgeText, { color: c.accent }]}>✦ New Task</Text>
        </View>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={16} color={c.textSub} />
        </TouchableOpacity>
      </View>

      {/* Title */}
      {editingTitle ? (
        <TextInput
          style={[styles.titleInput, { color: c.text, borderColor: c.accent, backgroundColor: c.inputBg }]}
          value={task.title}
          onChangeText={v => setTask(p => ({ ...p, title: v }))}
          onBlur={() => setEditingTitle(false)}
          autoFocus
          returnKeyType="done"
        />
      ) : (
        <TouchableOpacity onPress={() => setEditingTitle(true)} activeOpacity={0.75}>
          <Text style={[styles.title, { color: c.text }]}>
            {task.title}
            <Text style={{ color: c.textSub, fontSize: 12 }}> ✎</Text>
          </Text>
        </TouchableOpacity>
      )}

      {/* Meta row */}
      <View style={styles.metaRow}>
        {/* Priority chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {PRIORITIES.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, {
                backgroundColor: task.priority === p ? c.chipActive : c.chipInactive,
                borderColor: task.priority === p ? c.chipActive : c.border,
              }]}
              onPress={() => setTask(prev => ({ ...prev, priority: p }))}
            >
              <Text style={[styles.chipText, {
                color: task.priority === p ? c.chipActiveTxt : c.chipInactiveTxt,
              }]}>
                {priorityEmoji(p)} {p}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Type row */}
      <View style={styles.metaRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {TASK_TYPES.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, {
                backgroundColor: task.taskType === t ? c.chipActive : c.chipInactive,
                borderColor: task.taskType === t ? c.chipActive : c.border,
              }]}
              onPress={() => setTask(prev => ({ ...prev, taskType: t }))}
            >
              <Text style={[styles.chipText, {
                color: task.taskType === t ? c.chipActiveTxt : c.chipInactiveTxt,
              }]}>
                {t === 'daily' ? '🔁' : t === 'weekly' ? '📅' : '⚡'} {taskTypeLabel(t)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Due date / time display */}
      {dueLabel ? (
        <View style={[styles.dueRow, { backgroundColor: c.inputBg, borderColor: c.border }]}>
          <Ionicons name="time-outline" size={14} color={c.accent} />
          <Text style={[styles.dueText, { color: c.text }]}>{dueLabel}</Text>
        </View>
      ) : null}

      {/* Expandable: bucket + notes */}
      <TouchableOpacity onPress={() => setExpanded(p => !p)} style={styles.expandRow}>
        <Text style={[styles.expandLabel, { color: c.textSub }]}>
          {expanded ? '▲ Less options' : '▼ More options (bucket, notes, time)'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedSection}>
          {/* Bucket */}
          <Text style={[styles.fieldLabel, { color: c.textSub }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
            {BUCKETS.map(b => (
              <TouchableOpacity
                key={b}
                style={[styles.chip, {
                  backgroundColor: task.bucket === b ? c.chipActive : c.chipInactive,
                  borderColor: task.bucket === b ? c.chipActive : c.border,
                }]}
                onPress={() => setTask(prev => ({ ...prev, bucket: b }))}
              >
                <Text style={[styles.chipText, {
                  color: task.bucket === b ? c.chipActiveTxt : c.chipInactiveTxt,
                }]}>{b}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Due time input */}
          <Text style={[styles.fieldLabel, { color: c.textSub }]}>Time (HH:MM)</Text>
          <TextInput
            style={[styles.fieldInput, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]}
            value={task.dueTime || ''}
            onChangeText={v => setTask(p => ({ ...p, dueTime: v }))}
            placeholder="e.g. 20:00"
            placeholderTextColor={c.textSub}
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
          />

          {/* Notes */}
          <Text style={[styles.fieldLabel, { color: c.textSub }]}>Notes</Text>
          <TextInput
            style={[styles.fieldInput, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text, minHeight: 56 }]}
            value={task.notes || ''}
            onChangeText={v => setTask(p => ({ ...p, notes: v }))}
            placeholder="Any extra details..."
            placeholderTextColor={c.textSub}
            multiline
            returnKeyType="done"
          />
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.dismissBtn, { borderColor: c.border }]}
          onPress={onDismiss}
        >
          <Text style={[styles.dismissText, { color: c.textSub }]}>Not now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: c.accent }]}
          onPress={() => onConfirm(task)}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark" size={15} color="#FFFFFF" />
          <Text style={styles.confirmText}>Add to tasks</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    marginTop: 6,
    marginBottom: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 22,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  metaRow: {
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  dueText: {
    fontSize: 13,
    fontWeight: '500',
  },
  expandRow: {
    paddingVertical: 4,
    marginBottom: 4,
  },
  expandLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  expandedSection: {
    marginTop: 4,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  dismissBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
