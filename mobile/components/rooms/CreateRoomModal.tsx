import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, Modal, ScrollView, TextInput, 
  TouchableOpacity, Switch, ActivityIndicator, StatusBar 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import api from '../../services/api';

interface CreateRoomModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (room: any) => void;
  isDark: boolean;
}

const primary = '#6366f1';
const accent = '#8b5cf6';
const cyan = '#06b6d4';
const gold = '#fbbf24';

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ visible, onClose, onSuccess, isDark }) => {
  const insets = useSafeAreaInsets();
  
  // Colors
  const bg = isDark ? '#080810' : '#f8f9ff';
  const text = isDark ? '#ffffff' : '#0f172a';
  const textSub = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';
  const textTert = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.28)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  const surf = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';

  // Form State
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [maxMembers, setMaxMembers] = useState('20');
  const [duration, setDuration] = useState<'1_week' | '2_weeks' | '1_month'>('1_month');
  const [retention, setRetention] = useState(3);
  const [requireApproval, setRequireApproval] = useState(false);
  
  // Tasks state
  const [roomTasks, setRoomTasks] = useState<any[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [taskDays, setTaskDays] = useState<number[]>([]);
  const [taskPoints, setTaskPoints] = useState('5');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PRESETS = [
    { title: 'Morning Standup', type: 'daily', points: 5, icon: 'sunny-outline', color: '#fbbf24' },
    { title: 'Log Workout', type: 'daily', points: 10, icon: 'barbell-outline', color: '#06b6d4' },
    { title: 'Deep Work (2h)', type: 'daily', points: 15, icon: 'headset-outline', color: '#8b5cf6' },
    { title: 'Weekly Sync', type: 'weekly', points: 10, icon: 'people-outline', color: '#6366f1' },
  ] as const;

  const handleAddPreset = (preset: typeof PRESETS[number]) => {
    const newTask = {
      id: Math.random().toString(),
      title: preset.title,
      type: preset.type,
      daysOfWeek: [],
      points: preset.points,
    };
    setRoomTasks([newTask, ...roomTasks]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleAddTask = () => {
    if (!taskTitle.trim()) return;
    const newTask = {
      id: Math.random().toString(),
      title: taskTitle.trim(),
      type: taskType,
      daysOfWeek: taskType === 'custom' ? taskDays : [],
      points: parseInt(taskPoints) || 5,
    };
    setRoomTasks([newTask, ...roomTasks]);
    setTaskTitle('');
    setShowAddTask(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeTask = (id: string) => {
    setRoomTasks(roomTasks.filter(t => t.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleDay = (day: number) => {
    if (taskDays.includes(day)) {
      setTaskDays(taskDays.filter(d => d !== day));
    } else {
      setTaskDays([...taskDays, day].sort());
    }
  };

  const handleDeploy = async () => {
    if (!name.trim()) {
      setError('Mission Title is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const response = await api.post('/rooms', {
        name: name.trim(),
        description: description.trim() || undefined,
        isPublic,
        requireApproval,
        maxMembers: parseInt(maxMembers) || 20,
        duration,
        chatRetentionDays: retention,
        tasks: roomTasks.map(t => ({
          title: t.title,
          description: t.description,
          taskType: t.type,
          daysOfWeek: t.daysOfWeek,
          points: t.points,
        })),
      });

      onSuccess(response.data.room);
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to deploy mission');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setModalStep(1);
    setName('');
    setDescription('');
    setIsPublic(false);
    setRequireApproval(false);
    setMaxMembers('20');
    setRoomTasks([]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[s.modalContainer, { backgroundColor: bg }]}>
        <StatusBar barStyle="light-content" />

        {/* Tactical Header */}
        <LinearGradient colors={[primary, '#4f46e5']} style={s.modalTacticalHeader}>
          <View style={s.modalHeaderContent}>
            <TouchableOpacity
              onPress={() => modalStep === 2 ? setModalStep(1) : onClose()}
              style={s.modalTacticalClose}
            >
              <Ionicons name={modalStep === 2 ? "chevron-back" : "close"} size={24} color="#FFF" />
            </TouchableOpacity>
            
            <View style={{ alignItems: 'center' }}>
              <Text style={s.modalTacticalTitle}>{modalStep === 1 ? 'NEW MISSION' : 'ADD OBJECTIVES'}</Text>
              <Text style={s.modalTacticalSubtitle}>{modalStep === 1 ? 'Step 1: Deployment Briefing' : 'Step 2: Operational Tasks'}</Text>
            </View>

            {modalStep === 1 ? (
              <TouchableOpacity
                onPress={() => name.trim() && setModalStep(2)}
                style={[s.modalTacticalCreate, { opacity: !name.trim() ? 0.6 : 1 }]}
              >
                <Text style={s.modalTacticalCreateText}>NEXT</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleDeploy} disabled={loading} style={s.modalTacticalCreate}>
                {loading ? <ActivityIndicator size="small" color={primary} /> : <Text style={s.modalTacticalCreateText}>DEPLOY</Text>}
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {error && (
          <View style={s.errorBadge}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {modalStep === 1 ? (
          <ScrollView style={s.modalContent} contentContainerStyle={s.modalContentContainer} showsVerticalScrollIndicator={false}>
            {/* Step 1 Content */}
            <View style={[s.formSection, { backgroundColor: surf }]}>
              <View style={s.sectionHeader}>
                <Ionicons name="flag" size={16} color={primary} />
                <Text style={[s.sectionTitle, { color: textSub }]}>IDENTIFICATION</Text>
              </View>
              
              <View style={s.formGroup}>
                <Text style={[s.formLabel, { color: textTert }]}>OPERATION NAME</Text>
                <TextInput
                  style={[s.formInput, { backgroundColor: inputBg, borderColor: border, color: text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Operation: Zero Gravity"
                  placeholderTextColor={textTert}
                />
              </View>

              <View style={s.formGroup}>
                <Text style={[s.formLabel, { color: textTert }]}>MISSION SUMMARY</Text>
                <TextInput
                  style={[s.formInput, s.formTextArea, { backgroundColor: inputBg, borderColor: border, color: text }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="High-level operational goals..."
                  placeholderTextColor={textTert}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>

            <View style={[s.formSection, { backgroundColor: surf }]}>
              <View style={s.sectionHeader}>
                <Ionicons name="shield" size={16} color={accent} />
                <Text style={[s.sectionTitle, { color: textSub }]}>VISIBILITY PROTOCOL</Text>
              </View>

              <View style={s.visibilityToggleRow}>
                <TouchableOpacity onPress={() => setIsPublic(true)} style={[s.visBtn, isPublic && { backgroundColor: `${primary}20`, borderColor: primary }]}>
                  <Ionicons name="globe" size={24} color={isPublic ? primary : textTert} />
                  <Text style={[s.visLabel, { color: isPublic ? text : textSub }]}>PUBLIC</Text>
                  <Text style={s.visDesc}>Visible to everyone</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setIsPublic(false)} style={[s.visBtn, !isPublic && { backgroundColor: `${accent}20`, borderColor: accent }]}>
                  <Ionicons name="lock-closed" size={24} color={!isPublic ? accent : textTert} />
                  <Text style={[s.visLabel, { color: !isPublic ? text : textSub }]}>PRIVATE</Text>
                  <Text style={s.visDesc}>Invite only access</Text>
                </TouchableOpacity>
              </View>

              <View style={[s.formToggleRow, { marginTop: 16 }]}>
                <View>
                  <Text style={[s.formLabel, { color: textTert, marginBottom: 2 }]}>ADMIN APPROVAL</Text>
                  <Text style={{ fontSize: 11, color: textTert }}>Review join requests</Text>
                </View>
                <Switch value={requireApproval} onValueChange={setRequireApproval} trackColor={{ false: '#333', true: primary }} />
              </View>
            </View>

            <View style={[s.formSection, { backgroundColor: surf }]}>
              <View style={s.sectionHeader}>
                <Ionicons name="settings" size={16} color={gold} />
                <Text style={[s.sectionTitle, { color: textSub }]}>LOGISTICS</Text>
              </View>
              
              <View style={s.formGroup}>
                <Text style={[s.formLabel, { color: textTert }]}>DEPLOYMENT DURATION</Text>
                <View style={s.durationRow}>
                  {(['1_week', '2_weeks', '1_month'] as const).map((d) => (
                    <TouchableOpacity key={d} onPress={() => setDuration(d)} style={[s.durationChip, { backgroundColor: duration === d ? primary : inputBg }]}>
                      <Text style={[s.durationChipText, { color: duration === d ? '#fff' : textSub }]}>{d.replace('_', ' ').toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[s.formGroup, { flex: 1 }]}>
                  <Text style={[s.formLabel, { color: textTert }]}>MAX UNIT SIZE</Text>
                  <TextInput style={[s.formInput, { backgroundColor: inputBg, borderColor: border, color: text }]} value={maxMembers} onChangeText={setMaxMembers} keyboardType="numeric" />
                </View>
                <View style={[s.formGroup, { flex: 1 }]}>
                  <Text style={[s.formLabel, { color: textTert }]}>RETENTION (DAYS)</Text>
                  <View style={s.retentionControl}>
                    <TouchableOpacity onPress={() => setRetention(Math.max(1, retention - 1))} style={s.retentionBtn}><Ionicons name="remove" size={18} color={text} /></TouchableOpacity>
                    <Text style={[s.retentionValue, { color: text }]}>{retention}</Text>
                    <TouchableOpacity onPress={() => setRetention(Math.min(5, retention + 1))} style={s.retentionBtn}><Ionicons name="add" size={18} color={text} /></TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
            <View style={{ height: 60 }} />
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            <ScrollView style={s.modalContent} contentContainerStyle={s.modalContentContainer}>
              
              {/* Quick Presets */}
              <View style={{ marginBottom: 24 }}>
                <Text style={[s.sectionTitle, { color: textSub, marginBottom: 12 }]}>QUICK PRESETS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {PRESETS.map((p, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={[s.presetCard, { backgroundColor: surf, borderColor: border }]}
                      onPress={() => handleAddPreset(p)}
                    >
                      <View style={[s.presetIconWrap, { backgroundColor: `${p.color}20` }]}>
                        <Ionicons name={p.icon as any} size={16} color={p.color} />
                      </View>
                      <Text style={[s.presetTitle, { color: text }]}>{p.title}</Text>
                      <Text style={[s.presetSub, { color: textTert }]}>+{p.points} PTS</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={s.taskListContainer}>
                {roomTasks.length === 0 ? (
                  <View style={s.emptyTasksBox}>
                    <Ionicons name="list" size={40} color={textTert} />
                    <Text style={[s.emptyTasksText, { color: textSub }]}>No mission objectives defined yet.</Text>
                  </View>
                ) : (
                  roomTasks.map((t) => (
                    <View key={t.id} style={[s.taskItem, { backgroundColor: surf, borderColor: border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.taskItemTitle, { color: text }]}>{t.title}</Text>
                        <Text style={[s.taskItemSub, { color: primary }]}>{t.type.toUpperCase()}  <Text style={{color: textTert}}>•  {t.points} PTS</Text></Text>
                      </View>
                      <TouchableOpacity onPress={() => removeTask(t.id)} style={s.taskDeleteBtn}>
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>

              {showAddTask ? (
                <Animated.View entering={FadeInDown} style={[s.addTaskForm, { backgroundColor: surf, borderColor: primary }]}>
                  <Text style={[s.formLabel, { color: primary }]}>NEW TASK</Text>
                  
                  <Text style={[s.formLabel, { color: textTert, marginTop: 8 }]}>TITLE</Text>
                  <TextInput style={[s.formInput, { backgroundColor: inputBg, color: text, marginBottom: 12 }]} value={taskTitle} onChangeText={setTaskTitle} placeholder="Daily Morning Run" placeholderTextColor={textTert} autoFocus />
                  
                  <Text style={[s.formLabel, { color: textTert }]}>FREQUENCY</Text>
                  <View style={s.durationRow}>
                    {(['daily', 'weekly', 'custom'] as const).map((f) => (
                      <TouchableOpacity key={f} onPress={() => setTaskType(f)} style={[s.durationChip, { backgroundColor: taskType === f ? primary : inputBg }]}>
                        <Text style={[s.durationChipText, { color: taskType === f ? '#fff' : textSub }]}>{f.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {taskType === 'custom' && (
                    <View style={s.daysRow}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                        <TouchableOpacity key={i} onPress={() => toggleDay(i)} style={[s.dayBtn, taskDays.includes(i) && { backgroundColor: cyan, borderColor: cyan }]}><Text style={[s.dayBtnText, taskDays.includes(i) && { color: '#fff' }]}>{day}</Text></TouchableOpacity>
                      ))}
                    </View>
                  )}
                  
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 16 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.formLabel, { color: textTert }]}>POINTS</Text>
                      <TextInput style={[s.formInput, { backgroundColor: inputBg, color: text }]} value={taskPoints} onChangeText={setTaskPoints} keyboardType="numeric" />
                    </View>
                    <TouchableOpacity onPress={handleAddTask} style={s.confirmTaskBtn}><Text style={s.confirmTaskBtnText}>ADD TASK</Text></TouchableOpacity>
                  </View>
                </Animated.View>
              ) : (
                <TouchableOpacity onPress={() => setShowAddTask(true)} style={s.addTaskBtn}>
                  <Ionicons name="add-circle" size={24} color={primary} />
                  <Text style={[s.addTaskBtnText, { color: primary }]}>CREATE CUSTOM TASK</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            
            <TouchableOpacity onPress={handleDeploy} style={[s.deployBottomBtn, { marginBottom: insets.bottom + 20 }]}>
              <LinearGradient colors={[primary, accent]} style={s.deployBottomGradient}><Text style={s.deployBottomText}>DEPLOY MISSION NOW</Text></LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  modalContainer: { flex: 1 },
  modalTacticalHeader: { paddingTop: 20, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  modalHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  modalTacticalClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTacticalTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  modalTacticalSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' },
  modalTacticalCreate: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  modalTacticalCreateText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  errorBadge: { backgroundColor: 'rgba(239,68,68,0.2)', padding: 12, marginHorizontal: 20, marginTop: 20, borderRadius: 12 },
  errorText: { color: '#ef4444', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  modalContent: { flex: 1 },
  modalContentContainer: { padding: 20 },
  formSection: { padding: 16, borderRadius: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 10, fontWeight: '800', marginBottom: 8, letterSpacing: 0.5 },
  formInput: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, fontSize: 15 },
  formTextArea: { height: 100, textAlignVertical: 'top' },
  visibilityToggleRow: { flexDirection: 'row', gap: 12 },
  visBtn: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center' },
  visLabel: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  visDesc: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, textAlign: 'center' },
  formToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  durationRow: { flexDirection: 'row', gap: 8 },
  durationChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  durationChipText: { fontSize: 10, fontWeight: '800' },
  retentionControl: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  retentionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  retentionValue: { fontSize: 16, fontWeight: '900' },
  taskListContainer: { marginBottom: 20 },
  emptyTasksBox: { alignItems: 'center', padding: 40 },
  emptyTasksText: { fontSize: 14, fontWeight: '700', marginTop: 12 },
  taskItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  taskItemTitle: { fontSize: 15, fontWeight: '800' },
  taskItemSub: { fontSize: 11, fontWeight: '700', marginTop: 4, letterSpacing: 0.5 },
  taskDeleteBtn: { padding: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10 },
  addTaskBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, borderColor: primary },
  addTaskBtnText: { fontSize: 14, fontWeight: '800' },
  addTaskForm: { padding: 16, borderRadius: 16, borderWidth: 1.5, marginBottom: 16 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  dayBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  dayBtnText: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.4)' },
  confirmTaskBtn: { backgroundColor: primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, justifyContent: 'center' },
  confirmTaskBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  deployBottomBtn: { marginHorizontal: 20, marginTop: 10 },
  deployBottomGradient: { paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
  deployBottomText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  presetCard: { padding: 14, borderRadius: 16, borderWidth: 1, width: 140 },
  presetIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  presetTitle: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  presetSub: { fontSize: 11, fontWeight: '700' },
});
