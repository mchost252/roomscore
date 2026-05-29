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
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

function useT() {
  const { isDark, colors, gradients } = useTheme();
  const primaryRgb = hexToRgb(colors.primary);
  return {
    isDark,
    bg:      colors.background.primary,
    text:    colors.text,
    textSub: colors.textSecondary,
    primary: colors.primary,
    primaryRgb,
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
    deployQuery,
    isCommanderWaiting,
    isCommanderLoading,
    commanderError,
    reloadCommander,
    stopCommander,
  } = useTacticalCommander(undefined, user?.id, initialMessages);

  // Save history whenever messages change
  useEffect(() => {
    if (commanderMessages.length > 0) {
      try {
        // Keep only the last 30 messages in storage to ensure performance and prevent crashes
        const recentMessages = commanderMessages.slice(-30);
        AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(recentMessages));
      } catch (e) {
        console.warn('Failed to save chat history:', e);
      }
      // Optimized scroll
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
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

    const messageText = getMessageText(item).trim();
    const toolInvocations = item.parts?.filter(p => p.type === 'tool-invocation') || [];

    // Hide message completely if it's completely empty (no text and no tools)
    if (!messageText && toolInvocations.length === 0) return null;

    return (
      <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
        {!isUser && (
          <View style={[styles.avatarSmall, { backgroundColor: t.primary }]}>
            <Image source={require('../../assets/krios-logo.png')} style={{ width: 14, height: 14 }} resizeMode="contain" />
          </View>
        )}
        <View style={{ flex: 1, maxWidth: '85%' }}>
          {messageText ? (
            <View style={[
              styles.bubble,
              isUser
                ? { backgroundColor: t.primary, borderColor: t.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 }
                : { backgroundColor: t.isDark ? '#2A2A35' : '#F0F0F5', borderColor: 'transparent', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
            ]}>
              <Text style={{ 
                fontSize: 15, 
                color: isUser ? '#FFFFFF' : t.text, 
                lineHeight: 22,
                fontWeight: '400',
              }}>
                {messageText}
              </Text>
            </View>
          ) : null}

          {/* Tool execution badge */}
          {toolInvocations.map((part: any, idx: number) => {
            const friendlyName = part.toolName === 'create_task' ? 'Creating task...' : 
                                 part.toolName === 'update_task' ? 'Updating task...' :
                                 part.toolName === 'delete_task' ? 'Deleting task...' :
                                 'Gathering context...';
            return (
              <View key={`tool-${idx}`} style={[styles.toolBadge, { backgroundColor: `rgba(${t.primaryRgb}, 0.1)` }]}>
                <Ionicons name="sparkles-outline" size={12} color={t.primary} />
                <Text style={[styles.toolText, { color: t.primary, fontFamily: undefined, fontWeight: '600' }]}>{friendlyName}</Text>
              </View>
            );
          })}

          <Text style={[styles.timeLabel, { color: t.textSub, textAlign: isUser ? 'right' : 'left' }]}>{time}</Text>
        </View>
      </View>
    );
  }, [t]);

  if (!historyLoaded) return null;

  return (
    <KeyboardAvoidingView 
      style={[styles.root, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
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
          <Text style={[styles.headerTitle, { color: t.text }]}>Krios</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isCommanderLoading ? t.primary : '#22c55e' }} />
            <Text style={[styles.headerSub, { color: t.textSub }]}>
              {isCommanderLoading ? 'Thinking...' : 'Online'}
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
        style={{ flex: 1 }}
        contentContainerStyle={[styles.list, { paddingBottom: 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={isCommanderWaiting ? (
          <View style={[styles.row, styles.rowLeft]}>
            <View style={[styles.avatarSmall, { backgroundColor: t.primary }]}>
              <Image source={require('../../assets/krios-logo.png')} style={{ width: 14, height: 14 }} resizeMode="contain" />
            </View>
            <View style={[styles.bubble, { backgroundColor: t.isDark ? '#2A2A35' : '#F0F0F5', borderColor: 'transparent', borderBottomLeftRadius: 4 }]}>
              <TypingDots color={t.textSub} />
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
      <View style={[styles.inputBar, {
        backgroundColor: t.isDark ? 'rgba(10,10,22,0.98)' : 'rgba(252,252,255,0.98)',
        borderTopColor: t.border,
        paddingBottom: keyboardHeight > 0 ? 12 : Math.max(insets.bottom, 12),
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

      {commanderError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.errorText}>Oops! Something went wrong.</Text>
        </View>
      )}
    </KeyboardAvoidingView>
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
  bubble:        { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 0, flexShrink: 1, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  toolText: {
    fontSize: 12,
  },
  errorBanner: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  errorText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
