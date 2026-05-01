import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { Task } from '../types/room';

interface TaskCompletionModalProps {
  visible: boolean;
  onClose: () => void;
  task: Task | null;
  onComplete: (task: Task) => void;
}

export function TaskCompletionModal({
  visible,
  onClose,
  task,
  onComplete,
}: TaskCompletionModalProps) {
  const { colors, isDark } = useTheme();

  if (!task) return null;

  // Solid opaque backgrounds — no transparency
  const cardBg = isDark ? '#141424' : '#ffffff';

  return (
    <Modal visible={visible} animationType="fade" transparent>
      {/* Proper overlay scrim */}
      <TouchableOpacity
        style={[styles.scrim, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={styles.center} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor: colors.borderColor,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            Complete task?
          </Text>
          <Text
            style={[styles.sub, { color: colors.textSecondary }]}
            numberOfLines={3}
          >
            {task.title}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.btn,
                { borderColor: colors.borderStrong },
              ]}
              onPress={onClose}
            >
              <Text style={{ color: colors.text }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btn,
                { backgroundColor: colors.success, borderColor: colors.success },
              ]}
              onPress={() => {
                onComplete(task);
                onClose();
              }}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.btnLight}>Complete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 15, marginBottom: 20 },
  actions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  btnLight: { color: '#fff', fontWeight: '700' },
});

export default TaskCompletionModal;
