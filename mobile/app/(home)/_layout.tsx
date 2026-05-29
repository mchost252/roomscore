import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { View, StyleSheet, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import SidebarNav from '../../components/SidebarNav';
import BottomTabBar from '../../components/BottomTabBar';
import { NotificationProvider } from '../../context/NotificationContext';
import { HomeNavContext } from '../../context/HomeNavContext';

const HOME_TAB_ROUTES = ['/(home)', '/(home)/rooms', '/(home)/messages', '/(home)/profile'];
const HOME_TAB_COUNT = HOME_TAB_ROUTES.length;
const SWIPE_DISTANCE_THRESHOLD = 34;
const SWIPE_VELOCITY_THRESHOLD = 0.22;

function isPrimaryHomePath(pathname: string) {
  return pathname === '/' ||
    pathname === '/(home)' ||
    pathname === '/(home)/index' ||
    pathname === '/rooms' ||
    pathname === '/(home)/rooms' ||
    pathname === '/messages' ||
    pathname === '/(home)/messages' ||
    pathname === '/profile' ||
    pathname === '/(home)/profile';
}

export default function HomeLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const [navStyle, setNavStyle] = useState<'bottom' | 'sidebar'>('bottom');
  const [aiChatFn, setAiChatFn] = useState<() => void>(() => () => {});
  const [addTaskFn, setAddTaskFn] = useState<() => void>(() => () => {});
  const [homeTabAnimation, setHomeTabAnimation] = useState<'slide_from_right' | 'slide_from_left'>('slide_from_right');
  const [optimisticHomeTabIndex, setOptimisticHomeTabIndex] = useState<number | null>(null);

  // ── Notification tap handler ────────────────────────────────────────────
  // When user taps a notification, deep-link to the relevant task thread
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (!data) return;

      if (data.type === 'due-reminder' && data.taskId) {
        router.push({
          pathname: '/(home)/task-thread',
          params: { taskId: data.taskId as string, taskTitle: response.notification.request.content.body || '' },
        });
      } else if (data.type === 'morning-digest' || data.type === 'evening-preview') {
        // Navigate to home screen (tasks list)
        router.push('/(home)');
      }
    });

    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    const load = async () => {
      const v = await AsyncStorage.getItem('krios_nav_style');
      if (v === 'sidebar' || v === 'bottom') setNavStyle(v);
    };
    load();
    // Poll infrequently — nav style rarely changes (only from settings)
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const prefetch = (router as any).prefetch;
    if (typeof prefetch !== 'function') return;
    HOME_TAB_ROUTES.forEach((route, index) => {
      setTimeout(() => prefetch(route), index * 120);
    });
  }, [router]);

  const setOpenAIChatStable = useCallback((fn: () => void) => setAiChatFn(() => fn), []);
  const setOpenAddTaskStable = useCallback((fn: () => void) => setAddTaskFn(() => fn), []);
  const getHomeTabIndex = useCallback((pathOrRoute: string) => {
    if (pathOrRoute.includes('/rooms')) return 1;
    if (pathOrRoute.includes('/messages')) return 2;
    if (pathOrRoute.includes('/profile')) return 3;
    return 0;
  }, []);

  const routeHomeTabIndex = getHomeTabIndex(pathname);
  const isPrimaryHomeTab = isPrimaryHomePath(pathname);
  const activeNavTabIndex = optimisticHomeTabIndex ?? routeHomeTabIndex;

  const navigateHomeTab = useCallback((route: string) => {
    const currentIndex = getHomeTabIndex(pathname);
    const targetIndex = getHomeTabIndex(route);
    if (targetIndex === currentIndex && isPrimaryHomePath(pathname)) return;

    setOptimisticHomeTabIndex(targetIndex);
    setHomeTabAnimation(targetIndex >= currentIndex ? 'slide_from_right' : 'slide_from_left');
    router.replace(route as any);
  }, [getHomeTabIndex, pathname, router]);

  useEffect(() => {
    if (optimisticHomeTabIndex === null) return;
    if (optimisticHomeTabIndex === routeHomeTabIndex) {
      setOptimisticHomeTabIndex(null);
    }
  }, [optimisticHomeTabIndex, routeHomeTabIndex]);

  const swipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      if (!isPrimaryHomeTab) return false;
      return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
    },
    onPanResponderRelease: (_, gestureState) => {
      const shouldSwipe = Math.abs(gestureState.dx) > SWIPE_DISTANCE_THRESHOLD || Math.abs(gestureState.vx) > SWIPE_VELOCITY_THRESHOLD;
      if (!shouldSwipe) return;

      const direction = gestureState.dx < 0 ? 1 : -1;
      const targetIndex = Math.max(0, Math.min(HOME_TAB_COUNT - 1, routeHomeTabIndex + direction));
      if (targetIndex === routeHomeTabIndex) return;
      navigateHomeTab(HOME_TAB_ROUTES[targetIndex]);
    },
  }), [isPrimaryHomeTab, navigateHomeTab, routeHomeTabIndex]);

  const ctxValue = React.useMemo(() => ({
    openAIChat: aiChatFn,
    openAddTask: addTaskFn,
    navigateHomeTab,
    setOpenAIChat: setOpenAIChatStable,
    setOpenAddTask: setOpenAddTaskStable,
  }), [aiChatFn, addTaskFn, navigateHomeTab, setOpenAIChatStable, setOpenAddTaskStable]);

  return (
    <NotificationProvider>
      <HomeNavContext.Provider value={ctxValue}>
        <View style={styles.root} {...swipeResponder.panHandlers}>
          <Stack screenOptions={{ 
         headerShown: false, 
         animation: homeTabAnimation,
         gestureEnabled: true,
         contentStyle: { backgroundColor: '#080810' },
         presentation: 'card'
       }}>
          <Stack.Screen name="index" options={{ animation: homeTabAnimation, gestureEnabled: true, presentation: 'card' }} />
          <Stack.Screen name="rooms" options={{ animation: homeTabAnimation, gestureEnabled: true, presentation: 'card' }} />
          <Stack.Screen name="room-detail" options={{ animation: 'slide_from_right', gestureEnabled: true, presentation: 'card' }} />
          <Stack.Screen name="profile" options={{ animation: homeTabAnimation, gestureEnabled: true, presentation: 'card' }} />
          <Stack.Screen name="settings" options={{ animation: 'slide_from_right', gestureEnabled: true, presentation: 'card' }} />
          <Stack.Screen name="task-thread" options={{ animation: 'slide_from_bottom', gestureEnabled: true, presentation: 'modal' }} />
          <Stack.Screen name="room-task-thread" options={{ animation: 'slide_from_bottom', gestureEnabled: true, presentation: 'modal' }} />
          <Stack.Screen name="focus-session" options={{ animation: 'slide_from_bottom', gestureEnabled: true, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="ai-chat" options={{ animation: 'slide_from_right', gestureEnabled: true, presentation: 'card' }} />
          <Stack.Screen name="messages" options={{ animation: homeTabAnimation, gestureEnabled: true, presentation: 'card' }} />
          <Stack.Screen name="chat" options={{ animation: 'slide_from_right', gestureEnabled: true, presentation: 'card' }} />
        </Stack>

        {isPrimaryHomeTab && navStyle === 'sidebar' && (
          <SidebarNav activeTabIndex={activeNavTabIndex} onAIPress={aiChatFn} onAddTask={addTaskFn} onNavigate={navigateHomeTab} />
        )}

        {isPrimaryHomeTab && navStyle === 'bottom' && (
          <BottomTabBar activeTabIndex={activeNavTabIndex} onAddTask={addTaskFn} onNavigate={navigateHomeTab} />
        )}
      </View>
    </HomeNavContext.Provider>
    </NotificationProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
