import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  Dimensions, ScrollView, Modal, TextInput, ImageBackground,
  Image, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  interpolate, Extrapolation, runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useFocusTimer } from '../../hooks/useFocusTimer';
import CircularProgress from '../../components/ui/CircularProgress';
import ConfettiCelebration from '../../components/ConfettiCelebration';
import focusService from '../../services/focusService';
import focusSoundService, { SoundOption, SoundStatus } from '../../services/focusSoundService';
import taskService from '../../services/taskService';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ConfirmationModal from '../../components/ConfirmationModal';
import XPReward from '../../components/ui/XPReward';

let ImagePicker: any = null;
try {
  if (Platform.OS !== 'web') ImagePicker = require('expo-image-picker');
} catch {}

const { width: W, height: H } = Dimensions.get('window');

// ── Mini pill dimensions ──
const MINI_W = W - 32;
const MINI_H = 72;
const MINI_BOTTOM = 40;
const MINI_RADIUS = 22;

// ── Background presets ──
const BG_PRESETS: { id: string; name: string; image: any; accent: string; rotate: boolean; cat: 'ambient' | 'nature' }[] = [
  { id: 'default',  name: 'Starry Night', image: require('../../assets/session_bg_default.png'),  accent: '#818cf8', rotate: false, cat: 'ambient' },
  { id: 'cosmic',   name: 'Cosmic',       image: require('../../assets/focus session.png'),        accent: '#818cf8', rotate: true,  cat: 'ambient' },
  { id: 'forest',   name: 'Forest',       image: require('../../assets/focused.png'),              accent: '#34d399', rotate: true,  cat: 'nature'  },
  { id: 'rooms',    name: 'Ocean Depth',  image: require('../../assets/rooms_header_bg.jpeg'),     accent: '#06b6d4', rotate: true,  cat: 'nature'  },
  { id: 'aurora',   name: 'Aurora',       image: require('../../assets/room_header_bg_new.webp'),  accent: '#a855f7', rotate: true,  cat: 'ambient' },
];

const TIME_OPTIONS = [15, 25, 45, 60];
type ScreenState = 'setup' | 'active' | 'paused' | 'complete';
type BgTab = 'Ambient' | 'Nature';
type SoundTab = 'All' | 'Nature' | 'Lo-fi';


