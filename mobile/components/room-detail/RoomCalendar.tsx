/**
 * RoomCalendar — Premium 3-Level Calendar (v2)
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CalendarLevel = 0 | 1 | 2;

const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getWeekDays(ref: Date): Date[] {
  const d = new Date(ref);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x; });
}

interface RoomCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  taskDates?: Date[];
  completedDates?: Date[];
}

const RoomCalendar: React.FC<RoomCalendarProps> = ({
  selectedDate,
  onSelectDate,
  taskDates = [],
  completedDates = [],
}) => {
  const { colors, isDark } = useTheme();
  const [level, setLevel] = useState<CalendarLevel>(0);
  const today = useMemo(() => new Date(), []);
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  // Month grid state (for level 2)
  const [calMonth, setCalMonth] = useState(selectedDate.getMonth());
  const [calYear, setCalYear] = useState(selectedDate.getFullYear());
  const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
  const startDay = new Date(calYear, calMonth, 1).getDay();

  const toggleLevel = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLevel(prev => {
      if (prev === 0) return 1;
      if (prev === 1) { setCalMonth(selectedDate.getMonth()); setCalYear(selectedDate.getFullYear()); return 2; }
      return 0;
    });
  }, [selectedDate]);

  const surfRgb = isDark ? '30,30,50' : '255,255,255';
  const textPrimary = isDark ? '#ffffff' : '#1a1a2e';
  const textHint = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
  const cardBg = isDark ? 'rgba(16,16,30,0.92)' : 'rgba(248,248,255,0.92)';
  const cardBorder = isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)';

  const hasTasks = (d: Date) => taskDates.some(td => isSameDay(td, d));
  const isCompleted = (d: Date) => completedDates.some(cd => isSameDay(cd, d));

  // ===== WEEK STRIP (Level 0 & 1) =====
  const renderWeekStrip = (enlarged: boolean) => {
    const pillW = enlarged ? 42 : 36;
    const pillH = enlarged ? 62 : 54;
    const pillR = enlarged ? 16 : 18;
    const fontSize = enlarged ? 18 : 16;
    const labelSize = enlarged ? 11 : 10;

    return (
      <View style={{ paddingHorizontal: 8, paddingTop: enlarged ? 8 : 10, paddingBottom: enlarged ? 4 : 6 }}>
        {enlarged && (
          <Text style={[styles.monthLabel, { color: textPrimary, marginBottom: 10 }]}>
            {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </Text>
        )}
        <View style={styles.weekRow}>
          {weekDays.map((d, i) => {
            const isSel = isSameDay(d, selectedDate);
            const isTod = isSameDay(d, today);
            const has = hasTasks(d);
            const completed = isCompleted(d);

            return (
              <TouchableOpacity key={i} onPress={() => onSelectDate(d)} activeOpacity={0.75} style={styles.weekCell}>
                <Text style={{
                  fontSize: labelSize, fontWeight: '700', letterSpacing: 0.6,
                  color: isSel ? colors.primary : textHint,
                  marginBottom: enlarged ? 6 : 5,
                }}>
                  {enlarged ? DAY_FULL[d.getDay()].slice(0, 3).toUpperCase() : DAY_SHORT[d.getDay()]}
                </Text>
                <View style={{
                  width: pillW, height: pillH, borderRadius: pillR,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isSel ? colors.primary : isTod ? 'rgba(99,102,241,0.15)' : `rgba(${surfRgb},0.45)`,
                  borderWidth: isTod && !isSel ? 2 : isSel ? 0 : 0.5,
                  borderColor: isTod && !isSel ? colors.primary : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                }}>
                  <Text style={{
                    fontSize: isSel ? fontSize + 2 : fontSize,
                    fontWeight: isSel ? '800' : isTod ? '700' : '600',
                    color: isSel ? '#fff' : isTod ? colors.primary : textPrimary,
                    letterSpacing: -0.3,
                  }}>
                    {d.getDate()}
                  </Text>
                  {isTod && isSel && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.7)', marginTop: 2 }} />}
                </View>
                {/* Dot */}
                {has && !isSel && (
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, marginTop: 4, backgroundColor: completed ? colors.success : colors.primary }} />
                )}
                {(!has || isSel) && <View style={{ width: 5, height: 5, marginTop: 4 }} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // ===== MONTH GRID (Level 2) =====
  const renderMonthGrid = () => (
    <View style={{ paddingHorizontal: 4, paddingBottom: 4 }}>
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => { const m = calMonth === 0 ? 11 : calMonth - 1; setCalMonth(m); if (calMonth === 0) setCalYear(y => y - 1); }}
          style={[styles.monthNavBtn, { backgroundColor: `rgba(${surfRgb},0.5)` }]}>
          <Ionicons name="chevron-back" size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: textPrimary }]}>{MONTHS[calMonth]} {calYear}</Text>
        <TouchableOpacity onPress={() => { const m = calMonth === 11 ? 0 : calMonth + 1; setCalMonth(m); if (calMonth === 11) setCalYear(y => y + 1); }}
          style={[styles.monthNavBtn, { backgroundColor: `rgba(${surfRgb},0.5)` }]}>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.gridDayHeaders}>
        {DAY_SHORT.map((label, i) => <Text key={i} style={[styles.gridDayLabel, { color: textHint }]}>{label}</Text>)}
      </View>
      <View style={styles.monthGrid}>
        {Array.from({ length: startDay }).map((_, i) => <View key={`e${i}`} style={styles.gridCell} />)}
        {Array.from({ length: totalDays }).map((_, i) => {
          const d = new Date(calYear, calMonth, i + 1);
          const isSel = isSameDay(d, selectedDate);
          const isTod = isSameDay(d, today);
          const has = hasTasks(d);
          const completed = isCompleted(d);
          return (
            <TouchableOpacity key={i} style={styles.gridCell} onPress={() => { onSelectDate(d); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setLevel(0); }}>
              <View style={{
                width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isSel ? colors.primary : isTod ? 'rgba(99,102,241,0.15)' : completed ? colors.success + '18' : `rgba(${surfRgb},0.3)`,
                borderWidth: isTod && !isSel ? 2 : 0,
                borderColor: colors.primary,
              }}>
                <Text style={{ fontSize: 13, fontWeight: isSel || isTod ? '700' : '500', color: isSel ? '#fff' : isTod ? colors.primary : textPrimary }}>
                  {i + 1}
                </Text>
              </View>
              {has && !isSel && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: completed ? colors.success : colors.primary, marginTop: 2 }} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <LinearGradient
        colors={[isDark ? '#6366f125' : '#6366f115', 'transparent', isDark ? 'rgba(139,92,246,0.08)' : 'rgba(99,102,241,0.05)'] as any}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
      />

      {level === 0 && renderWeekStrip(false)}
      {level === 1 && renderWeekStrip(true)}
      {level === 2 && renderMonthGrid()}

      <TouchableOpacity onPress={toggleLevel} style={styles.chevronRow}>
        <Ionicons name={level === 2 ? 'chevron-up' : 'chevron-down'} size={16} color={textHint} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  weekCell: { alignItems: 'center', flex: 1 },
  monthLabel: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 8, paddingTop: 8 },
  monthNavBtn: { padding: 6, borderRadius: 10 },
  gridDayHeaders: { flexDirection: 'row', marginBottom: 4, paddingHorizontal: 4 },
  gridDayLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 },
  gridCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  chevronRow: { alignItems: 'center', paddingVertical: 6 },
});

export default React.memo(RoomCalendar);
