import React, { useState, useCallback } from 'react';
import { View, Text, Image, StyleSheet, Pressable, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  interpolate, Extrapolation, runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import messageService from '../services/messageService';

const { height: SH } = Dimensions.get('window');
const ITEM_H  = 48;
const K_SIZE  = 52;
const OPEN_W  = 68;
const LABEL_W = 220;
const N = 7; // nav items count
const OPEN_H  = K_SIZE + N * ITEM_H + 8;

const NAV_ITEMS = [
  { icon: 'home',                label: 'Home',     route: '/(home)',          active: ['/', '/(home)', '/(home)/index', '/index'] },
  { icon: 'briefcase-outline',   label: 'Rooms',    route: '/(home)/rooms',    active: ['/(home)/rooms', '/rooms'] },
  { icon: 'chatbubbles-outline', label: 'Messages', route: '/(home)/messages', active: ['/(home)/messages', '/messages'] },
  { icon: 'person-outline',      label: 'Profile',  route: '/(home)/profile',  active: ['/(home)/profile', '/profile'] },
  { icon: 'settings-outline',    label: 'Settings', route: '/(home)/settings', active: ['/(home)/settings', '/settings'] },
  { icon: 'chatbubble-ellipses', label: 'Krios AI', route: 'ai',               active: [] },
  { icon: 'add-circle-outline',  label: 'Add Task', route: 'add',              active: [] },
] as const;

const FADE_ROUTES = ['/profile', '/settings', '/rooms', '/chat', '/(home)/profile', '/(home)/settings', '/(home)/rooms', '/(home)/chat'];

interface Props { onAIPress: () => void; onAddTask: () => void; }

export default function SidebarNav({ onAIPress, onAddTask }: Props) {
  const { colors, isDark } = useTheme();
  const router   = useRouter();
  const pathname = usePathname();

  const [open,   setOpen]   = useState(false);
  const [labeled, setLabeled] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const count = await messageService.getUnreadCount();
      setUnreadCount(count);
    } catch {}
  }, []);

  React.useEffect(() => {
    refreshUnread();
    const unsub = (messageService as any).on?.('conversations_updated', refreshUnread);
    return () => {
      (messageService as any).off?.('conversations_updated', refreshUnread);
      if (typeof unsub === 'function') unsub();
    };
  }, [refreshUnread]);

  // Shared values
  const pillW   = useSharedValue(K_SIZE);
  const pillH   = useSharedValue(K_SIZE);
  // translateY keeps pill centered: when height grows by dH, shift up by dH/2
  const pillTY  = useSharedValue(0);
  const bdAlpha = useSharedValue(0);
  const opacity = useSharedValue(1);
  const labelsO = useSharedValue(0);
  const itemsO  = useSharedValue(0);

  const P      = colors.primary;
  const bg     = isDark ? 'rgba(8,8,20,0.94)' : 'rgba(248,249,255,0.96)';
  const border = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)';
  const textC  = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)';

  // Fade on non-home routes
  const shouldFade = FADE_ROUTES.some(r => pathname === r || pathname.startsWith(r));
  React.useEffect(() => {
    opacity.value = withTiming(shouldFade ? 0 : 1, { duration: 200 });
  }, [shouldFade]);

  const SPRING_OPEN  = { mass: 0.4,  damping: 16, stiffness: 300 } as const;
  const SPRING_CLOSE = { mass: 0.35, damping: 18, stiffness: 360 } as const;

  const doClose = useCallback(() => {
    // Animate back to collapsed — translate up to keep center
    pillW.value   = withSpring(K_SIZE, SPRING_CLOSE);
    pillH.value   = withSpring(K_SIZE, SPRING_CLOSE);
    pillTY.value  = withSpring(0, SPRING_CLOSE);
    bdAlpha.value = withTiming(0, { duration: 150 });
    labelsO.value = withTiming(0, { duration: 80 });
    itemsO.value  = withTiming(0, { duration: 100 });
    runOnJS(setOpen)(false);
    runOnJS(setLabeled)(false);
  }, []);

  const doOpen = useCallback(() => {
    setOpen(true);
    const dH = OPEN_H - K_SIZE; // extra height gained
    pillW.value   = withSpring(OPEN_W, SPRING_OPEN);
    pillH.value   = withSpring(OPEN_H, SPRING_OPEN);
    // Move up by half the extra height so pill stays centred
    pillTY.value  = withSpring(-(dH / 2), SPRING_OPEN);
    bdAlpha.value = withTiming(0.42, { duration: 150 });
    itemsO.value  = withTiming(1, { duration: 220 });
  }, []);

  const onKPress = useCallback(() => {
    if (!open) {
      doOpen();
    } else if (!labeled) {
      setLabeled(true);
      pillW.value   = withSpring(LABEL_W, SPRING_OPEN);
      labelsO.value = withTiming(1, { duration: 180 });
    } else {
      doClose();
    }
  }, [open, labeled, doOpen, doClose]);

  const navigate = useCallback((route: string) => {
    doClose();
    // Increase the timeout slightly to allow the close spring animation to fully resolve 
    // before locking the JS thread with React Navigation's heavy unmount/mount cycles.
    setTimeout(() => {
      if      (route === 'ai')  { onAIPress(); }
      else if (route === 'add') { onAddTask(); }
      else                      { router.push(route as any); }
    }, 150);
  }, [onAIPress, onAddTask, router, doClose]);

  // Animated styles
  const pillStyle = useAnimatedStyle(() => ({
    width:   pillW.value,
    height:  pillH.value,
    opacity: opacity.value,
    transform: [{ translateY: pillTY.value }],
  }));

  const bdStyle = useAnimatedStyle(() => ({
    opacity:       bdAlpha.value,
    pointerEvents: bdAlpha.value > 0.01 ? 'auto' : 'none',
  } as any));

  const itemsStyle  = useAnimatedStyle(() => ({ opacity: itemsO.value }));
  const labelStyle  = useAnimatedStyle(() => ({ opacity: labelsO.value }));

  return (
    <>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, bdStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={doClose} />
      </Animated.View>

      {/* Pill — anchored at vertical center via top:50% + marginTop:-K_SIZE/2, then translateY keeps it centred */}
      <Animated.View
        style={[styles.pill, { backgroundColor: bg, borderColor: border }, pillStyle]}
        pointerEvents={shouldFade ? 'none' : 'auto'}
      >
        {/* Logo button — always full-width of pill, centered */}
        <TouchableOpacity style={styles.kBtn} onPress={onKPress} activeOpacity={0.75}>
          <View style={[styles.kCircle, {
            backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
            borderColor: P + '44',
            borderWidth: 1,
          }]}>
            <Image source={require('../assets/krios-logo.png')} style={styles.kLogo} resizeMode="contain" />
          </View>
        </TouchableOpacity>

        {/* Nav items */}
        <Animated.View style={[styles.items, itemsStyle]}>
          {NAV_ITEMS.map((item, i) => {
            const isActive = item.active.some((a: string) => {
              if (a === '/' || a === '/(home)' || a === '/(home)/index' || a === '/index') {
                return pathname === a; // strict equality for home routes
              }
              return pathname === a || pathname.startsWith(a + '/');
            });
            const isAI     = item.route === 'ai';
            const isAdd    = item.route === 'add';
            const iColor   = isActive ? P : isAI ? P : isAdd ? '#22c55e' : textC;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.item, isActive && { backgroundColor: `${P}15` }]}
                onPress={() => navigate(item.route)}
                activeOpacity={0.7}
              >
                {isActive && <View style={[styles.activeDot, { backgroundColor: P }]} />}
                <View style={[
                  styles.iconBox,
                  isAI  && { backgroundColor: `${P}15` },
                  isAdd && { backgroundColor: 'rgba(34,197,94,0.1)' },
                ]}>
                  <View>
                    <Ionicons name={item.icon as any} size={19} color={iColor} />
                    {item.label === 'Messages' && unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Animated.Text numberOfLines={1} style={[styles.label, { color: isActive ? P : textC }, labelStyle]}>
                  {item.label}
                </Animated.Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: '#000',
    zIndex:          98,
  },
  pill: {
    position:      'absolute',
    left:          12,
    top:           '50%',
    marginTop:     -(K_SIZE / 2),   // offset for collapsed size; translateY handles expansion
    borderRadius:  26,
    borderWidth:   1,
    zIndex:        100,
    overflow:      'hidden',
    alignItems:    'center',
    shadowColor:   '#000',
    shadowOffset:  { width: 2, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius:  18,
    elevation:     22,
  },
  kBtn: {
    width:          '100%',
    height:         K_SIZE,
    alignItems:     'center',
    justifyContent: 'center',
  },
  kCircle: {
    width:          38,
    height:         38,
    borderRadius:   19,
    alignItems:     'center',
    justifyContent: 'center',
  },
  kLogo: { width: 26, height: 26 },
  items: {
    width:             '100%',
    paddingHorizontal: 6,
    paddingBottom:     8,
  },
  item: {
    flexDirection:     'row',
    alignItems:        'center',
    height:            ITEM_H,
    borderRadius:      14,
    paddingHorizontal: 6,
    marginBottom:      2,
    position:          'relative',
    overflow:          'hidden',
  },
  activeDot: {
    position:     'absolute',
    left:         0,
    top:          10,
    bottom:       10,
    width:        3,
    borderRadius: 2,
  },
  iconBox: {
    width:          36,
    height:         36,
    borderRadius:   11,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  label: {
    fontSize:      13,
    fontWeight:    '600',
    letterSpacing: -0.2,
    marginLeft:    8,
    flex:          1,
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#1e1e2e',
  },
  unreadText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});