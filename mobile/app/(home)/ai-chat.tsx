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
import { useTacticalCommander, getMessageText } from '../../hooks/ai/useTacticalCommander';
import { UIMessage } from '@ai-sdk/react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = '@krios:chatHistory_v2'; // New key for Groq history

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
  'Show my personal tasks',
  'Add a task: Workout at 6pm',
  'Give me a status report',
  'How do I earn ghost points?',
];

export default function AIChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { user } = useAuth();

  const flatListRef = useRef<FlatList>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Load history on mount
  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then(raw => {
      if (raw) setInitialMessages(JSON.parse(raw));
      setHistoryLoaded(true);
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

  const {
    commanderMessages,
    commanderInput,
    updateCommanderInput,
    sendCommanderCommand,
    isCommanderLoading,
    commanderError,
    deployQuery,
  } = useTacticalCommander(undefined, user?.id, initialMessages);

  // Save history whenever messages change
  useEffect(() => {
    if (commanderMessages.length > 0) {
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(commanderMessages));
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [commanderMessages]);

  const handleClearChat = useCallback(async () => {
    await AsyncStorage.removeItem(HISTORY_KEY);
    router.replace('/(home)/ai-chat');
  }, [router]);

  const renderMessage = useCallback(({ item }: { item: UIMessage }) => {
    const isUser = item.role === 'user';
    const timestamp = (item as any).createdAt || new Date();
    const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // In v3 AI SDK, tool invocations might be on the message object directly
    const toolInvocations = (item as any).toolInvocations as any[] | undefined;

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
            <Text style={{ 
              fontSize: 14, 
              color: t.text, 
              lineHeight: 21,
              fontFamily: !isUser ? (Platform.OS === 'ios' ? 'Menlo' : 'monospace') : undefined 
            }}>
              {getMessageText(item)}
            </Text>
          </View>

          {/* Tool execution badge */}
          {item.parts?.filter(p => p.type === 'tool-invocation').map((part: any, idx: number) => (
            <View key={`tool-${idx}`} style={styles.toolBadge}>
              <Ionicons name="construct-outline" size={10} color="#22d3ee" />
              <Text style={styles.toolText}>EXECUTING: {part.toolName?.toUpperCase() || 'TOOL'}</Text>
            </View>
          ))}

          <Text style={[styles.timeLabel, { color: t.textSub, textAlign: isUser ? 'right' : 'left' }]}>{time}</Text>
        </View>
      </View>
    );
  }, [t]);

  if (!historyLoaded) return null;

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
          <Text style={[styles.headerTitle, { color: t.text }]}>Krios Assistant</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isCommanderLoading ? '#22d3ee' : '#22c55e' }} />
            <Text style={[styles.headerSub, { color: t.textSub }]}>
              {isCommanderLoading ? 'Thinking...' : 'Groq L4 Powered'}
            </Text>
          </View>
        </View>

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
        data={commanderMessages}
        keyExtractor={(m, i) => (m as any).id || i.toString()}
        renderItem={renderMessage}
        contentContainerStyle={[styles.list, { paddingBottom: 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={isCommanderLoading ? (
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
      {commanderMessages.length <= 1 && (
        <FlatList
          data={QUICK_REPLIES}
          keyExtractor={r => r}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: `rgba(${t.surfRgb},0.8)`, borderColor: t.border }]}
              onPress={() => deployQuery(item)}
            >
              <Text style={{ fontSize: 12, color: t.textSub, fontWeight: '500' }}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Input bar ── */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
      >
        <View style={[styles.inputBar, {
          backgroundColor: t.isDark ? 'rgba(10,10,22,0.98)' : 'rgba(252,252,255,0.98)',
          borderTopColor: t.border,
          paddingBottom: insets.bottom + 12,
        }]}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <TextInput
              style={[styles.input, {
                backgroundColor: `rgba(${t.surfRgb},0.6)`,
                borderColor: t.border,
                color: t.text,
                flex: 1,
              }]}
              value={commanderInput}
              onChangeText={updateCommanderInput}
              placeholder="Message Krios..."
              placeholderTextColor={t.textSub}
              autoCapitalize="none"
              multiline
              maxLength={600}
            />
            <TouchableOpacity
              onPress={() => sendCommanderCommand()}
              disabled={isCommanderLoading || !commanderInput.trim()}
              style={[styles.sendBtn, { backgroundColor: commanderInput.trim() && !isCommanderLoading ? t.primary : t.border }]}
            >
              {isCommanderLoading
                ? <ActivityIndicator size={14} color={t.textSub} />
                : <Ionicons name="send" size={15} color={commanderInput.trim() ? '#fff' : t.textSub} />
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {commanderError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>COMM_LINK_FAILURE: {commanderError.message}</Text>
        </View>
      )}
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
  timeLabel:     { fontSize: 10, marginTop: 4, paddingHorizontal: 4 },
  quickRow:      { paddingHorizontal: 16, paddingVertical: 8, gap: 8, height: 50 },
  chip:          { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 7, height: 34 },
  inputBar:      { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12 },
  input:         { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn:       { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  toolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,211,238,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  toolText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 9,
    fontWeight: '800',
    color: '#22d3ee',
  },
  errorBanner: {
    backgroundColor: '#ef4444',
    padding: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
