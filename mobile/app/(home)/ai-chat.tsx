import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Platform, KeyboardAvoidingView, Image,
  Animated, Keyboard, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import taskService from '../../services/taskService';
import { secureStorage } from '../../services/storage';
import { TOKEN_KEY } from '../../constants/config';
import {
  ChatMessage, TaskSuggestion,
  loadHistory, saveHistory, clearHistory,
  makeMessage, sendChatMessage,
} from '../../services/aiChatService';
import TaskPreviewCard from '../../components/TaskPreviewCard';

// ── Theme helper ─────────────────────────────────────────────────────────────
function useT() {
  const { isDark, colors, gradients } = useTheme();
  return {
    isDark,
    bg:      colors.background.primary,
    text:    colors.text,
    textSub: colors.textSecondary,
    primary: colors.primary,
    border:  colors.border.primary,
    surf:    colors.surface,
    surfRgb: isDark ? '26,26,46' : '255,255,255',
    grad:    gradients.background.colors as readonly [string, string, ...string[]],
    success: colors.status.success,
  };
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots({ color }: { color: string }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 150),
        Animated.timing(d, { toValue: -5, duration: 250, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.delay(500),
      ]))
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 6 }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color, opacity: 0.75, transform: [{ translateY: d }] }} />
      ))}
    </View>
  );
}

// ── Quick replies ─────────────────────────────────────────────────────────────
const QUICK_REPLIES = [
  'What are my tasks?',
  'Add a task for me',
  'How am I doing?',
  'Motivate me',
  'Help me prioritize',
];

// ── Extended message type (includes task suggestion UI) ───────────────────────
interface UIMessage extends ChatMessage {
  taskSuggestion?: TaskSuggestion | null;
  taskConfirmed?: boolean;
}

