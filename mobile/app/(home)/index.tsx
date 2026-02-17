import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
  Pressable,
  FlatList,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import taskService, { PersonalTask } from '../../services/taskService';
import aiTaskParser from '../../services/aiTaskParser';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Message {
  id: number;
  text: string;
  isUser: boolean;
}

const DarkTheme = {
  background: '#0a0a12',
  surface: 'rgba(255,255,255,0.06)',
  surfaceActive: 'rgba(255,255,255,0.12)',
  primary: '#7c3aed',
  primaryLight: '#a855f7',
  primaryGlow: 'rgba(124, 58, 237, 0.5)',
  text: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.7)',
  textTertiary: 'rgba(255,255,255,0.45)',
  border: 'rgba(255,255,255,0.1)',
  accent: '#f472b6',
  success: '#34d399',
  warning: '#fbbf24',
  gradient: ['#1e1b4b', '#312e81', '#0a0a12', '#0a0a12'],
  dimBg: 'rgba(0,0,0,0.6)',
};

const LightTheme = {
  background: '#fafafa',
  surface: 'rgba(0,0,0,0.04)',
  surfaceActive: 'rgba(0,0,0,0.08)',
  primary: '#7c3aed',
  primaryLight: '#a855f7',
  primaryGlow: 'rgba(124, 58, 237, 0.3)',
  text: '#0f172a',
  textSecondary: 'rgba(15, 23, 42, 0.7)',
  textTertiary: 'rgba(15, 23, 42, 0.45)',
  border: 'rgba(0,0,0,0.08)',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  gradient: ['#ede9fe', '#e0e7ff', '#fafafa', '#fafafa'],
  dimBg: 'rgba(0,0,0,0.3)',
};

