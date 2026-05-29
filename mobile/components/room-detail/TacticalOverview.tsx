import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';

const { width: W } = Dimensions.get('window');

interface TacticalOverviewProps {
  visible: boolean;
  stats: {
    sync: number;       // Participation %
    total: number;      // Total tasks
    points: number;     // Total points pot
    squadOnline: number; // Members online
  };
}

const StatBox = ({ label, value, icon, color, isDark }: { label: string, value: string, icon: string, color: string, isDark: boolean }) => {
  const boxBg = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
  const borderColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const labelColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';

  return (
    <View style={[s.statBox, { backgroundColor: boxBg, borderColor }]}>
      <View style={s.statHeader}>
        <Ionicons name={icon as any} size={12} color={color} />
        <Text style={[s.statLabel, { color: labelColor }]}>{label}</Text>
      </View>
      <Text style={[s.statValue, { color: isDark ? '#fff' : '#000' }]}>{value}</Text>
      <View style={[s.glowPoint, { backgroundColor: color }]} />
    </View>
  );
};

export const TacticalOverview: React.FC<TacticalOverviewProps> = ({ visible, stats }) => {
  const { isDark } = useTheme();

  if (!visible) return null;

  return (
    <Animated.View 
      entering={FadeIn.duration(600)} 
      exiting={FadeOut.duration(400)}
      style={s.container}
    >
      <View style={s.grid}>
        <StatBox 
          label="SQD_SYNC" 
          value={`${Math.round(stats.sync)}%`} 
          icon="sync-outline" 
          color="#22d3ee" 
          isDark={isDark} 
        />
        <StatBox 
          label="OBJ_TOTAL" 
          value={stats.total.toString()} 
          icon="layers-outline" 
          color="#818cf8" 
          isDark={isDark} 
        />
        <StatBox 
          label="GHOST_CAP" 
          value={`${stats.points} PTS`} 
          icon="flash-outline" 
          color="#fbbf24" 
          isDark={isDark} 
        />
        <StatBox 
          label="SQUAD_RDY" 
          value={`${stats.squadOnline} LIVE`} 
          icon="radio-outline" 
          color="#22c55e" 
          isDark={isDark} 
        />
      </View>

      <View style={s.footerNote}>
        <View style={[s.line, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
        <Text style={[s.footerText, { color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }]}>
          SECTORS COMPRESSED • STANDBY FOR INTEL
        </Text>
        <View style={[s.line, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    width: (W - 32 - 12) / 2,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    overflow: 'hidden',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  glowPoint: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 4,
    height: 4,
    borderRadius: 2,
    shadowRadius: 4,
    shadowOpacity: 1,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    opacity: 0.8,
  },
  line: {
    flex: 1,
    height: 1,
  },
  footerText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
});