export default function AIChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { user } = useAuth();

  const flatListRef = useRef<FlatList>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Load token + history on mount
  useEffect(() => {
    secureStorage.getItem(TOKEN_KEY).then(setToken);
    loadHistory().then(history => {
      if (history.length > 0) {
        setMessages(history as UIMessage[]);
      } else {
        const welcome = makeMessage('assistant',
          `Hey${user?.username ? ' ' + user.username : ''}! ✦ I'm Krios — your personal AI assistant.\n\nI know your tasks, your patterns, and I'm here to help. What's on your mind?`
        );
        setMessages([{ ...welcome }]);
      }
    });
  }, []);

  // Keyboard listeners
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, typing]);

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || typing) return;
    setInput('');

    const userMsg: UIMessage = makeMessage('user', msg);
    const updated = [...messages, userMsg];
    setMessages(updated);
    setTyping(true);

    // Save user message immediately
    await saveHistory(updated.map(m => ({ id: m.id, role: m.role, text: m.text, timestamp: m.timestamp })));

    try {
      const response = await sendChatMessage({
        message: msg,
        history: updated.map(m => ({ id: m.id, role: m.role, text: m.text, timestamp: m.timestamp })),
        token: token || '',
      });

      const aiMsg: UIMessage = {
        ...makeMessage('assistant', response.reply),
        taskSuggestion: response.taskSuggestion,
        taskConfirmed: false,
      };

      const withAI = [...updated, aiMsg];
      setMessages(withAI);
      await saveHistory(withAI.map(m => ({ id: m.id, role: m.role, text: m.text, timestamp: m.timestamp })));
    } catch {
      const errMsg: UIMessage = makeMessage('assistant', "Couldn't reach the server — check your connection.");
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setTyping(false);
    }
  }, [input, messages, token, typing]);

  // ── Confirm task from preview card ─────────────────────────────────────────
  const handleConfirmTask = useCallback(async (suggestion: TaskSuggestion, messageId: string) => {
    try {
      // Build due date with time
      let dueDate: string | undefined = suggestion.dueDate;
      if (suggestion.dueTime && dueDate) {
        const d = new Date(dueDate);
        const [h, m] = suggestion.dueTime.split(':').map(Number);
        d.setHours(h, m, 0, 0);
        dueDate = d.toISOString();
      } else if (suggestion.dueTime && !dueDate) {
        const d = new Date();
        const [h, m] = suggestion.dueTime.split(':').map(Number);
        d.setHours(h, m, 0, 0);
        dueDate = d.toISOString();
      }

      await taskService.createPersonalTask({
        title: suggestion.title,
        priority: suggestion.priority || 'medium',
        taskType: suggestion.taskType || 'one-time',
        bucket: suggestion.bucket || 'inbox',
        dueDate,
      });

      // Mark card as confirmed in UI
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, taskConfirmed: true } : m
      ));

      // AI confirms
      const confirmMsg: UIMessage = makeMessage('assistant',
        `Done ✦ "${suggestion.title}" is in your tasks. Head to your task thread for a full plan on it!`
      );
      setMessages(prev => [...prev, confirmMsg]);
      await saveHistory([...messages, confirmMsg].map(m => ({ id: m.id, role: m.role, text: m.text, timestamp: m.timestamp })));
    } catch {
      const errMsg = makeMessage('assistant', "Couldn't save the task right now — try again.");
      setMessages(prev => [...prev, errMsg]);
    }
  }, [messages]);

  const handleDismissTask = useCallback((messageId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, taskSuggestion: null } : m
    ));
  }, []);

  // ── Render message ──────────────────────────────────────────────────────────
  const renderMessage = useCallback(({ item }: { item: UIMessage }) => {
    const isUser = item.role === 'user';
    const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
        {!isUser && (
          <View style={[styles.avatarSmall, { backgroundColor: t.primary }]}>
            <Image source={require('../../assets/krios-logo.png')} style={{ width: 14, height: 14 }} resizeMode="contain" />
          </View>
        )}
        <View style={{ flex: 1, maxWidth: '85%' }}>
          <View style={[
            styles.bubble,
            isUser
              ? { backgroundColor: 'rgba(99,102,241,0.18)', borderColor: '#6366f133', alignSelf: 'flex-end' }
              : { backgroundColor: `rgba(${t.surfRgb},0.92)`, borderColor: t.border, alignSelf: 'flex-start' },
          ]}>
            <Text style={{ fontSize: 14, color: t.text, lineHeight: 21 }}>{item.text}</Text>
          </View>

          {/* Task preview card */}
          {!isUser && item.taskSuggestion && !item.taskConfirmed && (
            <TaskPreviewCard
              suggestion={item.taskSuggestion}
              onConfirm={s => handleConfirmTask(s, item.id)}
              onDismiss={() => handleDismissTask(item.id)}
            />
          )}

          {/* Confirmed task badge */}
          {!isUser && item.taskConfirmed && (
            <View style={[styles.confirmedBadge, { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.25)' }]}>
              <Ionicons name="checkmark-circle" size={13} color={t.success} />
              <Text style={{ fontSize: 12, color: t.success, fontWeight: '600' }}>Task added</Text>
            </View>
          )}

          <Text style={[styles.timeLabel, { color: t.textSub, textAlign: isUser ? 'right' : 'left' }]}>{time}</Text>
        </View>
      </View>
    );
  }, [t, handleConfirmTask, handleDismissTask]);

  const handleClearChat = useCallback(async () => {
    await clearHistory();
    const welcome = makeMessage('assistant', "Fresh start! ✦ What would you like to work on?");
    setMessages([{ ...welcome }]);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <LinearGradient colors={t.grad} locations={[0, 0.5, 1]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[`rgba(139,92,246,${t.isDark ? '0.15' : '0.06'})`, 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: `rgba(${t.surfRgb},0.7)`, borderColor: t.border }]}>
          <Ionicons name="chevron-back" size={20} color={t.text} />
        </TouchableOpacity>

        <View style={[styles.avatar, { backgroundColor: t.primary, marginLeft: 12 }]}>
          <Image source={require('../../assets/krios-logo.png')} style={{ width: 20, height: 20 }} resizeMode="contain" />
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.headerTitle, { color: t.text }]}>Krios AI</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
            <Text style={[styles.headerSub, { color: t.textSub }]}>Your personal assistant</Text>
          </View>
        </View>

        {/* Clear chat */}
        <TouchableOpacity
          onPress={handleClearChat}
          style={[styles.iconBtn, { backgroundColor: `rgba(${t.surfRgb},0.7)`, borderColor: t.border }]}
        >
          <Ionicons name="trash-outline" size={16} color={t.textSub} />
        </TouchableOpacity>
      </View>

      {/* ── Messages ── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.list, { paddingBottom: 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={typing ? (
          <View style={[styles.row, styles.rowLeft]}>
            <View style={[styles.avatarSmall, { backgroundColor: t.primary }]}>
              <Image source={require('../../assets/krios-logo.png')} style={{ width: 14, height: 14 }} resizeMode="contain" />
            </View>
            <View style={[styles.bubble, { backgroundColor: `rgba(${t.surfRgb},0.92)`, borderColor: t.border }]}>
              <TypingDots color={t.primary} />
            </View>
          </View>
        ) : null}
      />

      {/* ── Quick replies ── */}
      {messages.length <= 2 && (
        <FlatList
          data={QUICK_REPLIES}
          keyExtractor={r => r}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: `rgba(${t.surfRgb},0.8)`, borderColor: t.border }]}
              onPress={() => handleSend(item)}
            >
              <Text style={{ fontSize: 12, color: t.textSub, fontWeight: '500' }}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Input bar ── */}
      <View style={[styles.inputBar, {
        backgroundColor: t.isDark ? 'rgba(10,10,22,0.98)' : 'rgba(252,252,255,0.98)',
        borderTopColor: t.border,
        paddingBottom: insets.bottom + (keyboardHeight > 0 ? 8 : 20),
        marginBottom: keyboardHeight > 0 ? keyboardHeight : 0,
      }]}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <TextInput
            style={[styles.input, {
              backgroundColor: `rgba(${t.surfRgb},0.6)`,
              borderColor: t.border,
              color: t.text,
              flex: 1,
            }]}
            value={input}
            onChangeText={setInput}
            placeholder="Message Krios..."
            placeholderTextColor={t.textSub}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
            multiline
            maxLength={600}
          />
          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={typing || !input.trim()}
            style={[styles.sendBtn, { backgroundColor: input.trim() && !typing ? t.primary : t.border }]}
          >
            {typing
              ? <ActivityIndicator size={14} color={t.textSub} />
              : <Ionicons name="send" size={15} color={input.trim() ? '#fff' : t.textSub} />
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  avatar:        { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarSmall:   { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 2 },
  headerTitle:   { fontSize: 16, fontWeight: '700' },
  headerSub:     { fontSize: 12, fontWeight: '500' },
  list:          { padding: 16, gap: 12 },
  row:           { flexDirection: 'row', alignItems: 'flex-start' },
  rowLeft:       { alignSelf: 'flex-start', maxWidth: '88%' },
  rowRight:      { alignSelf: 'flex-end', maxWidth: '88%', flexDirection: 'row-reverse' },
  bubble:        { borderRadius: 18, padding: 12, borderWidth: StyleSheet.hairlineWidth, flexShrink: 1 },
  confirmedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4, alignSelf: 'flex-start' },
  timeLabel:     { fontSize: 10, marginTop: 4, paddingHorizontal: 4 },
  quickRow:      { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip:          { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 7 },
  inputBar:      { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12 },
  input:         { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn:       { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