export default function HomeScreen() {
  const { user } = useAuth();
  const { isDark, theme: themeMode, setTheme: setThemeMode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([{
    id: 0,
    text: "Welcome to Krios AI!\n\nI'm your intelligent task assistant. Try saying:\n• \"Add Design logo by Friday\"\n• \"What's my priority today?\"\n• \"Motivate me!\"\n\nI can understand natural language and help you stay productive!",
    isUser: false,
  }]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'ongoing' | 'focus'>('upcoming');
  const [showCircularNav, setShowCircularNav] = useState(false);
  const [navStyle, setNavStyle] = useState<'circular' | 'drawer'>('circular');
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<PersonalTask[]>([]);
  const [ongoingTasks, setOngoingTasks] = useState<PersonalTask[]>([]);
  const [focusTasks, setFocusTasks] = useState<PersonalTask[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [pendingSuggestion, setPendingSuggestion] = useState<any>(null);
  const [timerDuration, setTimerDuration] = useState(25);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'priority' | 'dueDate'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const filterAnim = useRef(new Animated.Value(0)).current;
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | null>(null);
  const [newTaskDueTime, setNewTaskDueTime] = useState<string>('');
  const [newTaskFrequency, setNewTaskFrequency] = useState<'one-time' | 'daily' | 'weekly'>('one-time');
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  
  const theme = isDark ? DarkTheme : LightTheme;
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const navSlideAnim = useRef(new Animated.Value(0)).current;
  const circularScaleAnim = useRef(new Animated.Value(0)).current;
  const circularRotateAnim = useRef(new Animated.Value(0)).current;
  const tasksSlideAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadSettings();
    loadTasks();
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
      loadTasks();
    }, [])
  );

  useEffect(() => {
    if (showNavMenu && navStyle === 'drawer') {
      Animated.spring(navSlideAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(navSlideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showNavMenu, navStyle]);

  useEffect(() => {
    if (showCircularNav && navStyle === 'circular') {
      Animated.parallel([
        Animated.spring(circularScaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.spring(circularRotateAnim, {
          toValue: 1,
          tension: 60,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(circularScaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(circularRotateAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showCircularNav, navStyle]);

  useEffect(() => {
    if (showTasks) {
      Animated.spring(tasksSlideAnim, {
        toValue: 1,
        tension: 35,
        friction: 9,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(tasksSlideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showTasks]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages are added
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  // Manage calendar expanded state when tasks view changes
  useEffect(() => {
    if (showTasks) {
      setIsCalendarExpanded(true);
    } else {
      setIsCalendarExpanded(false);
      setShowFilters(false);
    }
  }, [showTasks]);

  useEffect(() => {
    if (activeTab === 'focus') {
      setShowFilters(false);
    }
  }, [activeTab]);

  useEffect(() => {
    Animated.timing(filterAnim, {
      toValue: showFilters ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [showFilters, filterAnim]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
      // On Android, e.endCoordinates.height includes the keyboard toolbar
      // We use screenY to get the actual position from the bottom
      const screenHeight = Dimensions.get('window').height;
      const keyboardTop = e.endCoordinates.screenY;
      const actualHeight = screenHeight - keyboardTop;
      setKeyboardHeight(actualHeight);
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const loadSettings = async () => {
    try {
      const nav = await AsyncStorage.getItem('navStyle');
      if (nav === 'circular' || nav === 'drawer') setNavStyle(nav);
    } catch (e) {}
  };

  const loadTasks = async () => {
    try {
      await taskService.syncTasks();
      const [upcoming, ongoing, focus] = await Promise.all([
        taskService.getUpcomingTasks(),
        taskService.getOngoingTasks(),
        taskService.getTopPriorityTasks(3),
      ]);
      setUpcomingTasks(upcoming);
      setOngoingTasks(ongoing);
      setFocusTasks(focus);
      setTasks(await taskService.getLocalTasks());
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const getTimeEmoji = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return '🌅';
    if (hour >= 12 && hour < 17) return '☀️';
    if (hour >= 17 && hour < 21) return '🌆';
    return '🌙';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 21) return 'Good evening';
    return 'Good night';
  };

  const processAIResponse = (input: string): string => {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('motivate') || lowerInput.includes('motivation')) {
      return "Small steps lead to big changes. You've got this! Every task you complete is a victory. Keep pushing forward! 💪";
    }
    
    if (lowerInput.includes('suggest')) {
      return "Suggested Tasks:\n\n📌 Review weekly goals (high)\n📌 Organize workspace (low)\n📌 Plan next week (medium)\n\nWant me to add any of these?";
    }
    
    if (lowerInput.includes('analyze') || lowerInput.includes('priority') || lowerInput.includes('what\'s my')) {
      return "Here's your task analysis:\n\n✅ High priority: 2 tasks\n📋 Medium priority: 5 tasks\n📝 Low priority: 3 tasks\n\nYou're doing great!";
    }
    
    if (lowerInput.includes('tips') || lowerInput.includes('advice')) {
      return "Here are some productivity tips:\n\n1. 🧘 Start with the hardest task\n2. 📵 Use the 2-minute rule\n3. 🎯 Focus on one thing at a time\n4. 💧 Stay hydrated!\n\nNeed help with anything specific?";
    }
    
    if (lowerInput.includes('add') && lowerInput.includes('by')) {
      const match = lowerInput.match(/add (.+?) by (\w+ \d+)/);
      if (match) {
        return `Done! I've added "${match[1]}" due on ${match[2]} with medium priority.`;
      }
    }
    
    if (lowerInput.includes('add') || lowerInput.includes('new task') || lowerInput.includes('create task')) {
      return "I can help you add tasks! Just tell me:\n\n• Task name\n• Due date\n• Priority (high/medium/low)\n\nWhat would you like to add?";
    }
    
    if (lowerInput.includes('yes') || lowerInput.includes('sure') || lowerInput.includes('please')) {
      return "Done! I've added 3 tasks to your list:\n\n✅ Review weekly goals (high)\n✅ Organize workspace (low)\n✅ Plan next week (medium)";
    }
    
    if (lowerInput.includes('hello') || lowerInput.includes('hi') || lowerInput.includes('hey')) {
      return `Hey there! ${getGreeting()}, ${user?.username || 'there'}! 👋\n\nHow can I help you stay productive today?`;
    }
    
    if (lowerInput.includes('thank')) {
      return "You're welcome! 😊 Keep crushing those goals!";
    }
    
    if (lowerInput.includes('bye') || lowerInput.includes('goodbye')) {
      return "Goodbye! Come back soon! Take care! ✨";
    }
    
    return "I understand! How can I assist you with your productivity today?";
  };

  const handleSendMessage = async (text?: string) => {
    const textToSend = text || message;
    if (!textToSend.trim() || isSendingRef.current) return;
    
    isSendingRef.current = true;
    setIsSending(true);
    
    const userMessage: Message = { id: Date.now(), text: textToSend.trim(), isUser: true };
    setMessages(prev => [...prev, userMessage]);
    if (!text) setMessage('');
    
    setTimeout(async () => {
      try {
        const lowerMessage = textToSend.toLowerCase().trim();
        
        // Check if user is confirming a pending suggestion
        if (pendingSuggestion && (lowerMessage === 'yes' || lowerMessage === 'sure' || lowerMessage === 'ok' || lowerMessage === 'yeah' || lowerMessage === 'yep' || lowerMessage === 'create it' || lowerMessage === 'add it')) {
          try {
            await taskService.createTask(pendingSuggestion);
            await loadTasks();
            
            const aiMessage: Message = { 
              id: Date.now() + 1, 
              text: `✅ Perfect! I've added "${pendingSuggestion.title}" to your tasks${pendingSuggestion.dueDate ? ` (due ${formatDate(pendingSuggestion.dueDate)})` : ''}!`, 
              isUser: false 
            };
            setMessages(prev => [...prev, aiMessage]);
            setPendingSuggestion(null);
          } catch (error) {
            console.error('Error creating task:', error);
            const aiMessage: Message = { id: Date.now() + 1, text: "❌ Sorry, I couldn't add that task. Please try again.", isUser: false };
            setMessages(prev => [...prev, aiMessage]);
          }
          isSendingRef.current = false;
          setIsSending(false);
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
          return;
        }
        
        // Check if user is declining a suggestion
        if (pendingSuggestion && (lowerMessage === 'no' || lowerMessage === 'nope' || lowerMessage === 'cancel' || lowerMessage === 'nevermind')) {
          setPendingSuggestion(null);
          const aiMessage: Message = { id: Date.now() + 1, text: "👍 No problem! Let me know if you need anything else.", isUser: false };
          setMessages(prev => [...prev, aiMessage]);
          isSendingRef.current = false;
          setIsSending(false);
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
          return;
        }
        
        // Parse message using AI
        const intent = await aiTaskParser.parseMessage(textToSend.trim());
        
        // Handle the intent
        if (intent.action === 'create') {
          if (intent.suggestion && intent.taskData) {
            // Store suggestion for confirmation
            setPendingSuggestion(intent.taskData);
          } else if (intent.taskData) {
            // Create task directly
            await taskService.createTask(intent.taskData);
            await loadTasks(); // Refresh tasks
          }
        }
        
        // Send AI response
        const aiMessage: Message = { id: Date.now() + 1, text: intent.response, isUser: false };
        setMessages(prev => [...prev, aiMessage]);
        
        isSendingRef.current = false;
        setIsSending(false);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } catch (error) {
        console.error('Error processing message:', error);
        const aiMessage: Message = { id: Date.now() + 1, text: "Sorry, I had trouble processing that. Can you try again?", isUser: false };
        setMessages(prev => [...prev, aiMessage]);
        isSendingRef.current = false;
        setIsSending(false);
      }
    }, 800);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays <= 7) return `in ${diffDays} days`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleQuickPrompt = (prompt: string) => {
    if (!isSendingRef.current) {
      handleSendMessage(prompt);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await taskService.completeTask(taskId);
      await loadTasks();
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const startTimer = (duration: number) => {
    setTimerDuration(duration);
    setTimerSeconds(duration * 60);
    setIsTimerRunning(true);
    setShowDurationPicker(false);
  };

  const toggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerSeconds(timerDuration * 60);
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    try {
      await taskService.createTask({
        title: newTaskTitle.trim(),
        taskType: 'one-time',
        priority: newTaskPriority,
      });
      await loadTasks();
      setShowTaskModal(false);
      setNewTaskTitle('');
      setNewTaskPriority('medium');
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const getFilteredTasks = () => {
    const currentTasks = activeTab === 'upcoming' ? upcomingTasks : ongoingTasks;
    if (taskFilter === 'all') return currentTasks;
    if (taskFilter === 'priority') return [...currentTasks].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority || 'medium'] || 1) - (priorityOrder[b.priority || 'medium'] || 1);
    });
    if (taskFilter === 'dueDate') return [...currentTasks].sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
    return currentTasks;
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const circularNavItems: Array<{icon: any; label: string; route: string; color: string; angle: number}> = [
    { icon: 'home-outline' as const, label: 'Home', route: '/(home)', color: '#6366f1', angle: 0 },
    { icon: 'people-outline' as const, label: 'Rooms', route: '/(home)/rooms', color: '#22c55e', angle: 72 },
    { icon: 'settings-outline' as const, label: 'Settings', route: '/(home)/settings', color: '#f59e0b', angle: 144 },
    { icon: 'person-outline' as const, label: 'Profile', route: '/(home)/profile', color: '#8b5cf6', angle: 216 },
    { icon: 'close-outline' as const, label: 'Close', route: '', color: '#ef4444', angle: 288 },
  ];

  const drawerNavItems: Array<{icon: any; label: string; route: string; color: string}> = [
    { icon: 'home-outline' as const, label: 'Home', route: '/(home)', color: '#6366f1' },
    { icon: 'person-outline' as const, label: 'Profile', route: '/(home)/profile', color: '#8b5cf6' },
    { icon: 'people-outline' as const, label: 'Rooms', route: '/(home)/rooms', color: '#22c55e' },
    { icon: 'settings-outline' as const, label: 'Settings', route: '/(home)/settings', color: '#f59e0b' },
  ];

  const handleMenuPress = (route: string) => {
    closeAllMenus();
    if (route) router.push(route);
  };

  const closeAllMenus = () => {
    setShowNavMenu(false);
    setShowCircularNav(false);
    setShowTasks(false);
  };

  const handleKPress = () => {
    if (navStyle === 'circular') {
      setShowCircularNav(!showCircularNav);
    } else {
      setShowNavMenu(!showNavMenu);
    }
  };

  const navTranslateY = navSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  const upcomingTasksCount = upcomingTasks.length;
  const ongoingTasksCount = ongoingTasks.length;
  const isNavOpen = showNavMenu || showCircularNav;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <LinearGradient
        colors={theme.gradient as any}
        locations={[0, 0.15, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      
      <View style={[styles.glowOrb1, isDark && styles.glowOrb1Dark]} pointerEvents="none" />
      <View style={[styles.glowOrb2, isDark && styles.glowOrb2Dark]} pointerEvents="none" />

      {/* Dim Background when nav is open */}
      {isNavOpen && (
        <Pressable style={[styles.dimOverlay, { backgroundColor: theme.dimBg }]} onPress={closeAllMenus} />
      )}

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        
        <TouchableOpacity 
          style={[styles.themeToggle, { backgroundColor: theme.surface }]}
          onPress={() => {
            const newTheme = themeMode === 'dark' ? 'light' : themeMode === 'light' ? 'system' : 'dark';
            setThemeMode(newTheme);
          }}
        >
          <Ionicons 
            name={themeMode === 'dark' ? 'moon' : themeMode === 'light' ? 'sunny' : 'contrast'} 
            size={18} 
            color={theme.primary} 
          />
        </TouchableOpacity>

          <View style={styles.greetingSection}>
            <View style={styles.greetingRow}>
              <Text style={styles.timeEmoji}>{getTimeEmoji()}</Text>
              <Text style={[styles.greeting, { color: theme.text }]}>
                {getGreeting()}, {user?.username || 'there'}!
              </Text>
            </View>
          </View>

          <Pressable 
            style={[styles.calendarSection, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => {
              if (!isCalendarExpanded) {
                setShowTasks(!showTasks);
              }
            }}
            pointerEvents={isCalendarExpanded ? 'box-none' : 'auto'}
          >
            <View style={styles.calendarHeader}>
              <Text style={[styles.calendarMonth, { color: theme.text }]}>
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <View style={styles.calendarTaskBadges}>
                <View style={[styles.taskBadge, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.12)' }]}>
                  <Text style={[styles.taskBadgeText, { color: theme.text }]}>📋 {upcomingTasksCount} upcoming</Text>
                </View>
                <View style={[styles.taskBadge, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.12)' }]}>
                  <Text style={[styles.taskBadgeText, { color: theme.text }]}>🔥 {ongoingTasksCount} ongoing</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.calendarGrid}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                <Text key={i} style={[styles.dayLabel, { color: theme.textTertiary }]}>{day}</Text>
              ))}
              {Array.from({ length: 35 }, (_, i) => {
                const dayNumber = i - 3;
                const isToday = dayNumber === new Date().getDate();
                
                if (dayNumber < 1 || dayNumber > 31) {
                  return <View key={i} style={styles.dayCell} />;
                }
                
                // Check tasks for this date
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();
                const dateStr = new Date(currentYear, currentMonth, dayNumber).toISOString().split('T')[0];
                const dateTasks = tasks.filter(t => t.dueDate?.startsWith(dateStr));
                const hasCompleted = dateTasks.some(t => t.completedAt);
                const hasOngoing = dateTasks.some(t => !t.completedAt && t.dueDate && new Date(t.dueDate) <= new Date());
                const hasUpcoming = dateTasks.some(t => !t.completedAt && t.dueDate && new Date(t.dueDate) > new Date());
                
                return (
                  <TouchableOpacity 
                    key={i} 
                    style={[styles.dayCell, isToday && { backgroundColor: theme.primary }]} 
                    onPress={() => {
                      if (isCalendarExpanded) {
                        setSelectedDate(new Date(currentYear, currentMonth, dayNumber));
                      }
                    }}
                    disabled={!isCalendarExpanded}
                  >
                    <Text style={[styles.dayNumber, { color: isToday ? '#fff' : theme.text }, isToday && styles.todayText]}>{dayNumber}</Text>
                    {!isToday && (dateTasks.length > 0) && (
                      <View style={styles.dateDots}>
                        {hasCompleted && <View style={[styles.eventDot, { backgroundColor: theme.success }]} />}
                        {hasOngoing && <View style={[styles.eventDot, { backgroundColor: theme.warning }]} />}
                        {hasUpcoming && <View style={[styles.eventDot, { backgroundColor: theme.primary }]} />}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              </View>
             
            <LinearGradient
              colors={isDark 
                ? ['transparent', 'rgba(10, 10, 18, 0.9)']
                : ['transparent', 'rgba(250, 250, 250, 0.9)']
              }
              style={styles.calendarFade}
              pointerEvents="none"
            />
          </Pressable>

          {showTasks ? (
            <>
              {/* Tasks Content */}
              <Animated.View 
                style={[
                  styles.tasksContent, 
                  { backgroundColor: isDark ? 'rgba(15, 15, 25, 0.4)' : 'rgba(235, 235, 240, 0.4)' },
                  { 
                    transform: [{ 
                      translateY: tasksSlideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0]
                      }) 
                    }],
                    opacity: tasksSlideAnim
                  }
                ]}
              >
                {/* Tabs */}
                <View style={[styles.tasksTabs, { backgroundColor: theme.surface }]}>
                  <TouchableOpacity 
                    style={[styles.tasksTab, activeTab === 'upcoming' && { backgroundColor: theme.primary + '25' }]}
                    onPress={() => setActiveTab('upcoming')}
                  >
                    <Text style={[styles.tasksTabText, { color: activeTab === 'upcoming' ? theme.primary : theme.textTertiary }]}>
                      Upcoming
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.tasksTab, activeTab === 'ongoing' && { backgroundColor: theme.primary + '25' }]}
                    onPress={() => setActiveTab('ongoing')}
                  >
                    <Text style={[styles.tasksTabText, { color: activeTab === 'ongoing' ? theme.primary : theme.textTertiary }]}>
                      Ongoing
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.tasksTab, activeTab === 'focus' && { backgroundColor: theme.primary + '25' }]}
                    onPress={() => setActiveTab('focus')}
                  >
                    <Text style={[styles.tasksTabText, { color: activeTab === 'focus' ? theme.primary : theme.textTertiary }]}>
                      Focus
                    </Text>
                  </TouchableOpacity>
                </View>

                {activeTab === 'focus' ? (
                  <ScrollView style={styles.tasksListView} showsVerticalScrollIndicator={false}>
                    <View style={styles.focusMode}>
                      {focusTasks.length > 0 && (
                        <View style={styles.focusTasksList}>
                          <Text style={[styles.focusTasksHeader, { color: theme.text }]}>Top 3 Focus Tasks</Text>
                          {focusTasks.map((task, index) => (
                            <TouchableOpacity 
                              key={task.id} 
                              style={[styles.focusTaskItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
                              onPress={() => handleCompleteTask(task.id)}
                            >
                              <View style={[styles.taskPriorityDot, { backgroundColor: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981' }]} />
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.focusTaskTitle, { color: theme.text }]}>{task.title}</Text>
                                {task.dueDate && (
                                  <Text style={[styles.focusTaskTime, { color: theme.textTertiary }]}>{formatDate(task.dueDate)}</Text>
                                )}
                              </View>
                              <Text style={[styles.focusTaskRank, { color: theme.primary }]}>#{index + 1}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      <View style={[styles.focusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <LinearGradient
                          colors={['#6366f1', '#8b5cf6']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.focusGradient}
                        >
                          <View style={styles.focusIconContainer}>
                            <Ionicons name="bulb" size={32} color="#fff" />
                          </View>
                        </LinearGradient>
                        <Text style={[styles.focusTitle, { color: theme.text }]}>Focus Mode</Text>
                        <Text style={[styles.focusSubtitle, { color: theme.textTertiary }]}>
                          Set a timer and minimize distractions
                        </Text>
                        <View style={styles.focusTimerContainer}>
                          <Text style={[styles.focusTimer, { color: theme.primary }]}>
                            {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')}
                          </Text>
                        </View>
                        {!isTimerRunning ? (
                          <TouchableOpacity 
                            style={[styles.focusStartButton, { backgroundColor: theme.primary }]}
                            onPress={() => setShowDurationPicker(!showDurationPicker)}
                          >
                            <Ionicons name="play" size={20} color="#fff" />
                            <Text style={styles.focusStartText}>Start Focus</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.focusTimerButtons}>
                            <TouchableOpacity 
                              style={[styles.focusTimerButton, { backgroundColor: theme.warning }]}
                              onPress={toggleTimer}
                            >
                              <Ionicons name="pause" size={18} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.focusTimerButton, { backgroundColor: theme.accent }]}
                              onPress={resetTimer}
                            >
                              <Ionicons name="refresh" size={18} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        )}
                        {showDurationPicker && (
                          <View style={styles.durationPicker}>
                            {[15, 25, 45, 60].map(duration => (
                              <TouchableOpacity 
                                key={duration}
                                style={[styles.durationOption, { backgroundColor: theme.surface, borderColor: theme.border }]}
                                onPress={() => startTimer(duration)}
                              >
                                <Text style={[styles.durationText, { color: theme.text }]}>{duration} min</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>

                      <View style={[styles.focusStatsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <View style={styles.focusStat}>
                          <Text style={[styles.focusStatValue, { color: theme.primary }]}>4</Text>
                          <Text style={[styles.focusStatLabel, { color: theme.textTertiary }]}>Sessions</Text>
                        </View>
                        <View style={styles.focusStatDivider} />
                        <View style={styles.focusStat}>
                          <Text style={[styles.focusStatValue, { color: theme.accent }]}>1h 40m</Text>
                          <Text style={[styles.focusStatLabel, { color: theme.textTertiary }]}>Focused</Text>
                        </View>
                        <View style={styles.focusStatDivider} />
                        <View style={styles.focusStat}>
                          <Text style={[styles.focusStatValue, { color: theme.success }]}>85%</Text>
                          <Text style={[styles.focusStatLabel, { color: theme.textTertiary }]}>Efficiency</Text>
                        </View>
                      </View>
                    </View>
                  </ScrollView>
                ) : (
                  <View style={[styles.tasksList, showFilters && styles.tasksListWithFilters]}>
                      {/* Filter Buttons */}
                      <Animated.View
                        pointerEvents={showFilters ? 'auto' : 'none'}
                        style={[
                          styles.filterPanel,
                          styles.filterPanelFloating,
                          {
                            backgroundColor: isDark ? 'rgba(20, 20, 35, 0.65)' : 'rgba(255, 255, 255, 0.78)',
                            borderColor: theme.border,
                            opacity: filterAnim,
                            transform: [
                              { translateY: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
                              { scale: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }
                            ],
                          },
                        ]}
                      >
                        <View style={styles.filterButtons}>
                          <TouchableOpacity 
                            style={[styles.filterButton, taskFilter === 'all' && { backgroundColor: theme.primary + '30' }]}
                            onPress={() => setTaskFilter('all')}
                          >
                            <Text style={[styles.filterButtonText, { color: taskFilter === 'all' ? theme.primary : theme.textTertiary }]}>All</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.filterButton, taskFilter === 'priority' && { backgroundColor: theme.primary + '30' }]}
                            onPress={() => setTaskFilter('priority')}
                          >
                            <Text style={[styles.filterButtonText, { color: taskFilter === 'priority' ? theme.primary : theme.textTertiary }]}>Priority</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.filterButton, taskFilter === 'dueDate' && { backgroundColor: theme.primary + '30' }]}
                            onPress={() => setTaskFilter('dueDate')}
                          >
                            <Text style={[styles.filterButtonText, { color: taskFilter === 'dueDate' ? theme.primary : theme.textTertiary }]}>Due Date</Text>
                          </TouchableOpacity>
                        </View>
                      </Animated.View>
                      
                      {getFilteredTasks().length === 0 ? (
                        <View style={styles.emptyState}>
                          <Ionicons name="checkmark-done-circle-outline" size={64} color={theme.textTertiary} />
                          <Text style={[styles.emptyStateText, { color: theme.textTertiary }]}>
                            {activeTab === 'upcoming' ? 'No upcoming tasks! 🎉' : 'No ongoing tasks'}
                          </Text>
                          <Text style={[styles.emptyStateSubtext, { color: theme.textTertiary }]}>
                            {activeTab === 'upcoming' ? 'Add a new task to get started' : 'Start a task to see it here'}
                          </Text>
                        </View>
                      ) : (
                        <FlatList
                          data={getFilteredTasks()}
                          keyExtractor={(task) => task.id}
                          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                          showsVerticalScrollIndicator={false}
                          renderItem={({ item: task }) => {
                            const color = task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981';
                            
                            return (
                              <TouchableOpacity 
                                style={[styles.taskCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                              >
                                <View style={[styles.taskPriorityDot, { backgroundColor: color }]} />
                                <View style={styles.taskContent}>
                                  <Text style={[styles.taskTitle, { color: theme.text }]}>{task.title}</Text>
                                  <Text style={[styles.taskTime, { color: theme.textTertiary }]}>
                                    {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                                  </Text>
                                </View>
                                <TouchableOpacity 
                                  style={styles.taskCheck}
                                  onPress={() => handleCompleteTask(task.id)}
                                >
                                  <Ionicons name={task.completedAt ? "checkmark-circle" : "ellipse-outline"} size={24} color={task.completedAt ? theme.success : theme.textTertiary} />
                                </TouchableOpacity>
                              </TouchableOpacity>
                            );
                          }}
                        />
                      )}
                    </View>
                )}
              </Animated.View>

              {/* Tasks Toolbar */}
              <Animated.View
                style={[{ position: 'absolute', left: 0, right: 0, zIndex: 10, bottom: keyboardHeight > 0 ? keyboardHeight - 10 : (insets.bottom || 0) }]}
              >
              <View style={[styles.tasksToolbar, { backgroundColor: isDark ? 'rgba(20, 20, 35, 0.95)' : 'rgba(255, 255, 255, 0.95)', borderColor: theme.border }]}>
                  <View style={styles.tasksToolbarInner}>
                  {/* K Button */}
                  <TouchableOpacity 
                    style={styles.toolbarKButton}
                    onPress={handleKPress}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={['#6366f1', '#8b5cf6', '#a855f7']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.toolbarKGradient}
                    >
                      <Image 
                        source={require('../../assets/krios-logo.png')}
                        style={styles.toolbarKLogo}
                        resizeMode="contain"
                      />
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Search Bar */}
                  <View style={[styles.toolbarSearch, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="search" size={18} color={theme.textTertiary} />
                    <TextInput 
                      style={[styles.toolbarSearchInput, { color: theme.text }]}
                      placeholder="Search tasks..."
                      placeholderTextColor={theme.textTertiary}
                    />
                  </View>

                  {/* Filter Button */}
                  <TouchableOpacity 
                    style={[
                      styles.toolbarButton,
                      { backgroundColor: showFilters ? theme.primary + '25' : theme.surface, borderColor: showFilters ? theme.primary : theme.border }
                    ]}
                    onPress={() => setShowFilters(prev => !prev)}
                  >
                    <Ionicons name="options" size={20} color={showFilters ? theme.primary : theme.textTertiary} />
                  </TouchableOpacity>

                  {/* Add Button */}
                  <TouchableOpacity 
                    style={[styles.toolbarButton, styles.toolbarAddButton, { backgroundColor: theme.primary }]}
                    onPress={() => setShowTaskModal(true)}
                  >
                    <Ionicons name="add" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
              </Animated.View>
            </>
          ) : (
            <>
              {/* Chat Messages */}
              <ScrollView 
                ref={scrollViewRef}
                style={[styles.messagesContainer, { backgroundColor: isDark ? 'rgba(15, 15, 25, 0.4)' : 'rgba(235, 235, 240, 0.4)' }]}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.messagesContent}
              >
                {messages.map((msg) => (
                  <View 
                    key={msg.id} 
                    style={[
                      styles.messageBubble,
                      msg.isUser ? styles.userMessage : styles.aiMessage
                    ]}
                  >
                    {!msg.isUser && (
                      <View style={[styles.aiAvatar, { backgroundColor: theme.primary }]}>
                        <Image 
                          source={require('../../assets/krios-logo.png')}
                          style={styles.aiLogoImage}
                          resizeMode="contain"
                        />
                      </View>
                    )}
                    <View style={[
                      styles.messageContent,
                      msg.isUser 
                        ? { backgroundColor: theme.primary }
                        : { backgroundColor: theme.surface }
                    ]}>
                      <Text style={[
                        styles.messageText,
                        { color: msg.isUser ? '#fff' : theme.text }
                      ]}>
                        {msg.text}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              {/* Chat Input - Outside ScrollView */}
              <Animated.View
                style={[styles.chatInputAvoidingView, { bottom: keyboardHeight > 0 ? keyboardHeight : (insets.bottom || 0) }]}
              >
                <View style={[styles.inputWrapper, { backgroundColor: isDark ? 'rgba(20, 20, 35, 0.95)' : 'rgba(255, 255, 255, 0.95)', borderColor: theme.border }]}
                >
                  <View style={styles.inputContainer}>
                    <View style={styles.promptTemplates}>
                    <TouchableOpacity 
                      style={[
                        styles.promptButton, 
                        { backgroundColor: theme.surface, borderColor: theme.border },
                        isSending && styles.promptButtonDisabled
                      ]}
                      onPress={() => handleQuickPrompt('Suggest')}
                      disabled={isSending}
                    >
                      <Ionicons name="bulb-outline" size={14} color={isSending ? theme.textTertiary : theme.warning} />
                      <Text style={[styles.promptButtonText, { color: isSending ? theme.textTertiary : theme.text }]}>Suggest</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[
                        styles.promptButton, 
                        { backgroundColor: theme.surface, borderColor: theme.border },
                        isSending && styles.promptButtonDisabled
                      ]}
                      onPress={() => handleQuickPrompt('Analyze')}
                      disabled={isSending}
                    >
                      <Ionicons name="analytics-outline" size={14} color={isSending ? theme.textTertiary : theme.primary} />
                      <Text style={[styles.promptButtonText, { color: isSending ? theme.textTertiary : theme.text }]}>Analyze</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[
                        styles.promptButton, 
                        { backgroundColor: theme.surface, borderColor: theme.border },
                        isSending && styles.promptButtonDisabled
                      ]}
                      onPress={() => handleQuickPrompt('Motivate')}
                      disabled={isSending}
                    >
                      <Ionicons name="flame-outline" size={14} color={isSending ? theme.textTertiary : theme.accent} />
                      <Text style={[styles.promptButtonText, { color: isSending ? theme.textTertiary : theme.text }]}>Motivate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[
                        styles.promptButton, 
                        { backgroundColor: theme.surface, borderColor: theme.border },
                        isSending && styles.promptButtonDisabled
                      ]}
                      onPress={() => handleQuickPrompt('Tips')}
                      disabled={isSending}
                    >
                      <Ionicons name="sparkles-outline" size={14} color={isSending ? theme.textTertiary : theme.success} />
                      <Text style={[styles.promptButtonText, { color: isSending ? theme.textTertiary : theme.text }]}>Tips</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[
                    styles.messageContainer,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    isInputFocused && { 
                      borderColor: theme.primary,
                      borderWidth: 1.5,
                    }
                  ]}>
                    <TouchableOpacity 
                      style={styles.inputKButton}
                      onPress={handleKPress}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={['#6366f1', '#8b5cf6', '#a855f7']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.inputKButtonGradient}
                      >
                        <Image 
                          source={require('../../assets/krios-logo.png')}
                          style={styles.inputKLogo}
                          resizeMode="contain"
                        />
                      </LinearGradient>
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder="Message Krios AI..."
                      placeholderTextColor={theme.textTertiary}
                      value={message}
                      onChangeText={setMessage}
                      multiline
                      maxLength={500}
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                    />
                    <TouchableOpacity 
                      style={[
                        styles.sendButton,
                        { backgroundColor: message.trim() ? theme.primary : theme.surfaceActive }
                      ]}
                      onPress={() => handleSendMessage()}
                      disabled={!message.trim() || isSending}
                    >
                      <Ionicons name="send" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Animated.View>
            </>
          )}

        </Animated.View>

      {/* Drawer rendered outside */}
      {showNavMenu && navStyle === 'drawer' && (
        <Animated.View 
          style={[
            styles.navMenuOverlay,
            { transform: [{ translateY: navTranslateY }] }
          ]}
        >
          <TouchableOpacity 
            style={styles.drawerBackdrop}
            activeOpacity={1}
            onPress={closeAllMenus}
          />
          <View style={[styles.navMenuContainer, { backgroundColor: isDark ? 'rgba(15, 15, 25, 0.98)' : '#ffffff' }]}>
            <View style={[styles.navMenuHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)' }]} />
            <Text style={[styles.navMenuTitle, { color: isDark ? '#fff' : '#0f172a' }]}>Navigate</Text>
            
            {drawerNavItems.map((item, index) => (
              <TouchableOpacity 
                key={index}
                style={[styles.navMenuItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}
                onPress={() => handleMenuPress(item.route)}
              >
                <View style={[styles.navMenuIcon, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <Text style={[styles.navMenuLabel, { color: isDark ? '#fff' : '#0f172a' }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'} />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Circular Navigation - outside KeyboardAvoidingView */}
      {showCircularNav && navStyle === 'circular' && (
        <View style={styles.circularNavWrapper}>
          <Animated.View 
            style={[
              styles.circularNavContainer,
              {
                transform: [
                  { scale: circularScaleAnim },
                  { rotate: circularRotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }
                ]
              }
            ]}
          >
            {circularNavItems.map((item, index) => {
              const angleRad = (item.angle - 90) * (Math.PI / 180);
              const translateX = Math.cos(angleRad) * 90;
              const translateY = Math.sin(angleRad) * 90;
              
              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.circularNavItem,
                    {
                      backgroundColor: isDark ? item.color + '25' : '#ffffff',
                      borderWidth: isDark ? 0 : 2,
                      borderColor: isDark ? 'transparent' : item.color + '40',
                      transform: [
                        { translateX },
                        { translateY },
                        { scale: circularScaleAnim }
                      ],
                      opacity: circularScaleAnim,
                    }
                  ]}
                >
                  <TouchableOpacity
                    style={styles.circularNavButton}
                    onPress={() => {
                      if (item.label === 'Close') {
                        closeAllMenus();
                      } else {
                        handleMenuPress(item.route);
                      }
                    }}
                  >
                    <Ionicons name={item.icon} size={24} color={item.color} />
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </Animated.View>
        </View>
      )}

      {/* Task Creation Modal */}
      {showTaskModal && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowTaskModal(false)} />
          <View style={[styles.taskModal, { backgroundColor: theme.background }]}>
            <View style={styles.taskModalHeader}>
              <Text style={[styles.taskModalTitle, { color: theme.text }]}>Create New Task</Text>
              <TouchableOpacity onPress={() => setShowTaskModal(false)}>
                <Ionicons name="close" size={24} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={[styles.taskModalInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
              placeholder="Task title..."
              placeholderTextColor={theme.textTertiary}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              autoFocus
            />
            
            <Text style={[styles.taskModalLabel, { color: theme.textSecondary }]}>Priority</Text>
            <View style={styles.priorityButtons}>
              {(['high', 'medium', 'low'] as const).map(priority => (
                <TouchableOpacity
                  key={priority}
                  style={[
                    styles.priorityButton,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    newTaskPriority === priority && { backgroundColor: theme.primary + '30', borderColor: theme.primary }
                  ]}
                  onPress={() => setNewTaskPriority(priority)}
                >
                  <Text style={[
                    styles.priorityButtonText,
                    { color: newTaskPriority === priority ? theme.primary : theme.textTertiary }
                  ]}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity
              style={[styles.taskModalButton, { backgroundColor: theme.primary }]}
              onPress={handleCreateTask}
            >
              <Text style={styles.taskModalButtonText}>Create Task</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
  },
  glowOrb1: {
    position: 'absolute',
    top: -100,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
  },
  glowOrb1Dark: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
  },
  glowOrb2: {
    position: 'absolute',
    bottom: 100,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
  },
  glowOrb2Dark: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
  },
  themeToggle: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 44,
    right: 20,
    zIndex: 50,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingSection: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeEmoji: {
    fontSize: 22,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '600',
  },
  calendarSection: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarMonth: {
    fontSize: 15,
    fontWeight: '600',
  },
  calendarTaskBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  taskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  taskBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayLabel: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 2,
  },
  dayCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
  },
  dayNumber: {
    fontSize: 11,
    fontWeight: '500',
  },
  todayText: {
    fontWeight: '700',
  },
  dateDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  eventDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  calendarFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 180,
  },
  messagesContent: {
    paddingBottom: 16,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 8,
    maxWidth: '100%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiMessage: {
    alignSelf: 'flex-start',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    overflow: 'hidden',
  },
  aiLogoImage: {
    width: 24,
    height: 24,
  },
  messageContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    maxWidth: SCREEN_WIDTH * 0.75,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  circularNavWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 280 : 270,
    left: '50%',
    marginLeft: -32,
    zIndex: 600,
  },
  circularNavContainer: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularNavItem: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 15,
  },
  circularNavButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kButtonWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 230 : 220,
    left: '50%',
    marginLeft: -28,
    alignItems: 'center',
    zIndex: 350,
  },
  kButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  kButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kLogoImage: {
    width: 36,
    height: 36,
  },
  inputKButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    marginRight: 8,
  },
  inputKButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputKLogo: {
    width: 22,
    height: 22,
  },
  inputLogo: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  inputWrapper: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  inputContainer: {
    gap: 8,
  },
  promptTemplates: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 6,
  },
  promptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  promptButtonDisabled: {
    opacity: 0.5,
  },
  promptButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  input: {
    flex: 1,
    fontSize: 14,
    maxHeight: 72,
    paddingVertical: 6,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  navMenuOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    justifyContent: 'flex-end',
    zIndex: 300,
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 301,
  },
  navMenuContainer: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 40,
    zIndex: 302,
  },
  navMenuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  navMenuTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  navMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  navMenuIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navMenuLabel: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '500',
  },
  tasksScreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 500,
  },
  tasksGlowOrb1: {
    position: 'absolute',
    top: -150,
    right: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
  },
  tasksGlowOrb2: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
  },
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 16,
  },
  tasksBackButton: {
    padding: 4,
  },
  tasksTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  tasksAddButton: {
    padding: 4,
  },
  tasksTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 3,
  },
  tasksTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  tasksTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tasksContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 180,
  },
  tasksListView: {
    flex: 1,
  },
  tasksList: {
    flex: 1,
    paddingTop: 10,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  taskPriorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  taskTime: {
    fontSize: 11,
  },
  taskProgressBg: {
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  taskProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  taskCheck: {
    padding: 4,
  },
  focusMode: {
    alignItems: 'center',
    gap: 16,
  },
  focusCard: {
    width: '100%',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 10,
  },
  chatInputAvoidingView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  tasksToolbarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  focusGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  focusIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  focusSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  focusTimerContainer: {
    marginBottom: 16,
  },
  focusTimer: {
    fontSize: 48,
    fontWeight: '700',
  },
  focusStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  focusStartText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  focusStatsCard: {
    flexDirection: 'row',
    width: '100%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  focusStat: {
    flex: 1,
    alignItems: 'center',
  },
  focusStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  focusStatValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  focusStatLabel: {
    fontSize: 11,
  },
  tasksToolbar: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  tasksToolbarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 2,
    gap: 8,
  },
  toolbarKButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  toolbarKGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarKLogo: {
    width: 24,
    height: 24,
  },
  toolbarSearch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  toolbarSearchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  toolbarButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  toolbarAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  focusTasksList: {
    marginTop: 12,
    marginBottom: 16,
  },
  focusTasksHeader: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  focusTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
  },
  focusTaskTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  focusTaskTime: {
    fontSize: 12,
  },
  focusTaskRank: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  filterPanel: {
    alignSelf: 'center',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  filterPanelFloating: {
    position: 'absolute',
    top: 8,
    zIndex: 5,
  },
  tasksListWithFilters: {
    paddingTop: 52,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  filterButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 10,
    fontWeight: '600',
  },
  focusTimerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  focusTimerButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationPicker: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  durationOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  durationText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  taskModal: {
    width: '85%',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  taskModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  taskModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  taskModalInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 16,
  },
  taskModalLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  priorityButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  taskModalButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  taskModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
