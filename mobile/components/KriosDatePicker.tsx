import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface KriosDatePickerProps {
  visible: boolean;
  initialDate: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Platform.OS === 'ios' ? 420 : 380;

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function KriosDatePicker({ visible, initialDate, onConfirm, onCancel }: KriosDatePickerProps) {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const confirmedRef = useRef(false);

  const [selectedDate, setSelectedDate] = useState(new Date(initialDate));
  const [mode, setMode] = useState<'time' | 'date' | 'ampm'>('time');

  // Sync when initialDate changes from parent
  useEffect(() => {
    if (visible) {
      setSelectedDate(new Date(initialDate));
      setMode('time');
    }
  }, [visible, initialDate]);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 5, speed: 14 }).start();
    } else {
      Animated.spring(translateY, { toValue: SHEET_HEIGHT, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
    }
  }, [visible, translateY]);

  const is24Hour = false; // Force 12-hour format like iOS alarms
  const hour24 = selectedDate.getHours();
  const hour12 = hour24 % 12 || 12;
  const minute = selectedDate.getMinutes();
  const ampm = hour24 >= 12 ? 'PM' : 'AM';

  const setHour = useCallback((h: number) => {
    setSelectedDate(prev => {
      const next = new Date(prev);
      const isPm = prev.getHours() >= 12;
      next.setHours(isPm ? (h % 12) + 12 : h % 12, prev.getMinutes(), 0, 0);
      return next;
    });
  }, []);

  const setMinute = useCallback((m: number) => {
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setHours(next.getHours(), m, 0, 0);
      return next;
    });
  }, []);

  const toggleAmPm = useCallback(() => {
    setSelectedDate(prev => {
      const next = new Date(prev);
      const h = next.getHours();
      next.setHours(h >= 12 ? h - 12 : h + 12, next.getMinutes(), 0, 0);
      return next;
    });
  }, []);

  const changeDay = useCallback((delta: number) => {
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    onConfirm(selectedDate);
    setTimeout(() => { confirmedRef.current = false; }, 500);
  }, [selectedDate, onConfirm]);

  const sheetBg = isDark ? 'rgba(10,10,22,0.99)' : 'rgba(248,248,255,0.99)';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const primary = '#6366f1';

  const dateStr = selectedDate.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  // Generate next 7 days for the date strip
  const dayStrips = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const isToday = (d: Date) => {
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel} />
      <Animated.View style={[styles.sheet, { backgroundColor: sheetBg, transform: [{ translateY }] }]}>
        {/* Accent bar */}
        <LinearGradient colors={['#6366f1', '#8b5cf6', '#a78bfa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accentBar} />
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }]} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: divider }]}>
          <TouchableOpacity onPress={onCancel} hitSlop={12}>
            <Text style={[styles.headerBtn, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.title, { color: colors.text }]}>Set Time</Text>
            <Text style={[styles.preview, { color: colors.primary }]}>{dateStr}</Text>
          </View>
          <TouchableOpacity onPress={handleConfirm} hitSlop={12}>
            <Text style={[styles.headerBtn, { color: primary, fontWeight: '700' }]}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* ── INLINE TIME PICKER ── */}
          <View style={styles.timeContainer}>
            {/* Hour column */}
            <ScrollView style={styles.timeColumn} contentContainerStyle={styles.timeColumnContent} showsVerticalScrollIndicator={false}>
              {HOURS.map(h => (
                <TouchableOpacity
                  key={h}
                  onPress={() => setHour(h)}
                  style={[styles.timeCell, hour12 === h && { backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)' }]}
                >
                  <Text style={[styles.timeCellText, { color: hour12 === h ? primary : colors.text }, hour12 === h && { fontWeight: '800' }]}>
                    {String(h).padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Separator */}
            <Text style={[styles.timeSeparator, { color: colors.text }]}>:</Text>

            {/* Minute column */}
            <ScrollView style={styles.timeColumn} contentContainerStyle={styles.timeColumnContent} showsVerticalScrollIndicator={false}>
              {MINUTES.map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMinute(m)}
                  style={[styles.timeCell, minute === m && { backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)' }]}
                >
                  <Text style={[styles.timeCellText, { color: minute === m ? primary : colors.text }, minute === m && { fontWeight: '800' }]}>
                    {String(m).padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* AM/PM */}
            <View style={styles.ampmColumn}>
              <TouchableOpacity
                onPress={() => { if (ampm === 'PM') toggleAmPm(); }}
                style={[styles.ampmBtn, ampm === 'AM' && { backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)' }]}
              >
                <Text style={[styles.ampmText, { color: ampm === 'AM' ? primary : colors.textSecondary }]}>AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { if (ampm === 'AM') toggleAmPm(); }}
                style={[styles.ampmBtn, ampm === 'PM' && { backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)' }]}
              >
                <Text style={[styles.ampmText, { color: ampm === 'PM' ? primary : colors.textSecondary }]}>PM</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── DATE STRIP ── */}
          <View style={[styles.dateStripHeader, { borderBottomColor: divider }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>DATE</Text>
            <View style={styles.dateNavRow}>
              <TouchableOpacity onPress={() => changeDay(-1)} hitSlop={8} style={styles.dateNavBtn}>
                <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => changeDay(1)} hitSlop={8} style={styles.dateNavBtn}>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStripContent}>
            {dayStrips.map((d, i) => {
              const sel = isSameDay(d, selectedDate);
              const today = isToday(d);
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedDate(d)}
                  style={[styles.dayPill, { borderColor: sel ? primary : divider, backgroundColor: sel ? (isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)') : 'transparent' }]}
                >
                  <Text style={[styles.dayPillDay, { color: sel ? primary : colors.textSecondary }]}>
                    {DAY_NAMES[d.getDay()]}
                  </Text>
                  <Text style={[styles.dayPillDate, { color: sel ? primary : colors.text }]}>
                    {d.getDate()}
                  </Text>
                  {today && !sel && <View style={[styles.todayDot, { backgroundColor: primary }]} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </ScrollView>

        {/* Confirm button */}
        <View style={[styles.footer, { borderTopColor: divider, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity onPress={handleConfirm} style={[styles.confirmBtn, { backgroundColor: primary }]} activeOpacity={0.85}>
            <Text style={styles.confirmText}>
              {hour12}:{String(minute).padStart(2, '0')} {ampm}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  accentBar: { height: 3, width: '100%' },
  handle: { alignSelf: 'center', marginTop: 10, width: 40, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: { alignItems: 'center', flex: 1 },
  title: { fontSize: 15, fontWeight: '600' },
  preview: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  headerBtn: { fontSize: 15, fontWeight: '500' },
  body: { paddingHorizontal: 12, paddingBottom: 8 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1,
    paddingVertical: 8, paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  picker: { width: '100%' },
  footer: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  confirmBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  confirmText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },

  // Inline time picker
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  timeColumn: {
    height: 180,
    width: 80,
  },
  timeColumnContent: {
    alignItems: 'center',
    paddingVertical: 70,
    gap: 4,
  },
  timeCell: {
    width: 64,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  timeCellText: {
    fontSize: 22,
    fontWeight: '500',
  },
  timeSeparator: {
    fontSize: 28,
    fontWeight: '300',
    marginHorizontal: 4,
  },
  ampmColumn: {
    flexDirection: 'column',
    gap: 6,
    marginLeft: 8,
  },
  ampmBtn: {
    width: 52,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  ampmText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Date strip
  dateStripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  dateNavRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dateNavBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  dateStripContent: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 8,
    alignItems: 'center',
  },
  dayPill: {
    width: 52,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
  },
  dayPillDay: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dayPillDate: {
    fontSize: 18,
    fontWeight: '700',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
});


