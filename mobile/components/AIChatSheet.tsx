import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.92;
const DISMISS_THRESHOLD = 120;

export interface Task {
  id: string;
  title: string;
  bucket?: string;
  priority?: string;
  dueDate?: string;
  completed?: boolean;
  isCompleted?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
  actions?: ChatAction[];
}

interface ChatAction {
  label: string;
  icon: string;
  onPress: () => void;
}

interface AIChatSheetProps {
  visible: boolean;
  onClose: () => void;
  tasks: Task[];
  userName: string;
  onAddTask?: (task: Partial<Task>) => void;
  onCompleteTask?: (taskId: string) => void;
}

const QUICK_REPLIES = [
  { label: 'What are my tasks today?', icon: 'list-outline' },
  { label: 'Add a task for me', icon: 'add-circle-outline' },
  { label: 'How am I doing?', icon: 'stats-chart-outline' },
  { label: 'Help me focus', icon: 'timer-outline' },
];

function getKriosResponse(
  userText: string,
  tasks: Task[],
  userName: string,
  onAddTask?: (task: Partial<Task>) => void,
): { text: string; actions?: ChatAction[] } {
  const lower = userText.toLowerCase();
  const pending = tasks.filter(t => !(t.isCompleted ?? t.completed));
  const done = tasks.filter(t => (t.isCompleted ?? t.completed));

  // Task inquiry
  if (lower.includes('task') && (lower.includes('today') || lower.includes('what') || lower.includes('my'))) {
    if (pending.length === 0) {
      return { text: `You're all clear, ${userName}! No pending tasks right now. Want me to help you plan something?` };
    }
    const taskList = pending.slice(0, 5).map((t, i) => `${i + 1}. ${t.title}`).join('\n');
    return {
      text: `You have ${pending.length} task${pending.length !== 1 ? 's' : ''} pending:\n\n${taskList}${pending.length > 5 ? `\n\n...and ${pending.length - 5} more.` : ''}\n\nWant me to help with any of these?`,
    };
  }

  // Stats / progress
  if (lower.includes('how') && (lower.includes('doing') || lower.includes('progress') || lower.includes('going'))) {
    const total = tasks.length;
    const pct = total > 0 ? Math.round((done.length / total) * 100) : 0;
    return {
      text: `You've completed ${done.length} of ${total} tasks — that's ${pct}% done! ${pct >= 70 ? 'Crushing it!' : pct >= 40 ? 'Good momentum, keep going!' : 'Every step counts, you got this!'}`,
    };
  }

  // Add task
  if (lower.includes('add') || lower.includes('create') || lower.includes('remind')) {
    // Try to extract task name after "add" or "create"
    const match = userText.match(/(?:add|create|remind me to|set)\s+(.+)/i);
    if (match && match[1] && onAddTask) {
      const title = match[1].trim();
      onAddTask({ title, bucket: 'today' });
      return { text: `Done! I've added "${title}" to your task list. Anything else?` };
    }
    return { text: `Sure! What would you like to add? Just tell me the task and I'll create it for you.` };
  }

  // Focus help
  if (lower.includes('focus') || lower.includes('concentrate') || lower.includes('timer')) {
    return {
      text: `Focus mode is your best friend! I recommend the Pomodoro technique — 25 minutes on, 5 minutes off. Head to the Focus tab on your home screen to start a session. Want me to suggest which task to tackle first?`,
    };
  }

  // Motivation
  if (lower.includes('motivat') || lower.includes('stuck') || lower.includes('help')) {
    const tips = [
      `One task at a time, ${userName}. Pick the smallest one and just start — momentum builds from there.`,
      `The hardest part is always starting. You've already done that by being here. What's one thing you can do in the next 10 minutes?`,
      `Progress, not perfection. Even ticking off one task today is a win. What feels most manageable right now?`,
    ];
    return { text: tips[Math.floor(Math.random() * tips.length)] };
  }

  // Greeting
  if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
    return { text: `Hey ${userName}! I'm Krios, your personal orbit companion. I can help you manage tasks, track your progress, or just talk things through. What's on your mind?` };
  }

  // Default
  return {
    text: `I hear you, ${userName}. I'm still learning to be more helpful — but I'm here! You can ask me about your tasks, check your progress, or ask me to add something new. What would you like?`,
  };
}

