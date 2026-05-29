import React, { useEffect, useState, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import messageService from '../services/messageService';

/**
 * The app's real Bottom Tab Bar (the one used on Home screen).
 * Extracted so it can be reused on Messages and other screens.
 */
export default function BottomTabBar({
  activeTabIndex,
  onAddTask,
  onNavigate,
}: {
  activeTabIndex?: number;
  onAddTask: () => void;
  onNavigate?: (route: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const primary = colors.primary;
  const textHint = colors.textTertiary;
  const border = colors.border.primary;

  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const count = await messageService.getUnreadCount();
      setUnreadCount(count);
    } catch {}
  }, []);

  useEffect(() => {
    refreshUnread();
    const unsub = (messageService as any).on?.('conversation:list', refreshUnread);
    return () => {
      (messageService as any).off?.('conversation:list', refreshUnread);
      if (typeof unsub === 'function') unsub();
    };
  }, [refreshUnread]);

  const pathTabIndex = pathname.includes('/rooms')
    ? 1
    : pathname.includes('/messages') || pathname.includes('/chat')
      ? 2
      : pathname.includes('/profile') || pathname.includes('/settings')
        ? 3
        : 0;
  const displayTabIndex = activeTabIndex ?? pathTabIndex;

  const isHomeActive = displayTabIndex === 0;
  const isRoomsActive = displayTabIndex === 1;
  const isMessagesActive = displayTabIndex === 2;
  const isProfileActive = displayTabIndex === 3;

  const isHomeRoute = pathname === '/' || pathname === '/(home)' || pathname === '/(home)/index';
  const isRoomsRoute = pathname === '/rooms' || pathname === '/(home)/rooms';
  const isMessagesRoute = pathname === '/messages' || pathname === '/(home)/messages';
  const isProfileRoute = pathname === '/profile' || pathname === '/(home)/profile';

  const handleNavigation = useCallback((route: string, isActive: boolean) => {
    if (!isActive) {
      if (onNavigate) onNavigate(route);
      else router.push(route);
    }
    // If already active, do nothing to prevent re-render/shake
  }, [onNavigate, router]);

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        backgroundColor: isDark ? '#16162a' : '#ffffff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderTopWidth: 1.5,
        borderColor: isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)',
        paddingBottom: Math.max(insets.bottom, 10),
      }}
    >
      <View style={s.tabBarContent}>
        {/* Home */}
        <TouchableOpacity style={s.tabItem} onPress={() => handleNavigation('/(home)', isHomeRoute)}>
          <Ionicons 
            name={isHomeActive ? 'home' : 'home-outline'} 
            size={22} 
            color={isHomeActive ? primary : textHint} 
          />
          {isHomeActive && (
            <View style={[s.tabActiveDot, { backgroundColor: primary }]} />
          )}
        </TouchableOpacity>

        {/* Rooms */}
        <TouchableOpacity style={s.tabItem} onPress={() => handleNavigation('/(home)/rooms', isRoomsRoute)}>
          <Ionicons 
            name={isRoomsActive ? 'planet' : 'planet-outline'} 
            size={22} 
            color={isRoomsActive ? primary : textHint} 
          />
          {isRoomsActive && (
            <View style={[s.tabActiveDot, { backgroundColor: primary }]} />
          )}
        </TouchableOpacity>

        {/* Center FAB */}
        <View style={{ width: 72, alignItems: 'center', marginTop: -24 }}>
          <TouchableOpacity
            onPress={onAddTask}
            activeOpacity={0.85}
            style={[s.fab, { shadowColor: primary }]}
          >
            <LinearGradient
              colors={['#818cf8', '#6366f1', '#4f46e5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.fabGrad}
            >
              <Ionicons name="add" size={28} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <TouchableOpacity style={s.tabItem} onPress={() => handleNavigation('/(home)/messages', isMessagesRoute)}>
          <View>
            <Ionicons 
              name={isMessagesActive ? 'chatbubbles' : 'chatbubbles-outline'} 
              size={22} 
              color={isMessagesActive ? primary : textHint} 
            />
            {isMessagesActive && (
              <View style={[s.tabActiveDot, { backgroundColor: primary, position: 'absolute', bottom: -12, alignSelf: 'center' }]} />
            )}
            {unreadCount > 0 && (
              <View style={s.unreadBadge}>
                <Text style={s.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Profile */}
        <TouchableOpacity style={s.tabItem} onPress={() => handleNavigation('/(home)/profile', isProfileRoute)}>
          <Ionicons 
            name={isProfileActive ? 'person' : 'person-outline'} 
            size={22} 
            color={isProfileActive ? primary : textHint} 
          />
          {isProfileActive && (
            <View style={[s.tabActiveDot, { backgroundColor: primary }]} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  tabBarContent: {
    height: 65,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', width: 44, height: 44 },
  tabActiveDot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },

  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 10,
  },
  fabGrad: { flex: 1, borderRadius: 29, alignItems: 'center', justifyContent: 'center', },
  unreadBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#6366f1',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
