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
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

interface KriosDatePickerProps {
  visible: boolean;
  initialDate: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Platform.OS === 'ios' ? 480 : 320;

export default function KriosDatePicker({ visible, initialDate, onConfirm, onCancel }: KriosDatePickerProps) {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setSelectedDate(new Date(initialDate));
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 5, speed: 14 }).start();
    } else {
      Animated.spring(translateY, { toValue: SHEET_HEIGHT, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
    }
  }, [visible]);

  // Guard refs to prevent Android duplicate fire
  const lastDateRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const onDateChange = useCallback((_: DateTimePickerEvent, date?: Date) => {
    if (_.type !== 'set') return;
    if (!date) return;
    const ts = date.getTime();
    if (ts === lastDateRef.current) return; // ignore duplicate fires
    lastDateRef.current = ts;
    const merged = new Date(selectedDate);
    merged.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    setSelectedDate(merged);
  }, [selectedDate]);

  const onTimeChange = useCallback((_: DateTimePickerEvent, date?: Date) => {
    if (_.type !== 'set') return;
    if (!date) return;
    const h = date.getHours(), m = date.getMinutes();
    const key = h * 60 + m;
    if (key === lastTimeRef.current) return; // ignore duplicate fires
    lastTimeRef.current = key;
    const merged = new Date(selectedDate);
    merged.setHours(h, m, 0, 0);
    setSelectedDate(merged);
  }, [selectedDate]);

  // Prevent double-fire on confirm
  const confirmedRef = useRef(false);
  const handleConfirm = useCallback(() => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    onConfirm(selectedDate);
    setTimeout(() => { confirmedRef.current = false; }, 500);
  }, [selectedDate, onConfirm]);

  const sheetBg = isDark ? 'rgba(10,10,22,0.99)' : 'rgba(248,248,255,0.99)';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const pickerColor = isDark ? '#ffffff' : '#0f172a';

  // Format display
  const dateStr = selectedDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
            <Text style={[styles.title, { color: colors.text }]}>Pick Date & Time</Text>
            <Text style={[styles.preview, { color: colors.primary }]}>{dateStr} · {timeStr}</Text>
          </View>
          <TouchableOpacity onPress={handleConfirm} hitSlop={12}>
            <Text style={[styles.headerBtn, { color: colors.primary, fontWeight: '700' }]}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Date picker */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, borderBottomColor: divider }]}>DATE</Text>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onDateChange}
            themeVariant={isDark ? 'dark' : 'light'}
            style={styles.picker}
            textColor={pickerColor}
          />
          {/* Time picker */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, borderBottomColor: divider, marginTop: 12 }]}>TIME</Text>
          <DateTimePicker
            value={selectedDate}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onTimeChange}
            themeVariant={isDark ? 'dark' : 'light'}
            style={styles.picker}
            textColor={pickerColor}
          />
        </ScrollView>
        {/* Confirm button */}
        <View style={[styles.footer, { borderTopColor: divider, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity onPress={handleConfirm} style={[styles.confirmBtn, { backgroundColor: colors.primary }]} activeOpacity={0.85}>
            <Text style={styles.confirmText}>Confirm · {dateStr} at {timeStr}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
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
});
