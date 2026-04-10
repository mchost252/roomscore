import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface RoomHeaderProps {
  roomName: string;
  roomCode?: string;
  memberCount?: number;
  streak?: number;
  daysLeft?: number;
  onBackPress?: () => void;
  onMenuPress?: () => void;
  onSettingsPress?: () => void;
}

const HEADER_HEIGHT = 210;
const ANIMATION_DURATION = 300;

const getFullDate = () => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const now = new Date();
  return {
    dayName: days[now.getDay()],
    fullDate: `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getFullYear()}`,
    monthYear: `${months[now.getMonth()]} ${now.getFullYear()}`,
  };
};

const getWeekDates = () => {
  const today = new Date();
  const dates = [];
  
  for (let i = -2; i <= 2; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push({
      day: date.getDate(),
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      isToday: i === 0,
    });
  }
  
  return dates;
};

const RoomHeader: React.FC<RoomHeaderProps> = ({
  roomName,
  roomCode = 'KRI-000',
  memberCount = 0,
  streak = 0,
  daysLeft = 0,
  onBackPress,
  onMenuPress,
  onSettingsPress,
}) => {
  const { isDark, colors } = useTheme();
  const activeView = useSharedValue(0);

  const weekDates = getWeekDates();
  const { fullDate, monthYear } = getFullDate();

  const handleToggle = () => {
    activeView.value = activeView.value === 0 ? 1 : 0;
  };

  const calendarViewStyle = useAnimatedStyle(() => ({
    opacity: withTiming(activeView.value === 0 ? 1 : 0, {
      duration: ANIMATION_DURATION,
      easing: Easing.inOut(Easing.ease),
    }),
  }));

  const detailsViewStyle = useAnimatedStyle(() => ({
    opacity: withTiming(activeView.value === 1 ? 1 : 0, {
      duration: ANIMATION_DURATION,
      easing: Easing.inOut(Easing.ease),
    }),
  }));

  // Background color matching home screen
  const bgColor = isDark ? '#080810' : '#f8f9ff';

  const renderCalendarView = () => (
    <Animated.View style={[styles.subView, calendarViewStyle]}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBackPress} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
        </TouchableOpacity>
        
        <Text style={styles.roomTitle} numberOfLines={1}>
          {roomName}
        </Text>
        
        <TouchableOpacity onPress={onMenuPress} style={styles.iconButton}>
          <Ionicons name="ellipsis-vertical" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.middleRow}>
        <Text style={styles.fullDate}>{fullDate}</Text>
      </View>

      <View style={styles.bottomRow}>
        {weekDates.map((date, index) => (
          <View
            key={index}
            style={[
              styles.datePill,
              date.isToday && styles.datePillActive,
            ]}
          >
            <Text style={styles.dayName}>{date.dayName}</Text>
            <Text
              style={[
                styles.dateNumber,
                date.isToday && styles.dateNumberActive,
              ]}
            >
              {date.day}
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );

  const renderDetailsView = () => (
    <Animated.View style={[styles.subView, detailsViewStyle]}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBackPress} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
        </TouchableOpacity>
        
        <Text style={styles.roomTitle} numberOfLines={1}>
          {roomName}
        </Text>
        
        <TouchableOpacity onPress={onSettingsPress} style={styles.iconButton}>
          <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.monthRow}>
        <Text style={styles.monthText}>{monthYear}</Text>
      </View>

      <View style={styles.dashboardContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statBadge}>
            <Text style={styles.statValue}>{daysLeft}</Text>
            <Text style={styles.statLabel}>Days</Text>
          </View>
          
          <View style={styles.statBadge}>
            <Text style={styles.statValue}>{roomCode}</Text>
            <Text style={styles.statLabel}>Code</Text>
          </View>
          
          <View style={styles.statBadge}>
            <Text style={styles.statValue}>{memberCount}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          
          <View style={styles.statBadge}>
            <Text style={styles.statValue}>🔥{streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleToggle}
        style={styles.container}
      >
        {/* Subtle background gradient - matching home screen */}
        <LinearGradient
          colors={isDark 
            ? ['#1e1b4b', '#312e81', '#0f172a'] 
            : ['#e0e7ff', '#c7d2fe', '#f0f9ff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Very subtle accent glow */}
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.08)', 'transparent']
            : ['rgba(99,102,241,0.04)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.3 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Subtle horizontal shimmer */}
        <LinearGradient
          colors={isDark
            ? ['transparent', 'rgba(139,92,246,0.15)', 'rgba(99,102,241,0.2)', 'rgba(139,92,246,0.15)', 'transparent']
            : ['transparent', 'rgba(99,102,241,0.08)', 'rgba(139,92,246,0.1)', 'rgba(99,102,241,0.08)', 'transparent']}
          locations={[0, 0.2, 0.5, 0.8, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }}
        />

        {renderCalendarView()}
        {renderDetailsView()}
      </TouchableOpacity>

      {/* Curved bottom edge - matches background color */}
      <View style={[styles.curveFill, { backgroundColor: bgColor }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    height: HEADER_HEIGHT + 15, // Extra space for curve
  },
  container: {
    height: HEADER_HEIGHT,
    width: '100%',
    position: 'relative',
  },
  subView: {
    position: 'absolute',
    top: 8, // Push content down slightly
    left: 0,
    right: 0,
    bottom: 15, // Leave space for curve
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  middleRow: {
    marginTop: 4,
    alignItems: 'center',
  },
  fullDate: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  datePill: {
    width: 50,
    height: 58,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  datePillActive: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    height: 64,
    borderRadius: 32,
  },
  dayName: {
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dateNumber: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  dateNumberActive: {
    color: '#6366f1',
  },
  monthRow: {
    marginTop: 6,
    alignItems: 'center',
  },
  monthText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  dashboardContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  statBadge: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 3,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 1,
  },
  statLabel: {
    fontSize: 7,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  curveFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
});

export { RoomHeader };
export type { RoomHeaderProps };