export default function FocusSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const params = useLocalSearchParams<{ taskId?: string; taskTitle?: string }>();
  const taskId = params.taskId || '';
  const taskTitle = params.taskTitle || 'Deep Work Session';

  // ── Screen state ──
  const [screenState, setScreenState] = useState<ScreenState>('setup');
  const [duration, setDuration] = useState(25);
  const [customDurText, setCustomDurText] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bg, setBg] = useState(BG_PRESETS[0]);
  const [customBgUri, setCustomBgUri] = useState<string | null>(null);
  const [taskMarkedDone, setTaskMarkedDone] = useState(false);
  const [taskDoneLoading, setTaskDoneLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session stats
  const [sessionsTodayCount, setSessionsTodayCount] = useState<number>(0);
  const [sessionReward, setSessionReward] = useState<number | null>(null);
  const [showXpAnim, setShowXpAnim] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  // ── Modals ──
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [bgTab, setBgTab] = useState<BgTab>('Ambient');
  const [soundTab, setSoundTab] = useState<SoundTab>('All');
  const [sounds, setSounds] = useState<SoundOption[]>([]);
  const [currentSoundId, setCurrentSoundId] = useState('silence');
  const [volume, setVolume] = useState(0.6);

  // ── Minimize animation ──
  // 0 = fullscreen, 1 = minimized pill
  const minimizeProgress = useSharedValue(0);
  const [isMinimized, setIsMinimized] = useState(false);

  const timer = useFocusTimer(duration);

  // ── Init ──
  useEffect(() => {
    focusSoundService.initialize().then(() => {
      setSounds(focusSoundService.getAllSounds());
      setCurrentSoundId(focusSoundService.getCurrentSoundId());
      setVolume(focusSoundService.getVolume());
    });
    return () => { focusSoundService.stop(); };
  }, []);

  useEffect(() => {
    if (timer.state === 'completed' && screenState === 'active') handleComplete();
  }, [timer.state]);

  // Compute today's completed sessions count on mount and when sessions change
  const computeSessionsToday = useCallback(async () => {
    try {
      const completed = await focusService.getCompletedSessions();
      const today = new Date().toDateString();
      const count = completed.filter(s => new Date(s.completedAt || s.startedAt).toDateString() === today).length;
      setSessionsTodayCount(count);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    computeSessionsToday();
  }, [computeSessionsToday]);

  // ── Toast helper ──
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const [soundStatus, setSoundStatus] = useState<SoundStatus>({ loading: false, playing: false, soundId: null, error: null });

  // Playback status → spinner / error toast (remote streams fail silently otherwise)
  useEffect(() => {
    return focusSoundService.onStatus((s) => {
      setSoundStatus(s);
      if (s.error) showToast('Could not load sound. Check your connection.');
    });
  }, [showToast]);

  // ── Minimize / Expand ──
  const minimize = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsMinimized(true); // set immediately so pointerEvents switches before animation
    minimizeProgress.value = withSpring(1, { damping: 20, stiffness: 160 });
  }, []);

  const expand = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    minimizeProgress.value = withSpring(0, { damping: 20, stiffness: 160 }, () => {
      runOnJS(setIsMinimized)(false); // only unblock touches after fully expanded
    });
  }, []);

  // ── Pause button micro-animation (subtle scale on press) ──
  const pauseScale = useSharedValue(1);
  const pauseScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pauseScale.value }],
  }));
  const onPausePressIn = () => { pauseScale.value = withTiming(0.94, { duration: 120 }); };
  const onPausePressOut = () => { pauseScale.value = withTiming(1, { duration: 200 }); };

  // ── Animated container style (fullscreen ↔ pill) ──
  const containerStyle = useAnimatedStyle(() => {
    const p = minimizeProgress.value;
    return {
      position: 'absolute',
      top: interpolate(p, [0, 1], [0, H - MINI_H - MINI_BOTTOM], Extrapolation.CLAMP),
      left: interpolate(p, [0, 1], [0, 16], Extrapolation.CLAMP),
      width: interpolate(p, [0, 1], [W, MINI_W], Extrapolation.CLAMP),
      height: interpolate(p, [0, 1], [H, MINI_H], Extrapolation.CLAMP),
      borderRadius: interpolate(p, [0, 1], [0, MINI_RADIUS], Extrapolation.CLAMP),
      overflow: 'hidden',
    };
  });

  // No gap: full fades out first half, mini fades in second half
  const fullContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(minimizeProgress.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  }));
  const miniContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(minimizeProgress.value, [0.5, 1], [0, 1], Extrapolation.CLAMP),
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
  }));

  // ── Session handlers ──
  const handleStart = useCallback(async () => {
    let finalDur = duration;
    if (customDurText && parseInt(customDurText) > 0) {
      finalDur = parseInt(customDurText);
      setDuration(finalDur);
    }
    const session = await focusService.startSession({
      taskId, taskTitle, mode: 'deep', durationMinutes: finalDur, soundUsed: currentSoundId,
    });
    setSessionId(session.id);
    setScreenState('active');
    timer.start();
    if (currentSoundId !== 'silence') focusSoundService.play(currentSoundId);
  }, [taskId, taskTitle, duration, customDurText, currentSoundId, timer]);

  const handlePause = () => { timer.pause(); setScreenState('paused'); focusSoundService.pause(); };
  const handleResume = () => { timer.resume(); setScreenState('active'); focusSoundService.resume(); };

  const handleStop = async () => {
    timer.stop();
    if (sessionId) await focusService.abandonSession(sessionId);
    await focusSoundService.fadeOut(500);
    router.back();
  };

  // Leaving mid-session discards it — confirm via in-app modal (Alert.alert
  // is a raw browser popup on web and is often blocked entirely).
  const confirmStop = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowStopConfirm(true);
  };

  const handleComplete = async () => {
    setScreenState('complete');
    let completedSession = null;
    if (sessionId) {
      try {
        completedSession = await focusService.completeSession(sessionId);
      } catch (e) {
        console.debug('[focus-session] completeSession failed', (e as any)?.message || e);
      }
    }

    // Update local stats
    try {
      await computeSessionsToday();
      if (completedSession && (completedSession as any).reward != null) {
        const r = (completedSession as any).reward as number;
        setSessionReward(r);
        // show XP animation
        setShowXpAnim(true);
      }
    } catch {}

    await focusSoundService.fadeOut(1000);
    setShowConfetti(true);
    if (isMinimized) expand();
  };

  const toggleTaskDone = async () => {
    if (!taskId || taskDoneLoading) return;
    const next = !taskMarkedDone;
    setTaskDoneLoading(true);
    try {
      await taskService.updatePersonalTask(taskId, { isCompleted: next });
      setTaskMarkedDone(next);
      if (next) showToast('Task marked as complete ✓');
    } catch {
      showToast('Could not update task. Try again.');
    } finally {
      setTaskDoneLoading(false);
    }
  };

  // ── Background ──
  const activeBgSource = customBgUri ? { uri: customBgUri } : bg.image;
  const activeBgRotate = customBgUri ? false : bg.rotate;

  const pickCustomBg = async () => {
    if (!ImagePicker) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showToast('Photo access required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setCustomBgUri(result.assets[0].uri);
      setShowBgPicker(false);
    }
  };

  // ── Sound ──
  const selectSound = async (id: string) => {
    setCurrentSoundId(id);
    if (screenState === 'active') await focusSoundService.play(id);
    else await focusSoundService.stop();
  };

  const pickCustomSound = async () => {
    if (!ImagePicker) { showToast('Not supported on this platform'); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showToast('Media access required'); return; }
    // Use launchImageLibraryAsync with All type — picks audio on Android
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 1,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri;
      const name = uri.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Custom Sound';
      const custom = await focusSoundService.addCustomSound(uri, name);
      setSounds(focusSoundService.getAllSounds());
      selectSound(custom.id);
      setShowSoundPicker(false);
    }
  };

  const filteredSounds = sounds.filter(s => {
    if (soundTab === 'All') return true;
    // Match against name + description so user-added customs filter correctly too.
    const hay = `${s.name} ${s.description || ''}`.toLowerCase();
    if (soundTab === 'Nature') return ['forest', 'rain'].includes(s.id) || /(nature|rain|forest|ocean|thunder|bird|water|wind|night|cricket)/.test(hay);
    if (soundTab === 'Lo-fi') return s.id === 'lofi' || /(lo-?fi|chill|calm|piano|sleepy)/.test(hay);
    return true;
  });


  // ── Background image renderer (handles rotation for landscape assets) ──
  const renderBg = (source: any, rotate: boolean) => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ImageBackground
        source={source}
        style={[StyleSheet.absoluteFill, rotate && { transform: [{ rotate: '90deg' }, { scale: 1.6 }] }]}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(5,5,20,0.45)', 'rgba(5,5,20,0.85)']}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );

  // ── Background Picker Modal ──
  const renderBgPicker = () => (
    <Modal visible={showBgPicker} transparent animationType="slide">
      <View style={s.modalOverlay}>
        <BlurView intensity={40} tint="dark" style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHeader}>
            <TouchableOpacity onPress={() => setShowBgPicker(false)}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={s.sheetTitle}>Background</Text>
            <TouchableOpacity onPress={() => setShowBgPicker(false)}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          {/* Tab bar */}
          <View style={s.tabRow}>
            {(['Ambient', 'Nature'] as BgTab[]).map(t => (
              <TouchableOpacity key={t} onPress={() => setBgTab(t)}
                style={[s.tabPill, bgTab === t && s.tabPillActive]}>
                <Text style={[s.tabPillTxt, bgTab === t && { color: '#fff' }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Large preview */}
          <View style={s.bgPreview}>
            <ImageBackground
              source={customBgUri ? { uri: customBgUri } : bg.image}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} style={StyleSheet.absoluteFill} />
            <View style={s.bgPreviewCheck}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </View>
          </View>

          {/* Thumbnails */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.bgThumbRow}>
            {BG_PRESETS.filter(item => (bgTab === 'Ambient' ? item.cat === 'ambient' : item.cat === 'nature')).map(item => (
              <TouchableOpacity key={item.id} onPress={() => { setBg(item); setCustomBgUri(null); }}
                style={[s.bgThumb, bg.id === item.id && !customBgUri && s.bgThumbActive]}>
                <ImageBackground source={item.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
                <Text style={s.bgThumbName}>{item.name}</Text>
                {bg.id === item.id && !customBgUri && (
                  <View style={s.bgThumbCheck}><Ionicons name="checkmark" size={10} color="#fff" /></View>
                )}
              </TouchableOpacity>
            ))}
            {/* Custom upload */}
            <TouchableOpacity onPress={pickCustomBg} style={s.bgThumbAdd}>
              <Ionicons name="add" size={24} color="rgba(255,255,255,0.6)" />
              <Text style={s.bgThumbName}>Custom</Text>
            </TouchableOpacity>
          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );

  // ── Sound Picker Modal ──
  const renderSoundPicker = () => (
    <Modal visible={showSoundPicker} transparent animationType="slide">
      <View style={s.modalOverlay}>
        <BlurView intensity={40} tint="dark" style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHeader}>
            <TouchableOpacity onPress={() => setShowSoundPicker(false)}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={s.sheetTitle}>Sound</Text>
            <TouchableOpacity onPress={() => setShowSoundPicker(false)}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={s.tabRow}>
            {(['All', 'Nature', 'Lo-fi'] as SoundTab[]).map(t => (
              <TouchableOpacity key={t} onPress={() => setSoundTab(t)}
                style={[s.tabPill, soundTab === t && s.tabPillActive]}>
                <Text style={[s.tabPillTxt, soundTab === t && { color: '#fff' }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sound list */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {filteredSounds.map(snd => (
              <TouchableOpacity key={snd.id} onPress={() => selectSound(snd.id)}
                style={[s.soundRow, currentSoundId === snd.id && s.soundRowActive]}>
                <View style={[s.soundIcon, { backgroundColor: currentSoundId === snd.id ? '#6366f1' : 'rgba(255,255,255,0.08)' }]}>
                  <Text style={{ fontSize: 16 }}>{snd.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.soundName}>{snd.name}</Text>
                  <Text style={s.soundDesc}>{snd.description}</Text>
                </View>
                {currentSoundId === snd.id && soundStatus.loading && soundStatus.soundId === snd.id
                  ? <ActivityIndicator size="small" color="#6366f1" />
                  : <Ionicons
                      name={currentSoundId === snd.id && soundStatus.playing ? 'pause' : 'play'}
                      size={16}
                      color={currentSoundId === snd.id && soundStatus.playing ? '#6366f1' : 'rgba(255,255,255,0.3)'}
                    />
                }
              </TouchableOpacity>
            ))}
            {/* Add custom sound */}
            <TouchableOpacity onPress={pickCustomSound} style={s.soundAddRow}>
              <View style={s.soundIcon}>
                <Ionicons name="add" size={18} color="rgba(255,255,255,0.6)" />
              </View>
              <Text style={[s.soundName, { color: 'rgba(255,255,255,0.6)' }]}>Add Custom Sound</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Volume slider */}
          <View style={s.volRow}>
            <Ionicons name="volume-low" size={16} color="rgba(255,255,255,0.4)" />
            <View style={s.volTrack}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e: any) => {
                const v: number = Math.max(0, Math.min(1, e.nativeEvent.locationX / (W - 80)));
                setVolume(v); focusSoundService.setVolume(v);
              }}
              onResponderMove={(e: any) => {
                const v: number = Math.max(0, Math.min(1, e.nativeEvent.locationX / (W - 80)));
                setVolume(v); focusSoundService.setVolume(v);
              }}
            >
              <View style={[s.volFill, { width: `${Math.round(volume * 100)}%` }]} />
            </View>
            <Ionicons name="volume-high" size={16} color="rgba(255,255,255,0.4)" />
          </View>
        </BlurView>
      </View>
    </Modal>
  );


  // ── Setup Screen ──
  const renderSetup = () => (
    <Animated.View style={fullContentStyle}>
      <View style={[s.safe, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.hdrBtn}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ width: 60 }} />
          <View style={{ width: 36 }} />
        </View>

        <View style={s.setupBody}>
          <View style={s.modePill}>
            <Ionicons name="leaf" size={10} color="#34d399" />
            <Text style={s.modePillTxt}>Deep Focus</Text>
          </View>
          <Text style={s.setupTitle} numberOfLines={2}>{taskTitle}</Text>
          <Text style={s.setupSub}>Set your duration</Text>

          <View style={s.timeGrid}>
            {TIME_OPTIONS.map(t => (
              <TouchableOpacity key={t}
                style={[s.timePill, duration === t && !customDurText && { backgroundColor: bg.accent, borderColor: bg.accent }]}
                onPress={() => { setDuration(t); setCustomDurText(''); }}>
                <Text style={[s.timePillTxt, duration === t && !customDurText && { color: '#fff' }]}>{t}m</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.customRow}>
            <Text style={s.customLabel}>Custom:</Text>
            <TextInput
              style={s.customInput}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={customDurText}
              onChangeText={t => { setCustomDurText(t); if (t) setDuration(parseInt(t) || 25); }}
              maxLength={3}
            />
            <Text style={s.customLabel}>mins</Text>
          </View>
        </View>

        <TouchableOpacity style={[s.primaryBtn, { backgroundColor: bg.accent }]} onPress={handleStart} activeOpacity={0.85}>
          <Text style={s.primaryBtnTxt}>Start Focusing</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // ── Complete Screen ──
  const renderComplete = () => (
    <Animated.View style={fullContentStyle}>
      <ConfettiCelebration show={showConfetti} priority="medium" onComplete={() => setShowConfetti(false)} />
      <View style={[s.safe, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.hdrBtn}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.hdrTitle}>Focus Session</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={s.completeScroll} showsVerticalScrollIndicator={false}>
          <View style={s.completeTop}>
            <View style={s.successRing}>
              <Ionicons name="checkmark" size={44} color="#818cf8" />
            </View>
            <Text style={s.setupTitle}>Great work, {user?.username || 'you'}! 👋</Text>
            <Text style={s.setupSub}>You've completed a focus session.</Text>
          </View>

          {/* Summary */}
          <BlurView intensity={30} tint="dark" style={s.card}>
            <View style={s.cardHeader}>
              <Ionicons name="bar-chart" size={14} color="#818cf8" />
              <Text style={s.cardTitle}>Session Summary</Text>
            </View>
            {[
              { label: 'Focus Time', value: `${customDurText || duration}:00` },
              { label: 'Task', value: taskTitle },
              ...(sessionReward != null ? [{ label: 'Reward', value: `+${sessionReward} XP` }] : []),
            ].map((row, i) => (
              <View key={i} style={[s.summaryRow, i > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }]}>
                <Text style={s.summaryLabel}>{row.label}</Text>
                <Text style={[s.summaryVal, { maxWidth: '55%' }]} numberOfLines={1}>{row.value}</Text>
              </View>
            ))}
          </BlurView>

          {/* Mark task done — only if taskId exists */}
          {!!taskId && (
            <TouchableOpacity style={s.taskDoneRow} onPress={toggleTaskDone} activeOpacity={0.7} disabled={taskDoneLoading}>
              <View style={[s.checkbox, taskMarkedDone && { backgroundColor: '#34d399', borderColor: '#34d399' }]}>
                {taskMarkedDone && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.taskDoneTitle}>Mark task as complete</Text>
                <Text style={s.taskDoneSub}>{taskDoneLoading ? 'Saving…' : 'Check this off your list for today.'}</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* What's Next */}
          <BlurView intensity={30} tint="dark" style={[s.card, { marginTop: 14 }]}>
            <View style={s.cardHeader}>
              <Ionicons name="compass" size={14} color="#818cf8" />
              <Text style={s.cardTitle}>What's Next?</Text>
            </View>
            {[
              { icon: 'cafe-outline', label: 'Take a 5 min break', sub: 'Recharge your mind' },
              { icon: 'list-outline', label: 'Continue to next task', sub: 'Keep the momentum going' },
            ].map((item, i) => (
              <TouchableOpacity key={i} style={[s.nextRow, i > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }]}
                onPress={() => router.back()}>
                <Ionicons name={item.icon as any} size={18} color="rgba(255,255,255,0.6)" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.nextLabel}>{item.label}</Text>
                  <Text style={s.nextSub}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
            ))}
          </BlurView>
        </ScrollView>

          {sessionReward != null && showXpAnim && (
            <XPReward amount={sessionReward} onComplete={() => setShowXpAnim(false)} />
          )}

          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: '#6366f1', marginTop: 10 }]} onPress={() => router.back()}>
            <Ionicons name="home-outline" size={16} color="#fff" />
            <Text style={s.primaryBtnTxt}>Back to Room</Text>
          </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // ── Active / Paused Screen ──
  const renderActive = () => (
    <Animated.View style={fullContentStyle}>
      <View style={[s.safe, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 16 }]}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={confirmStop} style={s.hdrBtn}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ width: 60 }} />
          <TouchableOpacity style={s.hdrBtn} onPress={minimize}>
            <Ionicons name="chevron-down" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Task info */}
        <View style={s.taskInfo}>
          <View style={s.modePill}>
            <Ionicons name="leaf" size={10} color="#34d399" />
            <Text style={s.modePillTxt}>Deep Focus</Text>
          </View>
          <Text style={s.activeTitle} numberOfLines={1}>{taskTitle}</Text>
          <Text style={s.activeSub} numberOfLines={1}>
            {taskId ? `${duration}-minute session` : 'No agenda. Just you and your best.'}
          </Text>
        </View>

        {/* Timer — countdown display; the ring fills ELAPSED clockwise from
            the top over a greyed-out track */}
        <View style={s.timerWrap}>
          <CircularProgress
            size={Math.min(W * 0.78, H * 0.36)}
            strokeWidth={10}
            progress={timer.progress}
            timeDisplay={timer.timeDisplay}
            elapsedMinutes={timer.elapsedMinutes}
            remainingPercent={timer.remainingPercent}
            subtitle={`Until ${timer.endTime}`}
            label="FOCUSING"
          />
          {/* Stats summary card — lives inside the timer group so the pair
              centers together, tucked onto the ring's lower edge */}
          <View style={s.statsRowWrap}>
          <BlurView intensity={40} tint="dark" style={s.statsCard}>
            <View style={s.statItem}>
              <Ionicons name="trending-up-outline" size={18} color="#a78bfa" />
              <View style={s.statTextWrap}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={s.statValue}>{Math.round(timer.progress * (timer.totalSeconds / 60))} min</Text>
                <Text numberOfLines={2} ellipsizeMode="tail" style={s.statLabel}>Focused</Text>
              </View>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Ionicons name="flame-outline" size={18} color="#fb923c" />
              <View style={s.statTextWrap}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={s.statValue}>{sessionsTodayCount}</Text>
                <Text numberOfLines={2} ellipsizeMode="tail" style={s.statLabel}>Sessions today</Text>
              </View>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Ionicons name="star-outline" size={18} color="#facc15" />
              <View style={s.statTextWrap}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={s.statValue}>{sessionReward != null ? `+${sessionReward} XP` : '—'}</Text>
                <Text numberOfLines={2} ellipsizeMode="tail" style={s.statLabel}>Session reward</Text>
              </View>
            </View>
            </BlurView>
          </View>
        </View>

        {/* Bottom rounded action bar */}
        <View style={{ width: '100%', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 16 }}>
          <BlurView intensity={40} tint="dark" style={s.bottomBar}>
            <View style={s.bottomBarInner}>
              <TouchableOpacity style={s.bottomActionBtn} onPress={() => setShowBgPicker(true)}>
                <View style={s.bottomActionIcon}><Ionicons name="image-outline" size={18} color="#fff" /></View>
                <Text style={s.bottomActionLabel} numberOfLines={1}>Background</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.bottomActionBtn} onPress={() => setShowSoundPicker(true)}>
                <View style={s.bottomActionIcon}><Ionicons name="musical-notes-outline" size={18} color="#fff" /></View>
                <Text style={s.bottomActionLabel} numberOfLines={1}>Sound</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={screenState === 'paused' ? handleResume : handlePause}
                activeOpacity={0.95}
                onPressIn={onPausePressIn}
                onPressOut={onPausePressOut}
                style={s.bottomActionCenterBtn}
              >
                <Animated.View style={[s.bottomPauseCenter, pauseScaleStyle]}>
                  <View style={s.bottomPauseGlow} />
                  <LinearGradient colors={[bg.accent, '#4f46e5']} style={s.pauseInner}>
                    <Ionicons name={screenState === 'paused' ? 'play' : 'pause'} size={24} color="#fff" />
                  </LinearGradient>
                </Animated.View>
                <Text style={s.bottomActionLabel} numberOfLines={1}>{screenState === 'paused' ? 'Resume' : 'Pause'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.bottomActionBtn}
                onPress={() => showToast('AI Assist is unavailable during sessions. Visit the home screen to chat with Krios.') }>
                <View style={s.bottomActionIcon}><Ionicons name="sparkles-outline" size={18} color="#fff" /></View>
                <Text style={s.bottomActionLabel} numberOfLines={1}>AI Assist</Text>
                <View style={s.betaPill}><Text style={s.betaTxt}>Beta</Text></View>
              </TouchableOpacity>

              <TouchableOpacity style={s.bottomActionBtn} onPress={confirmStop}>
                <View style={[s.bottomActionIcon, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                  <Ionicons name="stop" size={18} color="#ef4444" />
                </View>
                <Text style={[s.bottomActionLabel, { color: '#ef4444' }]} numberOfLines={1}>End session</Text>
              </TouchableOpacity>
            </View>
          </BlurView>

          {/* Focus mode footer */}
          <View style={s.focusLockRow}>
            <Ionicons name="lock-closed-outline" size={12} color="rgba(255,255,255,0.4)" />
            <View>
              <Text style={s.focusLockTxt}>Focus mode is on</Text>
              <Text style={[s.focusLockTxt, { color: 'rgba(255,255,255,0.35)' }]}>Notifications are paused</Text>
            </View>
          </View>
        </View>

      </View>
    </Animated.View>
  );

  // ── Minimized pill content ──
  const renderMiniPill = () => (
    <Animated.View style={[StyleSheet.absoluteFill, miniContentStyle]}>
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <TouchableOpacity style={s.miniInner} onPress={expand} activeOpacity={0.9}>
        <View style={{ flex: 1 }}>
          <Text style={s.miniTimer}>{timer.timeDisplay}</Text>
          <Text style={s.miniSub}>Focus. Learn. Grow.</Text>
        </View>
        <TouchableOpacity onPress={screenState === 'paused' ? handleResume : handlePause}
          style={s.miniPauseBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={screenState === 'paused' ? 'play' : 'pause'} size={18} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );


  // ════════════════════════════════════════ RENDER ════════════════════════════════════════
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={handleStop}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* Transparent root — lets the app show through when pill is minimized */}
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>

      <Animated.View style={containerStyle}>
        {/* Background */}
        {renderBg(activeBgSource, activeBgRotate)}

        {/* Screen content */}
        {screenState === 'setup' && renderSetup()}
        {(screenState === 'active' || screenState === 'paused') && renderActive()}
        {screenState === 'complete' && renderComplete()}

        {/* Mini pill overlay — only intercepts touches when actually minimized */}
        {(screenState === 'active' || screenState === 'paused') && (
          <View style={StyleSheet.absoluteFill} pointerEvents={isMinimized ? 'auto' : 'none'}>
            {renderMiniPill()}
          </View>
        )}
      </Animated.View>

      {/* End-session confirmation */}
      <ConfirmationModal
        visible={showStopConfirm}
        title="End session?"
        message="Your progress in this session will be lost."
        confirmText="End session"
        cancelText="Keep focusing"
        isDark={isDark}
        destructive
        onConfirm={() => { setShowStopConfirm(false); handleStop(); }}
        onCancel={() => setShowStopConfirm(false)}
      />

      {/* Toast */}
      {toast && (
        <View style={s.toast} pointerEvents="none">
          <BlurView intensity={50} tint="dark" style={s.toastInner}>
            <Text style={s.toastTxt}>{toast}</Text>
          </BlurView>
        </View>
      )}

      {renderBgPicker()}
      {renderSoundPicker()}
      </View>
    </Modal>
  );
}

