import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notificationService from '../../services/notificationService';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors, gradients, isDark, setTheme } = useTheme();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  useLayoutEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 220, friction: 18, useNativeDriver: true }),
    ]).start();
  }, []);
  const theme = {
    background: colors.background.primary,
    surface: colors.surface,
    border: colors.border.primary,
    text: colors.text,
    textSecondary: colors.textSecondary,
    textTertiary: colors.textTertiary,
    primary: colors.primary,
    gradient: gradients.background.colors,
  };
  const insets = useSafeAreaInsets();

  const [navStyle, setNavStyle] = useState<'bottom' | 'sidebar'>('bottom');
  const [notifications, setNotifications] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const nav = await AsyncStorage.getItem('krios_nav_style');
      const notif = await AsyncStorage.getItem('notifications');
      const sound = await AsyncStorage.getItem('soundEffects');
      const haptic = await AsyncStorage.getItem('hapticFeedback');
      if (nav === 'bottom' || nav === 'sidebar') setNavStyle(nav);
      if (notif !== null) setNotifications(notif === 'true');
      if (sound !== null) setSoundEffects(sound === 'true');
      if (haptic !== null) setHapticFeedback(haptic === 'true');
    } catch (e) {}
  };

  const toggleDarkMode = async (value: boolean) => {
    setTheme(value ? 'dark' : 'light');
  };

  const toggleNavStyle = async (style: 'bottom' | 'sidebar') => {
    setNavStyle(style);
    await AsyncStorage.setItem('krios_nav_style', style);
  };

  const toggleNotifications = async (value: boolean) => {
    setNotifications(value);
    await AsyncStorage.setItem('notifications', value.toString());
    
    // Update notification service
    await notificationService.updatePreferences({ enabled: value });
    
    if (value) {
      // Re-enable: request permission and schedule
      const granted = await notificationService.initialize();
      if (granted) {
        Alert.alert(
          'Notifications Enabled ✓',
          'You\'ll receive smart reminders for your tasks at 8am and 8pm, plus alerts for overdue tasks.',
          [{ text: 'Got it!' }]
        );
      } else {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive task reminders.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              // On real device this would open settings
              Alert.alert('Info', 'Open your device Settings → Krios → Notifications');
            }},
          ]
        );
      }
    } else {
      // Disable: cancel all scheduled notifications
      await notificationService.cancelAll();
      Alert.alert(
        'Notifications Disabled',
        'You won\'t receive any task reminders. You can re-enable them anytime.',
        [{ text: 'OK' }]
      );
    }
  };

  const toggleSoundEffects = async (value: boolean) => {
    setSoundEffects(value);
    await AsyncStorage.setItem('soundEffects', value.toString());
  };

  const toggleHapticFeedback = async (value: boolean) => {
    setHapticFeedback(value);
    await AsyncStorage.setItem('hapticFeedback', value.toString());
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  const accentColor = '#6366f1';

  const sections = [
    {
      title: 'Navigation',
      items: [
        { icon: 'apps-outline', label: 'Bottom Tab Bar', desc: 'Classic tab bar at the bottom', type: 'select', value: navStyle === 'bottom', onPress: () => toggleNavStyle('bottom') },
        { icon: 'reorder-three-outline', label: 'Sidebar Panel', desc: 'Discord-style right side panel', type: 'select', value: navStyle === 'sidebar', onPress: () => toggleNavStyle('sidebar') },
      ],
    },
    {
      title: 'Appearance',
      items: [
        { icon: 'moon', label: 'Dark Mode', desc: 'Use dark theme throughout', type: 'switch', value: isDark, onToggle: toggleDarkMode },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { icon: 'notifications', label: 'Smart Reminders', desc: 'Morning digest (8am), evening preview (8pm), and due task alerts', type: 'switch', value: notifications, onToggle: toggleNotifications },
        { icon: 'volume-high', label: 'Sound Effects', desc: 'Play sounds for actions', type: 'switch', value: soundEffects, onToggle: toggleSoundEffects },
        { icon: 'phone-portrait', label: 'Haptic Feedback', desc: 'Vibration for interactions', type: 'switch', value: hapticFeedback, onToggle: toggleHapticFeedback },
      ],
    },
    {
      title: 'Account',
      items: [
        { icon: 'person', label: 'Edit Profile', desc: 'Change your name and avatar', type: 'navigate', onPress: () => router.push('/(home)/profile') },
        { icon: 'lock-closed', label: 'Privacy', desc: 'Manage your privacy settings', type: 'navigate', onPress: () => Alert.alert('Privacy', 'Coming soon!') },
        { icon: 'shield-checkmark', label: 'Security', desc: 'Password and authentication', type: 'navigate', onPress: () => Alert.alert('Security', 'Coming soon!') },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: 'help-circle', label: 'Help & FAQ', desc: 'Get help and find answers', type: 'navigate', onPress: () => Alert.alert('Help', 'Coming soon!') },
        { icon: 'chatbubble', label: 'Contact Support', desc: 'Reach out to our team', type: 'navigate', onPress: () => Alert.alert('Support', 'Coming soon!') },
        { icon: 'document-text', label: 'Terms of Service', desc: 'Read our terms', type: 'navigate', onPress: () => Alert.alert('Terms', 'Coming soon!') },
      ],
    },
  ];

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={theme.gradient as any}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 52) }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {sections.map((section, si) => (
          <View key={si} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{section.title}</Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {section.items.map((item, ii) => (
                <TouchableOpacity
                  key={ii}
                  style={[styles.settingItem, ii < section.items.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}
                  onPress={item.type !== 'switch' ? (item as any).onPress : undefined}
                  activeOpacity={item.type === 'switch' ? 1 : 0.7}
                >
                  <View style={[styles.settingIcon, { backgroundColor: accentColor + '18' }]}>
                    <Ionicons name={item.icon as any} size={17} color={accentColor} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={[styles.settingLabel, { color: theme.text }]}>{item.label}</Text>
                    <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>{item.desc}</Text>
                  </View>
                  {item.type === 'switch' && (
                    <Switch
                      value={(item as any).value}
                      onValueChange={(item as any).onToggle}
                      trackColor={{ false: theme.border, true: accentColor + '80' }}
                      thumbColor={(item as any).value ? accentColor : '#f4f3f4'}
                    />
                  )}
                  {item.type === 'select' && (
                    <View style={[styles.selectDot, { backgroundColor: (item as any).value ? accentColor : 'transparent', borderColor: (item as any).value ? accentColor : theme.border }]}>
                      {(item as any).value && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  )}
                  {item.type === 'navigate' && (
                    <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.logoutButton, { borderColor: '#ef444440' }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: theme.textSecondary }]}>
          Krios v1.0.0 · Made with love
        </Text>
      </ScrollView>
    </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  placeholder: { width: 36 },
  content: { flex: 1, paddingHorizontal: 20 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 6, marginLeft: 4,
  },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  settingItem: {
    flexDirection: 'row', alignItems: 'center', padding: 13,
  },
  settingIcon: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  settingContent: { flex: 1, marginLeft: 11 },
  settingLabel: { fontSize: 14, fontWeight: '500' },
  settingDesc: { fontSize: 11, marginTop: 1 },
  selectDot: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: 14, borderWidth: 1,
    marginTop: 4, marginBottom: 16, gap: 8,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },
  version: { textAlign: 'center', fontSize: 11, marginBottom: 20 },
});