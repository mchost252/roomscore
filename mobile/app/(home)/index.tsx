import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView,
  TextInput, Animated, Dimensions, Platform, StatusBar,
  KeyboardAvoidingView, Pressable, Image, Switch, Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import taskService, { PersonalTask } from '../../services/taskService';
import messageService from '../../services/messageService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeNavContext } from './_layout';
import { getTaskStatus, taskStatusColors, TaskStatus } from '../../utils/taskStatusConfig';
import notificationService from '../../services/notificationService';
import KriosDatePicker from '../../components/KriosDatePicker';
import Skia3DCard from '../../components/Skia3DCard';
import ConfettiCelebration from '../../components/ConfettiCelebration';
import AIClarificationSheet from '../../components/AIClarificationSheet';
import { checkVagueness, ClarificationQuestion } from '../../services/aiNoteService';
import { secureStorage } from '../../services/storage';
import { TOKEN_KEY } from '../../constants/config';

const { width: W, height: H } = Dimensions.get('window');

// ─── Theme shim ─────────────────────────────────────────────────────────────
function useT() {
  const { colors, gradients, isDark } = useTheme();
  return {
    isDark,
    bg:       colors.background.primary,
    surface:  colors.surface,
    border:   colors.border.primary,
    text:     colors.text,
    textSub:  colors.textSecondary,
    textHint: colors.textTertiary,
    primary:  colors.primary,
    success:  colors.status.success,
    warning:  colors.status.warning,
    error:    colors.status.error,
    grad:     gradients.background.colors as readonly [string, string, ...string[]],
    rgb:      isDark ? '18,18,30' : '248,249,255',
    surfRgb:  isDark ? '30,30,50' : '255,255,255',
    accent:   isDark ? colors.accent : colors.primary,
    accentLight: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const PRIORITY: Record<string, { color: string; label: string; icon: 'flame' | 'alert-circle' | 'remove-circle' }> = {
  urgent: { color: '#dc2626', label: 'Urgent', icon: 'flame'         },
  high:   { color: '#ef4444', label: 'High',   icon: 'flame'         },
  medium: { color: '#f59e0b', label: 'Medium', icon: 'alert-circle'  },
  low:    { color: '#6366f1', label: 'Low',    icon: 'remove-circle' },
};
const BUCKET_COLOR: Record<string, string> = {
  today: '#6366f1', week: '#8b5cf6', someday: '#06b6d4', inbox: '#64748b',
};
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_SHORT   = ['S','M','T','W','T','F','S'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function startOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function isSameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function getWeekDays(ref: Date): Date[] {
  const d = new Date(ref); d.setDate(d.getDate() - d.getDay());
  return Array.from({length:7},(_,i)=>{ const x=new Date(d); x.setDate(d.getDate()+i); return x; });
}
interface ThreadEntry {
  id: string; type: 'note'|'reminder'|'snooze'|'complete'|'created'; text: string; timestamp: Date;
}
// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const t = useT();
  const { user } = useAuth();
  const { setTheme, isDark, theme: themeMode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setOpenAIChat, setOpenAddTask } = React.useContext(HomeNavContext);

  // ── Calendar state ────────────────────────────────────────────────────────
  const today = new Date();
  const [selectedDate, setSelectedDate]     = useState(today);
  const [calMonth, setCalMonth]             = useState(today.getMonth());
  const [calYear, setCalYear]               = useState(today.getFullYear());
  const [calView, setCalView]               = useState<'week'|'month'>('week');
  const weekDays = getWeekDays(selectedDate);
  const totalDays = daysInMonth(calYear, calMonth);
  const startDay  = startOfMonth(calYear, calMonth);
  const calHeight = useRef(new Animated.Value(1)).current;
  const [calExpanded, setCalExpanded]       = useState(false);
  // Calendar pull-down
  const [calPulled, setCalPulled]           = useState(false);
  const calPullAnim = useRef(new Animated.Value(-340)).current;

  const pullCalDown = useCallback(() => {
    setCalPulled(true);
    Animated.spring(calPullAnim, { toValue: 0, tension: 200, friction: 18, useNativeDriver: true }).start();
  }, [calPullAnim]);

  const pushCalUp = useCallback(() => {
    Animated.timing(calPullAnim, { toValue: -340, duration: 240, useNativeDriver: true }).start(() => {
      setCalPulled(false);
      setCalView('week');
    });
  }, [calPullAnim]);

  // ── Search ───────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]       = useState('');
  
  // ── Task status filter ────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter]     = useState<TaskStatus | null>(null);

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const [tasks, setTasks]                   = useState<PersonalTask[]>([]);
  const [loading, setLoading]               = useState(false);
  const [threadMap, setThreadMap]           = useState<Record<string,ThreadEntry[]>>({});
  const taskDates = tasks.filter(t=>t.dueDate).map(t=>new Date(t.dueDate!));
  let tasksForDate = searchQuery.trim()
    ? tasks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : statusFilter
      // When status filter is active, show ALL INCOMPLETE tasks with that status (ignore selectedDate)
      ? tasks.filter(t => !t.isCompleted && getTaskStatus(t.dueDate ? new Date(t.dueDate) : null) === statusFilter)
      // When no filter, show tasks for the selected date
      : tasks.filter(t=>{
          if (!t.dueDate) return isSameDay(new Date(t.createdAt), selectedDate);
          return isSameDay(new Date(t.dueDate), selectedDate);
        });
  const pendingCount = tasks.filter(t=>!t.isCompleted).length;
  // Task status counts using configurable logic (convert string dates to Date objects)
  const ongoingCount = tasks.filter(t => !t.isCompleted && getTaskStatus(t.dueDate ? new Date(t.dueDate) : null) === 'ongoing').length;
  const upcomingCount = tasks.filter(t => !t.isCompleted && getTaskStatus(t.dueDate ? new Date(t.dueDate) : null) === 'upcoming').length;
  const dueCount = tasks.filter(t => !t.isCompleted && getTaskStatus(t.dueDate ? new Date(t.dueDate) : null) === 'due').length;
  const done = tasks.filter(t=>t.isCompleted);

  const openTaskSheet = useCallback((task: PersonalTask) => {
    router.push({
      pathname: '/(home)/task-thread',
      params: {
        taskId: task.id,
        taskTitle: task.title,
        taskPriority: task.priority || 'medium',
        taskBucket: task.bucket || 'inbox',
        taskCompleted: task.isCompleted ? 'true' : 'false',
      },
    });
  },[router]);

  // ── Toast (declared first so all callbacks can reference it) ────────────
  const [toast, setToast]                   = useState('');
  const toastAnim                           = useRef(new Animated.Value(0)).current;
  const showToast = useCallback((msg:string)=>{
    setToast(msg);
    Animated.sequence([
      Animated.timing(toastAnim,{toValue:1,duration:200,useNativeDriver:true}),
      Animated.delay(1800),
      Animated.timing(toastAnim,{toValue:0,duration:200,useNativeDriver:true}),
    ]).start();
  },[toastAnim]);

  // ── Add task sheet ────────────────────────────────────────────────────────
  const [showAddTask, setShowAddTask]       = useState(false);
  // ── Confetti celebration ──────────────────────────────────────────────────
  const [showConfetti, setShowConfetti]     = useState(false);
  const [confettiPriority, setConfettiPriority] = useState<'urgent'|'high'|'medium'|'low'>('medium');

  // ── Unread messages badge ──────────────────────────────────────────────────
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    messageService.initialize(user.id).then(() => {
      messageService.getUnreadCount().then(setUnreadCount);
    });
    const unsub = messageService.on('conversations_updated', () => {
      messageService.getUnreadCount().then(setUnreadCount);
    });
    return unsub;
  }, [user]);

  // ── Smart notifications ───────────────────────────────────────────────────
  useEffect(() => {
    const initNotifications = async () => {
      await notificationService.initialize();
      if (tasks.length > 0) {
        await notificationService.scheduleSmartNotifications(tasks);
      }
    };
    initNotifications();
  }, [tasks]);
  const addTaskAnim                         = useRef(new Animated.Value(H)).current;
  const [newTaskTitle, setNewTaskTitle]     = useState('');
  const [newTaskBucket, setNewTaskBucket]   = useState<'today'|'week'|'someday'|'inbox'>('today');
  const [newTaskPriority, setNewTaskPriority] = useState<'urgent'|'low'|'medium'|'high'>('medium');
  const [newTaskDue, setNewTaskDue]         = useState<Date>(today);
  const [newTaskTime, setNewTaskTime]       = useState<string>('09:00');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── AI Clarification sheet state ──────────────────────────────────────────
  const [showClarification, setShowClarification] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<ClarificationQuestion[]>([]);
  const [pendingTask, setPendingTask] = useState<PersonalTask | null>(null);

  const openAddTask = useCallback(()=>{
    addTaskAnim.setValue(H);
    setShowAddTask(true);
    setTimeout(()=>{ Animated.spring(addTaskAnim,{toValue:0,useNativeDriver:true,tension:200,friction:16}).start(); },20);
  },[addTaskAnim]);

  const closeAddTask = useCallback(()=>{
    Animated.timing(addTaskAnim,{toValue:H,duration:240,useNativeDriver:true}).start(()=>{ setShowAddTask(false); setNewTaskTitle(''); });
  },[addTaskAnim]);

  const navigateToThread = useCallback((task: PersonalTask, clarifications?: Record<string,string>) => {
    router.push({
      pathname: '/(home)/task-thread',
      params: {
        taskId: task.id,
        taskTitle: task.title,
        taskPriority: task.priority || 'medium',
        taskBucket: task.bucket || 'inbox',
        taskType: task.taskType || 'one-time',
        taskCompleted: task.isCompleted ? 'true' : 'false',
        clarifications: clarifications ? JSON.stringify(clarifications) : '',
      },
    });
  }, [router]);

  const handleCreateTask = useCallback(async()=>{
    if (!newTaskTitle.trim()) return;
    const due = new Date(newTaskDue);
    const [h,m] = newTaskTime.split(':').map(Number);
    due.setHours(h, m, 0, 0);

    // Save task immediately (offline-first)
    const task = await taskService.createTask({
      title: newTaskTitle.trim(),
      bucket: newTaskBucket,
      priority: newTaskPriority,
      dueDate: due.toISOString(),
    });
    setTasks(prev=>[task,...prev]);
    closeAddTask();
    showToast('Task added!');

    // Check vagueness — if vague show clarification sheet, else go straight to thread
    try {
      const token = await secureStorage.getItem(TOKEN_KEY);
      const result = await checkVagueness(newTaskTitle.trim(), token || '');
      if (result.isVague && result.questions.length > 0) {
        setPendingTask(task);
        setClarificationQuestions(result.questions);
        setShowClarification(true);
      } else {
        // Not vague — navigate directly, AI note will generate without clarifications
        navigateToThread(task);
      }
    } catch {
      // If vagueness check fails, just navigate normally
      navigateToThread(task);
    }
  },[newTaskTitle,newTaskBucket,newTaskPriority,newTaskDue,newTaskTime,closeAddTask,showToast,navigateToThread]);

  const handleClarificationSubmit = useCallback((answers: Record<string,string>) => {
    setShowClarification(false);
    if (pendingTask) {
      navigateToThread(pendingTask, answers);
      setPendingTask(null);
    }
  }, [pendingTask, navigateToThread]);

  const handleClarificationSkip = useCallback(() => {
    setShowClarification(false);
    if (pendingTask) {
      navigateToThread(pendingTask);
      setPendingTask(null);
    }
  }, [pendingTask, navigateToThread]);

  const pulseAnim=useRef(new Animated.Value(1)).current;
  useEffect(()=>{
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim,{toValue:0.3,duration:800,useNativeDriver:true}),
      Animated.timing(pulseAnim,{toValue:1,duration:800,useNativeDriver:true}),
    ]));
    loop.start();
    return()=>loop.stop();
  },[pulseAnim]);

  const openAIChat = useCallback(()=>{
    router.push('/(home)/ai-chat');
  },[router]);

  // ── Focus timer ───────────────────────────────────────────────────────────
  const [focusActive, setFocusActive]       = useState(false);
  const [focusSecs, setFocusSecs]           = useState(25*60);
  const [focusRunning, setFocusRunning]     = useState(false);
  const focusRef                            = useRef<ReturnType<typeof setInterval>|null>(null);
  const signAnim                            = useRef(new Animated.Value(W)).current;
  const dimAnim                             = useRef(new Animated.Value(0)).current;

  const openFocus = useCallback(()=>{
    setFocusActive(true);
    Animated.parallel([
      Animated.spring(signAnim,{toValue:0,useNativeDriver:true,tension:200,friction:16}),
      Animated.timing(dimAnim,{toValue:0.6,duration:300,useNativeDriver:true}),
    ]).start();
  },[signAnim,dimAnim]);

  const closeFocus = useCallback(()=>{
    if (focusRef.current) clearInterval(focusRef.current);
    setFocusRunning(false);
    Animated.parallel([
      Animated.timing(signAnim,{toValue:W,duration:260,useNativeDriver:true}),
      Animated.timing(dimAnim,{toValue:0,duration:260,useNativeDriver:true}),
    ]).start(()=>{ setFocusActive(false); setFocusSecs(25*60); });
  },[signAnim,dimAnim]);

  const toggleFocusTimer = useCallback(()=>{
    if (focusRunning) {
      if (focusRef.current) clearInterval(focusRef.current);
      setFocusRunning(false);
    } else {
      setFocusRunning(true);
      focusRef.current = setInterval(()=>{
        setFocusSecs(s=>{ if(s<=1){clearInterval(focusRef.current!);setFocusRunning(false);return 0;}return s-1;});
      },1000);
    }
  },[focusRunning]);

  const fMins = String(Math.floor(focusSecs/60)).padStart(2,'0');
  const fSecs = String(focusSecs%60).padStart(2,'0');

  // ── Nav / Theme ───────────────────────────────────────────────────────────
  const [navStyle, setNavStyle]             = useState<'bottom'|'sidebar'>('bottom');

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(()=>{
    taskService.getLocalTasks().then((loaded:PersonalTask[])=>{ setTasks(loaded); setLoading(false); });
  },[]);

  useFocusEffect(useCallback(()=>{
    AsyncStorage.getItem('krios_nav_style').then(v=>{ if(v==='sidebar'||v==='bottom') setNavStyle(v); });
    
    // Inject shared functions into Layout whenever Home is focused
    setOpenAIChat(openAIChat);
    setOpenAddTask(openAddTask);
  },[openAIChat,openAddTask,setOpenAIChat,setOpenAddTask]));

  const handleToggleComplete = useCallback(async(task:PersonalTask)=>{
    const updated = await taskService.updateTask(task.id,{isCompleted:!task.isCompleted});
    if (!updated) return;
    setTasks(prev=>prev.map(t=>t.id===task.id?updated:t));
    if (!task.isCompleted) {
      // Trigger confetti based on priority
      const priority = (task.priority || 'medium') as 'urgent'|'high'|'medium'|'low';
      setConfettiPriority(priority);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
      showToast('Task completed!');
    }
  },[showToast]);

  // Undo delete
  const [undoTask, setUndoTask] = useState<PersonalTask|null>(null);
  const undoAnim = useRef(new Animated.Value(0)).current;

  const handleDeleteTask = useCallback(async(id:string)=>{
    const taskToDelete = tasks.find(t=>t.id===id);
    await taskService.deleteTask(id);
    setTasks(prev=>prev.filter(t=>t.id!==id));
    if (taskToDelete) {
      setUndoTask(taskToDelete);
      undoAnim.setValue(0);
      Animated.sequence([
        Animated.timing(undoAnim,{toValue:1,duration:220,useNativeDriver:true}),
        Animated.delay(4000),
        Animated.timing(undoAnim,{toValue:0,duration:220,useNativeDriver:true}),
      ]).start(()=>setUndoTask(null));
    } else {
      showToast('Task deleted');
    }
  },[tasks, showToast, undoAnim]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h<5) return 'Good night';
    if (h<12) return 'Good morning';
    if (h<17) return 'Good afternoon';
    return 'Good evening';
  })();

  const cycleTheme = useCallback(()=>{
    const themes: Array<'light'|'dark'|'system'> = ['light','dark','system'];
    const idx = themes.indexOf(themeMode as any);
    const next = themes[(idx + 1) % 3];
    setTheme(next);
  },[themeMode, setTheme]);

  // Icon: currently dark → show sun (to switch to light), currently light → show moon (to switch to dark)
  const themeIcon = themeMode === 'system'
    ? 'phone-portrait-outline'
    : isDark ? 'moon-outline' : 'sunny-outline';
  const themeColor = themeMode === 'system'
    ? '#64748b'
    : isDark ? '#f59e0b' : '#6366f1';
  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root,{backgroundColor:t.bg}]}>
      <StatusBar barStyle={t.isDark?'light-content':'dark-content'} />
      
      {/* ════ CONFETTI CELEBRATION ════ */}
      <ConfettiCelebration show={showConfetti} priority={confettiPriority} onComplete={() => setShowConfetti(false)} />
      {/* Background gradient - simple, reliable on all platforms */}
      <LinearGradient
        colors={t.isDark
          ? ['#0a0a16','#0d0d20','#080812'] as const
          : ['#ffffff','#f5f5ff','#f0f0ff'] as const}
        locations={[0,0.5,1]}
        start={{x:0.3,y:0}} end={{x:0.7,y:1}}
        style={StyleSheet.absoluteFill}
      />
      {/* Accent blob - subtle indigo/violet tint */}
      <LinearGradient
        colors={t.isDark
          ? ['rgba(99,102,241,0.18)','transparent'] as const
          : ['rgba(99,102,241,0.07)','transparent'] as const}
        start={{x:0,y:0}} end={{x:1,y:0.6}}
        style={StyleSheet.absoluteFill}
      />

      {/* ════ CALENDAR PULL-DOWN OVERLAY ════ */}
      {calPulled&&(
        <Pressable style={[StyleSheet.absoluteFillObject,{backgroundColor:'rgba(0,0,0,0.3)',zIndex:49}]} onPress={pushCalUp}/>
      )}
      <Animated.View style={[s.calDropdown,{backgroundColor:t.isDark?'rgba(10,10,22,0.98)':'rgba(248,248,255,0.98)',borderColor:t.isDark?'rgba(99,102,241,0.3)':'rgba(99,102,241,0.2)',borderWidth:1.5,top:insets.top,transform:[{translateY:calPullAnim}]}]}>
        {/* Multi-layer gradient for depth and shine */}
        <LinearGradient colors={[t.isDark?'#6366f120':'#6366f115','transparent',t.isDark?'rgba(139,92,246,0.1)':'rgba(99,102,241,0.08)']} locations={[0,0.5,1]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
        <LinearGradient colors={['rgba(255,255,255,0.15)','transparent']} locations={[0,0.4]} start={{x:0.2,y:0}} end={{x:0.8,y:0.4}} style={[StyleSheet.absoluteFill,{opacity:0.7}]}/>
        <View style={s.calDropInner}>
          <View style={s.calDropHeader}>
            <Text style={[s.calDropDate,{color:t.text}]}>{DAY_NAMES[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}</Text>
            <TouchableOpacity onPress={pushCalUp} style={[s.calDropClose,{backgroundColor:`rgba(${t.surfRgb},0.6)`}]}>
              <Ionicons name="close" size={16} color={t.textSub}/>
            </TouchableOpacity>
          </View>
          {/* Week strip — hidden when month is showing */}
          {calView==='week'&&(
          <View style={s.weekStrip}>
            {weekDays.map((d,i)=>{
              const isSel=isSameDay(d,selectedDate);
              const isTod=isSameDay(d,today);
              const has=taskDates.some(td=>isSameDay(td,d));
              return(
                <TouchableOpacity key={i} style={s.weekCell} onPress={()=>{setSelectedDate(d);}}>
                  <Text style={[s.weekDayLabel,{color:isSel?t.primary:t.textHint,fontSize:9,fontWeight:'700',letterSpacing:0.8}]}>{DAY_NAMES[d.getDay()].slice(0,3).toUpperCase()}</Text>
                  <View style={[s.weekDayPill,{
                    backgroundColor:isSel?t.primary:isTod?`rgba(99,102,241,0.15)`:`rgba(${t.surfRgb},0.4)`,
                    borderWidth:isTod&&!isSel?2:0,
                    borderColor:t.primary,
                    elevation:0
                  }]}>
                    <Text style={[s.weekDayNum,{color:isSel?'#fff':isTod?t.primary:t.text,fontWeight:isSel||isTod?'700':'600'}]}>{d.getDate()}</Text>
                  </View>
                  {has&&<View style={[s.taskDot,{backgroundColor:isSel?'#fff':t.primary}]}/>}
                </TouchableOpacity>
              );
            })}
          </View>
          )}
          {/* Chevron — only show in week view to go to month */}
          {calView==='week'&&(
            <TouchableOpacity onPress={()=>setCalView('month')} style={s.calChevronRow}>
              <Ionicons name="chevron-down" size={20} color={t.textHint}/>
            </TouchableOpacity>
          )}
          {calView==='month'&&(
            <TouchableOpacity onPress={()=>setCalView('week')} style={s.calChevronRow}>
              <Ionicons name="chevron-up" size={20} color={t.textHint}/>
            </TouchableOpacity>
          )}
          {/* Month grid — replaces week strip, has its own back chevron */}
          {calView==='month'&&(
            <View>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}>
                <TouchableOpacity onPress={()=>{const m=calMonth===0?11:calMonth-1;setCalMonth(m);if(calMonth===0)setCalYear(y=>y-1);}} style={[s.monthNavBtn,{borderColor:t.border}]}>
                  <Ionicons name="chevron-back" size={14} color={t.textSub}/>
                </TouchableOpacity>
                <Text style={[s.calMonthLabel,{color:t.text}]}>{MONTH_NAMES[calMonth]} {calYear}</Text>
                <TouchableOpacity onPress={()=>{const m=calMonth===11?0:calMonth+1;setCalMonth(m);if(calMonth===11)setCalYear(y=>y+1);}} style={[s.monthNavBtn,{borderColor:t.border}]}>
                  <Ionicons name="chevron-forward" size={14} color={t.textSub}/>
                </TouchableOpacity>
              </View>
              <View style={s.monthDayNames}>
                {DAY_SHORT.map((d,i)=><Text key={i} style={[s.monthDayLabel,{color:t.textHint}]}>{d}</Text>)}
              </View>
              <View style={s.monthGrid}>
                {Array.from({length:startDay}).map((_,i)=><View key={`e${i}`} style={s.monthCell}/>)}
                {Array.from({length:totalDays}).map((_,i)=>{
                  const d=new Date(calYear,calMonth,i+1);
                  const isSel=isSameDay(d,selectedDate);
                  const isTod=isSameDay(d,today);
                  const has=taskDates.some(td=>isSameDay(td,d));
                  return(
                    <TouchableOpacity key={i} style={s.monthCell} onPress={()=>{setSelectedDate(d);setCalView('week');}}>
                      <View style={[s.monthDayCircle,isSel&&{backgroundColor:t.primary},isTod&&!isSel&&{borderWidth:1.5,borderColor:t.primary}]}>
                        <Text style={[s.monthDayNum,{color:isSel?'#fff':isTod?t.primary:t.text}]}>{i+1}</Text>
                      </View>
                      {has&&<View style={[s.taskDotSm,{backgroundColor:isSel?'#fff':t.primary}]}/>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
          {/* Task count badges */}
          <View style={[s.calBadgeRow,{marginTop:10}]}>
            <TouchableOpacity onPress={() => setStatusFilter(statusFilter === 'ongoing' ? null : 'ongoing')}>
              <View style={[s.calBadge,{backgroundColor:taskStatusColors.ongoing.bg+'20',borderWidth:statusFilter==='ongoing'?2:0,borderColor:taskStatusColors.ongoing.bg}]}>
                <Ionicons name={taskStatusColors.ongoing.icon} size={10} color={taskStatusColors.ongoing.bg}/>
                <Text style={[s.calBadgeText,{color:taskStatusColors.ongoing.bg}]}>{ongoingCount} {taskStatusColors.ongoing.label.toLowerCase()}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStatusFilter(statusFilter === 'upcoming' ? null : 'upcoming')}>
              <View style={[s.calBadge,{backgroundColor:taskStatusColors.upcoming.bg+'20',borderWidth:statusFilter==='upcoming'?2:0,borderColor:taskStatusColors.upcoming.bg}]}>
                <Ionicons name={taskStatusColors.upcoming.icon} size={10} color={taskStatusColors.upcoming.bg}/>
                <Text style={[s.calBadgeText,{color:taskStatusColors.upcoming.bg}]}>{upcomingCount} {taskStatusColors.upcoming.label.toLowerCase()}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStatusFilter(statusFilter === 'due' ? null : 'due')}>
              <View style={[s.calBadge,{backgroundColor:taskStatusColors.due.bg+'20',borderWidth:statusFilter==='due'?2:0,borderColor:taskStatusColors.due.bg}]}>
                <Ionicons name={taskStatusColors.due.icon} size={10} color={taskStatusColors.due.bg}/>
                <Text style={[s.calBadgeText,{color:taskStatusColors.due.bg}]}>{dueCount} {taskStatusColors.due.label.toLowerCase()}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* ════ MAIN SCROLLABLE CONTENT ════ */}
      <ScrollView
        scrollEventThrottle={16} style={s.scroll} contentContainerStyle={[s.content,{paddingTop:insets.top+80,paddingBottom:insets.bottom+100}]} showsVerticalScrollIndicator={false}>

        {/* SEARCH BAR + CALENDAR ICON */}
        <View style={[s.searchRow,{marginTop:12}]}>
          <View style={[s.searchBar,{backgroundColor:`rgba(${t.surfRgb},0.7)`,borderColor:t.border}]}>
            <Ionicons name="search-outline" size={18} color={t.textHint}/>
            <TextInput style={[s.searchText,{color:t.text}]} placeholder="Search tasks..." placeholderTextColor={t.textHint} returnKeyType="search" value={searchQuery} onChangeText={setSearchQuery}/>
            {searchQuery.length>0&&<TouchableOpacity onPress={()=>setSearchQuery('')}><Ionicons name="close-circle" size={16} color={t.textHint}/></TouchableOpacity>}
          </View>
          <TouchableOpacity onPress={()=>setCalView(v=>v==='week'?'month':'week')} style={[s.calIconBtn,{backgroundColor:calView==='month'?t.primary:`rgba(${t.surfRgb},0.7)`,borderColor:calView==='month'?t.primary:t.border}]}>
            <Ionicons name="calendar-outline" size={20} color={calView==='month'?'#fff':t.textSub}/>
          </TouchableOpacity>
        </View>

        {/* ── ALWAYS-VISIBLE WEEK STRIP + TASK BADGES with 3D depth ── */}
        <Skia3DCard width={W-40} height={calView==='month'?320:148} borderRadius={22} elevation="none" style={{marginHorizontal:0}}>
          <View style={[s.weekCard,{backgroundColor:t.isDark?'rgba(16,16,30,0.92)':'rgba(248,248,255,0.92)',borderColor:t.isDark?'rgba(99,102,241,0.2)':'rgba(99,102,241,0.15)',borderWidth:1,borderRadius:22}]}>
            {/* Multi-layer gradient for depth and shine */}
            <LinearGradient colors={[t.isDark?'#6366f125':'#6366f115','transparent',t.isDark?'rgba(139,92,246,0.08)':'rgba(99,102,241,0.05)']} locations={[0,0.5,1]} start={{x:0,y:0}} end={{x:1,y:1}} style={[StyleSheet.absoluteFill,{borderRadius:22}]}/>

          {/* ── Week strip - 7 days, PILL shape like reference image ── */}
          {calView==='week'&&(
            <View style={{paddingHorizontal:8,paddingTop:10,paddingBottom:6}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                {weekDays.map((d,i)=>{
                  const isSel=isSameDay(d,selectedDate);
                  const isTod=isSameDay(d,today);
                  const has=taskDates.some(td=>isSameDay(td,d));
                  return(
                    <TouchableOpacity key={i} onPress={()=>setSelectedDate(d)} activeOpacity={0.75}
                      style={{alignItems:'center',flex:1}}>
                      <Text style={{fontSize:10,fontWeight:'700',color:isSel?t.primary:t.textHint,marginBottom:5,letterSpacing:0.6}}>
                        {DAY_NAMES[d.getDay()].slice(0,1)}
                      </Text>
                      {/* PILL shape - tall rounded rectangle like reference */}
                      <View style={{
                        width:36,
                        height:54,
                        borderRadius:18,
                        alignItems:'center',
                        justifyContent:'center',
                        backgroundColor:isSel?t.primary:isTod?`rgba(99,102,241,0.15)`:`rgba(${t.surfRgb},0.45)`,
                        borderWidth:isTod&&!isSel?2:isSel?0:StyleSheet.hairlineWidth,
                        borderColor:isTod&&!isSel?t.primary:t.border,
                        elevation:0,
                      }}>
                        <Text style={{fontSize:isSel?18:16,fontWeight:isSel?'800':isTod?'700':'600',color:isSel?'#fff':isTod?t.primary:t.text,letterSpacing:-0.3}}>
                          {d.getDate()}
                        </Text>
                        {isTod&&isSel&&<View style={{width:4,height:4,borderRadius:2,backgroundColor:'rgba(255,255,255,0.7)',marginTop:2}}/>}
                      </View>
                      {has&&!isSel&&<View style={{width:4,height:4,borderRadius:2,backgroundColor:t.primary,marginTop:4}}/>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Month grid (replaces week strip) ── */}
          {calView==='month'&&(
            <View style={{paddingBottom:4}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12,paddingHorizontal:8}}>
                <TouchableOpacity onPress={()=>{const m=calMonth===0?11:calMonth-1;setCalMonth(m);if(calMonth===0)setCalYear(y=>y-1);}} style={{padding:8,backgroundColor:`rgba(${t.surfRgb},0.5)`,borderRadius:12}}>
                  <Ionicons name="chevron-back" size={18} color={t.primary}/>
                </TouchableOpacity>
                <Text style={[s.calMonthLabel,{color:t.text,fontSize:16,fontWeight:'700'}]}>{MONTH_NAMES[calMonth]} {calYear}</Text>
                <TouchableOpacity onPress={()=>{const m=calMonth===11?0:calMonth+1;setCalMonth(m);if(calMonth===11)setCalYear(y=>y+1);}} style={{padding:8,backgroundColor:`rgba(${t.surfRgb},0.5)`,borderRadius:12}}>
                  <Ionicons name="chevron-forward" size={18} color={t.primary}/>
                </TouchableOpacity>
              </View>
              <View style={s.monthDayNames}>
                {DAY_SHORT.map((d,i)=><Text key={i} style={[s.monthDayLabel,{color:t.textHint,fontWeight:'700',fontSize:11}]}>{d}</Text>)}
              </View>
              <View style={s.monthGrid}>
                {Array.from({length:startDay}).map((_,i)=><View key={`e${i}`} style={s.monthCell}/>)}
                {Array.from({length:totalDays}).map((_,i)=>{
                  const d=new Date(calYear,calMonth,i+1);
                  const isSel=isSameDay(d,selectedDate);
                  const isTod=isSameDay(d,today);
                  const has=taskDates.some(td=>isSameDay(td,d));
                  return(
                    <TouchableOpacity key={i} style={s.monthCell} onPress={()=>{setSelectedDate(d);setCalView('week');}}>
                      <View style={[s.monthDayCircle,{
                        backgroundColor:isSel?t.primary:isTod?`rgba(99,102,241,0.15)`:`rgba(${t.surfRgb},0.3)`,
                        borderWidth:isTod&&!isSel?2:0,
                        borderColor:t.primary,
                        elevation:0
                      }]}>
                        <Text style={[s.monthDayNum,{color:isSel?'#fff':isTod?t.primary:t.text,fontWeight:isSel||isTod?'700':'600'}]}>{i+1}</Text>
                      </View>
                      {has&&<View style={[s.taskDotSm,{backgroundColor:isSel?'#fff':t.primary}]}/>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Bottom bump with chevron ── */}
          <View style={s.weekCardBump}>
            <View style={[s.calBadgeRow,{flex:1,justifyContent:'flex-start'}]}>
              <TouchableOpacity onPress={() => setStatusFilter(statusFilter === 'ongoing' ? null : 'ongoing')}>
                <View style={[s.calBadge,{backgroundColor:taskStatusColors.ongoing.bg+'20',borderWidth:statusFilter==='ongoing'?2:0,borderColor:taskStatusColors.ongoing.bg}]}>
                  <Ionicons name={taskStatusColors.ongoing.icon} size={9} color={taskStatusColors.ongoing.bg}/>
                  <Text style={[s.calBadgeText,{color:taskStatusColors.ongoing.bg}]}>{ongoingCount} {taskStatusColors.ongoing.label.toLowerCase()}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStatusFilter(statusFilter === 'upcoming' ? null : 'upcoming')}>
                <View style={[s.calBadge,{backgroundColor:taskStatusColors.upcoming.bg+'20',borderWidth:statusFilter==='upcoming'?2:0,borderColor:taskStatusColors.upcoming.bg}]}>
                  <Ionicons name={taskStatusColors.upcoming.icon} size={9} color={taskStatusColors.upcoming.bg}/>
                  <Text style={[s.calBadgeText,{color:taskStatusColors.upcoming.bg}]}>{upcomingCount} {taskStatusColors.upcoming.label.toLowerCase()}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStatusFilter(statusFilter === 'due' ? null : 'due')}>
                <View style={[s.calBadge,{backgroundColor:taskStatusColors.due.bg+'20',borderWidth:statusFilter==='due'?2:0,borderColor:taskStatusColors.due.bg}]}>
                  <Ionicons name={taskStatusColors.due.icon} size={9} color={taskStatusColors.due.bg}/>
                  <Text style={[s.calBadgeText,{color:taskStatusColors.due.bg}]}>{dueCount} {taskStatusColors.due.label.toLowerCase()}</Text>
                </View>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={()=>setCalView(v=>v==='week'?'month':'week')} style={s.bumpChevron}>
              <Ionicons name={calView==='week'?'chevron-down':'chevron-up'} size={16} color={t.textHint}/>
            </TouchableOpacity>
          </View>
          </View>
        </Skia3DCard>

        {/* AI HINT PILL - no extra margin, parent already has paddingHorizontal:20 */}
        <TouchableOpacity onPress={openAIChat} activeOpacity={0.8} style={{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:`rgba(${t.surfRgb},0.6)`,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:t.border,paddingHorizontal:14,paddingVertical:10,marginTop:calView==='month'?8:10,marginBottom:8}}>
          <Image source={require('../../assets/krios-logo.png')} style={{width:20,height:20}} resizeMode="contain"/>
          <Animated.View style={{width:6,height:6,borderRadius:3,backgroundColor:'#6366f1',opacity:pulseAnim}}/>
          <Text style={{flex:1,fontSize:13,fontWeight:'500',color:t.textHint}}>Ask Krios anything...</Text>
          <Ionicons name="chevron-forward" size={14} color={t.textHint}/>
        </TouchableOpacity>

        {/* DATE DIVIDER LINE — like reference image */}
        <View style={s.dateDivider}>
          <View style={[s.dateDividerLine,{backgroundColor:t.isDark?t.primary:'#6366f1',opacity:t.isDark?0.5:0.35}]}/>
          <Text style={[s.dateDividerText,{color:t.primary}]}>
            {isSameDay(selectedDate,today)?'Today':''}
            {' '}{selectedDate.getDate()} {MONTH_NAMES[selectedDate.getMonth()].slice(0,3)}
          </Text>
          <View style={[s.dateDividerLine,{backgroundColor:t.border,flex:1}]}/>
        </View>

        {/* TIMELINE TASK LIST */}
        {loading?(
          <View style={[s.emptyState,{paddingHorizontal:20}]}>
            <Text style={[s.emptySubtitle,{color:t.textSub}]}>Loading tasks...</Text>
          </View>
        ):tasksForDate.length===0?(
          <View style={[s.emptyState,{paddingHorizontal:20}]}>
            <View style={[s.emptyIcon,{borderColor:t.border}]}>
              <Ionicons name="checkmark-done-circle-outline" size={32} color={t.textHint}/>
            </View>
            <Text style={[s.emptyTitle,{color:t.text}]}>All clear!</Text>
            <Text style={[s.emptySubtitle,{color:t.textSub}]}>No tasks for this day yet.{'\n'}Tap + to add your first task.</Text>
            <TouchableOpacity onPress={openAddTask} style={[s.emptyAddBtn,{backgroundColor:t.primary}]}>
              <Ionicons name="add" size={18} color="#fff"/>
              <Text style={s.emptyAddText}>Add Task</Text>
            </TouchableOpacity>
          </View>
        ):(
          <View style={s.timelineSection}>
            {tasksForDate.map((task,idx)=>{
              const p=PRIORITY[task.priority||'medium'] ?? PRIORITY['medium'];
              const bc=BUCKET_COLOR[task.bucket||'inbox'];
              const timeStr=task.dueDate?new Date(task.dueDate).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):idx===0?'Now':'Later';
              const statusLabel=task.isCompleted?'Done':'Active';
              const statusColor=task.isCompleted?t.success:t.primary;
              // Priority-based sizing (like reference image)
              const priority = task.priority || 'medium';
              const cardScale = priority === 'high' ? 1.08 : priority === 'low' ? 0.94 : 1;
              const cardPadding = priority === 'high' ? 18 : priority === 'low' ? 10 : 14;
              const titleSize = priority === 'high' ? 15 : priority === 'low' ? 13 : 14;
              const borderWidth = priority === 'high' ? 1.5 : StyleSheet.hairlineWidth;
              const shadowIntensity = priority === 'high' ? 0.12 : priority === 'low' ? 0.04 : 0.08;
              return(
                <TouchableOpacity key={task.id} onPress={()=>openTaskSheet(task)} onLongPress={() => {
            Alert.alert('Task Options', undefined, [
              { text: 'Edit', onPress: () => openTaskSheet(task) },
              { text: 'Delete', onPress: () => handleDeleteTask(task.id), style: 'destructive' },
              { text: 'Cancel', style: 'cancel' }
            ]);
          }} activeOpacity={0.82} style={s.timelineRow}>
                  {/* Time axis */}
                  <View style={s.timelineTime}>
                    <Text style={[s.timelineTimeText,{fontSize:priority==='high'?12:11}]}>{timeStr}</Text>
                    <View style={[s.timelineLine,{flex:1}]}/>
                  </View>
                  {/* Card with priority-based sizing */}
                  <View style={[s.timelineCard,{
                    backgroundColor:t.isDark
                      ?`rgba(18,18,32,${priority==='high'?0.95:priority==='low'?0.75:0.85})`
                      :'#ffffff',
                    borderColor:priority==='high'?p.color:'rgba(99,102,241,0.12)',
                    borderWidth:StyleSheet.hairlineWidth,
                    overflow:'hidden',
                    transform:[{scale:cardScale}],
                    padding:cardPadding,
                    opacity:t.isDark?1:0.92,
                  }]}>
                    {/* Priority color accent - centered vertically, strong glow */}
                    <View style={{position:'absolute',left:0,top:'25%',bottom:'25%',width:priority==='high'?5:priority==='low'?3:4,backgroundColor:p.color,borderRadius:2,shadowColor:p.color,shadowOffset:{width:4,height:0},shadowOpacity:0.9,shadowRadius:8,elevation:4}}/>
                    <View style={{paddingLeft:priority==='high'?12:8}}>
                      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:priority==='high'?8:priority==='low'?4:6}}>
                        <View style={[s.tlStatusBadge,{backgroundColor:statusColor+'20',paddingHorizontal:priority==='high'?10:8}]}>
                          <Text style={[s.tlStatusText,{color:statusColor,fontSize:priority==='high'?11:10}]}>{statusLabel}</Text>
                        </View>
                        <TouchableOpacity onPress={()=>handleToggleComplete(task)} style={[s.checkBtn,{
                          borderColor:task.isCompleted?p.color:t.border,
                          backgroundColor:task.isCompleted?p.color:'transparent',
                          width:priority==='high'?26:priority==='low'?20:22,
                          height:priority==='high'?26:priority==='low'?20:22,
                          borderRadius:priority==='high'?13:priority==='low'?10:11,
                          borderWidth:priority==='high'?2.5:2
                        }]}>
                          {task.isCompleted&&<Ionicons name="checkmark" size={priority==='high'?14:priority==='low'?10:12} color="#fff"/>}
                        </TouchableOpacity>
                      </View>
                      <Text style={[s.tlCardTitle,{
                        color:t.text,
                        textDecorationLine:task.isCompleted?'line-through':'none',
                        opacity:task.isCompleted?0.5:1,
                        fontSize:titleSize,
                        fontWeight:priority==='high'?'700':'600'
                      }]}>{task.title}</Text>
                      <View style={[s.tlCardMeta,{marginTop:priority==='high'?5:priority==='low'?2:3}]}>
                        <View style={[s.priorityDot,{
                          backgroundColor:p.color,
                          width:priority==='high'?7:priority==='low'?5:6,
                          height:priority==='high'?7:priority==='low'?5:6,
                          borderRadius:priority==='high'?3.5:priority==='low'?2.5:3
                        }]}/>
                        <Text style={[s.tlCardMetaText,{color:t.textHint,fontSize:priority==='high'?12:11}]}>{p.label}</Text>
                        {task.bucket&&<Text style={[s.tlCardMetaText,{color:bc,fontSize:priority==='high'?12:11}]}> · {task.bucket}</Text>}
                        {(threadMap[task.id]?.length||0)>1&&(
                          <View style={[s.threadBadge,{backgroundColor:t.primary,marginLeft:4}]}>
                            <Text style={s.threadBadgeText}>{threadMap[task.id].length-1}</Text>
                          </View>
                        )}
                      </View>
                      {task.description&&priority!=='low'&&(
                        <Text style={[s.taskDesc,{color:t.textSub,marginTop:6}]} numberOfLines={priority==='high'?3:2}>{task.description}</Text>
                      )}
                    </View>
                    {/* > arrow — signals tappable, like reference */}
                    <View style={[s.cardArrow,{borderColor:t.border}]}>
                      <Ionicons name="chevron-forward" size={priority==='high'?16:14} color={t.textHint}/>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            {done.length>0&&(
              <View style={{marginTop:12,opacity:0.6}}>
                <Text style={[s.timelineDateLabel,{color:t.textSub,fontSize:12,marginBottom:8}]}>Completed ({done.length})</Text>
                {done.slice(0,2).map(task=>(
                  <View key={task.id} style={s.timelineRow}>
                    <View style={s.timelineTime}>
                      <Text style={[s.timelineTimeText,{textDecorationLine:'line-through'}]}>Done</Text>
                    </View>
                    <View style={[s.timelineCard,{backgroundColor:t.isDark?'rgba(22,22,40,0.65)':'#ffffff',borderColor:t.isDark?'rgba(99,102,241,0.08)':'transparent',borderWidth:StyleSheet.hairlineWidth,opacity:t.isDark?1:0.85}]}>
                      <Text style={[s.tlCardTitle,{color:t.textSub,textDecorationLine:'line-through',fontSize:13}]}>{task.title}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ════ STICKY HEADER ════ */}
      <View style={[s.stickyHeader,{paddingTop:insets.top+16,backgroundColor:'transparent',borderBottomColor:'transparent'}]}>
        {/* Header bg that blends with app bg */}
        <LinearGradient
          colors={t.isDark
            ?['rgba(10,10,22,0.97)','rgba(10,10,22,0.97)','rgba(10,10,22,0.0)'] as const
            :['rgba(248,248,255,0.97)','rgba(248,248,255,0.97)','rgba(248,248,255,0.0)'] as const}
          locations={[0,0.75,1]} start={{x:0,y:0}} end={{x:0,y:1}}
          style={StyleSheet.absoluteFill}
        />
        {/* Top glow bloom - strong at very top, fades into app bg */}
        <LinearGradient
          colors={t.isDark
            ? ['rgba(99,102,241,0.45)','rgba(139,92,246,0.20)','rgba(10,10,22,0.0)']
            : ['rgba(99,102,241,0.15)','rgba(139,92,246,0.06)','rgba(248,248,255,0.0)']}
          locations={[0,0.45,1]} start={{x:0.5,y:0}} end={{x:0.5,y:1}}
          style={StyleSheet.absoluteFill}
        />
        {/* Horizontal shimmer line at top edge */}
        <LinearGradient
          colors={t.isDark
            ? ['transparent','rgba(139,92,246,0.7)','rgba(99,102,241,0.9)','rgba(139,92,246,0.7)','transparent']
            : ['transparent','rgba(99,102,241,0.3)','rgba(139,92,246,0.45)','rgba(99,102,241,0.3)','transparent']}
          locations={[0,0.2,0.5,0.8,1]}
          start={{x:0,y:0}} end={{x:1,y:0}}
          style={{position:'absolute',top:insets.top,left:0,right:0,height:1.5}}
        />
        <View style={s.header}>
          <TouchableOpacity onPress={()=>router.push('/(home)/profile')} style={[s.avatarCircle,{backgroundColor:t.primary,overflow:'hidden'}]}>
            {user?.avatar ? (
              <Image source={{uri: user.avatar}} style={{width:'100%',height:'100%',borderRadius:999}} />
            ) : (
              <Text style={s.avatarInitial}>{(user?.username||'K')[0].toUpperCase()}</Text>
            )}
          </TouchableOpacity>
          <View style={{flex:1,marginLeft:12}}>
            <Text style={[s.greeting,{color:t.textSub,fontSize:11}]}>{greeting} 👋</Text>
            <Text style={[s.userName,{color:t.text}]}>{user?.username||'Friend'}</Text>
          </View>
          <TouchableOpacity onPress={cycleTheme} style={[s.iconBtn,{backgroundColor:`rgba(${t.surfRgb},0.7)`,borderColor:t.border}]}>
            <Ionicons name={themeIcon as any} size={18} color={themeColor}/>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>router.push('/(home)/settings')} style={[s.iconBtn,{backgroundColor:`rgba(${t.surfRgb},0.7)`,borderColor:t.border,marginLeft:8}]}>
            <Ionicons name="settings-outline" size={18} color={t.textSub}/>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom tab bar is now rendered globally in (home)/_layout.tsx */}
      {false && navStyle==='bottom'&&(
        <>
        <View />
        <View>
          {/* Home */}
          <TouchableOpacity style={s.tabItem} onPress={()=>{}}>
            <Ionicons name="home" size={22} color={t.primary}/>
            <View style={[s.tabActiveDot,{backgroundColor:t.primary}]}/>
          </TouchableOpacity>
          {/* Rooms */}
          <TouchableOpacity style={s.tabItem} onPress={()=>router.push('/(home)/rooms')}>
            <Ionicons name="planet-outline" size={22} color={t.textHint}/>
          </TouchableOpacity>
          {/* Center FAB */}
          <View style={{width:72, alignItems:'center', marginTop:-24}}>
            <TouchableOpacity onPress={openAddTask} activeOpacity={0.85}
              style={[s.fab,{shadowColor:t.primary,shadowOffset:{width:0,height:12},shadowOpacity:0.6,shadowRadius:24,elevation:20}]}>
              <LinearGradient colors={['#818cf8','#6366f1','#4f46e5']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.fabGrad}>
                <Ionicons name="add" size={28} color="#fff"/>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          {/* Messages */}
          <TouchableOpacity style={s.tabItem} onPress={()=>router.push('/(home)/messages')}>
            <View>
              <Ionicons name="chatbubbles-outline" size={22} color={t.textHint}/>
              {unreadCount > 0 && (
                <View style={{position:'absolute',top:-4,right:-8,backgroundColor:'#6366f1',borderRadius:8,minWidth:16,height:16,paddingHorizontal:4,alignItems:'center',justifyContent:'center'}}>
                  <Text style={{color:'#fff',fontSize:9,fontWeight:'800'}}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          {/* Profile */}
          <TouchableOpacity style={s.tabItem} onPress={()=>router.push('/(home)/profile')}>
            <Ionicons name="person-outline" size={22} color={t.textHint}/>
          </TouchableOpacity>
        </View>
        </>
      )}

      {/* ════ FOCUS SIGN BOARD — slides in from right edge ════ */}
      {focusActive&&(
        <>
          {/* Dim overlay */}
          <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFillObject,{backgroundColor:'#000',opacity:dimAnim,zIndex:60}]}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={()=>{if(!focusRunning)closeFocus();}}/>
          </Animated.View>
          {/* Sign board */}
          <Animated.View style={[s.signBoard,{backgroundColor:t.isDark?'rgba(12,12,24,0.98)':'rgba(250,250,255,0.98)',borderColor:'#6366f155',transform:[{translateX:signAnim}],top:H*0.2}]}>
            <LinearGradient colors={['#6366f122','#8b5cf611']} start={{x:0,y:0}} end={{x:0,y:1}} style={StyleSheet.absoluteFill}/>
            <View style={s.signHandle}/>
            <Text style={[s.signLabel,{color:t.textSub}]}>FOCUS</Text>
            <Text style={[s.signTimer,{color:t.text}]}>{fMins}:{fSecs}</Text>
            <Text style={[s.signTask,{color:t.textSub}]} numberOfLines={2}>
              {tasksForDate.find(t=>!t.isCompleted)?.title||'Deep work session'}
            </Text>
            <TouchableOpacity onPress={toggleFocusTimer} style={[s.signPlayBtn,{backgroundColor:focusRunning?'rgba(239,68,68,0.15)':'rgba(99,102,241,0.15)',borderColor:focusRunning?'#ef444444':'#6366f144'}]}>
              <Ionicons name={focusRunning?'pause':'play'} size={22} color={focusRunning?'#ef4444':t.primary}/>
            </TouchableOpacity>
            <TouchableOpacity onPress={closeFocus} style={s.signClose}>
              <Ionicons name="close" size={14} color={t.textHint}/>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}

      {/* ════ TOAST ════ */}
      <Animated.View style={[s.toast,{opacity:toastAnim,bottom:insets.bottom+90}]}>
        <Text style={s.toastText}>{toast}</Text>
      </Animated.View>

      {/* ════ AI CLARIFICATION SHEET ════ */}
      <AIClarificationSheet
        visible={showClarification}
        taskTitle={pendingTask?.title || ''}
        questions={clarificationQuestions}
        onSubmit={handleClarificationSubmit}
        onSkip={handleClarificationSkip}
      />

      {/* ════ UNDO DELETE TOAST ════ */}
      {undoTask&&(
        <Animated.View style={[s.undoToast,{opacity:undoAnim,transform:[{translateY:undoAnim.interpolate({inputRange:[0,1],outputRange:[20,0]})}],bottom:insets.bottom+90,backgroundColor:t.isDark?'rgba(20,20,36,0.97)':'rgba(248,248,255,0.97)',borderColor:t.border}]}>
          <Ionicons name="trash-outline" size={15} color="#ef4444"/>
          <Text style={[s.toastText,{color:t.text,flex:1}]} numberOfLines={1}>Deleted: {undoTask.title}</Text>
          <TouchableOpacity onPress={async()=>{
            const restored = await taskService.createTask({title:undoTask.title,priority:undoTask.priority,dueDate:undoTask.dueDate});
            setTasks(prev=>[restored,...prev]);
            setUndoTask(null);
            undoAnim.setValue(0);
            showToast('Task restored!');
          }} style={[s.undoBtn,{backgroundColor:t.primary}]}>
            <Text style={{color:'#fff',fontSize:12,fontWeight:'700'}}>Undo</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ════ ADD TASK SHEET — dark glass card with enhanced Skia glow ════ */}
      <Modal visible={showAddTask} transparent animationType="fade" onRequestClose={closeAddTask}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View pointerEvents="auto" style={[s.sheet,{transform:[{translateY:addTaskAnim}]}]}>
            <Pressable style={[StyleSheet.absoluteFillObject,{backgroundColor:'rgba(0,0,0,0.6)'}]} onPress={closeAddTask}/>
            <View style={[s.addTaskCard,{backgroundColor:t.isDark?'rgba(10,10,22,0.98)':'rgba(248,248,255,0.98)',borderColor:'#6366f133'}]}>
              {/* Enhanced gradient overlay */}
              <LinearGradient colors={['#6366f122','#8b5cf615','transparent']} start={{x:0.5,y:0}} end={{x:0.5,y:1}} style={[StyleSheet.absoluteFill,{borderRadius:28}]}/>
              
              {/* Multiple glow layers for depth */}
              <View style={[s.addTaskGlow,{backgroundColor:'rgba(99,102,241,0.35)',filter:'blur(40px)'}]}/>
              <View style={[s.addTaskGlow,{backgroundColor:'rgba(139,92,246,0.25)',top:-30,left:'60%',width:180,filter:'blur(35px)'}]}/>
              <View style={[s.addTaskGlow,{backgroundColor:'rgba(236,72,153,0.15)',top:-50,left:'30%',width:150,height:80,filter:'blur(30px)'}]}/>
              <View style={s.addTaskHandleRow}>
                <View style={s.addTaskHandle}/>
              </View>
              <View style={[s.addTaskHeader,{borderBottomColor:`rgba(${t.surfRgb},0.5)`}]}>
                <View>
                  <Text style={[s.addTaskBigTitle,{color:t.text}]}>New Task</Text>
                  <Text style={[s.addTaskSubtitle,{color:t.textSub}]}>Add it to your plan</Text>
                </View>
                <TouchableOpacity onPress={closeAddTask} style={[s.addTaskClose,{backgroundColor:`rgba(${t.surfRgb},0.6)`,borderColor:t.border}]}>
                  <Ionicons name="close" size={18} color={t.text}/>
                </TouchableOpacity>
              </View>
              <KriosDatePicker
                visible={showDatePicker}
                initialDate={newTaskDue}
                onConfirm={(date)=>{
                  setNewTaskDue(date);
                  setNewTaskTime(`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`);
                  setShowDatePicker(false);
                }}
                onCancel={()=>setShowDatePicker(false)}
              />
              <ScrollView contentContainerStyle={{padding:20,gap:16,paddingBottom:40}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <TextInput style={[s.addTaskInput,{backgroundColor:`rgba(${t.surfRgb},0.5)`,borderColor:t.border,color:t.text}]} value={newTaskTitle} onChangeText={setNewTaskTitle} placeholder="What needs to be done?" placeholderTextColor={t.textHint} autoFocus={showAddTask} multiline returnKeyType="done"/>
                <Text style={[s.addTaskLabel,{color:t.textSub}]}>WHEN</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
                  {getWeekDays(today).map((d,i)=>{
                    const isSel=isSameDay(d,newTaskDue);
                    const isTod=isSameDay(d,today);
                    return(
                      <TouchableOpacity key={i} onPress={()=>setNewTaskDue(d)} style={[s.dueDatePill,{backgroundColor:isSel?t.primary:`rgba(${t.surfRgb},0.5)`,borderColor:isSel?t.primary:t.border}]}>
                        <Text style={{fontSize:9,color:isSel?'#fff':t.textHint,fontWeight:'600'}}>{DAY_NAMES[d.getDay()].slice(0,3).toUpperCase()}</Text>
                        <Text style={{fontSize:18,color:isSel?'#fff':t.text,fontWeight:'800'}}>{d.getDate()}</Text>
                        {isTod&&<View style={{width:4,height:4,borderRadius:2,backgroundColor:isSel?'#fff':t.primary}}/>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <Text style={[s.addTaskLabel,{color:t.textSub}]}>DATE & TIME</Text>
                <TouchableOpacity
                  onPress={()=>setShowDatePicker(true)}
                  style={[s.chip,{borderColor:t.primary,backgroundColor:`rgba(99,102,241,0.12)`,paddingHorizontal:14,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:6}]}>
                  <Ionicons name="calendar-outline" size={16} color={t.primary}/>
                  <Text style={{color:t.primary,fontSize:13,fontWeight:'600'}}>
                    {newTaskDue.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} · {newTaskTime}
                  </Text>
                </TouchableOpacity>
                <Text style={[s.addTaskLabel,{color:t.textSub}]}>PRIORITY</Text>
                <View style={s.chipRow}>
                  {(['low','medium','high','urgent'] as const).map(p=>(
                    <TouchableOpacity key={p} onPress={()=>setNewTaskPriority(p)} style={[s.chip,{borderColor:newTaskPriority===p?PRIORITY[p].color:t.border,backgroundColor:newTaskPriority===p?`${PRIORITY[p].color}22`:'transparent'}]}>
                      <View style={[s.priorityDot,{backgroundColor:PRIORITY[p].color}]}/>
                      <Text style={[s.chipText,{color:newTaskPriority===p?PRIORITY[p].color:t.textSub}]}>{PRIORITY[p].label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={handleCreateTask} disabled={!newTaskTitle.trim()} style={[s.addTaskSubmit,{backgroundColor:newTaskTitle.trim()?t.primary:'rgba(99,102,241,0.3)',marginBottom:insets.bottom+8}]}>
                  <Text style={s.addTaskSubmitText}>Add Task</Text>
                  <Ionicons name="add-circle" size={18} color="#fff"/>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}
const s = StyleSheet.create({
  root:              { flex:1 },
  scroll:            { flex:1 },
  content:           { paddingHorizontal:20, gap:12 },

  // Sticky Header
  stickyHeader:      { position:'absolute', top:0, left:0, right:0, zIndex:100, paddingHorizontal:20, paddingBottom:16, borderBottomWidth:0 },
  
  // Header
  header:            { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:4 },
  greeting:          { fontSize:12, fontWeight:'500', letterSpacing:0.3, opacity:0.7 },
  userName:          { fontSize:26, fontWeight:'800', letterSpacing:-0.8, marginTop:1 },
  themeBtn:          { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:7, borderRadius:20, borderWidth:1 },
  themeBtnText:      { fontSize:12, fontWeight:'600' },

  // Stats
  statsRow:          { flexDirection:'row', gap:8 },
  statCard:          { flex:1, flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:10, borderRadius:14, borderWidth:StyleSheet.hairlineWidth, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:6, elevation:2 },
  statNum:           { fontSize:18, fontWeight:'800', letterSpacing:-0.5 },
  statLbl:           { fontSize:10, fontWeight:'500', opacity:0.65 },

  // AI Pill
  aiPill:            { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:14, paddingVertical:12, borderRadius:20, borderWidth:1, overflow:'hidden', shadowColor:'#6366f1', shadowOffset:{width:0,height:4}, shadowOpacity:0.15, shadowRadius:12, elevation:4 },
  aiPillDot:         { width:7, height:7, borderRadius:3.5 },
  aiAvatarSmall:     { alignItems:'center', justifyContent:'center', borderRadius:14 },
  aiPillText:        { flex:1, fontSize:13, fontWeight:'500', lineHeight:18 },

  // Card
  card:              { borderRadius:20, borderWidth:StyleSheet.hairlineWidth, padding:16, shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.07, shadowRadius:14, elevation:3 },

  // Calendar
  calTopRow:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
  calDayOfWeek:      { fontSize:10, fontWeight:'700', letterSpacing:1.2, textTransform:'uppercase', marginBottom:2 },
  calDateBig:        { fontSize:17, fontWeight:'700', letterSpacing:-0.3 },
  focusBtn:          { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:5, borderRadius:12, borderWidth:1 },
  focusBtnText:      { fontSize:11, fontWeight:'600' },

  // Week strip
  // Always-visible week card
  weekCard:           { borderRadius:22, borderWidth:0.5, overflow:'visible', marginBottom:12, paddingTop:14, paddingHorizontal:10 },
  weekStrip:         { flexDirection:'row', justifyContent:'space-between', marginBottom:6, gap:4 },
  weekPill:          { alignItems:'center', justifyContent:'center', borderRadius:18, paddingVertical:10, paddingHorizontal:4, flex:1, gap:3 },
  weekPillDay:       { fontSize:9, fontWeight:'800', letterSpacing:1 },
  weekPillNum:       { fontWeight:'800', letterSpacing:-0.5 },
  weekCardBump:      { flexDirection:'row', alignItems:'center', marginTop:-4, borderTopWidth:0.5, paddingTop:2, paddingBottom:4 },
  bumpChevron:       { width:32, height:32, borderRadius:16, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(128,128,128,0.1)' },
  weekCell:          { alignItems:'center', gap:4, flex:1 },
  weekDayLabel:      { fontSize:9, letterSpacing:0.8, fontWeight:'700' },
  weekDayPill:       { width:44, height:52, borderRadius:14, alignItems:'center', justifyContent:'center' },
  weekDayNum:        { fontSize:20, fontWeight:'800' },
  taskDot:           { width:5, height:5, borderRadius:2.5 },
  taskDotSm:         { width:4, height:4, borderRadius:2 },

  // Month grid
  monthDayNames:     { flexDirection:'row', marginBottom:4 },
  monthDayLabel:     { flex:1, textAlign:'center', fontSize:10, fontWeight:'600', textTransform:'uppercase' },
  monthGrid:         { flexDirection:'row', flexWrap:'wrap' },
  monthCell:         { width:'14.28%', alignItems:'center', paddingVertical:2 },
  monthDayCircle:    { width:28, height:28, borderRadius:14, alignItems:'center', justifyContent:'center' },
  monthDayNum:       { fontSize:12, fontWeight:'600' },
  monthNavBtn:       { width:32, height:32, borderRadius:16, alignItems:'center', justifyContent:'center', borderWidth:1 },
  calMonthLabel:     { fontSize:13, fontWeight:'600', flex:1, textAlign:'center', alignSelf:'center' },
  calBadgeRow:       { flexDirection:'row', gap:8, marginTop:0 },
  calBadge:          { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:4, borderRadius:10 },
  calBadgeText:      { fontSize:11, fontWeight:'500' },

  // Section
  sectionRow:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  sectionTitle:      { fontSize:15, fontWeight:'700', letterSpacing:-0.2 },
  addBtn:            { width:30, height:30, borderRadius:15, alignItems:'center', justifyContent:'center' },

  // Empty
  emptyCard:         { borderRadius:16, borderWidth:StyleSheet.hairlineWidth, padding:24, alignItems:'center', justifyContent:'center', gap:4 },
  emptyText:         { fontSize:13, fontWeight:'500', textAlign:'center' },

  // Task card
  taskCard:          { borderRadius:18, borderWidth:0, borderColor:'transparent', flexDirection:'row', overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:3}, shadowOpacity:0.08, shadowRadius:10, elevation:2 },
  taskBucketBar:     { width:4 },
  taskCardInner:     { flex:1, padding:14 },
  taskCardTop:       { flexDirection:'row', alignItems:'center', gap:10 },
  checkBtn:          { width:24, height:24, borderRadius:12, borderWidth:2, alignItems:'center', justifyContent:'center' },
  taskTitle:         { fontSize:14, fontWeight:'600', letterSpacing:-0.2, lineHeight:20 },
  taskMeta:          { flexDirection:'row', alignItems:'center', flexWrap:'wrap', marginTop:3 },
  taskMetaText:      { fontSize:11 },
  priorityDot:       { width:6, height:6, borderRadius:3 },
  taskDesc:          { fontSize:12, lineHeight:17, marginTop:5, opacity:0.7 },
  taskChevronArea:   { alignItems:'center', gap:3 },
  threadBadge:       { minWidth:16, height:16, borderRadius:8, alignItems:'center', justifyContent:'center', paddingHorizontal:3 },
  threadBadgeText:   { color:'#fff', fontSize:9, fontWeight:'700' },

  // Bottom tab bar with curved ends and shading
  tabBar:            { position:'absolute', bottom:0, left:0, right:0, flexDirection:'row', alignItems:'center', borderTopWidth:StyleSheet.hairlineWidth, paddingTop:4, borderTopLeftRadius:28, borderTopRightRadius:28, overflow:'visible' },
  tabItem:           { flex:1, alignItems:'center', paddingBottom:14, gap:2 },
  tabActiveDot:      { width:4, height:4, borderRadius:2 },
  tabIconWrap:       { width:40, height:32, borderRadius:16, alignItems:'center', justifyContent:'center' },
  tabLabel:          { fontSize:10 },
  fabWrap:           { width:72, alignItems:'center', marginTop:-24, paddingBottom:6 },
  fab:               { width:56, height:56, borderRadius:28, overflow:'hidden', shadowColor:'#6366f1', shadowOffset:{width:0,height:12}, shadowOpacity:0.6, shadowRadius:24, elevation:20 },
  // Header styles
  avatarCircle:      { width:44, height:44, borderRadius:22, alignItems:'center', justifyContent:'center' },
  avatarInitial:     { fontSize:18, fontWeight:'800', color:'#fff' },
  iconBtn:           { width:36, height:36, borderRadius:18, alignItems:'center', justifyContent:'center', borderWidth:StyleSheet.hairlineWidth },
  calChevronRow:     { alignItems:'center', paddingVertical:8 },
  fabGrad:           { flex:1, alignItems:'center', justifyContent:'center', borderRadius:29 },

  // Focus sign board
  signBoard:         { position:'absolute', right:0, width:140, borderTopLeftRadius:24, borderBottomLeftRadius:24, borderWidth:1, borderRightWidth:0, padding:20, alignItems:'center', gap:12, zIndex:70, shadowColor:'#6366f1', shadowOffset:{width:-4,height:0}, shadowOpacity:0.3, shadowRadius:20, elevation:20, overflow:'hidden' },
  signHandle:        { width:4, height:40, borderRadius:2, backgroundColor:'rgba(99,102,241,0.3)', marginBottom:4 },
  signLabel:         { fontSize:10, fontWeight:'800', letterSpacing:2, textTransform:'uppercase' },
  signTimer:         { fontSize:36, fontWeight:'800', letterSpacing:-1 },
  signTask:          { fontSize:11, fontWeight:'500', textAlign:'center', lineHeight:16, opacity:0.7 },
  signPlayBtn:       { width:52, height:52, borderRadius:26, alignItems:'center', justifyContent:'center', borderWidth:1.5 },
  signClose:         { position:'absolute', top:10, right:10 },

  // Toast
  toast:             { position:'absolute', left:32, right:32, backgroundColor:'rgba(30,30,46,0.95)', borderRadius:14, paddingVertical:10, paddingHorizontal:16, alignItems:'center', zIndex:999 },
  toastText:         { color:'#fff', fontSize:13, fontWeight:'600' },
  undoToast:         { position:'absolute', left:16, right:16, borderRadius:16, borderWidth:StyleSheet.hairlineWidth, paddingHorizontal:14, paddingVertical:10, flexDirection:'row', alignItems:'center', gap:10, shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.15, shadowRadius:12, elevation:8, zIndex:999 },
  undoBtn:           { paddingHorizontal:14, paddingVertical:6, borderRadius:12 },

  // Sheets
  sheet:             { position:'absolute', top:0, left:0, right:0, height:'100%', zIndex:80 },
  sheetHeader:       { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingBottom:14, borderBottomWidth:StyleSheet.hairlineWidth },
  sheetBackBtn:      { width:36, height:36, borderRadius:18, alignItems:'center', justifyContent:'center', borderWidth:1 },
  sheetTitle:        { fontSize:16, fontWeight:'700', letterSpacing:-0.3 },
  sheetSubtitle:     { fontSize:11, fontWeight:'500', opacity:0.7, marginTop:1 },
  sheetDoneBtn:      { width:36, height:36, borderRadius:18, alignItems:'center', justifyContent:'center' },
  threadContent:     { padding:16, gap:10 },
  threadRow:         { maxWidth:'80%', gap:3 },
  threadLeft:        { alignSelf:'flex-start' },
  threadRight:       { alignSelf:'flex-end' },
  threadBubble:      { borderRadius:16, borderWidth:1, padding:12 },
  sheetInputBar:     { borderTopWidth:StyleSheet.hairlineWidth, padding:12 },
  quickChip:         { paddingHorizontal:10, paddingVertical:5, borderRadius:12, borderWidth:1 },
  sheetInput:        { borderRadius:14, borderWidth:1, paddingHorizontal:14, paddingVertical:10, fontSize:14, minHeight:44, maxHeight:100 },
  sendBtn:           { width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center' },

  // Add task sheet with enhanced depth/glow
  addTaskCard:       { position:'absolute', bottom:0, left:0, right:0, borderTopLeftRadius:28, borderTopRightRadius:28, borderWidth:1, borderBottomWidth:0, overflow:'hidden', maxHeight:'88%', shadowColor:'#6366f1', shadowOffset:{width:0,height:-8}, shadowOpacity:0.25, shadowRadius:30, elevation:30 },
  addTaskGlow:       { position:'absolute', top:-40, left:'50%', width:200, height:100, borderRadius:100, backgroundColor:'rgba(99,102,241,0.35)', transform:[{translateX:-100}], opacity:0.8 },
  addTaskHandleRow:  { paddingTop:12, alignItems:'center' },
  addTaskHandle:     { width:40, height:4, borderRadius:2, backgroundColor:'rgba(128,128,128,0.3)' },
  addTaskHeader:     { flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between', paddingHorizontal:20, paddingBottom:14, borderBottomWidth:StyleSheet.hairlineWidth },
  addTaskBigTitle:   { fontSize:22, fontWeight:'800', letterSpacing:-0.5 },
  addTaskSubtitle:   { fontSize:13, opacity:0.6, marginTop:2 },
  addTaskClose:      { width:34, height:34, borderRadius:17, alignItems:'center', justifyContent:'center', borderWidth:1 },
  addTaskInput:      { borderRadius:16, borderWidth:1, paddingHorizontal:16, paddingVertical:14, fontSize:16, minHeight:52, fontWeight:'500' },
  addTaskLabel:      { fontSize:10, fontWeight:'700', letterSpacing:1, textTransform:'uppercase', marginBottom:-8 },
  chipRow:           { flexDirection:'row', flexWrap:'wrap', gap:8 },
  chip:              { paddingHorizontal:14, paddingVertical:7, borderRadius:20, borderWidth:1.5, flexDirection:'row', alignItems:'center', gap:6 },
  chipText:          { fontSize:12, fontWeight:'600' },
  dueDatePill:       { alignItems:'center', gap:2, paddingHorizontal:10, paddingVertical:10, borderRadius:18, borderWidth:1.5, minWidth:52 },
  addTaskSubmit:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:16, borderRadius:20, marginTop:4 },
  addTaskSubmitText: { color:'#fff', fontSize:16, fontWeight:'700' },
  // Search bar
  searchRow:         { flexDirection:'row', alignItems:'center', gap:10, paddingTop:8, paddingBottom:16 },
  searchBar:         { flex:1, flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:14, height:44, borderRadius:22, borderWidth:StyleSheet.hairlineWidth },
  searchText:        { flex:1, fontSize:14 },
  calIconBtn:        { width:42, height:42, borderRadius:21, alignItems:'center', justifyContent:'center', borderWidth:StyleSheet.hairlineWidth },
  calDropdown:       { position:'absolute', left:0, right:0, zIndex:50, borderBottomLeftRadius:28, borderBottomRightRadius:28, overflow:'hidden' },
  calDropInner:      { padding:20, paddingBottom:16 },
  calDropHeader:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:16 },
  calDropDate:       { fontSize:15, fontWeight:'700', letterSpacing:-0.3 },
  calDropClose:      { width:32, height:32, borderRadius:16, alignItems:'center', justifyContent:'center' },
  timelineSection:   { gap:2 },
  timelineDateLabel: { fontSize:16, fontWeight:'700', letterSpacing:-0.3, marginBottom:16 },
  timelineRow:       { flexDirection:'row', marginBottom:14 },
  timelineTime:      { width:52, paddingTop:3 },
  timelineTimeText:  { fontSize:11, fontWeight:'600', color:'#64748b' },
  timelineLine:      { width:1, backgroundColor:'rgba(100,116,139,0.2)', marginRight:14, marginTop:6 },
  // Date divider — subtle horizontal line with date chip
  dateDivider:       { flexDirection:'row', alignItems:'center', gap:6, marginBottom:10, marginTop:4 },
  dateDividerLine:   { height:1, flex:1 },
  dateDividerText:   { fontSize:11, fontWeight:'600', letterSpacing:0.3, paddingHorizontal:6 },
  // Card arrow
  cardArrow:         { width:24, alignItems:'center', justifyContent:'center', paddingLeft:4 },
  timelineCard:      { flex:1, borderRadius:14, padding:12, borderWidth:0, borderColor:'transparent', overflow:'hidden', flexDirection:'row', alignItems:'center', shadowColor:'#000', shadowOffset:{width:0,height:3}, shadowOpacity:0.08, shadowRadius:10, elevation:2 },
  tlCardTitle:       { fontSize:14, fontWeight:'600', letterSpacing:-0.2, marginBottom:4 },
  tlCardMeta:        { flexDirection:'row', alignItems:'center', gap:6 },
  tlCardMetaText:    { fontSize:11, fontWeight:'500' },
  tlStatusBadge:     { paddingHorizontal:8, paddingVertical:2, borderRadius:8 },
  tlStatusText:      { fontSize:10, fontWeight:'700' },
  emptyState:        { alignItems:'center', justifyContent:'center', paddingVertical:60, gap:12 },
  emptyIcon:         { width:72, height:72, borderRadius:36, alignItems:'center', justifyContent:'center', borderWidth:1.5, borderStyle:'dashed' as const },
  emptyTitle:        { fontSize:16, fontWeight:'700', letterSpacing:-0.3 },
  emptySubtitle:     { fontSize:13, textAlign:'center', lineHeight:19 },
  emptyAddBtn:       { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:24, paddingVertical:12, borderRadius:24 },
  emptyAddText:      { color:'#fff', fontSize:14, fontWeight:'700' },
});