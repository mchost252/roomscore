import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, KeyboardAvoidingView, Animated,
  Keyboard, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import threadService, { ThreadMessage } from '../../services/threadService';
import { fetchAINote, AINote, AIMilestone } from '../../services/aiNoteService';
import AITaskNote from '../../components/AITaskNote';
import { secureStorage } from '../../services/storage';
import { TOKEN_KEY } from '../../constants/config';

// ── Local theme helper ──────────────────────────────────────────────────────
function useT() {
  const { isDark, colors, gradients } = useTheme();
  return {
    isDark,
    bg:      colors.background.primary,
    text:    colors.text,
    textSub: colors.textSecondary,
    primary: colors.primary,
    success: colors.status.success,
    border:  colors.border.primary,
    surf:    colors.surface,
    surfRgb: isDark ? '26,26,46' : '255,255,255',
    grad:    gradients.background.colors as readonly [string, string, ...string[]],
  };
}

interface ThreadEntry {
  id: string;
  type: 'note' | 'reminder' | 'snooze' | 'complete';
  text: string;
  timestamp: Date;
}

export default function TaskThreadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  const [token, setToken] = useState<string | null>(null);

  // Load token once on mount
  useEffect(() => {
    secureStorage.getItem(TOKEN_KEY).then(setToken);
  }, []);

  const params = useLocalSearchParams<{
    taskId: string;
    taskTitle: string;
    taskPriority: string;
    taskBucket: string;
    taskCompleted: string;
    taskType: string;
    // Pass clarifications as JSON string if coming from clarification sheet
    clarifications: string;
  }>();

  const taskId = params.taskId as string;

  const [noteInput, setNoteInput] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [completed, setCompleted] = useState(params.taskCompleted === 'true');
  const [thread, setThread] = useState<ThreadEntry[]>([]);

  // AI note state
  const [aiNote, setAiNote] = useState<AINote | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  // ── Load thread messages ──────────────────────────────────────────────────
  useEffect(() => {
    const loadThread = async () => {
      if (!taskId) return;
      const threadMessages = await threadService.getThread(taskId as any);
      setMessages(threadMessages);
      
      // Map existing messages to thread entries for the UI
      const mappedEntries: ThreadEntry[] = threadMessages.map(msg => ({
        id: msg.id,
        type: (msg.metadata?.action as any) || 'note',
        text: msg.text,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
      }));
      setThread(mappedEntries);
    };
    loadThread();
  }, [taskId]);

  // ── Keyboard handling ─────────────────────────────────────────────────────
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [thread]);

  // ── Add note ──────────────────────────────────────────────────────────────
  const handleAddNote = useCallback(async () => {
    if (!noteInput.trim()) return;

    const newMessage = await threadService.addMessage(taskId as any, {
      taskId: taskId as any,
      text: noteInput.trim(),
      sender: 'user',
      metadata: { action: 'note' as any }
    });

    const entry: ThreadEntry = {
      id: newMessage.id,
      type: 'note',
      text: noteInput.trim(),
      timestamp: new Date(),
    };
    setThread(prev => [...prev, entry]);
    setMessages(prev => [...prev, newMessage]);
    setNoteInput('');
  }, [noteInput, taskId]);

  const handleQuickAction = useCallback(async (action: string) => {
    const type = action.startsWith('Remind') ? 'reminder' : action.startsWith('Sno') ? 'snooze' : 'note';
    
    const newMessage = await threadService.addMessage(taskId as any, {
      taskId: taskId as any,
      text: action,
      sender: 'user',
      metadata: { action: type as any }
    });

    const entry: ThreadEntry = {
      id: newMessage.id,
      type: type as any,
      text: action,
      timestamp: new Date(),
    };
    setThread(prev => [...prev, entry]);
    setMessages(prev => [...prev, newMessage]);
  }, [taskId]);

  const handleMilestonesChange = useCallback((milestones: AIMilestone[]) => {
    setAiNote(prev => prev ? { ...prev, milestones } : prev);
  }, []);

  const handleRefreshAI = useCallback(async () => {
    if (!token) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const note = await fetchAINote({
        taskId,
        taskTitle: params.taskTitle as string,
        taskType: params.taskType as string,
        priority: params.taskPriority as string,
        token,
        forceRefresh: true,
      });
      setAiNote(note);
    } catch {
      setAiError('Could not refresh AI note');
    } finally {
      setAiLoading(false);
    }
  }, [taskId, token]);

  const priorityColors: Record<string, string> = {
    urgent: '#ef4444', high: '#f97316', medium: '#6366f1', low: '#22c55e',
  };
  const priorityColor = priorityColors[params.taskPriority || 'medium'] || '#6366f1';

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      {/* Background gradients */}
      <LinearGradient colors={t.grad} locations={[0, 0.5, 1]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[`rgba(99,102,241,${t.isDark ? '0.12' : '0.05'})`, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: `rgba(${t.surfRgb},0.7)`, borderColor: t.border }]}>
          <Ionicons name="chevron-back" size={20} color={t.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>{params.taskTitle}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: priorityColor }} />
            <Text style={[styles.subtitle, { color: t.textSub }]}>
              {params.taskPriority || 'medium'} · {params.taskBucket || 'inbox'}
            </Text>
          </View>
        </View>
        {/* Refresh AI button */}
        <TouchableOpacity
          onPress={handleRefreshAI}
          style={[styles.iconBtn, { backgroundColor: `rgba(${t.surfRgb},0.7)`, borderColor: t.border, marginRight: 8 }]}
          disabled={aiLoading}
        >
          {aiLoading
            ? <ActivityIndicator size={14} color={t.primary} />
            : <Text style={{ fontSize: 14 }}>✦</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCompleted(v => !v)}
          style={[styles.doneBtn, { backgroundColor: completed ? t.success : t.primary }]}
        >
          <Ionicons name={completed ? 'checkmark-circle' : 'ellipse-outline'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Thread content ── */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.threadContent, { paddingBottom: keyboardHeight + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── AI Note (pinned at top) ── */}
        {aiLoading && !aiNote && (
          <AITaskNote
            note={{} as AINote}
            isLoading={true}
            fromCache={false}
            onMilestonesChange={handleMilestonesChange}
          />
        )}

        {aiNote && (
          <AITaskNote
            note={aiNote}
            fromCache={aiNote.fromCache}
            onMilestonesChange={handleMilestonesChange}
          />
        )}

        {!aiNote && !aiLoading && aiError && (
          <View style={[styles.aiErrorCard, { borderColor: t.border, backgroundColor: `rgba(${t.surfRgb},0.5)` }]}>
            <Text style={{ color: t.textSub, fontSize: 13 }}>✦ AI note unavailable — add your own notes below</Text>
          </View>
        )}

        {/* Divider between AI note and user notes */}
        {(aiNote || aiLoading) && thread.length > 0 && (
          <View style={[styles.divider, { borderColor: t.border }]}>
            <Text style={[styles.dividerText, { color: t.textSub }]}>Your notes</Text>
          </View>
        )}

        {/* ── User thread entries ── */}
        {thread.map((entry) => (
          <View key={entry.id} style={[styles.threadRow, styles.threadRight]}>
            <View style={[styles.threadBubble, {
              backgroundColor: 'rgba(99,102,241,0.15)',
              borderColor: '#6366f133',
            }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <Ionicons
                  name={
                    entry.type === 'note' ? 'pencil-outline'
                    : entry.type === 'reminder' ? 'alarm-outline'
                    : entry.type === 'complete' ? 'checkmark-circle-outline'
                    : 'information-circle-outline'
                  }
                  size={10} color={t.primary}
                />
                <Text style={{ fontSize: 9, color: t.primary, fontWeight: '600', textTransform: 'uppercase' }}>
                  {entry.type}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: t.text, lineHeight: 18 }}>{entry.text}</Text>
            </View>
            <Text style={{ fontSize: 10, color: t.textSub, marginTop: 3, alignSelf: 'flex-end' }}>
              {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))}

        {thread.length === 0 && !aiLoading && (
          <Text style={[styles.emptyHint, { color: t.textSub }]}>
            Add notes, reminders, or log your progress below ↓
          </Text>
        )}
      </ScrollView>

      {/* ── Input bar ── */}
      <View style={[styles.inputBar, {
        backgroundColor: t.isDark ? 'rgba(10,10,22,0.98)' : 'rgba(252,252,255,0.98)',
        borderTopColor: t.border,
        paddingBottom: insets.bottom + (keyboardHeight > 0 ? 8 : 32),
        marginBottom: keyboardHeight > 0 ? keyboardHeight : 0,
      }]}>
        {/* Quick chips */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {(['Remind me', 'Snooze 30m', 'Note'] as const).map(q => (
            <TouchableOpacity
              key={q}
              onPress={() => handleQuickAction(q)}
              style={[styles.chip, { backgroundColor: `rgba(${t.surfRgb},0.8)`, borderColor: t.border }]}
            >
              <Text style={{ fontSize: 11, color: t.textSub, fontWeight: '500' }}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Text input row */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <TextInput
            style={[styles.input, {
              backgroundColor: `rgba(${t.surfRgb},0.6)`,
              borderColor: t.border,
              color: t.text,
              flex: 1,
            }]}
            value={noteInput}
            onChangeText={setNoteInput}
            placeholder="Add a note..."
            placeholderTextColor={t.textSub}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handleAddNote}
            style={[styles.sendBtn, { backgroundColor: noteInput.trim() ? t.primary : t.border }]}
          >
            <Ionicons name="send" size={15} color={noteInput.trim() ? '#fff' : t.textSub} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  iconBtn:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  title:        { fontSize: 16, fontWeight: '700' },
  subtitle:     { fontSize: 12, fontWeight: '500' },
  doneBtn:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  threadContent:{ padding: 16, gap: 12 },
  threadRow:    { maxWidth: '85%' },
  threadRight:  { alignSelf: 'flex-end' },
  threadBubble: { borderRadius: 16, padding: 12, borderWidth: StyleSheet.hairlineWidth },
  inputBar:     { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12 },
  chip:         { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 6 },
  input:        { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn:      { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  divider:      { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: 8, alignItems: 'center', paddingTop: 8 },
  dividerText:  { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyHint:    { textAlign: 'center', fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  aiErrorCard:  { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8, alignItems: 'center' },
});
