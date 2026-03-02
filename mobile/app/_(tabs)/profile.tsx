import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../constants/theme';
import { GradientText, GlowCard } from '../../components';
import { CosmicAvatar, NeumorphicStatsCard, ActivityHeatmap } from '../../components/profile';

interface MenuItem {
  icon: string;
  label: string;
  onPress: () => void;
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { colors, spacing, borderRadius, fontSizes, gradients, isDark } = useTheme();
  
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [roomsCount, setRoomsCount] = useState(0);
  const [timeSaved, setTimeSaved] = useState(0);

  useEffect(() => {
    setTasksCompleted(47);
    setRoomsCount(5);
    setTimeSaved(12);
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const menuItems: MenuItem[] = [
    { icon: 'person-outline', label: 'Profile Settings', onPress: () => {} },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => {} },
    { icon: 'color-palette-outline', label: 'Appearance', onPress: () => {} },
    { icon: 'information-circle-outline', label: 'About', onPress: () => {} },
    { icon: 'help-circle-outline', label: 'Help & Support', onPress: () => {} },
  ];

  return (
    <LinearGradient
      colors={gradients.background.colors as any}
      locations={gradients.background.locations as any}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.screen.paddingHorizontal }}>
        <View style={[styles.header, { marginTop: spacing.xxxl, marginBottom: spacing.xl }]}>
          <CosmicAvatar 
            username={user?.username || 'U'} 
            size={100} 
            level={3}
            premium={false}
          />
          
          <GradientText gradient="primary" style={[styles.username, { fontSize: fontSizes.h2, marginTop: spacing.md, marginBottom: spacing.xs }]}>
            {user?.username}
          </GradientText>
          <Text style={[styles.email, { fontSize: fontSizes.sm, color: colors.textSecondary as string }]}>
            {user?.email}
          </Text>
        </View>

        <View style={[styles.statsRow, { marginBottom: spacing.xl }]}>
          <NeumorphicStatsCard
            icon="checkmark-done"
            label="Tasks Done"
            value={tasksCompleted}
            color="#6366f1"
            delay={0}
            maxValue={100}
          />
          <View style={{ width: spacing.md }} />
          <NeumorphicStatsCard
            icon="home"
            label="Rooms"
            value={roomsCount}
            color="#8b5cf6"
            delay={100}
            maxValue={20}
          />
          <View style={{ width: spacing.md }} />
          <NeumorphicStatsCard
            icon="time"
            label="Hours Saved"
            value={timeSaved}
            color="#10b981"
            delay={200}
            maxValue={50}
          />
        </View>

        <GlowCard style={{
          backgroundColor: isDark ? colors.background.tertiary : colors.background.secondary,
          padding: spacing.lg,
          borderRadius: borderRadius.lg,
          marginBottom: spacing.lg,
        }}>
          <ActivityHeatmap />
        </GlowCard>

        <GlowCard style={{
          backgroundColor: isDark ? colors.background.tertiary : colors.background.secondary,
          padding: spacing.lg,
          borderRadius: borderRadius.lg,
          marginBottom: spacing.lg,
        }}>
          <Text style={[styles.sectionTitle, { 
            fontSize: fontSizes.lg, 
            color: colors.text as string,
            marginBottom: spacing.md 
          }]}>
            Settings
          </Text>

          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={item.label}
              onPress={item.onPress}
              activeOpacity={0.7}
              style={[styles.menuItem, { 
                paddingVertical: spacing.md,
                borderBottomColor: colors.border.primary,
                borderBottomWidth: index < menuItems.length - 1 ? 1 : 0,
              }]}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons 
                  name={item.icon as any} 
                  size={20} 
                  color={colors.primary} 
                />
              </View>
              <Text style={[styles.menuLabel, { 
                fontSize: fontSizes.md, 
                color: colors.text as string,
              }]}>
                {item.label}
              </Text>
              <Ionicons 
                name="chevron-forward" 
                size={20} 
                color={colors.textSecondary as string} 
              />
            </TouchableOpacity>
          ))}
        </GlowCard>

        <TouchableOpacity onPress={handleLogout} activeOpacity={0.8} style={{ marginTop: spacing.md, marginBottom: spacing.xxl }}>
          <LinearGradient
            colors={['#EF4444', '#DC2626'] as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.logoutButton, {
              borderRadius: borderRadius.button,
              padding: spacing.md,
            }]}
          >
            <Ionicons name="log-out-outline" size={20} color="#ffffff" style={{ marginRight: spacing.sm }} />
            <Text style={[styles.logoutButtonText, { fontSize: fontSizes.md }]}>
              Logout
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
  },
  username: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  email: {
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
  },
  sectionTitle: {
    fontWeight: '700',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