export default function AIChatSheet({ visible, onClose, tasks, userName, onAddTask, onCompleteTask }: AIChatSheetProps) {
  const { colors, gradients, isDark } = useTheme();
  // Shim for existing theme.* usage inside this component
  const theme = {
    background: colors.background.primary,
    surface: colors.surface,
    border: colors.border.primary,
    text: colors.text,
    textSecondary: colors.textSecondary,
    textTertiary: colors.textTertiary,
    primary: colors.primary,
    success: colors.status.success,
    warning: colors.status.warning,
    error: colors.status.error,
    gradient: gradients.background.colors,
  };
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'ai',
      text: `Hey ${userName || 'there'}! I'm Krios, your personal orbit companion. Ask me anything — tasks, focus, progress, or just talk.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const dragStartY = useRef(0);
  const inputRef = useRef<TextInput>(null);

  // Pan responder for swipe-down dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gs) => gs.dy > 0 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 10,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) dragY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > DISMISS_THRESHOLD) {
          handleClose();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 100 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      dragY.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dragY.setValue(0);
      onClose();
    });
  }, [onClose]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: msg,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    scrollToBottom();

    // Simulate AI thinking time (0.8-1.5s)
    const thinkTime = 800 + Math.random() * 700;
    await new Promise(resolve => setTimeout(resolve, thinkTime));

    const response = getKriosResponse(msg, tasks, userName || 'there', onAddTask);
    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'ai',
      text: response.text,
      timestamp: new Date(),
      actions: response.actions,
    };

    setIsTyping(false);
    setMessages(prev => [...prev, aiMsg]);
    scrollToBottom();
  }, [input, tasks, userName, onAddTask, scrollToBottom]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isAI = item.role === 'ai';
    const showAvatar = isAI && (index === 0 || messages[index - 1]?.role !== 'ai');

    return (
      <View style={[styles.messageRow, isAI ? styles.aiRow : styles.userRow]}>
        {isAI && (
          <View style={[styles.avatarContainer, { opacity: showAvatar ? 1 : 0 }]}>
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>K</Text>
            </LinearGradient>
          </View>
        )}
        <View style={styles.bubbleWrapper}>
          <View style={[
            styles.bubble,
            isAI
              ? [styles.aiBubble, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)', borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)' }]
              : [styles.userBubble, { backgroundColor: theme.primary }],
          ]}>
            <Text style={[
              styles.bubbleText,
              { color: isAI ? theme.text : '#ffffff' }
            ]}>
              {item.text}
            </Text>
          </View>
          <Text style={[styles.timestamp, { color: theme.textSecondary, textAlign: isAI ? 'left' : 'right' }]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  const renderTypingIndicator = () => (
    <View style={[styles.messageRow, styles.aiRow]}>
      <View style={styles.avatarContainer}>
        <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.avatar}>
          <Text style={styles.avatarText}>K</Text>
        </LinearGradient>
      </View>
      <View style={[styles.bubble, styles.aiBubble, styles.typingBubble, {
        backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
        borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)',
      }]}>
        <TypingDots color={theme.primary} />
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.background,
            transform: [
              { translateY: Animated.add(slideAnim, dragY) },
            ],
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers}>
          <View style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerLeft}>
              <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.headerAvatar}>
                <Text style={styles.headerAvatarText}>K</Text>
              </LinearGradient>
              <View>
                <Text style={[styles.headerName, { color: theme.text }]}>Krios AI</Text>
                <View style={styles.headerStatus}>
                  <View style={styles.onlineDot} />
                  <Text style={[styles.headerStatusText, { color: theme.textSecondary }]}>Your orbit companion</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
              <Ionicons name="close" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={isTyping ? renderTypingIndicator : null}
            onContentSizeChange={scrollToBottom}
          />

          {/* Quick replies */}
          {messages.length <= 2 && (
            <View style={styles.quickReplies}>
              <FlatList
                data={QUICK_REPLIES}
                horizontal
                keyExtractor={item => item.label}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickRepliesList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.quickReply, { borderColor: theme.primary, backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)' }]}
                    onPress={() => sendMessage(item.label)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={item.icon as any} size={13} color={theme.primary} />
                    <Text style={[styles.quickReplyText, { color: theme.primary }]}>{item.label}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* Input bar */}
          <View style={[styles.inputBar, { borderTopColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
            <View style={[styles.inputWrapper, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}>
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: theme.text }]}
                placeholder="Message Krios..."
                placeholderTextColor={theme.textSecondary}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={500}
                onSubmitEditing={() => sendMessage()}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: input.trim() ? theme.primary : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)') }]}
              onPress={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              activeOpacity={0.8}
            >
              {isTyping ? (
                <ActivityIndicator size="small" color={input.trim() ? '#fff' : theme.textSecondary} />
              ) : (
                <Ionicons name="send" size={16} color={input.trim() ? '#ffffff' : theme.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// Typing dots animation component
function TypingDots({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -5, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const dotStyle = (anim: Animated.Value) => ({ transform: [{ translateY: anim }] });

  return (
    <View style={styles.dotsRow}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View key={i} style={[styles.dot, { backgroundColor: color }, dotStyle(d)]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 24,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  headerName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  headerStatusText: {
    fontSize: 11,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    marginRight: 8,
    marginBottom: 16,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  bubbleWrapper: {
    maxWidth: SCREEN_WIDTH * 0.72,
  },
  bubble: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  aiBubble: {
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    borderBottomRightRadius: 4,
    borderColor: 'transparent',
  },
  typingBubble: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bubbleText: {
    fontSize: 14.5,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 3,
    marginHorizontal: 4,
    opacity: 0.6,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    height: 16,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    opacity: 0.8,
  },
  quickReplies: {
    paddingVertical: 8,
  },
  quickRepliesList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickReply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickReplyText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
    maxHeight: 100,
  },
  input: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
});
