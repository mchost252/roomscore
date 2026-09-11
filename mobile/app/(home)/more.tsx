/**
 * More — overflow menu for the home tab bar.
 *
 * Replaces the old Profile tab. A personal profile is a destination you visit
 * occasionally rather than a mode you switch between, so it now lives one tap
 * inside here (top card) instead of occupying a permanent tab slot.
 *
 * Presented as a modal route (registered in _layout with presentation: 'modal'),
 * which gives Android hardware-back handling and deep-linking for free.
 *
 * Only rows backed by real functionality are listed. The sectioned card layout
 * exists so future features (Saved, Media & Files, global Search, Privacy) slot in
 * without a redesign.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ConfirmationModal from '../../components/ConfirmationModal';

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
  onPress: () => void;
};

type Section = { title: string; rows: Row[] };

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { colors, isDark } = useTheme();

  const [logoutVisible, setLogoutVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);

  const theme = {
    background: colors.background.primary,
    surface: colors.surface,
    border: colors.border.primary,
    text: colors.text,
    textSecondary: colors.textSecondary,
  };
  const accent = '#6366f1';

  const close = useCallback(() => router.back(), [router]);

  const confirmLogout = useCallback(async () => {
    setLogoutVisible(false);
    await logout();
    router.replace('/(auth)/login');
  }, [logout, router]);

  const appVersion =
    (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';

  const sections: Section[] = [
    {
      title: 'App',
      rows: [
        {
          icon: 'color-palette-outline',
          label: 'Appearance',
          desc: 'Theme and chat bubble style',
          onPress: () => router.push('/(home)/appearance'),
        },
        {
          icon: 'notifications-outline',
          label: 'Notifications',
          desc: 'Manage your reminders',
          onPress: () => router.push('/(home)/settings'),
        },
        {
          icon: 'options-outline',
          label: 'Settings',
          desc: 'Navigation and app preferences',
          onPress: () => router.push('/(home)/settings'),
        },
      ],
    },
    {
      title: 'Support',
      rows: [
        {
          icon: 'information-circle-outline',
          label: 'About Krios',
          desc: `Version ${appVersion}`,
          onPress: () => setAboutVisible(true),
        },
      ],
    },
  ];

  const initial = (user?.username || 'U').charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <Text style={[styles.title, { color: theme.text }]}>More</Text>
        <TouchableOpacity
          onPress={close}
          style={[styles.closeButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Profile — pinned at the top so it stays one tap away */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => router.push('/(home)/profile')}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={StyleSheet.absoluteFill} />
            ) : (
              <LinearGradient
                colors={['#6366f1', '#8b5cf6', '#38bdf8'] as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, styles.avatarFill]}
              >
                <Text style={styles.avatarInitial}>{initial}</Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.profileText}>
            <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>
              {user?.username || 'Your profile'}
            </Text>
            <Text style={[styles.profileSub, { color: theme.textSecondary }]} numberOfLines={1}>
              View profile
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </TouchableOpacity>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              {section.title}
            </Text>
            <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {section.rows.map((row, ri) => (
                <TouchableOpacity
                  key={row.label}
                  style={[
                    styles.row,
                    ri < section.rows.length - 1 && {
                      borderBottomColor: theme.border,
                      borderBottomWidth: 1,
                    },
                  ]}
                  onPress={row.onPress}
                  activeOpacity={0.7}
                >
                  <View style={[styles.rowIcon, { backgroundColor: accent + '18' }]}>
                    <Ionicons name={row.icon} size={17} color={accent} />
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowLabel, { color: theme.text }]}>{row.label}</Text>
                    <Text style={[styles.rowDesc, { color: theme.textSecondary }]}>{row.desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.logoutButton, { borderColor: '#ef444440' }]}
          onPress={() => setLogoutVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={19} color="#ef4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmationModal
        visible={aboutVisible}
        title="About Krios"
        message={`Krios — social habit tracking.\n\nVersion ${appVersion}`}
        confirmText="OK"
        cancelText="Close"
        isDark={isDark}
        onCancel={() => setAboutVisible(false)}
        onConfirm={() => setAboutVisible(false)}
      />

      <ConfirmationModal
        visible={logoutVisible}
        title="Log Out"
        message="Are you sure you want to log out?"
        confirmText="Log Out"
        cancelText="Cancel"
        destructive
        isDark={isDark}
        onCancel={() => setLogoutVisible(false)}
        onConfirm={confirmLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
  },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  closeButton: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  content: { flex: 1, paddingHorizontal: 20 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 22,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, overflow: 'hidden',
  },
  avatarFill: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 19, fontWeight: '700' },
  profileText: { flex: 1, marginLeft: 13 },
  profileName: { fontSize: 16, fontWeight: '600' },
  profileSub: { fontSize: 12, marginTop: 2 },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 6, marginLeft: 4,
  },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 13 },
  rowIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  rowContent: { flex: 1, marginLeft: 11 },
  rowLabel: { fontSize: 14, fontWeight: '500' },
  rowDesc: { fontSize: 11, marginTop: 1 },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 14, borderWidth: 1,
    marginTop: 4, marginBottom: 8, gap: 8,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },
});
