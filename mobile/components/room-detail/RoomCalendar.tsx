/**
 * RoomCalendar — Clean Dark Calendar Card (v3)
 *
 * Reference layout:
 *   [S] [M] [T] [W] [T] [F] [S]     ← gray letter labels
 *   [7] [8] [9] [10] [11] [12] [13]  ← dark rounded-rect cells, today = purple circle
 *   ● 11m  Nuelist completed run     View activity >   ← activity footer inside card
 *   Long-press an empty area to open the full month grid.
 *
 * Expandable: long-pressing the calendar toggles the full month grid.
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CalendarLevel = 0 | 2;

const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
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
  footer?: React.ReactNode;
}

const RoomCalendar: React.FC<RoomCalendarProps> = ({
  selectedDate,
  onSelectDate,
  taskDates = [],
  completedDates = [],
  footer,
}) => {
  const { colors, isDark } = useTheme();
  const [level, setLevel] = useState<CalendarLevel>(0);
  const today = useMemo(() => new Date(), []);
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const [calMonth, setCalMonth] = useState(selectedDate.getMonth());
  const [calYear, setCalYear] = useState(selectedDate.getFullYear());
  const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
  const startDay = new Date(calYear, calMonth, 1).getDay();

  const toggleLevel = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLevel(prev => {
      if (prev === 0) {
        setCalMonth(selectedDate.getMonth());
        setCalYear(selectedDate.getFullYear());
        return 2;
      }
      return 0;
    });
  }, [selectedDate]);

  const textPrimary = isDark ? '#ffffff' : '#1a1a2e';
  const textHint = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
  const cellBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const cardBg = isDark ? 'rgba(16,16,30,0.95)' : 'rgba(248,248,255,0.95)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const hasTasks = (d: Date) => taskDates.some(td => isSameDay(td, d));
  const isCompleted = (d: Date) => completedDates.some(cd => isSameDay(cd, d));

  // ===== WEEK STRIP =====
  const renderWeekStrip = (enlarged: boolean) => (
    <View style={{ paddingHorizontal: 12, paddingTop: enlarged ? 12 : 14, paddingBottom: 6 }}>
      {enlarged && (
        <Text style={[st.monthLabel, { color: textPrimary, marginBottom: 12 }]}>
          {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
        </Text>
      )}
      {/* Day labels */}
      <View style={st.weekRow}>
        {weekDays.map((d, i) => {
          const isSel = isSameDay(d, selectedDate);
          return (
            <View key={`label-${i}`} style={st.weekCell}>
              <Text style={{
                fontSize: 12, fontWeight: '600', letterSpacing: 0.5,
                color: isSel ? colors.primary : textHint,
              }}>
                {DAY_SHORT[d.getDay()]}
              </Text>
            </View>
          );
        })}
      </View>
      {/* Day numbers */}
      <View style={[st.weekRow, { marginTop: 8 }]}>
        {weekDays.map((d, i) => {
          const isSel = isSameDay(d, selectedDate);
          const isTod = isSameDay(d, today);

          return (
            <TouchableOpacity key={i} onPress={() => onSelectDate(d)} activeOpacity={0.7} style={st.weekCell}>
              <View style={{
                width: 42, height: 42, borderRadius: 21,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isSel ? colors.primary : cellBg,
              }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: isSel ? '800' : '600',
                  color: isSel ? '#fff' : textPrimary,
                }}>
                  {d.getDate()}
                </Text>
                {isTod && isSel && (
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.8)', marginTop: 1 }} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ===== MONTH GRID =====
  const renderMonthGrid = () => (
    <View style={{ paddingHorizontal: 8, paddingBottom: 4 }}>
      <View style={st.monthNav}>
        <TouchableOpacity onPress={() => { const m = calMonth === 0 ? 11 : calMonth - 1; setCalMonth(m); if (calMonth === 0) setCalYear(y => y - 1); }}
          style={[st.monthNavBtn, { backgroundColor: cellBg }]}>
          <Ionicons name="chevron-back" size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[st.monthLabel, { color: textPrimary }]}>{MONTHS[calMonth]} {calYear}</Text>
        <TouchableOpacity onPress={() => { const m = calMonth === 11 ? 0 : calMonth + 1; setCalMonth(m); if (calMonth === 11) setCalYear(y => y + 1); }}
          style={[st.monthNavBtn, { backgroundColor: cellBg }]}>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={st.gridDayHeaders}>
        {DAY_SHORT.map((label, i) => <Text key={i} style={[st.gridDayLabel, { color: textHint }]}>{label}</Text>)}
      </View>
      <View style={st.monthGrid}>
        {Array.from({ length: startDay }).map((_, i) => <View key={`e${i}`} style={st.gridCell} />)}
        {Array.from({ length: totalDays }).map((_, i) => {
          const d = new Date(calYear, calMonth, i + 1);
          const isSel = isSameDay(d, selectedDate);
          const isTod = isSameDay(d, today);
          const completed = isCompleted(d);
          return (
            <TouchableOpacity key={i} style={st.gridCell} onPress={() => { onSelectDate(d); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setLevel(0); }}>
              <View style={{
                width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isSel ? colors.primary : isTod ? 'rgba(99,102,241,0.15)' : completed ? colors.success + '18' : cellBg,
                borderWidth: isTod && !isSel ? 2 : 0,
                borderColor: colors.primary,
              }}>
                <Text style={{ fontSize: 13, fontWeight: isSel || isTod ? '700' : '500', color: isSel ? '#fff' : isTod ? colors.primary : textPrimary }}>
                  {i + 1}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <Pressable
      style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
      onLongPress={toggleLevel}
      delayLongPress={450}
    >
      {level === 0 && renderWeekStrip(false)}
      {level === 2 && renderMonthGrid()}

      {/* Activity footer slot — rendered inside the card */}
      {footer && level === 0 && (
        <View style={[st.footerSlot, { borderTopColor: cardBorder }]}>
          {footer}
        </View>
      )}

    </Pressable>
  );
};

const st = StyleSheet.create({
  card: { marginHorizontal: 16, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekCell: { alignItems: 'center', flex: 1 },
  monthLabel: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 8, paddingTop: 8 },
  monthNavBtn: { padding: 6, borderRadius: 10 },
  gridDayHeaders: { flexDirection: 'row', marginBottom: 4, paddingHorizontal: 4 },
  gridDayLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 },
  gridCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  footerSlot: { borderTopWidth: StyleSheet.hairlineWidth, marginHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
});

export default React.memo(RoomCalendar);
