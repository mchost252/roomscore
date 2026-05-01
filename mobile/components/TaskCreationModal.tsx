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

  useEffect(() => {
    if (visible && taskData) {
      setTitle(taskData.title);
      setDescription(taskData.description || '');
      setPoints(String(taskData.points ?? 10));
    }
    if (visible && !taskData) {
      setTitle('');
      setDescription('');
      setPoints('10');
    }
  }, [visible, taskData]);

  const submit = () => {
    if (!title.trim()) return;
    onSubmit({
      id: isEditMode ? taskData?.id : undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      points: parseInt(points, 10) || 10,
      taskType: 'daily',
    });
  };

  // Solid opaque backgrounds
  const sheetBg = isDark ? '#141424' : '#ffffff';

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
});

export default TaskCreationModal;
