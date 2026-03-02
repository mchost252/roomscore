import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.9;
const DISMISS_THRESHOLD = 100;

import type { PersonalTask } from '../services/taskService';

export type TaskItem = PersonalTask & {
  tags?: string[];
};

// Backward-compat alias for older references
export interface TaskItemLegacy {
  id: string;
  title: string;
  bucket?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  // Align with PersonalTask
  isCompleted?: boolean;
  description?: string;
  createdAt?: string;
  snoozedUntil?: string;
  tags?: string[];
}

interface ThreadEntry {
  id: string;
  type: 'creation' | 'note' | 'reminder' | 'snooze' | 'complete' | 'priority' | 'status';
  text: string;
  timestamp: Date;
  icon?: string;
  color?: string;
}

interface TaskDetailSheetProps {
  visible: boolean;
  task: TaskItem | null;
  onClose: () => void;
  onUpdate: (updatedTask: TaskItem) => void;
  onDelete: (taskId: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  urgent: '#dc2626',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const ACTION_CHIPS = [
  { label: 'Add note', icon: 'create-outline', type: 'note' },
  { label: 'Remind me', icon: 'notifications-outline', type: 'reminder' },
  { label: 'Snooze', icon: 'time-outline', type: 'snooze' },
  { label: 'Priority', icon: 'flag-outline', type: 'priority' },
];

function buildInitialThread(task: TaskItem): ThreadEntry[] {
  const entries: ThreadEntry[] = [
    {
      id: 'creation',
      type: 'creation',
      text: `Task created: "${task.title}"`,
      timestamp: new Date(task.createdAt || Date.now()),
      icon: 'add-circle',
      color: '#6366f1',
    },
  ];

  if (task.priority) {
    entries.push({
      id: 'priority-init',
      type: 'priority',
      text: `Priority set to ${PRIORITY_LABELS[task.priority] || task.priority}`,
      timestamp: new Date(task.createdAt || Date.now()),
      icon: 'flag',
      color: PRIORITY_COLORS[task.priority] || '#6366f1',
    });
  }

  if (task.dueDate) {
    entries.push({
      id: 'due-init',
      type: 'reminder',
      text: `Due date: ${task.dueDate}`,
      timestamp: new Date(task.createdAt || Date.now()),
      icon: 'calendar',
      color: '#f59e0b',
    });
  }

  if (task.description) {
    entries.push({
      id: 'notes-init',
      type: 'note',
      text: task.description,
      timestamp: new Date(task.createdAt || Date.now()),
      icon: 'document-text',
      color: '#06b6d4',
    });
  }

  if (task.isCompleted) {
    entries.push({
      id: 'complete-init',
      type: 'complete',
      text: 'Task completed!',
      timestamp: new Date(),
      icon: 'checkmark-circle',
      color: '#22c55e',
    });
  }

  return entries;
}

const REMINDER_OPTIONS = ['In 30 min', 'In 1 hour', 'Tonight 8pm', 'Tomorrow 9am', 'Custom'];
const SNOOZE_OPTIONS = ['30 minutes', '1 hour', '3 hours', 'Tomorrow', 'Next week'];
const PRIORITY_OPTIONS: Array<'low' | 'medium' | 'high' | 'urgent'> = ['low', 'medium', 'high', 'urgent'];

export default function TaskDetailSheet({ visible, task, onClose, onUpdate, onDelete }: TaskDetailSheetProps) {
  const { colors, gradients, isDark } = useTheme();
  // Shim for existing theme.* usage inside this component
  const theme = {
    background: colors.background.primary,
    surface: colors.surface,
    border: colors.border.primary,
    text: colors.text,
    textSecondary: colors.textSecondary,
    textTertiary: colors.textTertiary,
    primary: colors.primary,
    success: colors.status.success,
    warning: colors.status.warning,
    error: colors.status.error,
    gradient: gradients.background.colors,
  };
  const insets = useSafeAreaInsets();
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gs) => gs.dy > 5,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) dragY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > DISMISS_THRESHOLD) {
          handleClose();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 100 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible && task) {
      setThread(buildInitialThread(task));
      setIsCompleted(task.isCompleted || false);
      dragY.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, task]);

  const handleClose = useCallback(() => {
    setActiveAction(null);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 280, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      dragY.setValue(0);
      onClose();
    });
  }, [onClose]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const addNote = useCallback(() => {
    if (!noteInput.trim() || !task) return;
    const entry: ThreadEntry = {
      id: Date.now().toString(),
      type: 'note',
      text: noteInput.trim(),
      timestamp: new Date(),
      icon: 'document-text',
      color: '#06b6d4',
    };
    setThread(prev => [...prev, entry]);
    onUpdate({ ...task, description: noteInput.trim() });
    setNoteInput('');
    setActiveAction(null);
    scrollToBottom();
  }, [noteInput, task, onUpdate, scrollToBottom]);

  const setReminder = useCallback((option: string) => {
    if (!task) return;
    const entry: ThreadEntry = {
      id: Date.now().toString(),
      type: 'reminder',
      text: `Reminder set: ${option}`,
      timestamp: new Date(),
      icon: 'notifications',
      color: '#f59e0b',
    };
    setThread(prev => [...prev, entry]);
    setActiveAction(null);
    scrollToBottom();
  }, [task, scrollToBottom]);

  const handleSnooze = useCallback((option: string) => {
    if (!task) return;
    const entry: ThreadEntry = {
      id: Date.now().toString(),
      type: 'snooze',
      text: `Task snoozed: ${option}`,
      timestamp: new Date(),
      icon: 'time',
      color: '#8b5cf6',
    };
    setThread(prev => [...prev, entry]);
    onUpdate({ ...task });
    setActiveAction(null);
    scrollToBottom();
  }, [task, onUpdate, scrollToBottom]);

  const handlePriority = useCallback((p: 'low' | 'medium' | 'high' | 'urgent') => {
    if (!task) return;
    const entry: ThreadEntry = {
      id: Date.now().toString(),
      type: 'priority',
      text: `Priority changed to ${PRIORITY_LABELS[p]}`,
      timestamp: new Date(),
      icon: 'flag',
      color: PRIORITY_COLORS[p],
    };
    setThread(prev => [...prev, entry]);
    onUpdate({ ...task, priority: p });
    setActiveAction(null);
    scrollToBottom();
  }, [task, onUpdate, scrollToBottom]);

  const handleToggleComplete = useCallback(() => {
    if (!task) return;
    const newDone = !isCompleted;
    setIsCompleted(newDone);
    const entry: ThreadEntry = {
      id: Date.now().toString(),
      type: 'complete',
      text: newDone ? 'Task marked as completed!' : 'Task reopened',
      timestamp: new Date(),
      icon: newDone ? 'checkmark-circle' : 'refresh-circle',
      color: newDone ? '#22c55e' : '#f59e0b',
    };
    setThread(prev => [...prev, entry]);
    onUpdate({ ...task, isCompleted: newDone });
    scrollToBottom();
  }, [task, isCompleted, onUpdate, scrollToBottom]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const renderEntry = ({ item, index }: { item: ThreadEntry; index: number }) => {
    const isNote = item.type === 'note';
    const showDate = index === 0 || 
      formatDate(thread[index - 1]?.timestamp) !== formatDate(item.timestamp);

    return (
      <View>
        {showDate && (
          <View style={styles.dateDivider}>
            <View style={[styles.dateLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dateLabel, { color: theme.textSecondary, backgroundColor: theme.background }]}>
              {formatDate(item.timestamp)}
            </Text>
            <View style={[styles.dateLine, { backgroundColor: theme.border }]} />
          </View>
        )}
        {isNote ? (
          // Notes look like user messages (right side)
          <View style={styles.noteRow}>
            <View style={[styles.noteBubble, { backgroundColor: theme.primary }]}>
              <Text style={styles.noteText}>{item.text}</Text>
              <Text style={styles.noteTime}>{formatTime(item.timestamp)}</Text>
            </View>
          </View>
        ) : (
          // System events look like AI messages (left side, subtle)
          <View style={styles.eventRow}>
            <View style={[styles.eventIcon, { backgroundColor: (item.color || '#6366f1') + '20' }]}>
              <Ionicons name={(item.icon || 'information-circle') as any} size={13} color={item.color || '#6366f1'} />
            </View>
            <View style={styles.eventContent}>
              <Text style={[styles.eventText, { color: theme.text }]}>{item.text}</Text>
              <Text style={[styles.eventTime, { color: theme.textSecondary }]}>{formatTime(item.timestamp)}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderActionPanel = () => {
    switch (activeAction) {
      case 'note':
        return (
          <View style={[styles.actionPanel, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderTopColor: theme.border }]}>
            <TextInput
              style={[styles.noteInputFull, { color: theme.text, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}
              placeholder="Add a note, thought, or update..."
              placeholderTextColor={theme.textSecondary}
              value={noteInput}
              onChangeText={setNoteInput}
              multiline
              autoFocus
            />
            <View style={styles.actionPanelButtons}>
              <TouchableOpacity onPress={() => setActiveAction(null)} style={[styles.cancelBtn, { borderColor: theme.border }]}>
                <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addNote} style={[styles.saveBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.saveBtnText}>Add Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 'reminder':
        return (
          <View style={[styles.actionPanel, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderTopColor: theme.border }]}>
            <Text style={[styles.actionPanelTitle, { color: theme.text }]}>Set a reminder</Text>
            <View style={styles.optionChips}>
              {REMINDER_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionChip, { borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)' }]}
                  onPress={() => setReminder(opt)}
                >
                  <Text style={[styles.optionChipText, { color: '#f59e0b' }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 'snooze':
        return (
          <View style={[styles.actionPanel, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderTopColor: theme.border }]}>
            <Text style={[styles.actionPanelTitle, { color: theme.text }]}>Snooze for...</Text>
            <View style={styles.optionChips}>
              {SNOOZE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionChip, { borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.08)' }]}
                  onPress={() => handleSnooze(opt)}
                >
                  <Text style={[styles.optionChipText, { color: '#8b5cf6' }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 'priority':
        return (
          <View style={[styles.actionPanel, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderTopColor: theme.border }]}>
            <Text style={[styles.actionPanelTitle, { color: theme.text }]}>Set priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITY_OPTIONS.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityOption, { borderColor: PRIORITY_COLORS[p], backgroundColor: PRIORITY_COLORS[p] + '15' }]}
                  onPress={() => handlePriority(p)}
                >
                  <Ionicons name="flag" size={14} color={PRIORITY_COLORS[p]} />
                  <Text style={[styles.priorityLabel, { color: PRIORITY_COLORS[p] }]}>{PRIORITY_LABELS[p]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  if (!task) return null;

  const priorityColor = task.priority ? PRIORITY_COLORS[task.priority] : '#6366f1';

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} pointerEvents="box-none">
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, {
        backgroundColor: theme.background,
        transform: [{ translateY: Animated.add(slideAnim, dragY) }],
        paddingBottom: insets.bottom,
      }]}>
        {/* Handle + Header */}
        <View {...panResponder.panHandlers}>
          <View style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
          </View>

          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={2}>
                  {task.title}
                </Text>
                <View style={styles.headerMeta}>
                  {task.bucket && (
                    <View style={[styles.bucketChip, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)' }]}>
                      <Text style={[styles.bucketText, { color: theme.primary }]}>{(task as any).bucket}</Text>
                    </View>
                  )}
                  {task.priority && (
                    <View style={[styles.bucketChip, { backgroundColor: priorityColor + '15' }]}>
                      <Ionicons name="flag" size={10} color={priorityColor} />
                      <Text style={[styles.bucketText, { color: priorityColor }]}>{PRIORITY_LABELS[task.priority]}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <View style={styles.headerRight}>
              <Switch
                value={isCompleted}
                onValueChange={handleToggleComplete}
                trackColor={{ false: theme.border, true: '#22c55e' }}
                thumbColor="#ffffff"
                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
              />
              <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                <Ionicons name="close" size={17} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Thread */}
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            ref={flatListRef}
            data={thread}
            keyExtractor={item => item.id}
            renderItem={renderEntry}
            contentContainerStyle={styles.threadList}
            showsVerticalScrollIndicator={false}
          />

          {/* Action chips */}
          {!activeAction && (
            <View style={[styles.actionChipsRow, { borderTopColor: theme.border }]}>
              {ACTION_CHIPS.map(chip => (
                <TouchableOpacity
                  key={chip.type}
                  style={[styles.actionChip, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
                  onPress={() => setActiveAction(chip.type)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={chip.icon as any} size={14} color={theme.primary} />
                  <Text style={[styles.actionChipText, { color: theme.primary }]}>{chip.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Action panel */}
          {renderActionPanel()}

          {/* Delete button */}
          {!activeAction && (
            <View style={[styles.deleteRow, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: 'rgba(239,68,68,0.08)' }]}
                onPress={() => { onDelete(task.id); handleClose(); }}
              >
                <Ionicons name="trash-outline" size={15} color="#ef4444" />
                <Text style={styles.deleteBtnText}>Delete Task</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 24,
    overflow: 'hidden',
  },
  handleArea: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  priorityDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  headerTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2, lineHeight: 21 },
  headerMeta: { flexDirection: 'row', gap: 6, marginTop: 5, flexWrap: 'wrap' },
  bucketChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  bucketText: { fontSize: 11, fontWeight: '500' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  threadList: { padding: 16, paddingBottom: 8 },
  dateDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, gap: 8 },
  dateLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dateLabel: { fontSize: 11, fontWeight: '500', paddingHorizontal: 6 },
  noteRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6 },
  noteBubble: {
    maxWidth: SCREEN_WIDTH * 0.75,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  noteText: { color: '#ffffff', fontSize: 14, lineHeight: 20 },
  noteTime: { color: 'rgba(255,255,255,0.65)', fontSize: 10, marginTop: 3, textAlign: 'right' },
  eventRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  eventIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  eventContent: { flex: 1 },
  eventText: { fontSize: 13, lineHeight: 18 },
  eventTime: { fontSize: 10, marginTop: 1, opacity: 0.6 },
  actionChipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexWrap: 'wrap',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  actionChipText: { fontSize: 12.5, fontWeight: '500' },
  actionPanel: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionPanelTitle: { fontSize: 13, fontWeight: '600', marginBottom: 12 },
  actionPanelButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  cancelBtnText: { fontSize: 14, fontWeight: '500' },
  saveBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  noteInputFull: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  optionChipText: { fontSize: 13, fontWeight: '500' },
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  priorityLabel: { fontSize: 13, fontWeight: '600' },
  deleteRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  deleteBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '500' },
});
