/**
 * CalendarStrip — Tactical Ribbon variant with 3D-like curves and under-lighting
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  interpolate, 
  withTiming, 
  Extrapolate 
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ACTIVE_PILL_COLOR = '#818cf8'; 

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getWeekDays(ref: Date): Date[] {
  const d = new Date(ref);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return x;
  });
}

interface CalendarStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  taskDates?: Date[];
}

const CalendarStrip: React.FC<CalendarStripProps> = ({ selectedDate, onSelectDate, taskDates = [] }) => {
  const { isDark } = useTheme();
  const today = useMemo(() => new Date(), []);
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  
  const selectedIndex = useMemo(() => {
    return weekDays.findIndex(d => isSameDay(d, selectedDate));
  }, [weekDays, selectedDate]);

  return (
    <View style={styles.container}>
      <View style={styles.strip}>
        {weekDays.map((d, i) => {
          const isSel = isSameDay(d, selectedDate);
          const isTod = isSameDay(d, today);
          const hasTask = taskDates.some(td => isSameDay(td, d));

          // ── Ribbon Animation logic ───────────────────────────────────────
          const diff = i - selectedIndex;
          
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onSelectDate(d)}
              activeOpacity={0.8}
              style={[styles.cell]}
            >
              <View style={[
                styles.ribbonWrapper,
                { 
                  transform: [
                    { perspective: 1000 },
                    { rotateY: `${diff * 10}deg` },
                    { scale: 1 - Math.abs(diff) * 0.05 }
                  ] as any
                }
              ]}>
                <Text style={[
                  styles.dayLabel,
                  { color: isSel ? ACTIVE_PILL_COLOR : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.45)') }
                ]}>
                  {DAY_LETTERS[d.getDay()]}
                </Text>

                <View style={[
                  styles.pill,
                  {
                    width: 42,
                    height: isSel ? 64 : 54,
                    borderRadius: 21,
                    backgroundColor: isSel ? ACTIVE_PILL_COLOR : (isDark ? 'rgba(30,30,50,0.5)' : 'rgba(240,240,255,0.5)'),
                    borderColor: isTod && !isSel ? ACTIVE_PILL_COLOR : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                    borderWidth: isTod && !isSel ? 1.5 : 0.5,
                  }
                ]}>
                  <Text style={[
                    styles.dateText,
                    { color: isSel ? '#fff' : (isTod ? ACTIVE_PILL_COLOR : (isDark ? 'rgba(255,255,255,0.8)' : '#1e293b')) }
                  ]}>
                    {d.getDate()}
                  </Text>
                  {isSel && <View style={styles.underglow} />}
                </View>

                {hasTask && !isSel && <View style={[styles.taskDot, { backgroundColor: ACTIVE_PILL_COLOR }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingTop: 4 },
  strip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cell: { flex: 1, alignItems: 'center' },
  ribbonWrapper: { alignItems: 'center' },
  dayLabel: { fontSize: 9, fontWeight: '800', marginBottom: 6, letterSpacing: 0.5 },
  pill: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dateText: { fontSize: 16, fontWeight: '700' },
  underglow: {
    position: 'absolute',
    bottom: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ACTIVE_PILL_COLOR,
    opacity: 0.4,
    shadowRadius: 10,
    shadowColor: ACTIVE_PILL_COLOR,
    shadowOpacity: 0.8,
  },
  taskDot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },
});

export default React.memo(CalendarStrip);
