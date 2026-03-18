import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Switch, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHaptics } from '../../hooks';
import roomService, { CreateRoomData } from '../../services/roomService';

type Duration = '1_week' | '2_weeks' | '1_month';
type TaskType = 'daily' | 'weekly' | 'custom';

interface TaskDraft {
  id: string;
  title: string;
  description: string;
  taskType: TaskType;
  points: number;
  daysOfWeek: number[];
}

const DURATIONS: { value: Duration; label: string }[] = [
  { value: '1_week', label: '1 Week' },
  { value: '2_weeks', label: '2 Weeks' },
  { value: '1_month', label: '1 Month' },
];

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CreateRoomScreen() {
  const router = useRouter();
  const { colors, gradients, isDark } = useTheme();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();

  const t = {
    bg: colors.background.primary,
    surface: colors.surface,
    border: colors.border.primary,
    text: colors.text,
    textSub: colors.textSecondary,
    textHint: colors.textTertiary,
    primary: colors.primary,
    gradient: gradients.background.colors,
    inputBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  };

  // ── Form state ──
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [maxMembers, setMaxMembers] = useState('50');
  const [duration, setDuration] = useState<Duration>('1_month');
  const [chatRetention, setChatRetention] = useState('3');
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [creating, setCreating] = useState(false);

  // ── Task editing ──
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('daily');
  const [taskPoints, setTaskPoints] = useState('5');
  const [taskDays, setTaskDays] = useState<number[]>([]);

  const resetTaskForm = () => {
    setTaskTitle('');
    setTaskDesc('');
    setTaskType('daily');
    setTaskPoints('5');
    setTaskDays([]);
    setShowTaskForm(false);
  };

  const addTask = () => {
    if (!taskTitle.trim()) return;
    const newTask: TaskDraft = {
      id: `draft_${Date.now()}`,
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      taskType,
      points: Math.min(10, Math.max(1, parseInt(taskPoints) || 5)),
      daysOfWeek: taskType === 'custom' ? taskDays : [],
    };
    setTasks(prev => [...prev, newTask]);
    haptics.success();
    resetTaskForm();
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    haptics.tap();
  };

  const toggleDay = (day: number) => {
    setTaskDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
    haptics.selection();
  };

  // ── Submit ──
  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      showToast({ message: 'Room name is required', type: 'error' });
      return;
    }
    if (name.trim().length < 2) {
      showToast({ message: 'Room name must be at least 2 characters', type: 'error' });
      return;
    }

    setCreating(true);
    try {
      const data: CreateRoomData = {
        name: name.trim(),
        description: description.trim() || undefined,
        isPublic,
        requireApproval,
        maxMembers: parseInt(maxMembers) || 50,
        duration,
        chatRetentionDays: Math.min(5, Math.max(1, parseInt(chatRetention) || 3)),
        tasks: tasks.map(t => ({
          title: t.title,
          description: t.description || undefined,
          taskType: t.taskType,
          daysOfWeek: t.daysOfWeek,
          points: t.points,
        })),
      };

      const room = await roomService.createRoom(data);
      haptics.success();
      showToast({ message: `${room.name} created!`, type: 'success' });
      router.replace({ pathname: '/(home)/room-detail', params: { roomId: room.id || room._id } });
    } catch (err: any) {
      haptics.error();
      showToast({ message: err?.response?.data?.message || 'Failed to create room', type: 'error' });
    } finally {
      setCreating(false);
    }
  }, [name, description, isPublic, requireApproval, maxMembers, duration, chatRetention, tasks]);

  // ── Section component ──
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: t.textSub }]}>{title}</Text>
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.container, { backgroundColor: t.bg }]}>
          <LinearGradient
            colors={t.gradient as any}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* ── Header ── */}
          <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 52) }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backButton, { backgroundColor: t.surface, borderColor: t.border }]}
            >
              <Ionicons name="chevron-back" size={22} color={t.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: t.text }]}>Create Room</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Room Info ── */}
            <Section title="ROOM INFO">
              <View style={[styles.inputGroup, { backgroundColor: t.surface, borderColor: t.border }]}>
                <TextInput
                  style={[styles.input, { color: t.text, borderColor: t.border }]}
                  placeholder="Room name *"
                  placeholderTextColor={t.textHint}
                  value={name}
                  onChangeText={setName}
                  maxLength={50}
                />
                <TextInput
                  style={[styles.input, styles.inputLast, { color: t.text }]}
                  placeholder="Description (optional)"
                  placeholderTextColor={t.textHint}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={200}
                />
              </View>
            </Section>

            {/* ── Privacy & Settings ── */}
            <Section title="SETTINGS">
              <View style={[styles.inputGroup, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={[styles.switchRow, { borderColor: t.border }]}>
                  <View style={styles.switchLabel}>
                    <Ionicons name="globe-outline" size={18} color={t.primary} />
                    <View>
                      <Text style={[styles.switchText, { color: t.text }]}>Public Room</Text>
                      <Text style={[styles.switchHint, { color: t.textHint }]}>Anyone can discover this room</Text>
                    </View>
                  </View>
                  <Switch
                    value={isPublic}
                    onValueChange={(v) => { setIsPublic(v); haptics.selection(); }}
                    trackColor={{ false: isDark ? '#333' : '#ddd', true: '#6366f1' }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={[styles.switchRow, { borderColor: t.border }]}>
                  <View style={styles.switchLabel}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={t.primary} />
                    <View>
                      <Text style={[styles.switchText, { color: t.text }]}>Require Approval</Text>
                      <Text style={[styles.switchHint, { color: t.textHint }]}>Approve members before they join</Text>
                    </View>
                  </View>
                  <Switch
                    value={requireApproval}
                    onValueChange={(v) => { setRequireApproval(v); haptics.selection(); }}
                    trackColor={{ false: isDark ? '#333' : '#ddd', true: '#6366f1' }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={[styles.switchRow, styles.switchRowLast]}>
                  <View style={styles.switchLabel}>
                    <Ionicons name="people-outline" size={18} color={t.primary} />
                    <Text style={[styles.switchText, { color: t.text }]}>Max Members</Text>
                  </View>
                  <TextInput
                    style={[styles.miniInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
                    value={maxMembers}
                    onChangeText={setMaxMembers}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>
              </View>
            </Section>

            {/* ── Duration ── */}
            <Section title="DURATION">
              <View style={styles.durationRow}>
                {DURATIONS.map(d => (
                  <TouchableOpacity
                    key={d.value}
                    activeOpacity={0.7}
                    onPress={() => { setDuration(d.value); haptics.selection(); }}
                    style={[
                      styles.durationChip,
                      {
                        backgroundColor: duration === d.value
                          ? (isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)')
                          : t.surface,
                        borderColor: duration === d.value ? '#6366f1' : t.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        { color: duration === d.value ? '#6366f1' : t.textSub },
                      ]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>

            {/* ── Chat Retention ── */}
            <Section title="CHAT RETENTION">
              <View style={[styles.inputGroup, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={[styles.switchRow, styles.switchRowLast]}>
                  <View style={styles.switchLabel}>
                    <Ionicons name="chatbubble-outline" size={18} color={t.primary} />
                    <View>
                      <Text style={[styles.switchText, { color: t.text }]}>Keep messages for</Text>
                      <Text style={[styles.switchHint, { color: t.textHint }]}>1-5 days</Text>
                    </View>
                  </View>
                  <View style={styles.retentionPicker}>
                    {[1, 2, 3, 5].map(d => (
                      <TouchableOpacity
                        key={d}
                        onPress={() => { setChatRetention(String(d)); haptics.selection(); }}
                        style={[
                          styles.retentionChip,
                          {
                            backgroundColor: parseInt(chatRetention) === d
                              ? '#6366f1' : t.inputBg,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '600',
                            color: parseInt(chatRetention) === d ? '#fff' : t.textSub,
                          }}
                        >
                          {d}d
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </Section>

            {/* ── Tasks ── */}
            <Section title={`TASKS (${tasks.length})`}>
              {tasks.map(task => (
                <View
                  key={task.id}
                  style={[styles.taskCard, { backgroundColor: t.surface, borderColor: t.border }]}
                >
                  <View style={styles.taskCardContent}>
                    <View style={[styles.taskDot, { backgroundColor: '#6366f1' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskCardTitle, { color: t.text }]}>{task.title}</Text>
                      <View style={styles.taskMeta}>
                        <Text style={[styles.taskMetaText, { color: t.textHint }]}>
                          {task.taskType} · {task.points}pts
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => removeTask(task.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close-circle" size={20} color={t.textHint} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {showTaskForm ? (
                <View style={[styles.taskForm, { backgroundColor: t.surface, borderColor: t.border }]}>
                  <TextInput
                    style={[styles.input, { color: t.text, borderColor: t.border }]}
                    placeholder="Task title *"
                    placeholderTextColor={t.textHint}
                    value={taskTitle}
                    onChangeText={setTaskTitle}
                    autoFocus
                  />
                  <TextInput
                    style={[styles.input, { color: t.text, borderColor: t.border }]}
                    placeholder="Description (optional)"
                    placeholderTextColor={t.textHint}
                    value={taskDesc}
                    onChangeText={setTaskDesc}
                  />

                  {/* Task type */}
                  <View style={styles.taskTypeRow}>
                    {(['daily', 'weekly', 'custom'] as TaskType[]).map(tt => (
                      <TouchableOpacity
                        key={tt}
                        onPress={() => { setTaskType(tt); haptics.selection(); }}
                        style={[
                          styles.taskTypeChip,
                          {
                            backgroundColor: taskType === tt
                              ? (isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)')
                              : t.inputBg,
                            borderColor: taskType === tt ? '#6366f1' : 'transparent',
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: taskType === tt ? '#6366f1' : t.textSub, textTransform: 'capitalize' }}>
                          {tt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Custom days */}
                  {taskType === 'custom' && (
                    <View style={styles.daysRow}>
                      {DAYS.map((label, i) => (
                        <TouchableOpacity
                          key={i}
                          onPress={() => toggleDay(i)}
                          style={[
                            styles.dayChip,
                            {
                              backgroundColor: taskDays.includes(i) ? '#6366f1' : t.inputBg,
                              borderColor: taskDays.includes(i) ? '#6366f1' : t.border,
                            },
                          ]}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: taskDays.includes(i) ? '#fff' : t.textSub }}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Points */}
                  <View style={styles.pointsRow}>
                    <Text style={[{ fontSize: 13, fontWeight: '500', color: t.textSub }]}>Points (1-10)</Text>
                    <TextInput
                      style={[styles.miniInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
                      value={taskPoints}
                      onChangeText={setTaskPoints}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>

                  {/* Actions */}
                  <View style={styles.taskFormActions}>
                    <TouchableOpacity
                      onPress={resetTaskForm}
                      style={[styles.taskFormCancel, { borderColor: t.border }]}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: t.textSub }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={addTask}
                      disabled={!taskTitle.trim()}
                      style={{ flex: 1, borderRadius: 10, overflow: 'hidden', opacity: !taskTitle.trim() ? 0.5 : 1 }}
                    >
                      <LinearGradient
                        colors={['#6366f1', '#8b5cf6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.taskFormAdd}
                      >
                        <Ionicons name="add" size={16} color="#fff" />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Add Task</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => { setShowTaskForm(true); haptics.tap(); }}
                  style={[styles.addTaskBtn, { borderColor: t.border }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={18} color={t.primary} />
                  <Text style={{ fontSize: 14, fontWeight: '500', color: t.primary }}>Add a task</Text>
                </TouchableOpacity>
              )}
            </Section>

            {/* ── Create Button ── */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleCreate}
              disabled={creating || !name.trim()}
              style={{ borderRadius: 16, overflow: 'hidden', marginTop: 8, opacity: creating || !name.trim() ? 0.5 : 1 }}
            >
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.createBtn}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="rocket-outline" size={18} color="#fff" />
                    <Text style={styles.createBtnText}>Create Room</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  placeholder: { width: 36 },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  // ── Sections ──
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, paddingLeft: 4,
  },
  // ── Input group ──
  inputGroup: {
    borderRadius: 16, borderWidth: 1, overflow: 'hidden',
  },
  input: {
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontWeight: '500',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputLast: { borderBottomWidth: 0 },
  // ── Switch rows ──
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  switchRowLast: { borderBottomWidth: 0 },
  switchLabel: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  switchText: { fontSize: 14, fontWeight: '500' },
  switchHint: { fontSize: 11, marginTop: 1 },
  miniInput: {
    width: 48, textAlign: 'center', fontSize: 15, fontWeight: '600',
    borderRadius: 8, borderWidth: 1, paddingVertical: 6,
  },
  // ── Duration ──
  durationRow: { flexDirection: 'row', gap: 8 },
  durationChip: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
  },
  durationChipText: { fontSize: 13, fontWeight: '600' },
  // ── Retention ──
  retentionPicker: { flexDirection: 'row', gap: 6 },
  retentionChip: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  // ── Tasks ──
  taskCard: {
    borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8,
  },
  taskCardContent: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  taskDot: { width: 8, height: 8, borderRadius: 4 },
  taskCardTitle: { fontSize: 14, fontWeight: '600' },
  taskMeta: { flexDirection: 'row', gap: 6, marginTop: 2 },
  taskMetaText: { fontSize: 11 },
  taskForm: {
    borderRadius: 16, borderWidth: 1, padding: 16, gap: 12,
  },
  taskTypeRow: { flexDirection: 'row', gap: 6 },
  taskTypeChip: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: 8, borderWidth: 1,
  },
  daysRow: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dayChip: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  pointsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  taskFormActions: { flexDirection: 'row', gap: 8 },
  taskFormCancel: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  taskFormAdd: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
  },
  addTaskBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderStyle: 'dashed',
  },
  // ── Create ──
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
});
