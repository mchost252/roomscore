import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ConfirmationModal from '../../components/ConfirmationModal';
import { ActivityHeatmap } from '../../components/profile/ActivityHeatmap';
import { useAuth } from '../../context/AuthContext';
import { HomeNavContext } from '../../context/HomeNavContext';
import { useTheme } from '../../context/ThemeContext';
import { imageStorageService } from '../../services/imageStorageService';

let ImagePicker: any = null;
if (Platform.OS !== 'web') {
  try {
    ImagePicker = require('expo-image-picker');
  } catch (e) {
    ImagePicker = null;
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const HERO_HEIGHT = 292;
const AVATAR_SIZE = 92;
const HEADER_COLLAPSE_AT = 150;
const BOTTOM_NAV_CLEARANCE = 132;
const BIO_KEY = 'krios_user_bio';

type TabKey = 'identity' | 'rhythm' | 'trophies';
type TrophyRarity = 'common' | 'rare' | 'epic' | 'legendary';
type TrophyGroupKey = 'consistency' | 'social' | 'mastery';
type ExpandKey = 'bio' | 'account' | 'insights' | TrophyGroupKey;

interface ThemeTokens {
  bg: string;
  bg2: string;
  surface: string;
  elevated: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  primary: string;
}

interface Trophy {
  id: string;
  group: TrophyGroupKey;
  title: string;
  description: string;
  detail: string;
  icon: string;
  rarity: TrophyRarity;
  unlocked: boolean;
  progress: string;
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

function showProfileError(message: string) {
  Alert.alert('Profile update', message);
}

function getArchetype(total: number, streak: number, longest: number) {
  if (longest >= 30) return 'Habit Architect';
  if (streak >= 7) return 'Streak Keeper';
  if (total >= 50) return 'Momentum Builder';
  if (total >= 10) return 'Focused Starter';
  return 'Fresh Signal';
}

function formatMonthYear(value?: string) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function buildProfileActivity(total: number, streak: number) {
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const data = Array.from({ length: daysInMonth }, () => 0);
  if (total <= 0) return data;

  const todayIndex = new Date().getDate() - 1;
  const visibleStreak = Math.min(streak || 1, daysInMonth, total);
  for (let offset = 0; offset < visibleStreak; offset += 1) {
    const index = todayIndex - offset;
    if (index >= 0) data[index] = Math.min(4, Math.max(1, Math.ceil(total / 20)));
  }
  return data;
}

function Surface({
  children,
  C,
  style,
}: {
  children: React.ReactNode;
  C: ThemeTokens;
  style?: any;
}) {
  return (
    <View style={[styles.surface, { backgroundColor: C.surface, borderColor: C.border }, style]}>
      {children}
    </View>
  );
}

function IconBubble({ icon, color }: { icon: string; color: string }) {
  return (
    <View style={[styles.iconBubble, { backgroundColor: `${color}1f` }]}>
      <Ionicons name={icon as any} size={18} color={color} />
    </View>
  );
}

function MetricTile({
  icon,
  label,
  value,
  color,
  C,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: string;
  C: ThemeTokens;
}) {
  return (
    <View style={[styles.metricTile, { backgroundColor: C.elevated, borderColor: C.border }]}>
      <IconBubble icon={icon} color={color} />
      <Text style={[styles.metricValue, { color: C.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: C.muted }]}>{label}</Text>
    </View>
  );
}

function ExpandablePanel({
  id,
  title,
  subtitle,
  icon,
  C,
  expanded,
  onToggle,
  children,
}: {
  id: ExpandKey;
  title: string;
  subtitle?: string;
  icon: string;
  C: ThemeTokens;
  expanded: boolean;
  onToggle: (id: ExpandKey) => void;
  children: React.ReactNode;
}) {
  return (
    <Surface C={C} style={styles.panel}>
      <Pressable onPress={() => onToggle(id)} style={styles.panelHeader}>
        <IconBubble icon={icon} color={C.primary} />
        <View style={styles.panelTitleWrap}>
          <Text style={[styles.panelTitle, { color: C.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.panelSubtitle, { color: C.muted }]}>{subtitle}</Text> : null}
        </View>
        <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={18} color={C.muted} />
      </Pressable>

      {expanded ? <View style={styles.panelBody}>{children}</View> : null}
    </Surface>
  );
}

function AccountRow({
  icon,
  label,
  value,
  color,
  C,
  onPress,
  destructive,
}: {
  icon: string;
  label: string;
  value?: string;
  color: string;
  C: ThemeTokens;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const content = (
    <>
      <IconBubble icon={icon} color={color} />
      <View style={styles.accountText}>
        <Text style={[styles.accountLabel, { color: destructive ? '#ef4444' : C.text }]}>{label}</Text>
        {value ? <Text style={[styles.accountValue, { color: C.muted }]} numberOfLines={1}>{value}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={17} color={C.faint} /> : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.72} style={styles.accountRow}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.accountRow}>{content}</View>;
}

function TrophyCard({ trophy, C }: { trophy: Trophy; C: ThemeTokens }) {
  const rarity = rarityMap[trophy.rarity];
  return (
    <View
      style={[
        styles.trophyCard,
        {
          backgroundColor: trophy.unlocked ? C.elevated : 'rgba(148,163,184,0.08)',
          borderColor: trophy.unlocked ? `${rarity.color}66` : C.border,
          opacity: trophy.unlocked ? 1 : 0.62,
        },
      ]}
    >
      <LinearGradient
        colors={
          trophy.unlocked
            ? [`${rarity.color}2a`, 'rgba(255,255,255,0.00)']
            : ['rgba(148,163,184,0.10)', 'rgba(148,163,184,0.00)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.trophyIcon, { backgroundColor: `${rarity.color}22` }]}>
        <Ionicons name={(trophy.unlocked ? trophy.icon : 'lock-closed') as any} size={22} color={trophy.unlocked ? rarity.color : C.faint} />
      </View>
      <Text style={[styles.trophyTitle, { color: C.text }]} numberOfLines={1}>{trophy.title}</Text>
      <Text style={[styles.trophyDesc, { color: C.muted }]} numberOfLines={2}>{trophy.description}</Text>
      <View style={styles.trophyFooter}>
        <Text style={[styles.rarityText, { color: trophy.unlocked ? rarity.color : C.faint }]}>{rarity.label}</Text>
        <Text style={[styles.progressText, { color: C.faint }]}>{trophy.progress}</Text>
      </View>
    </View>
  );
}

const rarityMap: Record<TrophyRarity, { label: string; color: string }> = {
  common: { label: 'Common', color: '#38bdf8' },
  rare: { label: 'Rare', color: '#8b5cf6' },
  epic: { label: 'Epic', color: '#ec4899' },
  legendary: { label: 'Legendary', color: '#f59e0b' },
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateProfile } = useAuth();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabKey>('identity');
  const [expanded, setExpanded] = useState<Record<ExpandKey, boolean>>({
    bio: true,
    account: false,
    insights: true,
    consistency: true,
    social: false,
    mastery: false,
  });
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(user?.bio || '');
  const [localBio, setLocalBio] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profileEditorVisible, setProfileEditorVisible] = useState(false);
  const { setOpenAddTask } = React.useContext(HomeNavContext);

  const C = useMemo<ThemeTokens>(() => ({
    bg: isDark ? '#070812' : '#f6f8fb',
    bg2: isDark ? '#101326' : '#eef4ff',
    surface: isDark ? 'rgba(255,255,255,0.065)' : 'rgba(255,255,255,0.78)',
    elevated: isDark ? 'rgba(255,255,255,0.075)' : 'rgba(255,255,255,0.92)',
    border: isDark ? 'rgba(255,255,255,0.11)' : 'rgba(15,23,42,0.08)',
    text: isDark ? '#f8fafc' : '#0f172a',
    muted: isDark ? 'rgba(226,232,240,0.64)' : 'rgba(51,65,85,0.62)',
    faint: isDark ? 'rgba(226,232,240,0.38)' : 'rgba(71,85,105,0.40)',
    primary: '#6366f1',
  }), [isDark]);

  const total = user?.totalTasksCompleted || 0;
  const streak = user?.streak || 0;
  const longest = user?.longestStreak || 0;
  const rate = total > 0 ? Math.min(Math.round((total / (total + 8)) * 100), 99) : 0;
  const initial = user?.username?.charAt(0).toUpperCase() || 'U';
  const displayBio = user?.bio || localBio || '';
  const archetype = getArchetype(total, streak, longest);
  const profileComplete = Boolean(displayBio && user?.avatar);
  const activityData = useMemo(() => buildProfileActivity(total, streak), [streak, total]);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HEADER_COLLAPSE_AT * 0.7], [0, 1], Extrapolation.CLAMP),
  }));

  const headerContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HEADER_COLLAPSE_AT * 0.35, HEADER_COLLAPSE_AT], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [HEADER_COLLAPSE_AT * 0.35, HEADER_COLLAPSE_AT], [8, 0], Extrapolation.CLAMP) }],
  }));

  const heroOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HEADER_COLLAPSE_AT], [1, 0.18], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, HEADER_COLLAPSE_AT], [0, -16], Extrapolation.CLAMP) }],
  }));

  useEffect(() => {
    AsyncStorage.getItem(BIO_KEY).then((value) => {
      if (value != null) setLocalBio(value);
    });
  }, []);

  useEffect(() => {
    if (user?.bio != null && !editingBio) {
      setBioDraft(user.bio);
      setLocalBio(user.bio);
    }
  }, [editingBio, user?.bio]);

  useEffect(() => {
    if (!user?.id) return;
    imageStorageService.getBanner(user.id).then((uri) => {
      if (uri) setBannerUri(uri);
    });
  }, [user?.id]);

  const toggleExpanded = useCallback((key: ExpandKey) => {
    animateLayout();
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const switchTab = useCallback((tab: TabKey) => {
    if (tab === activeTab) return;
    animateLayout();
    setActiveTab(tab);
  }, [activeTab]);

  const saveBio = useCallback(async () => {
    Keyboard.dismiss();
    const trimmed = bioDraft.trim();
    setSavingBio(true);
    try {
      await AsyncStorage.setItem(BIO_KEY, trimmed);
      setLocalBio(trimmed);
      const result = await updateProfile({ bio: trimmed });
      if (!result.success) {
        showProfileError(result.message || 'Could not save bio.');
        return;
      }
      setEditingBio(false);
      setProfileEditorVisible(false);
    } catch (error: any) {
      showProfileError(error?.message || 'Could not save bio.');
    } finally {
      setSavingBio(false);
    }
  }, [bioDraft, updateProfile]);

  const pickAvatar = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        showProfileError('Changing your profile photo from web is not supported yet.');
        return;
      }
      if (!ImagePicker) {
        showProfileError('expo-image-picker is not installed.');
        return;
      }

      setUploadingAvatar(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showProfileError('Please allow photo access to change your profile picture.');
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
        showProfileError('Could not read image data. Try another image.');
        return;
      }

      const mime = asset.mimeType || 'image/jpeg';
      const dataUri = `data:${mime};base64,${asset.base64}`;
      if (user?.id) await imageStorageService.saveAvatar(user.id, dataUri);
      const updated = await updateProfile({ avatar: dataUri } as any);
      if (!updated.success) showProfileError(updated.message || 'Could not update profile photo.');
    } catch (error: any) {
      showProfileError(error?.message || 'Could not pick image.');
    } finally {
      setUploadingAvatar(false);
    }
  }, [updateProfile, user?.id]);

  const pickBanner = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        showProfileError('Changing your banner from web is not supported yet.');
        return;
      }
      if (!ImagePicker) {
        showProfileError('expo-image-picker is not installed.');
        return;
      }

      setUploadingBanner(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showProfileError('Please allow photo access to change your banner.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.82,
        base64: true,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.base64) {
        showProfileError('Could not read image data. Try another image.');
        return;
      }

      const mime = asset.mimeType || 'image/jpeg';
      const dataUri = `data:${mime};base64,${asset.base64}`;
      if (user?.id) await imageStorageService.saveBanner(user.id, dataUri);
      setBannerUri(dataUri);
    } catch (error: any) {
      showProfileError(error?.message || 'Could not pick banner image.');
    } finally {
      setUploadingBanner(false);
    }
  }, [user?.id]);

  const confirmLogout = useCallback(async () => {
    setShowLogoutConfirm(false);
    await logout();
    router.replace('/(auth)/login');
  }, [logout, router]);

  const openProfileEditor = useCallback(() => {
    setBioDraft(displayBio);
    setProfileEditorVisible(true);
  }, [displayBio]);

  useEffect(() => {
    setOpenAddTask(openProfileEditor);
  }, [openProfileEditor, setOpenAddTask]);

  const metrics = useMemo(() => [
    { icon: 'flame', label: 'Current streak', value: `${streak}d`, color: '#f59e0b' },
    { icon: 'checkmark-done', label: 'Tasks done', value: total, color: '#10b981' },
    { icon: 'pulse', label: 'Completion rate', value: `${rate}%`, color: '#38bdf8' },
    { icon: 'trophy', label: 'Best streak', value: `${longest}d`, color: '#a855f7' },
  ], [longest, rate, streak, total]);

  const trophies = useMemo<Trophy[]>(() => [
    {
      id: 'first-task',
      group: 'consistency',
      title: 'First Proof',
      description: 'Complete your first task.',
      detail: 'The first visible signal that Krios can trust your momentum.',
      icon: 'checkmark-circle',
      rarity: 'common',
      unlocked: total >= 1,
      progress: `${Math.min(total, 1)}/1`,
    },
    {
      id: 'seven-streak',
      group: 'consistency',
      title: 'Seven-Day Heat',
      description: 'Hold a 7 day streak.',
      detail: 'A full week without dropping the rhythm.',
      icon: 'flame',
      rarity: 'rare',
      unlocked: longest >= 7,
      progress: `${Math.min(longest, 7)}/7`,
    },
    {
      id: 'thirty-streak',
      group: 'consistency',
      title: 'Thirty-Day Signal',
      description: 'Reach a 30 day streak.',
      detail: 'Long enough for the room to know your pattern is real.',
      icon: 'radio',
      rarity: 'legendary',
      unlocked: longest >= 30,
      progress: `${Math.min(longest, 30)}/30`,
    },
    {
      id: 'profile-photo',
      group: 'social',
      title: 'Face Card',
      description: 'Add a profile photo.',
      detail: 'A real avatar makes your account easier to recognize across rooms and chats.',
      icon: 'person-circle',
      rarity: 'common',
      unlocked: Boolean(user?.avatar),
      progress: user?.avatar ? 'Ready' : 'Photo',
    },
    {
      id: 'clean-record',
      group: 'social',
      title: 'Clean Record',
      description: 'Complete your public profile.',
      detail: 'This unlocks when your avatar and bio are both set.',
      icon: 'shield-checkmark',
      rarity: profileComplete ? 'rare' : 'common',
      unlocked: profileComplete,
      progress: profileComplete ? 'Ready' : 'Bio + photo',
    },
    {
      id: 'fifty-tasks',
      group: 'mastery',
      title: 'Fifty Finishes',
      description: 'Complete 50 total tasks.',
      detail: 'Proof that your output is no longer occasional.',
      icon: 'rocket',
      rarity: 'epic',
      unlocked: total >= 50,
      progress: `${Math.min(total, 50)}/50`,
    },
    {
      id: 'hundred-tasks',
      group: 'mastery',
      title: 'Century Mode',
      description: 'Complete 100 total tasks.',
      detail: 'A deeper layer of consistency built one task at a time.',
      icon: 'medal',
      rarity: 'legendary',
      unlocked: total >= 100,
      progress: `${Math.min(total, 100)}/100`,
    },
  ], [longest, profileComplete, total, user?.avatar]);

  const unlockedTrophies = trophies.filter((trophy) => trophy.unlocked).length;
  const trophyGroups = useMemo(() => ([
    {
      key: 'consistency' as const,
      title: 'Consistency',
      subtitle: 'Streaks, rhythm, and repeat wins',
      icon: 'flame',
      items: trophies.filter((trophy) => trophy.group === 'consistency'),
    },
    {
      key: 'social' as const,
      title: 'Room Identity',
      subtitle: 'Presence and profile signals',
      icon: 'people',
      items: trophies.filter((trophy) => trophy.group === 'social'),
    },
    {
      key: 'mastery' as const,
      title: 'Long Game',
      subtitle: 'Big completion milestones',
      icon: 'trophy',
      items: trophies.filter((trophy) => trophy.group === 'mastery'),
    },
  ]), [trophies]);

  const renderAvatar = (size: number, small?: boolean) => (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {user?.avatar ? (
        <Image source={{ uri: user.avatar }} style={StyleSheet.absoluteFill} />
      ) : (
        <LinearGradient
          colors={['#6366f1', '#8b5cf6', '#38bdf8'] as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        >
          <Text style={[styles.avatarInitial, { fontSize: small ? 15 : 36 }]}>{initial}</Text>
        </LinearGradient>
      )}
    </View>
  );

  const renderHero = () => (
    <View style={styles.heroWrap}>
      <Pressable onPress={pickBanner} disabled={uploadingBanner} style={styles.heroPressable}>
        <ImageBackground
          source={bannerUri ? { uri: bannerUri } : require('../../assets/profile_bg_default.png')}
          style={styles.heroImage}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.05)', 'rgba(5,7,15,0.24)', 'rgba(5,7,15,0.84)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View style={[styles.heroOverlay, { paddingTop: insets.top + 52 }, heroOverlayStyle]}>
            <View style={styles.heroTopRow}>
              <View style={styles.profileWordmark}>
                <Text style={styles.profileWordmarkText}>PROFILE</Text>
                <View style={styles.profileWordmarkLine} />
              </View>
              <TouchableOpacity onPress={() => router.push('/(home)/settings')} style={styles.heroButton} activeOpacity={0.75}>
                <Ionicons name="settings-outline" size={19} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroBottom}>
              <TouchableOpacity onPress={pickAvatar} disabled={uploadingAvatar} activeOpacity={0.85}>
                {renderAvatar(AVATAR_SIZE)}
                <View style={styles.avatarCamera}>
                  <Ionicons name={uploadingAvatar ? 'cloud-upload-outline' : 'camera-outline'} size={15} color="#fff" />
                </View>
              </TouchableOpacity>
              <View style={styles.heroIdentity}>
                <Text style={styles.heroName} numberOfLines={1}>{user?.username || 'User'}</Text>
                <Text style={styles.heroEmail} numberOfLines={1}>{user?.email || 'No email yet'}</Text>
                <View style={styles.heroPillRow}>
                  <View style={styles.archetypePill}>
                    <Ionicons name="sparkles" size={13} color="#c4b5fd" />
                    <Text style={styles.archetypeText}>{archetype}</Text>
                  </View>
                  <View style={styles.archetypePill}>
                    <Ionicons name="image-outline" size={13} color="#bae6fd" />
                    <Text style={styles.archetypeText}>{uploadingBanner ? 'Updating' : 'Cover'}</Text>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        </ImageBackground>
      </Pressable>
    </View>
  );

  const renderTabs = () => (
    <View style={[styles.tabs, { backgroundColor: C.surface, borderColor: C.border }]}>
      {(['identity', 'rhythm', 'trophies'] as TabKey[]).map((tab) => {
        const active = activeTab === tab;
        return (
          <Pressable
            key={tab}
            onPress={() => switchTab(tab)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.tabText, { color: active ? '#fff' : C.muted }]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderIdentity = () => (
    <View style={styles.sectionStack}>
      <ExpandablePanel
        id="bio"
        title="About"
        subtitle={displayBio ? 'Personal signal' : 'Add the profile line people see'}
        icon="person"
        C={C}
        expanded={expanded.bio}
        onToggle={toggleExpanded}
      >
        {editingBio ? (
          <>
            <TextInput
              value={bioDraft}
              onChangeText={setBioDraft}
              style={[styles.bioInput, { color: C.text, backgroundColor: C.elevated, borderColor: C.border }]}
              placeholder="Write a short bio..."
              placeholderTextColor={C.faint}
              multiline
              maxLength={250}
              autoFocus
            />
            <View style={styles.bioActions}>
              <TouchableOpacity
                onPress={() => {
                  setBioDraft(displayBio);
                  setEditingBio(false);
                }}
                style={[styles.secondaryButton, { borderColor: C.border }]}
              >
                <Text style={[styles.secondaryButtonText, { color: C.muted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveBio} disabled={savingBio} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{savingBio ? 'Saving' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.bioText, { color: displayBio ? C.text : C.muted }]}>
              {displayBio || 'No bio yet. Add one short line that tells your room what kind of energy you bring.'}
            </Text>
            <TouchableOpacity onPress={() => setEditingBio(true)} style={[styles.inlineAction, { borderColor: C.border }]}>
              <Ionicons name="create-outline" size={15} color={C.primary} />
              <Text style={[styles.inlineActionText, { color: C.primary }]}>{displayBio ? 'Edit bio' : 'Add bio'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ExpandablePanel>

      <ExpandablePanel
        id="account"
        title="Account"
        subtitle="Details and profile controls"
        icon="id-card"
        C={C}
        expanded={expanded.account}
        onToggle={toggleExpanded}
      >
        <View style={[styles.accountMetaCard, { backgroundColor: C.elevated, borderColor: C.border }]}>
          <Text style={[styles.accountMetaText, { color: C.text }]} numberOfLines={1}>
            {user?.email || 'No email'}
          </Text>
          <Text style={[styles.accountMetaSub, { color: C.muted }]} numberOfLines={1}>
            Joined {formatMonthYear(user?.createdAt)} | {user?.timezone || 'UTC'}
          </Text>
        </View>
        <AccountRow icon="settings-outline" label="Settings" value="Preferences and app controls" color="#8b5cf6" C={C} onPress={() => router.push('/(home)/settings')} />
        <AccountRow icon="lock-closed-outline" label="Privacy" value="Coming soon" color="#10b981" C={C} onPress={() => Alert.alert('Privacy', 'Privacy controls are coming soon.')} />
        <AccountRow icon="help-circle-outline" label="Help and support" value="Coming soon" color="#38bdf8" C={C} onPress={() => Alert.alert('Help and support', 'Support tools are coming soon.')} />
        <AccountRow icon="log-out-outline" label="Sign out" color="#ef4444" C={C} destructive onPress={() => setShowLogoutConfirm(true)} />
      </ExpandablePanel>
    </View>
  );

  const renderRhythm = () => (
    <View style={styles.sectionStack}>
      <Surface C={C} style={styles.heatmapPanel}>
        <ActivityHeatmap isDark={isDark} data={activityData} />
      </Surface>

      <ExpandablePanel
        id="insights"
        title="Rhythm read"
        subtitle="Compact view of current momentum"
        icon="analytics"
        C={C}
        expanded={expanded.insights}
        onToggle={toggleExpanded}
      >
        <View style={styles.insightGrid}>
          <View style={[styles.insightCard, { backgroundColor: C.elevated, borderColor: C.border }]}>
            <Text style={[styles.insightLabel, { color: C.muted }]}>Today signal</Text>
            <Text style={[styles.insightValue, { color: C.text }]}>{streak > 0 ? 'Active' : 'Waiting'}</Text>
          </View>
          <View style={[styles.insightCard, { backgroundColor: C.elevated, borderColor: C.border }]}>
            <Text style={[styles.insightLabel, { color: C.muted }]}>Profile grade</Text>
            <Text style={[styles.insightValue, { color: C.text }]}>{profileComplete ? 'Ready' : 'Needs polish'}</Text>
          </View>
        </View>
        <Text style={[styles.insightCopy, { color: C.muted }]}>
          {streak >= 7
            ? 'Your rhythm is visible. Keep the next few completions boring and repeatable.'
            : 'The profile is built to make small wins visible. A few steady completions will start lighting this screen up.'}
        </Text>
      </ExpandablePanel>
    </View>
  );

  const renderTrophies = () => (
    <View style={styles.sectionStack}>
      <Surface C={C} style={styles.trophySummary}>
        <View>
          <Text style={[styles.summaryEyebrow, { color: C.muted }]}>Trophy case</Text>
          <Text style={[styles.summaryTitle, { color: C.text }]}>{unlockedTrophies}/{trophies.length} unlocked</Text>
        </View>
        <View style={styles.summaryMedal}>
          <Ionicons name="trophy" size={24} color="#f59e0b" />
        </View>
      </Surface>

      {trophyGroups.map((group) => (
        <ExpandablePanel
          key={group.key}
          id={group.key}
          title={group.title}
          subtitle={group.subtitle}
          icon={group.icon}
          C={C}
          expanded={expanded[group.key]}
          onToggle={toggleExpanded}
        >
          <View style={styles.trophyGrid}>
            {group.items.map((trophy) => (
              <TrophyCard key={trophy.id} trophy={trophy} C={C} />
            ))}
          </View>
          <Text style={[styles.groupNote, { color: C.faint }]}>
            {group.items.find((item) => !item.unlocked)?.detail || 'This group is fully lit.'}
          </Text>
        </ExpandablePanel>
      ))}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <LinearGradient
        colors={[C.bg, C.bg2, C.bg] as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.fixedHeader, { paddingTop: insets.top + 8 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg, borderBottomColor: C.border, borderBottomWidth: 1 }, headerStyle]} />
        <Animated.View style={[styles.fixedHeaderRow, headerContentStyle]}>
          {renderAvatar(32, true)}
          <Text style={[styles.fixedHeaderTitle, { color: C.text }]} numberOfLines={1}>{user?.username || 'Profile'}</Text>
          <TouchableOpacity onPress={() => router.push('/(home)/settings')} style={[styles.fixedHeaderButton, { borderColor: C.border, backgroundColor: C.surface }]}>
            <Ionicons name="settings-outline" size={17} color={C.text} />
          </TouchableOpacity>
        </Animated.View>
      </View>

      <AnimatedScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + BOTTOM_NAV_CLEARANCE }]}
      >
        {renderHero()}

        <View style={styles.content}>
          <View style={styles.metricsGrid}>
            {metrics.map((metric) => (
              <MetricTile key={metric.label} {...metric} C={C} />
            ))}
          </View>

          {renderTabs()}

          {activeTab === 'identity' ? renderIdentity() : null}
          {activeTab === 'rhythm' ? renderRhythm() : null}
          {activeTab === 'trophies' ? renderTrophies() : null}

          <Text style={[styles.version, { color: C.faint }]}>Krios v1.0.0</Text>
        </View>
      </AnimatedScrollView>

      <ConfirmationModal
        visible={showLogoutConfirm}
        title="Sign Out"
        message="Sign out of Krios on this device? Local cached app data will be cleared."
        confirmText="Sign Out"
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
        isDark={isDark}
        destructive
      />

      <Modal
        visible={profileEditorVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileEditorVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.editorOverlay}
        >
          <Pressable style={styles.editorBackdrop} onPress={() => setProfileEditorVisible(false)} />
          <View style={[styles.editorSheet, { backgroundColor: C.bg, borderColor: C.border, paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.editorHandle} />
            <View style={styles.editorHeader}>
              <View>
                <Text style={[styles.editorKicker, { color: C.primary }]}>PROFILE KIT</Text>
                <Text style={[styles.editorTitle, { color: C.text }]}>Edit your signal</Text>
              </View>
              <TouchableOpacity onPress={() => setProfileEditorVisible(false)} style={[styles.editorClose, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Ionicons name="close" size={20} color={C.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.editorActions}>
              <TouchableOpacity onPress={pickAvatar} disabled={uploadingAvatar} style={[styles.editorMediaButton, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Ionicons name="camera-outline" size={20} color={C.primary} />
                <Text style={[styles.editorMediaText, { color: C.text }]}>{uploadingAvatar ? 'Updating photo' : 'Change photo'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickBanner} disabled={uploadingBanner} style={[styles.editorMediaButton, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Ionicons name="image-outline" size={20} color={C.primary} />
                <Text style={[styles.editorMediaText, { color: C.text }]}>{uploadingBanner ? 'Updating cover' : 'Change cover'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.editorLabel, { color: C.muted }]}>Bio</Text>
            <TextInput
              value={bioDraft}
              onChangeText={setBioDraft}
              style={[styles.editorInput, { color: C.text, backgroundColor: C.surface, borderColor: C.border }]}
              placeholder="Write a short bio..."
              placeholderTextColor={C.faint}
              multiline
              maxLength={250}
            />
            <TouchableOpacity onPress={saveBio} disabled={savingBio} style={styles.editorSave}>
              <LinearGradient
                colors={['#818cf8', '#6366f1', '#4f46e5'] as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.editorSaveText}>{savingBio ? 'Saving' : 'Save profile'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingBottom: 10,
  },
  fixedHeaderRow: {
    height: 38,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fixedHeaderTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  fixedHeaderButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 36,
  },
  heroWrap: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  heroPressable: {
    flex: 1,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileWordmark: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  profileWordmarkText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 3,
  },
  profileWordmarkLine: {
    width: 38,
    height: 2,
    borderRadius: 2,
    marginTop: 5,
    backgroundColor: '#818cf8',
  },
  heroButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,12,24,0.34)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    paddingBottom: 22,
  },
  heroIdentity: {
    flex: 1,
    paddingBottom: 3,
  },
  heroName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
  },
  heroEmail: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  heroPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  archetypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  archetypeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  avatar: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.86)',
    backgroundColor: '#6366f1',
  },
  avatarInitial: {
    color: '#fff',
    fontWeight: '900',
  },
  avatarCamera: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.96)',
    borderWidth: 2,
    borderColor: '#fff',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  metricTile: {
    width: (SCREEN_WIDTH - 42) / 2,
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 6,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 5,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '900',
  },
  sectionStack: {
    gap: 12,
  },
  surface: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  panel: {
    padding: 14,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  panelTitleWrap: {
    flex: 1,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  panelSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  panelBody: {
    paddingTop: 14,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  bioInput: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  bioActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  secondaryButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButton: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  inlineAction: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  inlineActionText: {
    fontSize: 12,
    fontWeight: '900',
  },
  accountRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  accountText: {
    flex: 1,
  },
  accountLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  accountValue: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
    marginVertical: 8,
  },
  accountMetaCard: {
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 8,
  },
  accountMetaText: {
    fontSize: 13,
    fontWeight: '800',
  },
  accountMetaSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  heatmapPanel: {
    padding: 10,
  },
  insightGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  insightCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  insightLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  insightValue: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 8,
  },
  insightCopy: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 12,
  },
  trophySummary: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  summaryMedal: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  trophyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  trophyCard: {
    width: (SCREEN_WIDTH - 82) / 2,
    minHeight: 136,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 12,
  },
  trophyIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  trophyTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  trophyDesc: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 5,
    minHeight: 32,
  },
  trophyFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rarityText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  progressText: {
    fontSize: 10,
    fontWeight: '800',
  },
  groupNote: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 12,
  },
  version: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 20,
  },
  editorOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  editorBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  editorSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  editorHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(148,163,184,0.45)',
    marginBottom: 16,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  editorKicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  editorTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 3,
  },
  editorClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  editorMediaButton: {
    flex: 1,
    minHeight: 74,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  editorMediaText: {
    fontSize: 12,
    fontWeight: '800',
  },
  editorLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  editorInput: {
    minHeight: 108,
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  editorSave: {
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    overflow: 'hidden',
  },
  editorSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
});
