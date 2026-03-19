import React, { useState, useEffect, useCallback } from 'react';
import {
  Pressable,
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, TextInput, Keyboard, Platform, Image,
  InteractionManager,
} from 'react-native';
// Optional dependency (so bundling doesn't fail if not installed yet)
let ImagePicker: any = null;
if (Platform.OS !== 'web') {
  try {
    ImagePicker = require('expo-image-picker');
  } catch (e) {
    ImagePicker = null;
  }
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { imageStorageService } from '../../services/imageStorageService';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityHeatmap } from '../../components/profile/ActivityHeatmap';
import { AchievementBadge } from '../../components/profile/AchievementBadge';
import ConfirmationModal from '../../components/ConfirmationModal';

// Conditional Skia import
let SkCanvas: any, SkRect: any, skVec: any,
  SkLinearGradient: any, SkRadialGradient: any, SkBlurMask: any, SkRoundedRect: any;
let SKIA_OK = false;
if (Platform.OS !== 'web') {
  try {
    const S = require('@shopify/react-native-skia');
    SkCanvas = S.Canvas;
    SkRect = S.Rect;
    skVec = S.vec;
    SkLinearGradient = S.LinearGradient;
    SkRadialGradient = S.RadialGradient;
    SkBlurMask = S.BlurMask;
    SkRoundedRect = S.RoundedRect;
    SKIA_OK = true;
  } catch (e) {}
}

const { width: SW } = Dimensions.get('window');
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const HERO_SIZE = 88;
const MINI_SIZE = 32;
const COLLAPSE_AT = 130; // scroll px where hero fully collapses

type TabKey = 'about' | 'activity' | 'achievements';

/* ═══════════════════════════════════════════════════════════
   Skia Liquid Shimmer Card
   ═══════════════════════════════════════════════════════════ */
function LiquidCard({ children, w, h, dark, style }: {
  children: React.ReactNode; w: number; h: number; dark: boolean; style?: any;
}) {
  const borderClr = dark ? 'rgba(99,102,241,0.16)' : 'rgba(99,102,241,0.10)';

  if (!SKIA_OK) {
    return (
      <View style={[{ borderRadius: 22, overflow: 'hidden' }, style]}>
        <LinearGradient
          colors={dark
            ? ['rgba(99,102,241,0.10)', 'rgba(139,92,246,0.06)', 'rgba(99,102,241,0.10)'] as any
            : ['rgba(99,102,241,0.05)', 'rgba(167,139,250,0.03)', 'rgba(99,102,241,0.05)'] as any}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
        />
                  <LinearGradient
            colors={dark
              ? ['transparent', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.03)', 'transparent'] as any
              : ['transparent', 'rgba(99,102,241,0.02)', 'rgba(99,102,241,0.05)', 'rgba(99,102,241,0.02)', 'transparent'] as any}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
        />
        <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 22, borderWidth: 1, borderColor: borderClr }} />
        {children}
      </View>
    );
  }

  return (
    <View style={[{ borderRadius: 22, overflow: 'hidden' }, style]}>
      <SkCanvas style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}>
        {/* Base */}
        <SkRoundedRect x={0} y={0} width={w} height={h} r={22}>
          <SkLinearGradient start={skVec(0, 0)} end={skVec(w, h)}
            colors={dark ? ['#0f0f20', '#12122e', '#0e0e1e'] : ['#f8f8ff', '#f0f0fe', '#f5f3ff']} />
        </SkRoundedRect>
        {/* Top-left indigo blob */}
        <SkRect x={0} y={0} width={w * 0.6} height={h * 0.6}>
          <SkRadialGradient c={skVec(w * 0.15, h * 0.15)} r={w * 0.45}
            colors={dark ? ['rgba(99,102,241,0.22)', 'transparent'] : ['rgba(99,102,241,0.08)', 'transparent']} />
          <SkBlurMask blur={25} style="normal" />
        </SkRect>
        {/* Bottom-right violet blob */}
        <SkRect x={w * 0.4} y={h * 0.4} width={w * 0.6} height={h * 0.6}>
          <SkRadialGradient c={skVec(w * 0.85, h * 0.85)} r={w * 0.4}
            colors={dark ? ['rgba(139,92,246,0.20)', 'transparent'] : ['rgba(167,139,250,0.06)', 'transparent']} />
          <SkBlurMask blur={30} style="normal" />
        </SkRect>
        {/* Center subtle pink */}
        <SkRect x={w * 0.2} y={h * 0.3} width={w * 0.6} height={h * 0.4}>
          <SkRadialGradient c={skVec(w * 0.5, h * 0.5)} r={w * 0.3}
            colors={dark ? ['rgba(236,72,153,0.06)', 'transparent'] : ['rgba(236,72,153,0.03)', 'transparent']} />
          <SkBlurMask blur={20} style="normal" />
        </SkRect>
      </SkCanvas>
      <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 22, borderWidth: 1, borderColor: borderClr }} />
      {children}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
   Animated Stat Card
   ═══════════════════════════════════════════════════════════ */
