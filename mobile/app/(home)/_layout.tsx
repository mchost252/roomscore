import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { View, StyleSheet, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SidebarNav from '../../components/SidebarNav';
import { CircularKMenu } from '../../components/CircularKMenu';

// Context so index.tsx can register its openAIChat / openAddTask handlers
export const HomeNavContext = React.createContext<{
  openAIChat: () => void;
  openAddTask: () => void;
  setOpenAIChat: (fn: () => void) => void;
  setOpenAddTask: (fn: () => void) => void;
}>({
  openAIChat: () => {},
  openAddTask: () => {},
  setOpenAIChat: () => {},
  setOpenAddTask: () => {},
});

// Screen wrapper that fades in on mount
function ScreenEntry({ children }: { children: React.ReactNode }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 200, friction: 18, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {children}
    </Animated.View>
  );
}

export default function HomeLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [navStyle, setNavStyle] = useState<'bottom' | 'sidebar'>('bottom');
  const [aiChatFn, setAiChatFn] = useState<() => void>(() => () => {});
  const [addTaskFn, setAddTaskFn] = useState<() => void>(() => () => {});

  useEffect(() => {
    const load = async () => {
      const v = await AsyncStorage.getItem('krios_nav_style');
      if (v === 'sidebar' || v === 'bottom') setNavStyle(v);
    };
    load();
    const id = setInterval(load, 500);
    return () => clearInterval(id);
  }, []);

  const ctxValue = {
    openAIChat: aiChatFn,
    openAddTask: addTaskFn,
    setOpenAIChat: (fn: () => void) => setAiChatFn(() => fn),
    setOpenAddTask: (fn: () => void) => setAddTaskFn(() => fn),
  };

  const hideBottomNav = pathname === '/(home)/chat'
    || pathname === '/chat'
    || pathname === '/(home)/ai-chat'
    || pathname === '/ai-chat'
    || pathname === '/(home)/task-thread'
    || pathname === '/task-thread';

  return (
    <HomeNavContext.Provider value={ctxValue}>
      <View style={styles.root}>
        <Stack screenOptions={{ 
         headerShown: false, 
         animation: 'slide_from_bottom',
         contentStyle: { backgroundColor: 'transparent' },
         presentation: 'transparentModal'
       }}>
          <Stack.Screen name="index" options={{ animation: 'none', presentation: 'card' }} />
          <Stack.Screen name="rooms" options={{ animation: 'none', presentation: 'card' }} />
          <Stack.Screen name="profile" options={{ animation: 'none', presentation: 'card' }} />
          <Stack.Screen name="settings" options={{ animation: 'none', presentation: 'card' }} />
          <Stack.Screen name="task-thread" options={{ animation: 'slide_from_bottom', gestureEnabled: true, presentation: 'transparentModal' }} />
          <Stack.Screen name="ai-chat" options={{ animation: 'slide_from_bottom', gestureEnabled: true, presentation: 'transparentModal' }} />
          <Stack.Screen name="messages" options={{ animation: 'none', presentation: 'card' }} />
          <Stack.Screen name="chat" options={{ animation: 'slide_from_right', gestureEnabled: true, presentation: 'card' }} />
        </Stack>

        {navStyle === 'sidebar' && (
          <SidebarNav onAIPress={aiChatFn} onAddTask={addTaskFn} />
        )}

        {navStyle === 'bottom' && !hideBottomNav && (
          <CircularKMenu
            menuItems={[
              { icon: 'home-outline', label: 'Home', onPress: () => router.push('/(home)'), color: '#6366f1' },
              { icon: 'chatbubbles-outline', label: 'Messages', onPress: () => router.push('/(home)/messages'), color: '#8b5cf6' },
              { icon: 'sparkles-outline', label: 'AI Chat', onPress: aiChatFn, color: '#06b6d4' },
              { icon: 'person-outline', label: 'Profile', onPress: () => router.push('/(home)/profile'), color: '#f59e0b' },
            ]}
          />
        )}
      </View>
    </HomeNavContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
