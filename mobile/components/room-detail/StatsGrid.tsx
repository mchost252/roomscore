/**
 * StatsGrid — "THE COMMAND DECK" (Side B of AbsoluteHeader)
 *
 * 2x2 grid of Control Widgets.
 *   Widget 1 (Identity):  Room Code + Copy icon
 *   Widget 2 (Squad):     Member count + Manage button
 *   Widget 3 (Retention): 5-day chat retention visual indicator
 *   Widget 4 (Privacy):   Public/Private toggle switch
 *
 * Theme-aware architecture replacing hardcoded hexes.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Switch } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { RoomMember } from '../../types/room';

interface StatsGridProps {
  daysLeft: number;
  roomCode: string;
  members: RoomMember[];
  streak: number;
  chatRetentionDays?: number;
  isPublic?: boolean;
  onTogglePrivacy?: (isPublic: boolean) => void;
  onManageMembers?: () => void;
  isOwner?: boolean;
}

const Widget: React.FC<{
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  colors: any;
}> = ({ children, onPress, onLongPress, colors }) => {
  const Wrapper = onPress || onLongPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[
        styles.widget,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.borderColor,
          shadowColor: colors.primary,
          elevation: 1,
        }
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
    >
      <LinearGradient
        colors={[colors.primary + '10', colors.secondary + '05', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </Wrapper>
  );
};

const StatsGrid: React.FC<StatsGridProps> = ({
  roomCode,
  members,
  chatRetentionDays = 3,
  isPublic = false,
  onTogglePrivacy,
  onManageMembers,
  isOwner = false,
}) => {
  const { colors, isDark } = useTheme();

  const handleCopyCode = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(roomCode);
      if (Platform.OS !== 'web') {
        Alert.alert('Copied', `Room code "${roomCode}" copied to clipboard`);
      }
    } catch {}
  }, [roomCode]);

  const retentionRatio = Math.min(chatRetentionDays / 5, 1);

  return (
    <View style={styles.grid}>
      {/* Widget 1: Identity */}
      <Widget onPress={handleCopyCode} colors={colors}>
        <View style={styles.widgetHeader}>
          <Ionicons name="key-outline" size={13} color={colors.primary} />
          <Text style={[styles.widgetLabel, { color: colors.textSecondary }]}>ROOM CODE</Text>
        </View>
        <View style={styles.codeRow}>
          <Text style={[styles.codeText, { color: colors.text }]} numberOfLines={1}>{roomCode}</Text>
          <Ionicons name="copy-outline" size={12} color={colors.textTertiary} />
        </View>
      </Widget>

      {/* Widget 2: Squad */}
      <Widget onPress={onManageMembers} colors={colors}>
        <View style={styles.widgetHeader}>
          <Ionicons name="people-outline" size={13} color={colors.secondary} />
          <Text style={[styles.widgetLabel, { color: colors.textSecondary }]}>SQUAD</Text>
        </View>
        <View style={styles.squadRow}>
          <Text style={[styles.squadCount, { color: colors.text }]}>{members.length}</Text>
          <Text style={[styles.squadSuffix, { color: colors.textSecondary }]}>
            {members.length === 1 ? 'member' : 'members'}
          </Text>
        </View>
      </Widget>

      {/* Widget 3: Retention */}
      <Widget colors={colors}>
        <View style={styles.widgetHeader}>
          <Ionicons name="timer-outline" size={13} color={colors.warning} />
          <Text style={[styles.widgetLabel, { color: colors.textSecondary }]}>RETENTION</Text>
        </View>
        <Text style={[styles.retentionValue, { color: colors.text }]}>
          {chatRetentionDays}<Text style={[styles.retentionUnit, { color: colors.textTertiary }]}> / 5 days</Text>
        </Text>
        <View style={[styles.retentionTrack, { backgroundColor: colors.borderColor }]}>
          <View style={[styles.retentionFill, { width: `${retentionRatio * 100}%`, backgroundColor: colors.warning }]} />
        </View>
      </Widget>

      {/* Widget 4: Privacy */}
      <Widget colors={colors}>
        <View style={styles.widgetHeader}>
          <Ionicons
            name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
            size={13}
            color={isPublic ? colors.success : colors.error}
          />
          <Text style={[styles.widgetLabel, { color: colors.textSecondary }]}>
            {isPublic ? 'PUBLIC' : 'PRIVATE'}
          </Text>
        </View>
        <View style={styles.toggleRow}>
          <Switch
            value={isPublic}
            onValueChange={onTogglePrivacy}
            disabled={!isOwner}
            trackColor={{ false: colors.borderColor, true: colors.primary + '50' }}
            thumbColor={isPublic ? colors.primary : colors.textTertiary}
            ios_backgroundColor={colors.borderColor}
            style={styles.toggleSwitch}
          />
          <Text style={[styles.toggleLabel, { color: colors.textTertiary }]}>
            {isOwner ? 'Toggle' : 'Owner only'}
          </Text>
        </View>
      </Widget>
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  widget: {
    width: '48%',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 1.5,
  },
  widgetLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    flex: 1,
  },
  squadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  squadCount: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  squadSuffix: {
    fontSize: 11,
    fontWeight: '500',
  },
  retentionValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  retentionUnit: {
    fontSize: 10,
    fontWeight: '500',
  },
  retentionTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  retentionFill: {
    height: '100%',
    borderRadius: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleSwitch: {
    transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }],
  },
  toggleLabel: {
    fontSize: 9,
    fontWeight: '500',
  },
});

export default React.memo(StatsGrid);
