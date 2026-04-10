/**
 * CalendarStrip — Horizontal pill calendar matching HomeScreen design
 *
 * UPDATED pill specs:
 *   Inactive: 42x58, borderRadius 21, subtle dark bg
 *   Active:   46x70, borderRadius 23, Lavender/Cyan accent, noticeably taller+wider
 *   Today:    border ring when not selected
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Lavender/Cyan accent for active pill
const ACTIVE_PILL_COLOR = '#818cf8'; // Lavender
const ACTIVE_PILL_GLOW = 'rgba(129,140,248,0.35)';

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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
  /** Dates that have tasks — shows dot indicator */
  taskDates?: Date[];
}

const CalendarStrip: React.FC<CalendarStripProps> = ({
  selectedDate,
  onSelectDate,
  taskDates = [],
}) => {
  const { isDark, colors } = useTheme();
  const today = useMemo(() => new Date(), []);
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const surfRgb = isDark ? '30,30,50' : '240,240,255';

  return (
    <View style={styles.container}>
      <View style={styles.strip}>
        {weekDays.map((d, i) => {
          const isSel = isSameDay(d, selectedDate);
          const isTod = isSameDay(d, today);
          const hasTask = taskDates.some(td => isSameDay(td, d));

          return (
            <TouchableOpacity
              key={i}
              onPress={() => onSelectDate(d)}
              activeOpacity={0.7}
              style={styles.cell}
            >
              {/* Day letter */}
              <Text
                style={[
                  styles.dayLabel,
                  {
                    color: isSel
                      ? ACTIVE_PILL_COLOR
                      : isDark
                        ? 'rgba(255,255,255,0.4)'
                        : 'rgba(15,23,42,0.45)',
                    fontWeight: isSel ? '800' : '700',
                  },
                ]}
              >
                {DAY_LETTERS[d.getDay()]}
              </Text>

              {/* Pill — active is noticeably taller + wider */}
              <View
                style={[
                  styles.pill,
                  {
                    width: isSel ? 46 : 42,
                    height: isSel ? 70 : 58,
                    borderRadius: isSel ? 23 : 21,
                    backgroundColor: isSel
                      ? ACTIVE_PILL_COLOR
                      : isTod
                        ? 'rgba(129,140,248,0.15)'
                        : `rgba(${surfRgb},0.5)`,
                    borderWidth: isTod && !isSel ? 2 : isSel ? 0 : StyleSheet.hairlineWidth,
                    borderColor: isTod && !isSel
                      ? ACTIVE_PILL_COLOR
                      : isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.06)',
                    // Glow shadow on active pill
                    shadowColor: isSel ? ACTIVE_PILL_COLOR : 'transparent',
                    shadowOffset: { width: 0, height: isSel ? 4 : 0 },
                    shadowOpacity: isSel ? 0.45 : 0,
                    shadowRadius: isSel ? 12 : 0,
                    elevation: isSel ? 6 : 0,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: isSel ? 20 : 16,
                    fontWeight: isSel ? '800' : isTod ? '700' : '600',
                    color: isSel
                      ? '#ffffff'
                      : isTod
                        ? ACTIVE_PILL_COLOR
                        : isDark
                          ? 'rgba(255,255,255,0.8)'
                          : '#1e293b',
                    letterSpacing: -0.3,
                  }}
                >
                  {d.getDate()}
                </Text>
                {/* Today indicator dot inside selected pill */}
                {isTod && isSel && (
                  <View style={styles.todayDotInside} />
                )}
              </View>

              {/* Task dot below pill */}
              {hasTask && !isSel && (
                <View
                  style={[styles.taskDot, { backgroundColor: ACTIVE_PILL_COLOR }]}
                />
              )}
              {/* Invisible spacer so unselected cells don't shift when neighbor is active */}
              {!hasTask && !isSel && <View style={styles.taskDotSpacer} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
    paddingTop: 2,
    paddingBottom: 0,
  },
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cell: {
    alignItems: 'center',
    flex: 1,
  },
  dayLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayDotInside: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.75)',
    marginTop: 3,
  },
  taskDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 5,
  },
  taskDotSpacer: {
    width: 4,
    height: 4,
    marginTop: 5,
  },
});

export default React.memo(CalendarStrip);
