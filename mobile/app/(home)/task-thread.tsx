import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, StatusBar,
  TextInput, KeyboardAvoidingView, Platform, Dimensions, Animated, Modal, ActivityIndicator, Keyboard
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import taskService from '../../services/taskService';
import threadService, { ThreadMessage } from '../../services/threadService';
import { fetchAINote, AINote } from '../../services/aiNoteService';
import { secureStorage } from '../../services/storage';
import { TOKEN_KEY } from '../../constants/config';

const { width: W } = Dimensions.get('window');

type TabKey = 'Overview' | 'Steps' | 'Notes';
type AIActionKey = 'find' | 'summarize' | 'plan' | 'motivate';

const AI_ACTIONS: Array<{ id: AIActionKey; title: string; modalTitle: string; desc: string; icon: string; color: string }> = [
  { id: 'find', title: 'Find\nresources', modalTitle: 'Find useful resources', desc: 'Links, tools, and sources', icon: 'search', color: '#38bdf8' },
  { id: 'summarize', title: 'Summarize\ntask', modalTitle: 'Summarize the task', desc: 'Extract the key ideas', icon: 'book', color: '#a855f7' },
  { id: 'plan', title: 'Action\nplan', modalTitle: 'Create an action plan', desc: 'Turn it into steps', icon: 'list', color: '#f43f5e' },
  { id: 'motivate', title: 'Stay\nmotivated', modalTitle: 'Give me momentum', desc: 'Reasons to keep going', icon: 'flame', color: '#f59e0b' },
];

function notepadKey(taskId: string) {
  return `@krios:taskNotepad:${taskId}`;
}

