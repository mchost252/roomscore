import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { View, StyleSheet, InteractionManager } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import {
  HOME_TAB_ROUTES,
  getHomeTabIndex as resolveHomeTabIndex,
  isPrimaryHomePath,
} from '../../constants/homeTabs';
import SidebarNav from '../../components/SidebarNav';
import BottomTabBar from '../../components/BottomTabBar';
import { NotificationProvider } from '../../context/NotificationContext';
import { HomeNavContext } from '../../context/HomeNavContext';
import AIBlobToast from '../../components/ai/AIBlobToast';
import { aiBehaviorEngine } from '../../services/aiBehaviorEngine';
import { useAuth } from '../../context/AuthContext';
import notificationService from '../../services/notificationService';

export default function HomeLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  // Subscribed to the settings store, so a change in Settings re-renders this
  // layout immediately. Persisted via MMKV, which hydrates synchronously — no flash.
  const navStyle = useSettingsStore((s) => s.navigationStyle);
  // Screen-supplied handlers live in refs, not state. Every home screen calls
  // setOpenAIChat/setOpenAddTask from its focus effect, so holding these in
  // state re-rendered HomeLayout — and changed the onAddTask prop identity,
  // defeating React.memo on the nav bars — on every single tab switch.
  const aiChatRef = useRef<() => void>(() => {});
  const addTaskRef = useRef<() => void>(() => {});
  const openAIChat = useCallback(() => aiChatRef.current?.(), []);
  const openAddTask = useCallback(() => addTaskRef.current?.(), []);
  const [homeTabAnimation, setHomeTabAnimation] = useState<'slide_from_right' | 'slide_from_left'>('slide_from_right');
  const [optimisticHomeTabIndex, setOptimisticHomeTabIndex] = useState<number | null>(null);

  const [aiToast, setAiToast] = useState<{ message: string; action: string } | null>(null);
  const [showAiToast, setShowAiToast] = useState(false);

  const showAiToastFn = useCallback((toast: { message: string; action: string }) => {
    setAiToast(toast);
    setShowAiToast(true);
  }, []);

  const hideAiToastFn = useCallback(() => {
    setShowAiToast(false);
  }, []);

  const handleNotificationData = useCallback((data: Record<string, unknown> | undefined, body = '') => {
    if (!data) return;
    const type = String(data.type || data.notificationType || '');
    const roomId = data.roomId ? String(data.roomId) : '';
    const friendId = String(data.friendId || data.senderId || '');
    const taskId = data.taskId ? String(data.taskId) : '';

    if (type === 'direct_message' && friendId) {
      router.push({ pathname: '/(home)/chat', params: { friendId, requestStatus: 'accepted' } });
    } else if (type === 'friend_request' || type === 'friend_request_accepted') {
      router.push('/(home)/more');
    } else if (roomId && (type.includes('room') || type === 'room_updated' || type === 'task_reminder' || type === 'task_completed')) {
      if (type === 'room_updated') {
        router.push({ pathname: '/(home)/room-chat', params: { roomId, roomName: String(data.roomName || 'Room') } });
      } else if (taskId) {
        router.push({ pathname: '/(home)/room-task-thread', params: { roomId, taskId, taskTitle: body } });
      } else {
        router.push({ pathname: '/(home)/room-detail', params: { roomId } });
      }
    } else if (taskId || type === 'due-reminder') {
      router.push({ pathname: '/(home)/task-thread', params: { taskId, taskTitle: body } });
    } else if (type === 'morning-digest' || type === 'evening-preview' || type === 'achievement_unlocked') {
      router.push('/(home)');
    }
    notificationService.syncUnreadBadge().catch(() => {});
  }, [router]);

  useEffect(() => {
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      handleNotificationData(
        response.notification.request.content.data as Record<string, unknown>,
        response.notification.request.content.body || '',
      );
    });
    const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
      notificationService.syncUnreadBadge().catch(() => {});
    });
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) {
        handleNotificationData(
          response.notification.request.content.data as Record<string, unknown>,
          response.notification.request.content.body || '',
        );
      }
    }).catch(() => {});

    return () => {
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  }, [handleNotificationData]);

  // AI toast — deferred past the slide-in animation and shown at most once per
  // session. Previously ran aiBehaviorEngine.load() + getProfileSummary() on
  // every mount, competing with the JS thread during the Home transition.
  const aiToastShownRef = useRef(false);
  useEffect(() => {
    if (aiToastShownRef.current || !user?.id) return;
    const handle = InteractionManager.runAfterInteractions(() => {
      // Additional 4s delay — toast is low priority, let the screen fully settle
      const timer = setTimeout(async () => {
        try {
          await aiBehaviorEngine.load();
          const summary = await aiBehaviorEngine.getProfileSummary();

          const hour = new Date().getHours();
          const currentPeriod =
            hour >= 5 && hour < 12
              ? 'morning'
              : hour >= 12 && hour < 17
                ? 'afternoon'
                : hour >= 17 && hour < 21
                  ? 'evening'
                  : 'night';

          const hasFocusHistory =
            summary.topCategories &&
            Object.keys(summary.topCategories).length > 0;

          if (hasFocusHistory || summary.preferredTimeOfDay === currentPeriod) {
            aiToastShownRef.current = true;
            showAiToastFn({
              message: `You usually focus around ${currentPeriod}. Start a session?`,
              action: 'Start Focus',
            });
          }
        } catch {
          // best-effort; never block UI on AI toast
        }
      }, 4000);
      return () => clearTimeout(timer);
    });
    return () => handle.cancel();
  }, [user?.id]); // showAiToastFn is stable (useCallback with no deps) — omit it

  useEffect(() => {
    const prefetch = (router as any).prefetch;
    if (typeof prefetch !== 'function') return;
    HOME_TAB_ROUTES.forEach((route, index) => {
      setTimeout(() => prefetch(route), index * 120);
    });
  }, [router]);

  const setOpenAIChatStable = useCallback((fn: () => void) => { aiChatRef.current = fn; }, []);
  const setOpenAddTaskStable = useCallback((fn: () => void) => { addTaskRef.current = fn; }, []);
  const getHomeTabIndex = useCallback(
    (pathOrRoute: string) => resolveHomeTabIndex(pathOrRoute),
    [],
  );

  const routeHomeTabIndex = getHomeTabIndex(pathname);
  const isPrimaryHomeTab = isPrimaryHomePath(pathname);
  const activeNavTabIndex = optimisticHomeTabIndex ?? routeHomeTabIndex;

  // pathname changes on every navigation. Reading it through a ref keeps
  // navigateHomeTab referentially stable — without this, the callback identity
  // changed on each transition and defeated React.memo on both nav bars.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const navigateHomeTab = useCallback((route: string) => {
    const current = pathnameRef.current;
    const currentIndex = getHomeTabIndex(current);
    const targetIndex = getHomeTabIndex(route);
    if (targetIndex === currentIndex && isPrimaryHomePath(current)) return;

    // Animation direction must be set before the navigation commits so the Stack
    // picks it up. The optimistic tab highlight is purely cosmetic, so it's
    // deferred a frame — applying it synchronously forced a full HomeLayout +
    // tab bar re-render in the same frame as the navigation, which is what made
    // the screen visibly wait before sliding.
    setHomeTabAnimation(targetIndex >= currentIndex ? 'slide_from_right' : 'slide_from_left');
    router.replace(route as any);
    requestAnimationFrame(() => {
      setOptimisticHomeTabIndex(targetIndex);
    });
  }, [getHomeTabIndex, router]);

  useEffect(() => {
    if (optimisticHomeTabIndex === null) return;
    if (optimisticHomeTabIndex === routeHomeTabIndex) {
      setOptimisticHomeTabIndex(null);
    }
  }, [optimisticHomeTabIndex, routeHomeTabIndex]);

  const ctxValue = React.useMemo(() => ({
    openAIChat,
    openAddTask,
    navigateHomeTab,
    setOpenAIChat: setOpenAIChatStable,
    setOpenAddTask: setOpenAddTaskStable,
    aiToast,
    showAiToast: showAiToastFn,
    hideAiToast: hideAiToastFn,
  }), [openAIChat, openAddTask, navigateHomeTab, setOpenAIChatStable, setOpenAddTaskStable, aiToast, showAiToastFn, hideAiToastFn]);

  return (
    <NotificationProvider>
      <HomeNavContext.Provider value={ctxValue}>
        <View style={styles.root}>
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
           {/* More is a modal so Android hardware-back closes it and it can sit
               above the nav overlay (which paints over <Stack>). */}
           <Stack.Screen name="more" options={{ animation: 'slide_from_bottom', gestureEnabled: true, presentation: 'modal' }} />
           <Stack.Screen name="appearance" options={{ animation: 'slide_from_right', gestureEnabled: true, presentation: 'card' }} />
           <Stack.Screen name="activity" options={{ animation: 'slide_from_right', gestureEnabled: true, presentation: 'card' }} />
           <Stack.Screen name="task-thread" options={{ animation: 'slide_from_right', gestureEnabled: true, presentation: 'card' }} />
           <Stack.Screen name="room-task-thread" options={{ animation: 'slide_from_right', gestureEnabled: true, presentation: 'card' }} />
           <Stack.Screen name="focus-session" options={{ animation: 'slide_from_right', gestureEnabled: true, presentation: 'card' }} />
           <Stack.Screen name="ai-chat" options={{ animation: 'slide_from_right', gestureEnabled: true, presentation: 'card' }} />
           <Stack.Screen name="messages" options={{ animation: homeTabAnimation, gestureEnabled: true, presentation: 'card' }} />
           <Stack.Screen name="chat" options={{ animation: 'slide_from_right', gestureEnabled: true, presentation: 'card' }} />
         </Stack>

         {navStyle === 'sidebar' && (
          <View
            style={[styles.navOverlay, { opacity: isPrimaryHomeTab ? 1 : 0 }]}
            pointerEvents={isPrimaryHomeTab ? 'box-none' : 'none'}
          >
            <SidebarNav activeTabIndex={activeNavTabIndex} onAIPress={openAIChat} onAddTask={openAddTask} onNavigate={navigateHomeTab} />
          </View>
        )}

         {navStyle === 'bottom' && (
          <View
            style={[styles.navOverlay, { opacity: isPrimaryHomeTab ? 1 : 0 }]}
            pointerEvents={isPrimaryHomeTab ? 'box-none' : 'none'}
          >
            <BottomTabBar activeTabIndex={activeNavTabIndex} onAddTask={openAddTask} onNavigate={navigateHomeTab} />
          </View>
        )}

         {isPrimaryHomeTab && (
           <AIBlobToast
             visible={showAiToast}
             message={aiToast?.message || ''}
             actionLabel={aiToast?.action}
             onAction={() => {
               setShowAiToast(false);
               openAIChat();
             }}
             onClose={hideAiToastFn}
           />
         )}
       </View>
    </HomeNavContext.Provider>
    </NotificationProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Must fill the screen: SidebarNav's pill anchors itself with top:'50%', which
  // resolves against this parent. A zero-height wrapper collapsed it to the bottom.
  navOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
});
