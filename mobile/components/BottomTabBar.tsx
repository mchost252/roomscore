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
  onAddTask,
}: {
  onAddTask: () => void;
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
    const unsub = (messageService as any).on?.('conversations_updated', refreshUnread);
    return () => {
      (messageService as any).off?.('conversations_updated', refreshUnread);
      if (typeof unsub === 'function') unsub();
    };
  }, [refreshUnread]);

  return (
    <>
      {/* Background shell */}
      <View
        style={{
          position: 'absolute', zIndex: 1,
          bottom: 0,
          left: 0,
          right: 0,
          height: insets.bottom + 56,
          backgroundColor: isDark ? '#16162a' : '#ffffff',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTopWidth: 1.5,
          borderColor: isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)',
        }}
      />

      <View style={[s.tabBar, { paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Home */}
        <TouchableOpacity style={s.tabItem} onPress={() => router.push('/(home)')}>
          <Ionicons 
            name={pathname === '/' || pathname === '/(home)' || pathname === '/(home)/index' ? 'home' : 'home-outline'} 
            size={22} 
            color={pathname === '/' || pathname === '/(home)' || pathname === '/(home)/index' ? primary : textHint} 
          />
          {(pathname === '/' || pathname === '/(home)' || pathname === '/(home)/index') && (
            <View style={[s.tabActiveDot, { backgroundColor: primary }]} />
          )}
        </TouchableOpacity>

        {/* Rooms */}
        <TouchableOpacity style={s.tabItem} onPress={() => router.push('/(home)/rooms')}>
          <Ionicons 
            name={pathname.includes('/rooms') ? 'planet' : 'planet-outline'} 
            size={22} 
            color={pathname.includes('/rooms') ? primary : textHint} 
          />
          {pathname.includes('/rooms') && (
            <View style={[s.tabActiveDot, { backgroundColor: primary }]} />
          )}
        </TouchableOpacity>

        {/* Center FAB */}
        <View style={{ width: 72, alignItems: 'center', marginTop: -30 }}>
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
        <TouchableOpacity style={s.tabItem} onPress={() => router.push('/(home)/messages')}>
          <View>
            <Ionicons 
              name={pathname.includes('/messages') ? 'chatbubbles' : 'chatbubbles-outline'} 
              size={22} 
              color={pathname.includes('/messages') ? primary : textHint} 
            />
            {pathname.includes('/messages') && (
              <View style={[s.tabActiveDot, { backgroundColor: primary, position: 'absolute', zIndex: 1, bottom: -12, alignSelf: 'center' }]} />
            )}
            {unreadCount > 0 && (
              <View style={s.unreadBadge}>
                <Text style={s.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Profile */}
        <TouchableOpacity style={s.tabItem} onPress={() => router.push('/(home)/profile')}>
          <Ionicons 
            name={pathname.includes('/profile') ? 'person' : 'person-outline'} 
            size={22} 
            color={pathname.includes('/profile') ? primary : textHint} 
          />
          {pathname.includes('/profile') && (
            <View style={[s.tabActiveDot, { backgroundColor: primary }]} />
          )}
        </TouchableOpacity>
      </View>

      {/* Thin top edge line */}
      <View style={{ position: 'absolute', zIndex: 1, left: 0, right: 0, bottom: insets.bottom + 64, height: 1, backgroundColor: border, opacity: 0.7 }} />
    </>
  );
}

const s = StyleSheet.create({
  tabBar: {
    position: 'absolute', zIndex: 1,
    left: 0,
    right: 0,
    bottom: 0,
    height: 105,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
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
    elevation: 20,
  },
  fabGrad: { flex: 1, borderRadius: 29, alignItems: 'center', justifyContent: 'center', },
  unreadBadge: {
    position: 'absolute', zIndex: 1,
    top: -4,
    right: -8,
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
