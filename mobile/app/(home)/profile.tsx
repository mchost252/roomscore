import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DarkTheme = {
  background: '#0a0a12',
  surface: 'rgba(255,255,255,0.06)',
  text: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.7)',
  textTertiary: 'rgba(255,255,255,0.45)',
  border: 'rgba(255,255,255,0.1)',
  gradient: ['#1e1b4b', '#312e81', '#0a0a12', '#0a0a12'],
  glow1: 'rgba(99, 102, 241, 0.2)',
  glow2: 'rgba(168, 85, 247, 0.2)',
  glow3: 'rgba(236, 72, 153, 0.2)',
};

const LightTheme = {
  background: '#fafafa',
  surface: 'rgba(0,0,0,0.04)',
  text: '#0f172a',
  textSecondary: 'rgba(15, 23, 42, 0.7)',
  textTertiary: 'rgba(15, 23, 42, 0.45)',
  border: 'rgba(0,0,0,0.08)',
  gradient: ['#ede9fe', '#e0e7ff', '#fafafa', '#fafafa'],
  glow1: 'rgba(99, 102, 241, 0.1)',
  glow2: 'rgba(168, 85, 247, 0.1)',
  glow3: 'rgba(236, 72, 153, 0.1)',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  const theme = isDarkMode ? DarkTheme : LightTheme;

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem('isDarkMode');
      if (saved !== null) {
        setIsDarkMode(saved === 'true');
      }
    } catch (e) {}
  };

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
          }
        },
      ]
    );
  };

  const stats = [
    { label: 'Current Streak', value: user?.streak || 0, icon: 'flame', color: '#F59E0B', glow: theme.glow3 },
    { label: 'Tasks Done', value: user?.totalTasksCompleted || 0, icon: 'checkmark-circle', color: '#10B981', glow: theme.glow1 },
    { label: 'Rooms', value: 2, icon: 'people', color: '#8B5CF6', glow: theme.glow2 },
  ];

  const quickActions = [
    { icon: 'calendar-outline', label: 'Schedule', color: '#6366f1' },
    { icon: 'trophy-outline', label: 'Achievements', color: '#f59e0b' },
    { icon: 'analytics-outline', label: 'Analytics', color: '#10b981' },
    { icon: 'heart-outline', color: '#ec4899' },
  ];

  const menuItems = [
    { icon: 'create-outline', label: 'Edit Profile', color: '#6366f1', action: 'edit' },
    { icon: 'notifications-outline', label: 'Notifications', color: '#f59e0b', action: '' },
    { icon: 'moon-outline', label: 'Appearance', color: '#8b5cf6', action: '' },
    { icon: 'lock-closed-outline', label: 'Privacy', color: '#10b981', action: '' },
    { icon: 'help-circle-outline', label: 'Help & Support', color: '#ec4899', action: '' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={theme.gradient as any}
        locations={[0, 0.15, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Profile</Text>
        <TouchableOpacity 
          style={[styles.settingsButton, { backgroundColor: theme.surface }]}
          onPress={() => router.push('/(home)/settings')}
        >
          <Ionicons name="settings-outline" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <LinearGradient
              colors={['#6366f1', '#8b5cf6', '#a855f7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarText}>
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </LinearGradient>
            <TouchableOpacity style={styles.editAvatarButton}>
              <Ionicons name="camera" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.username, { color: theme.text }]}>
            {user?.username || 'User'}
          </Text>
          <Text style={[styles.email, { color: theme.textSecondary }]}>
            {user?.email || 'user@example.com'}
          </Text>
          
          <View style={styles.quickActions}>
            {quickActions.map((action, index) => (
              <TouchableOpacity 
                key={index} 
                style={[styles.quickActionButton, { backgroundColor: action.color + '20' }]}
              >
                <Ionicons name={action.icon as any} size={20} color={action.color} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.statsContainer}>
          {stats.map((stat, index) => (
            <View 
              key={index} 
              style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={[styles.statIcon, { backgroundColor: stat.glow }]}>
                <Ionicons name={stat.icon as any} size={20} color={stat.color} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {stat.value}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textTertiary }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.menuSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={[
                styles.menuItem,
                index < menuItems.length - 1 && { borderBottomColor: theme.border }
              ]}
              onPress={() => {
                if (item.action === 'edit') {
                  Alert.alert('Edit Profile', 'Profile editing coming soon!');
                } else if (item.label === 'Appearance') {
                  router.push('/(home)/settings');
                } else if (item.label === 'Notifications') {
                  Alert.alert('Notifications', 'Notification settings coming soon!');
                } else if (item.label === 'Privacy') {
                  Alert.alert('Privacy', 'Privacy settings coming soon!');
                } else if (item.label === 'Help & Support') {
                  Alert.alert('Help & Support', 'Contact support coming soon!');
                }
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={[styles.menuLabel, { color: theme.text }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={[styles.logoutButton, { borderColor: '#ef4444' }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={[styles.logoutText, { color: '#ef4444' }]}>Logout</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: theme.textTertiary }]}>
          Krios v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarGradient: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0a0a12',
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
  },
  menuSection: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 40,
  },
});
