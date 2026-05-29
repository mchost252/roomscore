import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ActivityHeatmapProps {
  data?: number[];
  isDark?: boolean;
}

export function ActivityHeatmap({ data = [], isDark = true }: ActivityHeatmapProps) {
  const calendar = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const baseCells = Array.from({ length: firstDay + daysInMonth }, (_, index) => {
      const day = index - firstDay + 1;
      if (day < 1) return null;
      return {
        day,
        value: data[day - 1] || 0,
        isToday: day === now.getDate(),
      };
    });
    const trailingBlanks = (7 - (baseCells.length % 7)) % 7;
    const cells = [...baseCells, ...Array(trailingBlanks).fill(null)];
    const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, index) =>
      cells.slice(index * 7, index * 7 + 7)
    );
    return { weeks, monthLabel, daysInMonth };
  }, [data]);

  const getColor = (value: number) => {
    if (isDark) {
      if (value === 0) return 'rgba(255,255,255,0.05)';
      if (value === 1) return 'rgba(99, 102, 241, 0.3)';
      if (value === 2) return 'rgba(99, 102, 241, 0.5)';
      if (value === 3) return 'rgba(99, 102, 241, 0.7)';
      return '#6366f1';
    } else {
      if (value === 0) return 'rgba(0,0,0,0.04)';
      if (value === 1) return 'rgba(99, 102, 241, 0.2)';
      if (value === 2) return 'rgba(99, 102, 241, 0.4)';
      if (value === 3) return 'rgba(99, 102, 241, 0.6)';
      return '#6366f1';
    }
  };

  const textColor = isDark ? '#fff' : '#111';
  const secColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const mutedText = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.38)';
  const containerBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const containerBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
  const weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <View style={[styles.container, { backgroundColor: containerBg, borderColor: containerBorder }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: textColor }]}>Activity</Text>
          <Text style={[styles.subtitle, { color: secColor }]}>{calendar.monthLabel}</Text>
        </View>
        <View style={[styles.daysPill, { backgroundColor: isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.10)' }]}>
          <Text style={[styles.daysPillText, { color: textColor }]}>{calendar.daysInMonth} days</Text>
        </View>
      </View>

      <View style={styles.weekdayRow}>
        {weekdayLabels.map((label, index) => (
          <Text key={`${label}-${index}`} style={[styles.weekdayLabel, { color: mutedText }]}>{label}</Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {calendar.weeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.weekRow}>
            {week.map((cell, dayIndex) => (
              <View key={cell ? `day-${cell.day}` : `blank-${weekIndex}-${dayIndex}`} style={styles.daySlot}>
                <View
                  style={[
                    styles.dayCell,
                    cell
                      ? { backgroundColor: getColor(cell.value), borderColor: cell.isToday ? '#6366f1' : 'transparent' }
                      : styles.blankCell,
                  ]}
                >
                  {cell && (
                    <Text style={[styles.dayText, { color: cell.value > 2 || cell.isToday ? '#fff' : mutedText }]}>
                      {cell.day}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: secColor }]}>Less</Text>
        {[0, 1, 2, 3, 4].map((value) => (
          <View key={value} style={[styles.legendBox, { backgroundColor: getColor(value) }]} />
        ))}
        <Text style={[styles.legendText, { color: secColor }]}>More</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  daysPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  daysPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
  },
  calendarGrid: {
    gap: 4,
  },
  weekRow: {
    flexDirection: 'row',
  },
  daySlot: {
    flex: 1,
    alignItems: 'center',
  },
  dayCell: {
    width: '82%',
    height: 18,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  blankCell: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  dayText: {
    fontSize: 8,
    fontWeight: '800',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 9,
    gap: 4,
  },
  legendText: {
    fontSize: 11,
    marginHorizontal: 4,
  },
  legendBox: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