// ════════════════════════════════════════ STYLES ════════════════════════════════════════
const s = StyleSheet.create({
  safe: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'space-between' },

  // Header
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  hdrBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  hdrTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Setup
  setupBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  setupTitle: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  setupSub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 28 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 18 },
  timePill: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)', minWidth: 64, alignItems: 'center' },
  timePillTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  customLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  customInput: { backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, width: 60, textAlign: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  primaryBtn: { width: W - 40, flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 20, alignItems: 'center' },
  primaryBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Mode pill
  modePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(52,211,153,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(52,211,153,0.35)' },
  modePillTxt: { color: '#34d399', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Active
  taskInfo: { alignItems: 'center', marginTop: 4 },
  activeTitle: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', paddingHorizontal: 32 },
  activeSub: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontStyle: 'italic', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', textAlign: 'center', paddingHorizontal: 40, marginTop: 4 },
  timerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 44 },

  pauseInner: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', shadowColor: '#8b5cf6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 12, elevation: 8 },

  // Stats summary (below timer)
  statsRowWrap: { width: W, alignItems: 'center', marginTop: -32, marginBottom: 10, zIndex: 5 },
  statsCard: { width: W * 0.88, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' },
  statItem: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  statTextWrap: { marginLeft: 8, flex: 1, minWidth: 0, alignItems: 'center' },
  statDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 8 },
  statValue: { color: '#fff', fontSize: 15, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  statLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10.5, flexShrink: 1, lineHeight: 14, textAlign: 'center' },

  // Bottom rounded action bar (inset floating card, pause overlaps the top edge)
  bottomBar: { width: W - 32, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', backgroundColor: 'rgba(8, 12, 28, 0.45)' },
  bottomBarInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2, paddingHorizontal: 8 },
  bottomActionBtn: { alignItems: 'center', flex: 1, minWidth: 0 },
  bottomActionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.02)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  bottomActionLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9.5, marginTop: 4, textAlign: 'center' },
  bottomActionCenterBtn: { alignItems: 'center', width: 76 },
  bottomPauseCenter: { width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.5)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bottomPauseGlow: { position: 'absolute', width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(99,102,241,0.18)', opacity: 0.95 },
  betaPill: { backgroundColor: '#6366f1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  betaTxt: { color: '#fff', fontSize: 9, fontWeight: '700' },
  focusLockRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 },
  focusLockTxt: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '500' },

  // Mini pill
  miniInner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  miniTimer: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: -0.5 },
  miniSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 1 },
  miniPauseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(99,102,241,0.3)', alignItems: 'center', justifyContent: 'center' },

  // Complete
  completeScroll: { width: W, paddingHorizontal: 20, paddingBottom: 20, alignItems: 'center' },
  completeTop: { alignItems: 'center', marginTop: 16, marginBottom: 24 },
  successRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, borderColor: '#818cf8', alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: 'rgba(129,140,248,0.1)' },
  card: { width: '100%', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardTitle: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
  summaryLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
  summaryVal: { color: '#fff', fontSize: 13, fontWeight: '600' },
  taskDoneRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginTop: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  taskDoneTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  taskDoneSub: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
  nextRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  nextLabel: { color: '#fff', fontSize: 14, fontWeight: '500' },
  nextSub: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 1 },

  // Modals / sheets
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingBottom: 32, maxHeight: H * 0.75 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  sheetTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 14 },
  tabPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)' },
  tabPillActive: { backgroundColor: '#6366f1' },
  tabPillTxt: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600' },

  // Bg picker
  bgPreview: { height: 160, marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', marginBottom: 14, alignItems: 'flex-end', justifyContent: 'flex-start' },
  bgPreviewCheck: { margin: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  bgThumbRow: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  bgThumb: { width: 80, height: 80, borderRadius: 14, overflow: 'hidden', justifyContent: 'flex-end', padding: 6, borderWidth: 1.5, borderColor: 'transparent' },
  bgThumbActive: { borderColor: '#6366f1' },
  bgThumbName: { color: '#fff', fontSize: 10, fontWeight: '700' },
  bgThumbCheck: { position: 'absolute', top: 5, right: 5, width: 16, height: 16, borderRadius: 8, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  bgThumbAdd: { width: 80, height: 80, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', gap: 4 },

  // Sound picker
  soundRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  soundRowActive: { backgroundColor: 'rgba(99,102,241,0.08)' },
  soundIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  soundName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  soundDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 },
  soundAddRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  volRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', gap: 10 },
  volTrack: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, position: 'relative', justifyContent: 'center' },
  volFill: { height: 4, backgroundColor: '#6366f1', borderRadius: 2, position: 'absolute', left: 0 },

  // Toast
  toast: { position: 'absolute', bottom: 100, left: 20, right: 20, alignItems: 'center', zIndex: 9999 },
  toastInner: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  toastTxt: { color: '#fff', fontSize: 13, fontWeight: '500', textAlign: 'center' },
});