function StatCard({ icon, label, value, color, index, dark }: {
  icon: string; label: string; value: string | number; color: string; index: number; dark: boolean;
}) {
  const sc = useSharedValue(0.7);
  const op = useSharedValue(0);
  useEffect(() => {
    sc.value = withDelay(200 + index * 100, withSpring(1, { damping: 14, stiffness: 120 }));
    op.value = withDelay(200 + index * 100, withTiming(1, { duration: 350 }));
  }, []);
  const as = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }], opacity: op.value }));

  return (
    <Animated.View style={[st.statCard, {
      backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
      borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    }, as]}>
      <View style={[st.statIconCircle, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[st.statValue, { color: dark ? '#fff' : '#111' }]}>{value}</Text>
      <Text style={[st.statLabel, { color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }]}>{label}</Text>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════════
   Profile Screen
   ═══════════════════════════════════════════════════════════ */
export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateProfile } = useAuth();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabKey>('about');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [localBio, setLocalBio] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activityReady, setActivityReady] = useState(false);
  const [activitySkeleton, setActivitySkeleton] = useState(false);

  // Load locally cached bio on mount
  useEffect(() => {
    AsyncStorage.getItem('krios_user_bio').then(val => {
      if (val != null) setLocalBio(val);
    });
  }, []);

  // Sync bio from user object or local cache
  useEffect(() => {
    if (user?.bio != null && !editingBio) {
      setBioDraft(user.bio);
      setLocalBio(user.bio);
    }
  }, [user?.bio]);

  // Theme tokens
  const C = {
    bg: isDark ? '#080810' : '#f8f9ff',
    surface: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.035)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
    text: isDark ? '#ffffff' : '#111118',
    sec: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.48)',
    pri: '#6366f1',
    headerBg: isDark ? 'rgba(8,8,16,0.94)' : 'rgba(248,249,255,0.94)',
  };
  const cardW = SW - 40;

  /* ── Samsung-style scroll collapse ── */
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({ onScroll: e => { scrollY.value = e.contentOffset.y; } });

  // Hero avatar: fade + shrink
  const heroAvStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_AT * 0.55, COLLAPSE_AT], [1, 0.3, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(scrollY.value, [0, COLLAPSE_AT], [1, 0.55], Extrapolation.CLAMP) }],
  }));
  // Hero text: fade
  const heroTxtStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_AT * 0.45], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, COLLAPSE_AT], [0, -8], Extrapolation.CLAMP) }],
  }));
  // Header mini avatar + name: fade IN
  const miniStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSE_AT * 0.55, COLLAPSE_AT], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [COLLAPSE_AT * 0.55, COLLAPSE_AT], [6, 0], Extrapolation.CLAMP) }],
  }));
  // Header bg opacity
  const headerBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_AT * 0.65], [0, 1], Extrapolation.CLAMP),
  }));

  /* ── Entrance - removed for instant render ── */
  const entStyle = { flex: 1 };

  /* ── Tab switch ── */
  const tOp = useSharedValue(1);
  const tSl = useSharedValue(0);
  const switchTab = useCallback((tab: TabKey) => {
    if (tab === activeTab) return;
    tOp.value = withTiming(0, { duration: 100 });
    tSl.value = withTiming(6, { duration: 100 });
    setTimeout(() => {
      setActiveTab(tab);
      if (tab === 'activity') {
        // Show activity immediately without delay
        setActivitySkeleton(false);
        setActivityReady(true);
      } else {
        setActivityReady(false);
        setActivitySkeleton(false);
      }
      tOp.value = withTiming(1, { duration: 180 });
      tSl.value = withSpring(0, { damping: 20, stiffness: 300 });
    }, 110);
  }, [activeTab]);
  const tabCS = useAnimatedStyle(() => ({ opacity: tOp.value, transform: [{ translateY: tSl.value }] }));

  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  /* ── Bio save ── */
  const saveBio = async () => {
    Keyboard.dismiss();
    const trimmed = bioDraft.trim();
    setSaving(true);
    // Save locally first so it persists across reloads
    await AsyncStorage.setItem('krios_user_bio', trimmed);
    setLocalBio(trimmed);
    const r = await updateProfile({ bio: trimmed });
    setSaving(false);
    if (r.success) {
      setEditingBio(false);
      setInlineError(null);
    } else {
      setInlineError(r.message || 'Failed to save bio');
    }
  };

  /* ── Data ── */
  const total = user?.totalTasksCompleted || 0;
  const streak = user?.streak || 0;
  const longest = user?.longestStreak || 0;
  const rate = total > 0 ? Math.min(Math.round((total / (total + 8)) * 100), 99) : 0;
  const initial = user?.username?.charAt(0).toUpperCase() || 'U';
  const displayBio = user?.bio || localBio || '';

  const pickAvatar = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        setInlineError('Changing your profile photo from web is not supported yet.');
        return;
      }

      if (!ImagePicker) {
        setInlineError('expo-image-picker is not installed yet. Run: npx expo install expo-image-picker');
        return;
      }

      setUploadingAvatar(true);

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setInlineError('Please allow photo access to change your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        setInlineError('Could not read image data. Try another image.');
        return;
      }

      const mime = (asset as any).mimeType || 'image/jpeg';
      const dataUri = `data:${mime};base64,${asset.base64}`;

      // Save avatar locally first - this DELETES old avatar before saving new one
      // ensuring only ONE avatar file exists per user
      if (user?.id) {
        await imageStorageService.saveAvatar(user.id, dataUri);
      }

      // Then update profile on server
      const r = await updateProfile({ avatar: dataUri } as any);
      if (!r.success) {
        setInlineError(r.message || 'Could not update profile photo');
      } else {
        setInlineError(null);
      }
    } catch (e: any) {
      setInlineError(e?.message || 'Could not pick image');
    } finally {
      setUploadingAvatar(false);
    }
  }, [updateProfile, user]);

  const stats = [
    { icon: 'checkmark-done', label: 'Tasks Done', value: total, color: '#10B981' },
    { icon: 'flame', label: 'Streak', value: `${streak}d`, color: '#F59E0B' },
    { icon: 'trending-up', label: 'Rate', value: `${rate}%`, color: '#6366f1' },
    { icon: 'trophy', label: 'Best Streak', value: `${longest}d`, color: '#8B5CF6' },
  ];

  const achievements = [
    { icon: 'checkmark-circle', title: 'First Task', description: 'Complete your first task', unlocked: total >= 1, rarity: 'common' as const },
    { icon: 'flame', title: '7-Day Streak', description: 'Maintain a 7-day streak', unlocked: longest >= 7, rarity: 'rare' as const },
    { icon: 'home', title: 'Room Creator', description: 'Create your first room', unlocked: true, rarity: 'common' as const },
    { icon: 'rocket', title: '50 Tasks', description: 'Complete 50 tasks total', unlocked: total >= 50, rarity: 'epic' as const },
    { icon: 'moon', title: 'Night Owl', description: 'Complete a task past midnight', unlocked: false, rarity: 'rare' as const },
    { icon: 'star', title: '30-Day Streak', description: 'Keep a 30-day streak', unlocked: longest >= 30, rarity: 'legendary' as const },
  ];
  const unlocked = achievements.filter(a => a.unlocked).length;

  const menuItems = [
    { icon: 'notifications-outline', label: 'Notifications', color: '#f59e0b', onPress: () => setInlineError('Notifications: coming soon') },
    { icon: 'settings-outline', label: 'Settings', color: '#8b5cf6', onPress: () => router.push('/(home)/settings') },
    { icon: 'lock-closed-outline', label: 'Privacy', color: '#10b981', onPress: () => setInlineError('Privacy: coming soon') },
    { icon: 'help-circle-outline', label: 'Help & Support', color: '#ec4899', onPress: () => setInlineError('Help & Support: coming soon') },
  ];

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  /* ── Tab renderers ── */
  const renderAbout = () => (
    <LiquidCard w={cardW} h={editingBio ? 340 : 270} dark={isDark} style={{ marginBottom: 16 }}>
      <View style={st.cardInner}>
        <View style={st.aboutHdr}>
          <Text style={[st.secTitle, { color: C.text }]}>About</Text>
          {!editingBio ? (
            <TouchableOpacity onPress={() => { setEditingBio(true); setBioDraft(displayBio); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="create-outline" size={18} color={C.pri} />
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <TouchableOpacity onPress={() => { setEditingBio(false); setBioDraft(displayBio); }}>
                <Text style={{ color: C.sec, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveBio} disabled={saving}>
                <Text style={{ color: C.pri, fontSize: 14, fontWeight: '700' }}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {editingBio ? (
          <TextInput
            style={[st.bioInput, {
              color: C.text,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
              borderColor: C.pri + '40',
            }]}
            value={bioDraft}
            onChangeText={setBioDraft}
            multiline maxLength={250}
            placeholder="Tell the world about yourself..."
            placeholderTextColor={C.sec}
            autoFocus
          />
        ) : (
          <>
            <Text style={[st.bioTxt, { color: C.text }]} numberOfLines={bioExpanded ? undefined : 3}>
              {displayBio || 'No bio yet. Tap the edit icon to add one.'}
            </Text>
            {displayBio.length > 80 && (
              <TouchableOpacity onPress={() => setBioExpanded(!bioExpanded)}>
                <Text style={[st.readMore, { color: C.pri }]}>{bioExpanded ? 'Show less' : 'Read more'}</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={[st.divider, { backgroundColor: C.border }]} />

        {[
          { label: 'Member Since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A', icon: 'calendar-outline' },
          { label: 'Timezone', value: user?.timezone || 'UTC', icon: 'globe-outline' },
          { label: 'Email', value: user?.email || '---', icon: 'mail-outline' },
        ].map((it, i) => (
          <View key={i} style={[st.infoRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
            <View style={st.infoLeft}>
              <Ionicons name={it.icon as any} size={16} color={C.sec} />
              <Text style={[st.infoLabel, { color: C.sec }]}>{it.label}</Text>
            </View>
            <Text style={[st.infoVal, { color: C.text }]} numberOfLines={1}>{it.value}</Text>
          </View>
        ))}
      </View>
    </LiquidCard>
  );

  const renderActivity = () => (
    <LiquidCard w={cardW} h={210} dark={isDark} style={{ marginBottom: 16 }}>
      <View style={st.cardInner}>
        {/* Show activity heatmap immediately - no skeleton needed */}
        <ActivityHeatmap isDark={isDark} />
      </View>
    </LiquidCard>
  );

  const renderAchievements = () => (
    <View style={{ marginBottom: 16 }}>
      <View style={st.achHdr}>
        <Text style={[st.secTitle, { color: C.text }]}>Achievements</Text>
        <View style={[st.achPill, { backgroundColor: C.pri + '20' }]}>
          <Text style={[st.achCount, { color: C.pri }]}>{unlocked}/{achievements.length}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 4 }}>
        {achievements.map((b, i) => (
          <AchievementBadge key={i} icon={b.icon} title={b.title} description={b.description}
            unlocked={b.unlocked} rarity={b.rarity} isDark={isDark} />
        ))}
      </ScrollView>
    </View>
  );

  /* ════════════════════════════════════════ RENDER ════════════════════════════════════════ */
  return (
    <View style={entStyle}>
      <View style={[st.root, { backgroundColor: C.bg }]}>
        {/* Background */}
        <LinearGradient
          colors={isDark ? ['#080810', '#0d0d1a', '#080810'] as any : ['#f8f9ff', '#f0f0fe', '#f8f9ff'] as any}
          start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* ── Fixed header ── */}
        <View style={[st.header, { paddingTop: Math.max(insets.top + 4, 48) }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.headerBg }, headerBgStyle]} />
          <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: C.border }, headerBgStyle]} />

          <View style={st.headerRow}>
            <TouchableOpacity onPress={() => router.back()}
              style={[st.hdrBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: C.border }]}>
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </TouchableOpacity>

            <View style={st.hdrCenter}>
              {/* "Profile" label — fades out */}
              <Animated.Text style={[st.hdrTitle, { color: C.text }, heroTxtStyle]}>Profile</Animated.Text>
              {/* Mini avatar + name — fades in */}
              <Animated.View style={[st.hdrMini, miniStyle]}>
                <View style={[st.miniAv, { overflow: 'hidden' }]}>
                  {user?.avatar ? (
                    <Image source={{ uri: user.avatar }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <LinearGradient colors={['#6366f1', '#8b5cf6', '#a855f7'] as any}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
                      <Text style={st.miniAvTxt}>{initial}</Text>
                    </LinearGradient>
                  )}
                </View>
                <Text style={[st.miniName, { color: C.text }]} numberOfLines={1}>{user?.username || 'User'}</Text>
              </Animated.View>
            </View>

            <TouchableOpacity
              style={[st.hdrBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: C.border }]}
              onPress={() => router.push('/(home)/settings')}>
              <Ionicons name="settings-outline" size={18} color={C.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Scroll content ── */}
        <AnimatedScrollView style={st.scroll} showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
          onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled">

          {/* Hero */}
          <View style={st.hero}>
            <Animated.View style={heroAvStyle}>
              <TouchableOpacity activeOpacity={0.85} onPress={pickAvatar} disabled={uploadingAvatar}>
                <View style={[st.heroAv, { overflow: 'hidden' }]}>
                  {user?.avatar ? (
                    <Image source={{ uri: user.avatar }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <LinearGradient colors={['#6366f1', '#8b5cf6', '#a855f7'] as any}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
                      <Text style={st.heroAvTxt}>{initial}</Text>
                    </LinearGradient>
                  )}

                  <TouchableOpacity
                    onPress={pickAvatar}
                    activeOpacity={0.85}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={st.camBadge}
                  >
                    <Ionicons name={uploadingAvatar ? 'cloud-upload-outline' : 'camera-outline'} size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={[st.heroInfo, heroTxtStyle]}>
              <Text style={[st.username, { color: C.text }]}>{user?.username || 'User'}</Text>
              <Text style={[st.email, { color: C.sec }]}>{user?.email || 'user@example.com'}</Text>
              <Text style={[st.tapHint, { color: C.sec }]}>{uploadingAvatar ? 'Updating photo…' : 'Tap photo to change'}</Text>
            </Animated.View>
          </View>

          {/* Stats 2x2 */}
          <View style={st.statsGrid}>
            <View style={st.statsRow}>
              {stats.slice(0, 2).map((s, i) => <StatCard key={i} {...s} index={i} dark={isDark} />)}
            </View>
            <View style={st.statsRow}>
              {stats.slice(2).map((s, i) => <StatCard key={i + 2} {...s} index={i + 2} dark={isDark} />)}
            </View>
          </View>

          {/* Tab bar */}
          <View style={[st.tabBar, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
            borderColor: C.border,
          }]}>
            {(['about', 'activity', 'achievements'] as TabKey[]).map(tab => {
              const on = activeTab === tab;
              return (
                <Pressable key={tab} onPress={() => switchTab(tab)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  style={[st.tab, on && [st.tabOn, { backgroundColor: C.pri }]]}>
                  <Text style={[st.tabTxt, { color: on ? '#fff' : C.sec }, on && st.tabTxtOn]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Tab content */}
          <Animated.View style={tabCS}>
            {activeTab === 'about' && renderAbout()}
            {activeTab === 'activity' && renderActivity()}
            {activeTab === 'achievements' && renderAchievements()}
          </Animated.View>

          {/* Menu */}
          <LiquidCard w={cardW} h={menuItems.length * 60 + 4} dark={isDark} style={{ marginBottom: 16 }}>
            {menuItems.map((it, i) => (
              <TouchableOpacity key={i} style={[st.menuItem,
                i < menuItems.length - 1 && { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderBottomWidth: 1 }]}
                onPress={it.onPress} activeOpacity={0.7}>
                <View style={[st.menuIc, { backgroundColor: it.color + '18' }]}>
                  <Ionicons name={it.icon as any} size={17} color={it.color} />
                </View>
                <Text style={[st.menuLbl, { color: C.text }]}>{it.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={C.sec} />
              </TouchableOpacity>
            ))}
          </LiquidCard>

          {/* Logout */}
          <TouchableOpacity style={[st.logout, {
            borderColor: isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.18)',
            backgroundColor: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)',
          }]} onPress={handleLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            <Text style={st.logoutTxt}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={[st.ver, { color: C.sec }]}>Krios v1.0.0</Text>
        </AnimatedScrollView>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════ */
const st = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },

  // Header
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  hdrBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  hdrCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 36 },
  hdrTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, position: 'absolute' },
  hdrMini: { flexDirection: 'row', alignItems: 'center', position: 'absolute', gap: 8 },
  miniAv: { width: MINI_SIZE, height: MINI_SIZE, borderRadius: MINI_SIZE / 2, justifyContent: 'center', alignItems: 'center' },
  miniAvTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
  miniName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3, maxWidth: 140 },

  // Hero
  hero: { alignItems: 'center', paddingTop: 100, marginBottom: 24 },
  heroAv: {
    width: HERO_SIZE, height: HERO_SIZE, borderRadius: HERO_SIZE / 2,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  heroAvTxt: { fontSize: 36, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  camBadge: { position: 'absolute', right: 6, bottom: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(99,102,241,0.95)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  heroInfo: { alignItems: 'center', marginTop: 14 },
  tapHint: { marginTop: 6, fontSize: 12, fontWeight: '500' },
  username: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  email: { fontSize: 13, fontWeight: '500' },

  // Stats
  statsGrid: { marginBottom: 20, gap: 10 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8, borderRadius: 18, borderWidth: 1 },
  statIconCircle: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '800', marginBottom: 2, letterSpacing: -0.3 },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Tabs
  tabBar: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabOn: { shadowColor: '#6366f1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  tabTxt: { fontSize: 13, fontWeight: '600' },
  tabTxtOn: { fontWeight: '700' },

  // Card inner
  cardInner: { padding: 20 },

  // About
  aboutHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  secTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  bioTxt: { fontSize: 14, lineHeight: 21 },
  bioInput: { fontSize: 14, lineHeight: 21, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 80, textAlignVertical: 'top' },
  readMore: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  divider: { height: 1, marginVertical: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 13, fontWeight: '500' },
  infoVal: { fontSize: 13, fontWeight: '600', maxWidth: '50%' },

  // Achievements
  achHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  achPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  achCount: { fontSize: 12, fontWeight: '700' },

  // Menu
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14 },
  menuIc: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuLbl: { flex: 1, marginLeft: 12, fontSize: 14, fontWeight: '500' },

  // Logout
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 14, borderWidth: 1, marginBottom: 16, gap: 8 },
  logoutTxt: { fontSize: 15, fontWeight: '600', color: '#ef4444' },

  // Footer
  ver: { textAlign: 'center', fontSize: 11, marginBottom: 20 },
  heatmapSkeleton: {
    height: 140,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.35)',
    padding: 12,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heatmapSkeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    flex: 1,
    marginVertical: 2,
    backgroundColor: 'rgba(148,163,184,0.15)',
    borderRadius: 8,
  },
});