export default function TaskDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const params = useLocalSearchParams<{
    taskId: string; taskTitle: string; taskPriority: string; taskBucket: string; taskCompleted: string;
  }>();

  const [activeTab, setActiveTab] = useState<TabKey>('Overview');
  const [token, setToken] = useState<string | null>(null);

  // AI State
  const [aiNote, setAiNote] = useState<AINote | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<{ title: string; content: React.ReactNode } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Notes State
  const [notes, setNotes] = useState<ThreadMessage[]>([]);
  const [notepadText, setNotepadText] = useState('');
  const [noteSelection, setNoteSelection] = useState({ start: 0, end: 0 });
  const [savingNote, setSavingNote] = useState(false);
  const noteSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Tab underline animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    secureStorage.getItem(TOKEN_KEY).then(setToken);
    loadNotes();
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

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeTab === 'Overview' ? 0 : activeTab === 'Steps' ? 1 : 2,
      useNativeDriver: true,
      friction: 18,
      tension: 150
    }).start();
  }, [activeTab]);

  useEffect(() => {
    if (!token || !params.taskId || aiNote) return;
    const fetchAI = async () => {
      setAiLoading(true);
      try {
        const note = await fetchAINote({
          taskId: params.taskId as string,
          taskTitle: params.taskTitle as string,
          taskType: 'daily',
          priority: params.taskPriority as string,
          token,
          forceRefresh: false,
          notesContext: notepadText,
        });
        setAiNote(note);
      } catch (e) {} finally {
        setAiLoading(false);
      }
    };
    fetchAI();
  }, [token, params.taskId]);

  const loadNotes = async () => {
    if (!params.taskId) return;
    const threadMessages = await threadService.getThread(params.taskId as any);
    setNotes(threadMessages);
    const savedNotepad = await AsyncStorage.getItem(notepadKey(params.taskId as string));
    if (savedNotepad !== null) {
      setNotepadText(savedNotepad);
      return;
    }
    const combined = threadMessages
      .filter(m => m.sender === 'user')
      .map(m => m.text)
      .join('\n\n');
    setNotepadText(combined);
  };

  const handleNoteChange = (text: string) => {
    setNotepadText(text);
    // Auto-save debounced
    if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
    setSavingNote(true);
    noteSaveTimeout.current = setTimeout(async () => {
      if (params.taskId) {
        await AsyncStorage.setItem(notepadKey(params.taskId as string), text);
        setSavingNote(false);
      }
    }, 1000);
  };

  const refreshAINote = async (forceRefresh = true) => {
    if (!token || !params.taskId) return;
    setAiLoading(true);
    try {
      const note = await fetchAINote({
        taskId: params.taskId as string,
        taskTitle: params.taskTitle as string,
        taskType: 'daily',
        priority: params.taskPriority as string,
        token,
        forceRefresh,
        notesContext: notepadText,
      });
      setAiNote(note);
    } finally {
      setAiLoading(false);
    }
  };

  const noteContextLine = notepadText.trim()
    ? `I also considered your note: "${notepadText.trim().slice(0, 140)}${notepadText.trim().length > 140 ? '...' : ''}"`
    : 'Add notes here and Krios can use them to make the help more personal.';

  const applyNoteFormat = (type: 'list' | 'bold' | 'italic' | 'link') => {
    const start = Math.max(0, Math.min(noteSelection.start, notepadText.length));
    const end = Math.max(start, Math.min(noteSelection.end, notepadText.length));
    const selected = notepadText.slice(start, end);
    let replacement = '';

    if (type === 'list') {
      const text = selected || 'List item';
      replacement = text
        .split('\n')
        .map(line => line.trim().startsWith('- ') ? line : `- ${line || 'List item'}`)
        .join('\n');
    } else if (type === 'bold') {
      replacement = `**${selected || 'bold text'}**`;
    } else if (type === 'italic') {
      replacement = `*${selected || 'italic text'}*`;
    } else {
      replacement = `[${selected || 'title'}](https://)`;
    }

    const next = `${notepadText.slice(0, start)}${replacement}${notepadText.slice(end)}`;
    handleNoteChange(next);
    const cursor = start + replacement.length;
    setNoteSelection({ start: cursor, end: cursor });
  };

  const compactHeaderOpacity = scrollY.interpolate({
    inputRange: [20, 110],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const heroOpacity = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [1, 0.18],
    extrapolate: 'clamp',
  });
  const heroTranslate = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0, -24],
    extrapolate: 'clamp',
  });

  // ── AI Actions Implementation ──
  const triggerAIAction = async (actionType: string, query?: string) => {
    setIsAiThinking(true);
    setAiResponse(null);

    let title = '';
    let content: React.ReactNode = null;
    const taskTitle = params.taskTitle || 'this task';

    if (!aiNote) {
      setIsAiThinking(false);
      setAiResponse({
        title: 'Krios needs connection',
        content: (
          <Text style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 22 }}>
            I could not reach the live AI brief for "{taskTitle}". Connect to Krios AI and try again so I can answer from this task instead of giving a generic template.
          </Text>
        ),
      });
      return;
    }

    await new Promise(r => setTimeout(r, 650));

    if (actionType === 'find') {
      title = aiNote.resource ? 'Best resource' : 'Resource direction';
      content = (
        <View style={{ gap: 12 }}>
          <Text style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 22 }}>
            For "{taskTitle}", I looked at the generated brief and your current notes. {noteContextLine}
          </Text>
          {aiNote.resource ? (
            <View style={styles.resourceCard}>
               <Ionicons name="link-outline" size={24} color="#fff" />
               <View style={{ flex: 1 }}>
                 <Text style={{ color: '#fff', fontWeight: '700' }}>{aiNote.resource.name}</Text>
                 <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{aiNote.resource.description}</Text>
                 <Text style={{ color: 'rgba(129,140,248,0.8)', fontSize: 11, marginTop: 4 }}>{aiNote.resource.url}</Text>
               </View>
            </View>
          ) : (
            <View style={styles.resourceCard}>
              <Ionicons name="search-outline" size={24} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Search from the task wording</Text>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                  Search the exact phrase "{taskTitle}" plus "examples", "template", or "beginner guide" depending on what you need next.
                </Text>
              </View>
            </View>
          )}
        </View>
      );
    } else if (actionType === 'summarize') {
      title = 'Task summary';
      const summaryItems = aiNote?.milestones?.length
        ? aiNote.milestones.slice(0, 5).map(m => m.label)
        : ['Clarify the desired outcome', 'Break it into small visible actions', 'Work in one focused block', 'Review and update your notes'];
      content = (
        <View style={{ gap: 10 }}>
          <Text style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 22 }}>{aiNote.summary}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.48)', lineHeight: 20 }}>{noteContextLine}</Text>
          {summaryItems.map((item, i) => (
             <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="checkmark-circle" size={18} color="#34d399" />
                <Text style={{ color: '#fff', fontSize: 14 }}>{item}</Text>
             </View>
          ))}
          <View style={[styles.insightCard, { marginTop: 10 }]}>
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="sparkles" size={14} color="#c084fc" />
                <Text style={[styles.assistantTitle, { color: '#c084fc' }]}>Krios read</Text>
             </View>
             <Text style={styles.insightText}>{aiNote?.hook || 'The best next move is to make this task concrete, short, and easy to start.'}</Text>
          </View>
        </View>
      );
    } else if (actionType === 'plan') {
      title = 'Action plan';
      content = (
        <View style={{ gap: 12 }}>
          <Text style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 22 }}>Here is the working plan for "{taskTitle}". {noteContextLine}</Text>
          {(aiNote.flow?.length ? aiNote.flow : aiNote.milestones.map((m, i) => ({ step: i + 1, title: m.label, detail: 'Use this as your next checkpoint.' }))).map((item, i) => (
            <View key={i} style={styles.aiPlanRow}>
              <View style={styles.aiPlanBadge}><Text style={styles.aiPlanBadgeText}>{item.step || i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.aiPlanTitle}>{item.title}</Text>
                <Text style={styles.aiPlanDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      );
      setActiveTab('Steps');
    } else if (actionType === 'custom') {
      title = 'Krios response';
      const nextMove = aiNote.milestones?.[0]?.label || aiNote.hook || aiNote.summary;
      content = <Text style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 22 }}>For "{query || taskTitle}", I am using the saved brief for this task: {aiNote.summary} Next move: {nextMove}</Text>;
    } else if (actionType === 'motivate') {
      title = 'Keep momentum';
      content = <Text style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 22 }}>{aiNote.hook || aiNote.summary}</Text>;
    }

    setIsAiThinking(false);
    setAiResponse({ title, content });
  };

  // ── Render Helpers ──
  const priorityColor = params.taskPriority === 'high' ? '#ef4444' : params.taskPriority === 'low' ? '#34d399' : '#f59e0b';

  const renderOverview = () => (
    <View style={styles.tabContent}>
      <View style={styles.assistantCard}>
         <LinearGradient colors={['rgba(34,211,238,0.12)', 'rgba(99,102,241,0.11)', 'rgba(168,85,247,0.06)']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />
         <View style={styles.assistantEdge} />
         <View style={styles.assistantHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
               <Ionicons name="sparkles" size={14} color="#a855f7" />
               <Text style={styles.assistantTitle}>Krios AI</Text>
               <Text style={styles.assistantBeta}>BETA</Text>
            </View>
            <TouchableOpacity><Ionicons name="close" size={18} color="rgba(255,255,255,0.4)" /></TouchableOpacity>
         </View>
         <Text style={styles.assistantPrompt}>Choose a task-aware action. Krios will use this task, notes, and generated context.</Text>
         <View style={styles.aiGrid}>
            {AI_ACTIONS.map(a => (
              <TouchableOpacity key={a.id} style={styles.aiActionCard} activeOpacity={0.7} onPress={() => { setShowAiInput(true); triggerAIAction(a.id); }}>
                <View style={[styles.aiActionIconWrap, { backgroundColor: `${a.color}20` }]}>
                   <Ionicons name={a.icon as any} size={18} color={a.color} />
                </View>
                <Text style={styles.aiActionText}>{a.title}</Text>
              </TouchableOpacity>
            ))}
         </View>
      </View>

      <Text style={styles.sectionTitle}>About this task</Text>
      <Text style={styles.sectionText}>
        {aiLoading
          ? 'Krios is building a task-specific brief...'
          : aiNote?.summary || 'Connect to Krios AI to generate a task-specific brief for this task.'}
      </Text>

      <View style={styles.insightCard}>
         <LinearGradient colors={['rgba(168,85,247,0.15)', 'rgba(168,85,247,0.05)']} style={StyleSheet.absoluteFill} />
         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Ionicons name="sparkles" size={14} color="#c084fc" />
            <Text style={[styles.assistantTitle, { color: '#c084fc' }]}>Insight</Text>
         </View>
         <Text style={styles.insightText}>
            {aiNote?.hook || noteContextLine}
         </Text>
      </View>
    </View>
  );

  const renderSteps = () => (
    <View style={styles.tabContent}>
      {aiLoading ? (
         <Text style={styles.loadingText}>Structuring action plan...</Text>
      ) : aiNote?.milestones && aiNote.milestones.length > 0 ? (
         <View style={styles.stepsContainer}>
           {aiNote.milestones.map((m, i) => (
             <TouchableOpacity key={i} style={styles.stepRow} activeOpacity={0.7}>
                <View style={[styles.stepCircle, m.completed && { backgroundColor: '#34d399' }]}>
                   {m.completed ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Text style={styles.stepNumber}>{i + 1}</Text>}
                </View>
                <Text style={[styles.stepText, m.completed && { textDecorationLine: 'line-through', opacity: 0.5 }]}>{m.label}</Text>
             </TouchableOpacity>
           ))}
         </View>
      ) : (
         <View style={styles.stepsContainer}>
           <View style={styles.stepRow}>
             <View style={styles.stepCircle}><Ionicons name="cloud-offline-outline" size={14} color="#fff" /></View>
             <Text style={styles.stepText}>Connect to Krios AI to generate steps for this task.</Text>
           </View>
         </View>
      )}
    </View>
  );

  const renderNotes = () => (
    <View style={styles.notesContent}>
        <View style={styles.noteHeroCard}>
          <LinearGradient colors={['rgba(99,102,241,0.22)', 'rgba(168,85,247,0.08)', 'rgba(34,211,238,0.06)']} style={StyleSheet.absoluteFill} />
          <View style={styles.noteHeroHeader}>
            <View>
              <Text style={styles.noteEyebrow}>Krios Notes</Text>
              <Text style={styles.noteHeroTitle}>Think, capture, then ask better.</Text>
            </View>
            {savingNote ? <ActivityIndicator size={16} color="#a855f7" /> : <Ionicons name="checkmark-done" size={18} color="rgba(255,255,255,0.55)" />}
          </View>
          <Text style={styles.noteHeroText}>{noteContextLine}</Text>
          <View style={styles.noteActionRow}>
            <TouchableOpacity style={styles.noteActionBtn} onPress={() => refreshAINote(true)} disabled={aiLoading}>
              <Ionicons name="sparkles-outline" size={15} color="#fff" />
              <Text style={styles.noteActionText}>{aiLoading ? 'Refreshing...' : 'Use notes for AI'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.noteActionBtnGhost} onPress={() => { setShowAiInput(true); triggerAIAction('plan'); }}>
              <Ionicons name="list-outline" size={15} color="#a5b4fc" />
              <Text style={styles.noteActionGhostText}>Build plan</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.notepadCard}>
          <View style={styles.notepadHeader}>
            <Text style={styles.notepadTitle}>Personal Notepad</Text>
            <Text style={styles.notepadMeta}>{notepadText.length} chars</Text>
          </View>
          <TextInput
            style={styles.notepadInput}
            multiline
            placeholder="Write what matters: links, blockers, ideas, what you tried, or what you want Krios to consider."
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={notepadText}
            onChangeText={handleNoteChange}
            onSelectionChange={(event) => setNoteSelection(event.nativeEvent.selection)}
            textAlignVertical="top"
          />
          <View style={styles.noteToolbar}>
            <TouchableOpacity onPress={() => applyNoteFormat('list')}><Ionicons name="list" size={20} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
            <TouchableOpacity onPress={() => applyNoteFormat('bold')}><Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 'bold', fontSize: 16 }}>B</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => applyNoteFormat('italic')}><Text style={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', fontSize: 16 }}>I</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => applyNoteFormat('link')}><Ionicons name="link" size={20} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
            <TouchableOpacity onPress={() => refreshAINote(true)}><Ionicons name="sparkles-outline" size={20} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
          </View>
        </View>

        {notes.length > 0 && (
          <View style={styles.threadCard}>
            <Text style={styles.threadTitle}>Thread context</Text>
            {notes.slice(-4).map((message, index) => (
              <View key={`${message.id || index}`} style={styles.threadRow}>
                <View style={styles.threadDot} />
                <Text style={styles.threadText} numberOfLines={3}>{message.text}</Text>
              </View>
            ))}
          </View>
        )}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#080A12', '#0D101C', '#0A0A14']} style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.headerBg, { opacity: compactHeaderOpacity }]} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
         <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
         </TouchableOpacity>
         <Animated.Text style={[styles.compactTitle, { opacity: compactHeaderOpacity }]} numberOfLines={1}>
           {params.taskTitle}
         </Animated.Text>
         <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
         </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: activeTab !== 'Notes' ? insets.bottom + 118 : Math.max(insets.bottom, 34) + keyboardHeight }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        <Animated.View style={[styles.titleSection, { paddingTop: insets.top + 78, opacity: heroOpacity, transform: [{ translateY: heroTranslate }] }]}>
           <View style={styles.iconCircle}>
              <Ionicons name="book" size={28} color="#a855f7" />
           </View>
           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }}>
              <Text style={styles.taskTitle} numberOfLines={2}>{params.taskTitle}</Text>
              <TouchableOpacity><Ionicons name="pencil" size={16} color="rgba(255,255,255,0.4)" /></TouchableOpacity>
           </View>

           <View style={styles.metaRow}>
              <View style={styles.metaBadge}>
                 <View style={[styles.dot, { backgroundColor: priorityColor }]} />
                 <Text style={styles.metaText}>{params.taskPriority || 'Medium'}</Text>
              </View>
              <View style={styles.metaBadge}>
                 <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.6)" />
                 <Text style={styles.metaText}>No due date</Text>
              </View>
           </View>
        </Animated.View>

        <View style={styles.tabBar}>
           {(['Overview', 'Steps', 'Notes'] as TabKey[]).map((tab) => (
             <TouchableOpacity key={tab} style={styles.tabItem} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.tabText, activeTab === tab && { color: '#fff', fontWeight: '700' }]}>{tab}</Text>
             </TouchableOpacity>
           ))}
           <Animated.View style={[styles.tabIndicator, {
             transform: [{
               translateX: slideAnim.interpolate({ inputRange: [0, 1, 2], outputRange: [0, W / 3, (W / 3) * 2] })
             }]
           }]} />
           <View style={styles.tabTrack} />
        </View>

        {activeTab === 'Overview' && renderOverview()}
        {activeTab === 'Steps' && renderSteps()}
        {activeTab === 'Notes' && renderNotes()}
      </Animated.ScrollView>

      {/* Bottom Floating AI Bar (Only in Overview/Steps) */}
      {activeTab !== 'Notes' && (
         <View style={[styles.bottomAIBar, { paddingBottom: insets.bottom + 24 }]}>
            <TouchableOpacity style={styles.aiInputTrigger} onPress={() => setShowAiInput(true)}>
               <Text style={styles.aiInputPlaceholder}>Ask Krios anything...</Text>
               <Ionicons name="send" size={18} color="#6366f1" />
            </TouchableOpacity>
         </View>
      )}

      {/* Full Screen AI Action Flow / Chat (Triggered by input) */}
      <Modal visible={showAiInput} transparent animationType="slide">
         <View style={[styles.modalBg, { paddingBottom: keyboardHeight }]}>
            <View style={[styles.modalSheet, { paddingTop: insets.top + 20 }]}>
               <LinearGradient colors={['#080A12', '#11142A', '#090A14']} style={StyleSheet.absoluteFill} />
                 <View style={styles.modalHeader}>
                    <View>
                      <Text style={styles.modalHeaderTitle}>Krios AI <Text style={styles.betaBadge}>BETA</Text></Text>
                      <Text style={styles.modalHeaderSub}>Using this task, AI brief, and your notes</Text>
                    </View>
                    <TouchableOpacity onPress={() => { setShowAiInput(false); setAiResponse(null); }}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
                 </View>
                 <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
                    {!aiResponse && !isAiThinking ? (
                      <>
                        <Text style={styles.aiChatGreeting}>How can I help with{'\n'}<Text style={{ color: '#818cf8' }}>"{params.taskTitle}"</Text>?</Text>
                        <View style={styles.modalContextCard}>
                          <Ionicons name="reader-outline" size={16} color="#a5b4fc" />
                          <Text style={styles.modalContextText} numberOfLines={3}>{aiNote?.summary || noteContextLine}</Text>
                        </View>

                        {/* Action List */}
                        <View style={styles.actionList}>
                           {AI_ACTIONS.map((action, idx) => {
                             const ac = { id: action.id, i: action.icon, t: action.modalTitle, d: action.desc };
                             return (
                             <TouchableOpacity key={idx} style={styles.actionListItem} onPress={() => triggerAIAction(ac.id)}>
                                <View style={styles.actionListIcon}><Ionicons name={ac.i as any} size={16} color="#a855f7" /></View>
                                <View style={{ flex: 1 }}>
                                   <Text style={styles.actionListTitle}>{ac.t}</Text>
                                   <Text style={styles.actionListDesc}>{ac.d}</Text>
                                </View>
                             </TouchableOpacity>
                             );
                           })}
                        </View>
                      </>
                    ) : isAiThinking ? (
                      <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 80 }}>
                         <ActivityIndicator size="large" color="#a855f7" />
                         <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 16 }}>Synthesizing knowledge...</Text>
                      </View>
                    ) : (
                      <View style={styles.aiResponseContainer}>
                         <Text style={styles.aiResponseTitle}>{aiResponse?.title}</Text>
                         {aiResponse?.content}
                      </View>
                    )}
                 </ScrollView>
                 
                 <View style={[styles.aiInputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                   <TextInput
                     style={styles.noteInput}
                     placeholder="Ask anything about this task..."
                     placeholderTextColor="rgba(255,255,255,0.3)"
                     value={aiQuery}
                     onChangeText={setAiQuery}
                     onSubmitEditing={() => {
                       triggerAIAction('custom', aiQuery);
                       setAiQuery('');
                     }}
                   />
                   <TouchableOpacity style={styles.sendBtn} onPress={() => { triggerAIAction('custom', aiQuery); setAiQuery(''); }}>
                      <LinearGradient colors={['#8b5cf6', '#6366f1']} style={StyleSheet.absoluteFill} />
                      <Ionicons name="send" size={14} color="#fff" />
                   </TouchableOpacity>
                 </View>
              </View>
         </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0D17' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, zIndex: 10 },
  headerBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, backgroundColor: '#0B0D17', zIndex: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  compactTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center', paddingHorizontal: 16 },
  headerBtn: { padding: 8, zIndex: 10 },

  titleSection: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 10, paddingBottom: 24 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(168, 85, 247, 0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.2)' },
  taskTitle: { color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  metaText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' },

  tabBar: { flexDirection: 'row', marginHorizontal: 20, position: 'relative', height: 40 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  tabTrack: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  tabIndicator: { position: 'absolute', bottom: -0.5, left: 0, width: (W - 40) / 3, height: 2, backgroundColor: '#818cf8', borderRadius: 2, zIndex: 2 },

  tabContent: { padding: 20, paddingBottom: 136 },

  // Overview
  assistantCard: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(129,140,248,0.24)', overflow: 'hidden', padding: 16, marginBottom: 24 },
  assistantEdge: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: '#818cf8' },
  assistantHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  assistantTitle: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  assistantBeta: { color: '#a5b4fc', fontSize: 9, fontWeight: '800', letterSpacing: 0.8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, backgroundColor: 'rgba(129,140,248,0.12)', overflow: 'hidden' },
  assistantPrompt: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 16 },
  aiGrid: { flexDirection: 'row', gap: 10 },
  aiActionCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  aiActionIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  aiActionText: { color: 'rgba(255,255,255,0.8)', fontSize: 10, textAlign: 'center', fontWeight: '500' },

  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  sectionText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 22, marginBottom: 24 },

  insightCard: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.3)', overflow: 'hidden', padding: 16 },
  insightText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 22 },

  // Steps
  loadingText: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 20, fontSize: 14 },
  stepsContainer: { gap: 16 },
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  stepCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.2)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepNumber: { color: '#818cf8', fontSize: 12, fontWeight: '700' },
  stepText: { flex: 1, color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 22 },

  // Notes Notepad
  notesContent: { padding: 20, gap: 16 },
  noteHeroCard: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(129,140,248,0.24)', overflow: 'hidden', padding: 16 },
  noteHeroHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  noteEyebrow: { color: '#a5b4fc', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  noteHeroTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 4 },
  noteHeroText: { color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 20 },
  noteActionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  noteActionBtn: { flex: 1, height: 42, borderRadius: 14, backgroundColor: '#6366f1', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  noteActionText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  noteActionBtnGhost: { height: 42, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(165,180,252,0.28)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  noteActionGhostText: { color: '#a5b4fc', fontSize: 13, fontWeight: '800' },
  notepadCard: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.035)', padding: 16 },
  notepadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  notepadTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  notepadMeta: { color: 'rgba(255,255,255,0.38)', fontSize: 11, fontWeight: '700' },
  notepadInput: { minHeight: 220, color: '#fff', fontSize: 16, lineHeight: 25, paddingTop: 4, paddingBottom: 14 },
  noteToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14 },
  threadCard: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.025)', padding: 14 },
  threadTitle: { color: '#fff', fontSize: 14, fontWeight: '800', marginBottom: 10 },
  threadRow: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.06)' },
  threadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#818cf8', marginTop: 7 },
  threadText: { flex: 1, color: 'rgba(255,255,255,0.62)', fontSize: 13, lineHeight: 19 },

  // Bottom AI Bar
  bottomAIBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#0B0D17', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  aiInputTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 25, paddingHorizontal: 20, paddingVertical: 14 },
  aiInputPlaceholder: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },

  // AI Modal Flow
  modalBg: { flex: 1, backgroundColor: '#070911' },
  modalSheet: { flex: 1, backgroundColor: '#080A12' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20 },
  modalHeaderTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalHeaderSub: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 3 },
  modalScrollContent: { padding: 20, paddingBottom: 34 },
  betaBadge: { fontSize: 9, color: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 4, borderRadius: 4 },
  aiChatGreeting: { color: '#fff', fontSize: 24, fontWeight: '800', lineHeight: 32, marginBottom: 14 },
  modalContextCard: { flexDirection: 'row', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(129,140,248,0.22)', backgroundColor: 'rgba(129,140,248,0.08)', padding: 12, marginBottom: 22 },
  modalContextText: { flex: 1, color: 'rgba(255,255,255,0.68)', fontSize: 12, lineHeight: 18 },
  actionList: { gap: 16 },
  actionListItem: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  actionListIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(168, 85, 247, 0.1)', alignItems: 'center', justifyContent: 'center' },
  actionListTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  actionListDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },

  aiResponseContainer: { backgroundColor: 'rgba(168,85,247,0.1)', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)' },
  aiResponseTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  resourceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12 },
  viewBtn: { backgroundColor: 'rgba(129, 140, 248, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  aiPlanRow: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  aiPlanBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(99,102,241,0.24)', alignItems: 'center', justifyContent: 'center' },
  aiPlanBadgeText: { color: '#a5b4fc', fontSize: 12, fontWeight: '800' },
  aiPlanTitle: { color: '#fff', fontSize: 14, fontWeight: '800', marginBottom: 3 },
  aiPlanDetail: { color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 18 },

  aiInputContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  noteInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, color: '#fff', fontSize: 14, minHeight: 44, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
