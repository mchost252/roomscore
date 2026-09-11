import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { Task } from '../types/room';
import KriosDatePicker from './KriosDatePicker';

interface TaskCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    id?: string;
    title: string;
    description?: string;
    points?: number;
    taskType?: string;
    daysOfWeek?: number[];
    dueDate?: string;
    hasThread?: boolean;
  }) => void;
  isEditMode?: boolean;
  taskData?: Task | null;
}

export function TaskCreationModal({
  visible,
  onClose,
  onSubmit,
  isEditMode,
  taskData,
}: TaskCreationModalProps) {
  const { colors, isDark } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('10');
  const [taskType, setTaskType] = useState<'daily' | 'one-time' | 'custom'>('daily');
  const [taskDays, setTaskDays] = useState<number[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hasThread, setHasThread] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (visible && taskData) {
      setTitle(taskData.title);
      setDescription(taskData.description || '');
      setPoints(String(taskData.points ?? 10));
      setTaskType(taskData.taskType === 'weekly' ? 'daily' : ((taskData.taskType as any) || 'daily'));
      setDueDate(taskData.dueDate ? String(taskData.dueDate).slice(0, 10) : '');
      setShowDatePicker(false);
      setHasThread(taskData.hasThread ?? false);
      setErrorText('');
      setDueDate('');
      setShowDatePicker(false);
      
      // Parse days of week if stored as comma separated string
      if (taskData.daysOfWeek) {
        const parsed = String(taskData.daysOfWeek).split(',').map(Number).filter(n => !isNaN(n));
        setTaskDays(parsed);
      } else {
        setTaskDays([]);
        setDueDate('');
      }
    }
    if (visible && !taskData) {
      setTitle('');
      setDescription('');
      setPoints('10');
      setTaskType('daily');
      setTaskDays([]);
      setHasThread(false);
      setErrorText('');
    }
  }, [visible, taskData]);

  const toggleDay = (day: number) => {
    if (taskDays.includes(day)) {
      setTaskDays(taskDays.filter(d => d !== day));
    } else {
      setTaskDays([...taskDays, day].sort());
    }
  };

  const submit = () => {
    const trimmedTitle = title.trim();
    const numericPoints = Number.parseInt(points, 10);

    if (!trimmedTitle) {
      setErrorText('Task title is required.');
      return;
    }

    if (trimmedTitle.length < 3) {
      setErrorText('Task title must be at least 3 characters.');
      return;
    }

    if (!Number.isFinite(numericPoints) || numericPoints < 1 || numericPoints > 10) {
      setErrorText('Points must be between 1 and 10.');
      return;
    }

    if (taskType === 'custom' && taskDays.length === 0) {
      setErrorText('Choose at least one day for a custom task.');
      return;
    }
    if (taskType === 'one-time' && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      setErrorText('Choose a date for this one-time task.');
      return;
    }

    setErrorText('');
    onSubmit({
      id: isEditMode ? taskData?.id : undefined,
      title: trimmedTitle,
      description: description.trim() || undefined,
      points: numericPoints,
      taskType: taskType,
      daysOfWeek: taskType === 'custom' ? taskDays : [],
      dueDate: taskType === 'one-time' ? dueDate : undefined,
      hasThread,
    });
  };

  // Solid opaque backgrounds
  const sheetBg = isDark ? '#141424' : '#ffffff';

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        {/* Proper overlay scrim */}
        <TouchableOpacity
          style={[styles.scrim, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: sheetBg,
              borderColor: colors.borderColor,
            },
          ]}
        >
          <View style={styles.handleRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              {isEditMode ? 'Edit task' : 'New task'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Title
            </Text>
            <TextInput
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                if (errorText) setErrorText('');
              }}
              placeholder="Task title"
              placeholderTextColor={colors.placeholder}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: errorText ? '#ef4444' : colors.borderColor,
                  backgroundColor: colors.inputBg,
                },
              ]}
            />
            {errorText ? (
              <Text style={styles.errorText}>{errorText}</Text>
            ) : null}
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Optional"
              placeholderTextColor={colors.placeholder}
              multiline
              style={[
                styles.input,
                styles.area,
                {
                  color: colors.text,
                  borderColor: colors.borderColor,
                  backgroundColor: colors.inputBg,
                },
              ]}
            />
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Frequency
            </Text>
            <View style={styles.durationRow}>
              {(['daily', 'custom', 'one-time'] as const).map((f) => (
                <TouchableOpacity 
                  key={f} 
                  onPress={() => setTaskType(f)} 
                  style={[
                    styles.durationChip, 
                    { backgroundColor: taskType === f ? colors.primary : colors.inputBg }
                  ]}
                >
                  <Text style={[
                    styles.durationChipText, 
                    { color: taskType === f ? '#fff' : colors.textSecondary }
                  ]}>
                    {f.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {taskType === 'custom' && (
              <View style={styles.daysRow}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <TouchableOpacity 
                    key={i} 
                    onPress={() => toggleDay(i)} 
                    style={[
                      styles.dayBtn, 
                      { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                      taskDays.includes(i) && { backgroundColor: '#06b6d4', borderColor: '#06b6d4' }
                    ]}
                  >
                    <Text style={[
                      styles.dayBtnText, 
                      { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' },
                      taskDays.includes(i) && { color: '#fff' }
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {taskType === 'one-time' && (
              <>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Due date</Text>
                <TouchableOpacity
                  style={[styles.dateButton, { borderColor: colors.borderColor, backgroundColor: colors.inputBg }]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  <Text style={[styles.dateButtonText, { color: dueDate ? colors.text : colors.placeholder }]}>
                    {dueDate
                      ? new Date(`${dueDate}T12:00:00`).toLocaleDateString(undefined, {
                        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                      })
                      : 'Choose the day'}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </>
            )}

            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Points
            </Text>
            <TextInput
              value={points}
              onChangeText={setPoints}
              keyboardType="number-pad"
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.borderColor,
                  backgroundColor: colors.inputBg,
                },
              ]}
            />

            {/* Task Thread opt-in (default OFF) */}
            <TouchableOpacity
              style={[
                styles.threadRow,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: hasThread ? colors.primary : colors.borderColor,
                },
              ]}
              onPress={() => setHasThread((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.threadIconWrap, { backgroundColor: hasThread ? colors.primary : 'transparent' }]}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={18}
                  color={hasThread ? '#fff' : colors.textSecondary}
                />
              </View>
              <View style={styles.threadTextWrap}>
                <Text style={[styles.threadTitle, { color: colors.text }]}>
                  Task Thread
                </Text>
                <Text style={[styles.threadSub, { color: colors.textSecondary }]}>
                  Members can discuss & post proof
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.switchTrack,
                  { backgroundColor: hasThread ? colors.primary : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)') },
                ]}
                onPress={() => setHasThread((v) => !v)}
                activeOpacity={0.8}
                hitSlop={6}
              >
                <View
                  style={[
                    styles.switchThumb,
                    { transform: [{ translateX: hasThread ? 18 : 0 }] },
                  ]}
                />
              </TouchableOpacity>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primary, { backgroundColor: colors.primary }]}
              onPress={submit}
            >
              <Text style={styles.primaryTxt}>
                {isEditMode ? 'Save' : 'Create'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <KriosDatePicker
        visible={showDatePicker}
        initialDate={dueDate ? new Date(`${dueDate}T12:00:00`) : new Date()}
        showDate
        timeDisabled
        onCancel={() => setShowDatePicker(false)}
        onConfirm={(date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          setDueDate(`${year}-${month}-${day}`);
          setShowDatePicker(false);
          setErrorText('');
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 24,
    maxHeight: '85%',
  },
  handleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 12, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  area: { minHeight: 88, textAlignVertical: 'top' },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 6,
    marginBottom: 2,
    fontWeight: '600',
  },
  primary: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  durationRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  durationChip: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  durationChipText: { fontSize: 12, fontWeight: '800' },
  dateButton: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateButtonText: { flex: 1, fontSize: 16 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  dayBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayBtnText: { fontSize: 14, fontWeight: '800' },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 20,
    gap: 10,
  },
  threadIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadTextWrap: { flex: 1 },
  threadTitle: { fontSize: 14, fontWeight: '700' },
  threadSub: { fontSize: 11, marginTop: 2 },
  switchTrack: {
    width: 40,
    height: 22,
    borderRadius: 11,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
  },
});

export default TaskCreationModal;
