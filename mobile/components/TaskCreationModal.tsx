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
  const [taskType, setTaskType] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [taskDays, setTaskDays] = useState<number[]>([]);

  useEffect(() => {
    if (visible && taskData) {
      setTitle(taskData.title);
      setDescription(taskData.description || '');
      setPoints(String(taskData.points ?? 10));
      setTaskType((taskData.taskType as any) || 'daily');
      
      // Parse days of week if stored as comma separated string
      if (taskData.daysOfWeek) {
        const parsed = String(taskData.daysOfWeek).split(',').map(Number).filter(n => !isNaN(n));
        setTaskDays(parsed);
      } else {
        setTaskDays([]);
      }
    }
    if (visible && !taskData) {
      setTitle('');
      setDescription('');
      setPoints('10');
      setTaskType('daily');
      setTaskDays([]);
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
    if (!title.trim()) return;
    onSubmit({
      id: isEditMode ? taskData?.id : undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      points: parseInt(points, 10) || 10,
      taskType: taskType,
      daysOfWeek: taskType === 'custom' ? taskDays : [],
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
              onChangeText={setTitle}
              placeholder="Task title"
              placeholderTextColor={colors.placeholder}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.borderColor,
                  backgroundColor: colors.inputBg,
                },
              ]}
            />
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
              {(['daily', 'weekly', 'custom'] as const).map((f) => (
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
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  dayBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayBtnText: { fontSize: 14, fontWeight: '800' },
});

export default TaskCreationModal;
