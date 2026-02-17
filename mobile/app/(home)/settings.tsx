import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
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
  primary: '#6366f1',
  gradient: ['#1e1b4b', '#312e81', '#0a0a12', '#0a0a12'],
};

const LightTheme = {
  background: '#fafafa',
  surface: 'rgba(0,0,0,0.04)',
  text: '#0f172a',
  textSecondary: 'rgba(15, 23, 42, 0.7)',
  textTertiary: 'rgba(15, 23, 42, 0.45)',
  border: 'rgba(0,0,0,0.08)',
  primary: '#6366f1',
  gradient: ['#ede9fe', '#e0e7ff', '#fafafa', '#fafafa'],
};

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [navStyle, setNavStyle] = useState<'circular' | 'drawer'>('circular');
  const [notifications, setNotifications] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  
  const theme = isDarkMode ? DarkTheme : LightTheme;

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const darkMode = await AsyncStorage.getItem('isDarkMode');
      const nav = await AsyncStorage.getItem('navStyle');
      const notif = await AsyncStorage.getItem('notifications');
      const sound = await AsyncStorage.getItem('soundEffects');
      const haptic = await AsyncStorage.getItem('hapticFeedback');
      
      if (darkMode !== null) setIsDarkMode(darkMode === 'true');
      if (nav === 'circular' || nav === 'drawer') setNavStyle(nav);
      if (notif !== null) setNotifications(notif === 'true');
      if (sound !== null) setSoundEffects(sound === 'true');
      if (haptic !== null) setHapticFeedback(haptic === 'true');
    } catch (e) {}
  };

  const toggleDarkMode = async (value: boolean) => {
    setIsDarkMode(value);
    await AsyncStorage.setItem('isDarkMode', value.toString());
  };

  const toggleNavStyle = async (style: 'circular' | 'drawer') => {
    setNavStyle(style);
    await AsyncStorage.setItem('navStyle', style);
  };

  const toggleNotifications = async (value: boolean) => {
    setNotifications(value);
    await AsyncStorage.setItem('notifications', value.toString());
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

  const settingsSections = [
    {
      title: 'Navigation',
      items: [
        {
          icon: 'radio-button-on',
          label: 'Circular Navigation',
          description: 'Icons pop up around the K button',
          type: 'select',
          value: navStyle === 'circular',
          onPress: () => toggleNavStyle('circular'),
        },
        {
          icon: 'menu',
          label: 'Drawer Navigation',
          description: 'Slide up menu from bottom',
          type: 'select',
          value: navStyle === 'drawer',
          onPress: () => toggleNavStyle('drawer'),
        },
      ],
    },
    {
      title: 'Appearance',
      items: [
        {
          icon: 'moon',
          label: 'Dark Mode',
          description: 'Use dark theme throughout the app',
          type: 'switch',
          value: isDarkMode,
          onToggle: toggleDarkMode,
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          icon: 'notifications',
          label: 'Push Notifications',
          description: 'Receive task reminders and updates',
          type: 'switch',
          value: notifications,
          onToggle: toggleNotifications,
        },
        {
          icon: 'volume-high',
          label: 'Sound Effects',
          description: 'Play sounds for actions',
          type: 'switch',
          value: soundEffects,
          onToggle: toggleSoundEffects,
        },
        {
          icon: 'phone-portrait',
          label: 'Haptic Feedback',
          description: 'Vibration for interactions',
          type: 'switch',
          value: hapticFeedback,
          onToggle: toggleHapticFeedback,
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          icon: 'person',
          label: 'Edit Profile',
          description: 'Change your name and avatar',
          type: 'navigate',
          onPress: () => router.push('/(home)/profile'),
        },
        {
          icon: 'lock-closed',
          label: 'Privacy',
          description: 'Manage your privacy settings',
          type: 'navigate',
          onPress: () => {},
        },
        {
          icon: 'shield-checkmark',
          label: 'Security',
          description: 'Password and authentication',
          type: 'navigate',
          onPress: () => {},
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help-circle',
          label: 'Help & FAQ',
          description: 'Get help and find answers',
          type: 'navigate',
          onPress: () => {},
        },
        {
          icon: 'chatbubble',
          label: 'Contact Support',
          description: 'Reach out to our team',
          type: 'navigate',
          onPress: () => {},
        },
        {
          icon: 'document-text',
          label: 'Terms of Service',
          description: 'Read our terms',
          type: 'navigate',
          onPress: () => {},
        },
        {
          icon: 'shield',
          label: 'Privacy Policy',
          description: 'Read our privacy policy',
          type: 'navigate',
          onPress: () => {},
        },
      ],
    },
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
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {settingsSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>
              {section.title}
            </Text>
            <View style={[styles.sectionContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity 
                  key={itemIndex}
                  style={[
                    styles.settingItem,
                    itemIndex < section.items.length - 1 && { borderBottomColor: theme.border }
                  ]}
                  onPress={item.type === 'switch' ? undefined : (item as any).onPress}
                  activeOpacity={item.type === 'switch' ? 1 : 0.7}
                >
                  <View style={[styles.settingIcon, { backgroundColor: theme.primary + '20' }]}>
                    <Ionicons name={item.icon as any} size={18} color={theme.primary} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={[styles.settingLabel, { color: theme.text }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.settingDescription, { color: theme.textTertiary }]}>
                      {item.description}
                    </Text>
                  </View>
                  {item.type === 'switch' && (
                    <Switch
                      value={(item as any).value}
                      onValueChange={(item as any).onToggle}
                      trackColor={{ false: theme.border, true: theme.primary + '80' }}
                      thumbColor={(item as any).value ? theme.primary : '#f4f3f4'}
                    />
                  )}
                  {item.type === 'select' && (
                    <View style={[
                      styles.selectIndicator,
                      { backgroundColor: (item as any).value ? theme.primary + '30' : 'transparent' }
                    ]}>
                      <Ionicons 
                        name={(item as any).value ? 'checkmark' : 'add'} 
                        size={18} 
                        color={(item as any).value ? theme.primary : theme.textTertiary} 
                      />
                    </View>
                  )}
                  {item.type === 'navigate' && (
                    <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity 
          style={[styles.logoutButton, { borderColor: '#ef4444' }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={[styles.logoutText, { color: '#ef4444' }]}>Logout</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: theme.textTertiary }]}>
          Krios v1.0.0 • Made with ❤️
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
    paddingBottom: 20,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  placeholder: {
    width: 36,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionContent: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
    marginLeft: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  selectIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
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
