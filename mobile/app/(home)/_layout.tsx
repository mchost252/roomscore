import React, { useState, useCallback, useEffect } from 'react';
import { Stack, usePathname } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SidebarNav from '../../components/SidebarNav';
import BottomTabBar from '../../components/BottomTabBar';
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

// Screen wrapper - disabled animations for instant render
function ScreenEntry({ children }: { children: React.ReactNode }) {
  // No animation - instant render for faster navigation
  return (
    <View style={{ flex: 1 }}>
      {children}
    </View>
  );
}

export default function HomeLayout() {
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

  const setOpenAIChatStable = useCallback((fn: () => void) => setAiChatFn(() => fn), []);
  const setOpenAddTaskStable = useCallback((fn: () => void) => setAddTaskFn(() => fn), []);

  const ctxValue = React.useMemo(() => ({
    openAIChat: aiChatFn,
    openAddTask: addTaskFn,
    setOpenAIChat: setOpenAIChatStable,
    setOpenAddTask: setOpenAddTaskStable,
  }), [aiChatFn, addTaskFn, setOpenAIChatStable, setOpenAddTaskStable]);

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
          <Stack.Screen name="create-room" options={{ animation: 'slide_from_right', gestureEnabled: true, presentation: 'card' }} />
          <Stack.Screen name="room-detail" options={{ animation: 'slide_from_right', gestureEnabled: true, presentation: 'card' }} />
        </Stack>

        {/* Sidebar nav: show on home and messages only, hide on modals */}
        {navStyle === 'sidebar' && (
          (pathname === '/' || 
          pathname === '/(home)' || 
          pathname === '/(home)/index' ||
          pathname === '/messages' ||
          pathname === '/(home)/messages') && (
            <SidebarNav onAIPress={aiChatFn} onAddTask={addTaskFn} />
          )
        )}

        {/* Bottom tab bar: show on home and messages only */}
        {navStyle === 'bottom' && (
          (pathname === '/' || 
          pathname === '/(home)' || 
          pathname === '/(home)/index' ||
          pathname === '/messages' ||
          pathname === '/(home)/messages') && (
            <BottomTabBar onAddTask={addTaskFn} />
          )
        )}
      </View>
    </HomeNavContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
