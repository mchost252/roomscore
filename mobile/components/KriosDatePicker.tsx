import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

interface KriosDatePickerProps {
  visible: boolean;
  initialDate: Date;
  showDate?: boolean;
  timeDisabled?: boolean;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);

export default function KriosDatePicker({
  visible, initialDate, showDate = true, timeDisabled = false, onConfirm, onCancel,
}: KriosDatePickerProps) {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(new Date(initialDate));
  const [tab, setTab] = useState<'date' | 'time'>(showDate && !timeDisabled ? 'date' : 'date');
  const [month, setMonth] = useState(new Date(initialDate));

  useEffect(() => {
    if (visible) {
      const next = new Date(initialDate);
      setValue(next);
      setMonth(next);
      setTab(showDate ? 'date' : 'time');
    }
  }, [visible, initialDate, showDate]);

  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: total }, (_, index) => index + 1)];
  }, [month]);

  const hour = value.getHours() % 12 || 12;
  const minute = Math.round(value.getMinutes() / 5) * 5 % 60;
  const period = value.getHours() >= 12 ? 'PM' : 'AM';
  const updateTime = (nextHour: number, nextMinute: number, nextPeriod = period) => {
    const next = new Date(value);
    const hour24 = nextPeriod === 'PM' ? (nextHour % 12) + 12 : nextHour % 12;
    next.setHours(hour24, nextMinute, 0, 0);
    setValue(next);
  };

  const selectDay = (day: number) => {
    const next = new Date(value);
    next.setFullYear(month.getFullYear(), month.getMonth(), day);
    setValue(next);
  };

  const changeMonth = (delta: number) => {
    setMonth(current => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const muted = isDark ? '#8b8ba7' : '#73738a';
  const surface = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.06)';
  const selectedBg = isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.12)';
  const dateLabel = value.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLabel = `${hour}:${String(minute).padStart(2, '0')} ${period}`;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.card, { backgroundColor: isDark ? '#10101d' : '#fbfbff', paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel}><Text style={[styles.action, { color: muted }]}>Cancel</Text></TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={[styles.title, { color: colors.text }]}>Set schedule</Text>
              <Text style={[styles.subtitle, { color: colors.primary }]}>{showDate ? dateLabel : `Every day · ${timeLabel}`}</Text>
            </View>
            <TouchableOpacity onPress={() => onConfirm(value)}><Text style={[styles.action, { color: colors.primary, fontWeight: '800' }]}>Done</Text></TouchableOpacity>
          </View>

          <View style={[styles.tabs, { backgroundColor: surface }]}>
            {showDate && <TouchableOpacity onPress={() => setTab('date')} style={[styles.tab, tab === 'date' && { backgroundColor: colors.primary }]}>
              <Ionicons name="calendar-outline" size={16} color={tab === 'date' ? '#fff' : muted} />
              <Text style={[styles.tabText, { color: tab === 'date' ? '#fff' : muted }]}>Date</Text>
            </TouchableOpacity>}
            <TouchableOpacity disabled={timeDisabled} onPress={() => setTab('time')} style={[styles.tab, tab === 'time' && { backgroundColor: colors.primary }, timeDisabled && { opacity: 0.35 }]}>
              <Ionicons name="time-outline" size={16} color={tab === 'time' ? '#fff' : muted} />
              <Text style={[styles.tabText, { color: tab === 'time' ? '#fff' : muted }]}>Time</Text>
            </TouchableOpacity>
          </View>

          {tab === 'date' && showDate && (
            <View style={styles.datePane}>
              <View style={styles.monthHeader}>
                <TouchableOpacity onPress={() => changeMonth(-1)} style={[styles.navButton, { backgroundColor: surface }]}><Ionicons name="chevron-back" size={18} color={colors.text} /></TouchableOpacity>
                <Text style={[styles.monthTitle, { color: colors.text }]}>{MONTHS[month.getMonth()]} {month.getFullYear()}</Text>
                <TouchableOpacity onPress={() => changeMonth(1)} style={[styles.navButton, { backgroundColor: surface }]}><Ionicons name="chevron-forward" size={18} color={colors.text} /></TouchableOpacity>
              </View>
              <View style={styles.weekHeader}>{DAYS.map(day => <Text key={day} style={[styles.weekday, { color: muted }]}>{day.slice(0, 2)}</Text>)}</View>
              <View style={styles.grid}>{calendarDays.map((day, index) => {
                const selected = day === value.getDate() && month.getMonth() === value.getMonth() && month.getFullYear() === value.getFullYear();
                return <TouchableOpacity key={`${day}-${index}`} disabled={!day} onPress={() => day && selectDay(day)} style={[styles.day, selected && { backgroundColor: colors.primary }]}>
                  <Text style={[styles.dayText, { color: selected ? '#fff' : day ? colors.text : 'transparent' }]}>{day || 0}</Text>
                </TouchableOpacity>;
              })}</View>
            </View>
          )}

          {tab === 'time' && !timeDisabled && (
            <View style={styles.timePane}>
              <Text style={[styles.timePreview, { color: colors.text }]}>{timeLabel}</Text>
              <Text style={[styles.helper, { color: muted }]}>Choose a reminder time</Text>
              <View style={styles.pickerRow}>
                <View style={styles.pickerColumn}>{HOURS.map(item => <TouchableOpacity key={item} onPress={() => updateTime(item, minute)} style={[styles.option, item === hour && { backgroundColor: selectedBg }]}><Text style={[styles.optionText, { color: item === hour ? colors.primary : colors.text }]}>{item}</Text></TouchableOpacity>)}</View>
                <Text style={[styles.colon, { color: colors.text }]}>:</Text>
                <View style={styles.pickerColumn}>{MINUTES.map(item => <TouchableOpacity key={item} onPress={() => updateTime(hour, item)} style={[styles.option, item === minute && { backgroundColor: selectedBg }]}><Text style={[styles.optionText, { color: item === minute ? colors.primary : colors.text }]}>{String(item).padStart(2, '0')}</Text></TouchableOpacity>)}</View>
                <View style={styles.periodColumn}>{(['AM', 'PM'] as const).map(item => <TouchableOpacity key={item} onPress={() => updateTime(hour, minute, item)} style={[styles.period, item === period && { backgroundColor: selectedBg }]}><Text style={[styles.periodText, { color: item === period ? colors.primary : muted }]}>{item}</Text></TouchableOpacity>)}</View>
              </View>
            </View>
          )}

          {timeDisabled && <View style={styles.disabledNotice}><Ionicons name="sunny-outline" size={20} color={colors.primary} /><Text style={[styles.disabledText, { color: muted }]}>All day selected — no reminder time needed.</Text></View>}
          <TouchableOpacity onPress={() => onConfirm(value)} style={[styles.doneButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.doneText}>{showDate && !timeDisabled ? `${dateLabel} · ${timeLabel}` : showDate ? dateLabel : `Every day · ${timeLabel}`}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  card: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,150,0.45)', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  headerCenter: { alignItems: 'center', flex: 1 },
  title: { fontSize: 17, fontWeight: '800' },
  subtitle: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  action: { fontSize: 15, padding: 8 },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4, marginVertical: 14, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, paddingVertical: 10 },
  tabText: { fontSize: 13, fontWeight: '800' },
  datePane: { minHeight: 300 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthTitle: { fontSize: 16, fontWeight: '800' },
  navButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  weekday: { width: '14.28%', textAlign: 'center', fontSize: 11, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16, marginBottom: 3 },
  dayText: { fontSize: 14, fontWeight: '700' },
  timePane: { minHeight: 300, alignItems: 'center' },
  timePreview: { fontSize: 36, fontWeight: '900', marginTop: 10 },
  helper: { fontSize: 12, marginTop: 4, marginBottom: 16 },
  pickerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pickerColumn: { width: 140, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  option: { width: 42, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionText: { fontSize: 18, fontWeight: '800' },
  colon: { fontSize: 26, fontWeight: '900' },
  periodColumn: { gap: 8, marginLeft: 6 },
  period: { width: 58, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  periodText: { fontSize: 14, fontWeight: '900' },
  disabledNotice: { minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 10 },
  disabledText: { fontSize: 13, fontWeight: '600' },
  doneButton: { borderRadius: 15, alignItems: 'center', paddingVertical: 15, marginTop: 12 },
  doneText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
