/**
 * ActivityHeatmap - Optimized version without animations
 * Shows user activity as a GitHub-style contribution graph
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ActivityHeatmapProps {
  data?: number[];
  isDark?: boolean;
}

export function ActivityHeatmap({ data = [], isDark = true }: ActivityHeatmapProps) {
  // Generate 49 days of data (7 weeks)
  // If no real data provided, use empty data (no random)
  const activityData = useMemo(() => {
    if (data.length > 0) return data;
    // Return all zeros if no data - clean look
    return Array(49).fill(0);
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
  const containerBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const containerBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';

  // Render cells directly without animation for instant display
  const renderCells = () => {
    const weeks: React.ReactNode[] = [];
    
    for (let weekIndex = 0; weekIndex < 7; weekIndex++) {
      const days: React.ReactNode[] = [];
      
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const index = weekIndex * 7 + dayIndex;
        if (index >= activityData.length) {
          days.push(<View key={dayIndex} style={styles.cell} />);
        } else {
          days.push(
            <View
              key={dayIndex}
              style={[styles.cell, { backgroundColor: getColor(activityData[index]) }]}
            />
          );
        }
      }
      
      weeks.push(
        <View key={weekIndex} style={styles.week}>
          {days}
        </View>
      );
    }
    
    return weeks;
  };

  return (
    <View style={[styles.container, { backgroundColor: containerBg, borderColor: containerBorder }]}>
      <Text style={[styles.title, { color: textColor }]}>Activity This Month</Text>
      <View style={styles.heatmapContainer}>
        {renderCells()}
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
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  heatmapContainer: {
    flexDirection: 'row',
    gap: 3,
  },
  week: {
    flex: 1,
    gap: 3,
  },
  cell: {
    aspectRatio: 1,
    borderRadius: 3,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 4,
  },
  legendText: {
    fontSize: 11,
    marginHorizontal: 4,
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
});
