import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../constants/theme';
import { GradientText, GlowCard } from '../../components';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { colors, spacing, borderRadius, fontSizes, gradients, isDark } = useTheme();

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

  return (
    <LinearGradient
      colors={gradients.background.colors as any}
      locations={gradients.background.locations as any}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.screen.paddingHorizontal }}>
        <View style={[styles.header, { marginTop: spacing.xxxl, marginBottom: spacing.xl }]}>
          <LinearGradient
            colors={gradients.primary.colors as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.avatarPlaceholder, { 
              marginBottom: spacing.md,
              borderRadius: 50,
            }]}
          >
            <Text style={[styles.avatarText, { fontSize: fontSizes.h1 }]}>
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </LinearGradient>
          
          <GradientText gradient="primary" style={[styles.username, { fontSize: fontSizes.h2, marginBottom: spacing.xs }]}>
            {user?.username}
          </GradientText>
          <Text style={[styles.email, { fontSize: fontSizes.sm, color: colors.text.secondary }]}>
            {user?.email}
          </Text>
        </View>

        <GlowCard style={[styles.section, {
          backgroundColor: isDark ? colors.background.tertiary : colors.background.secondary,
          padding: spacing.lg,
          borderRadius: borderRadius.lg,
          marginBottom: spacing.lg,
        }]}>
          <Text style={[styles.sectionTitle, { 
            fontSize: fontSizes.lg, 
            color: colors.text.primary,
            marginBottom: spacing.md 
          }]}>
            Account Info
          </Text>
          
          <View style={[styles.infoRow, { 
            paddingVertical: spacing.sm,
            borderBottomColor: colors.border.secondary 
          }]}>
            <Text style={[styles.infoLabel, { fontSize: fontSizes.sm, color: colors.text.secondary }]}>
              Timezone
            </Text>
            <Text style={[styles.infoValue, { fontSize: fontSizes.sm, color: colors.text.primary }]}>
              {user?.timezone || 'UTC'}
            </Text>
          </View>
          
          <View style={[styles.infoRow, { 
            paddingVertical: spacing.sm,
            borderBottomColor: colors.border.secondary,
            borderBottomWidth: 0,
          }]}>
            <Text style={[styles.infoLabel, { fontSize: fontSizes.sm, color: colors.text.secondary }]}>
              Member Since
            </Text>
            <Text style={[styles.infoValue, { fontSize: fontSizes.sm, color: colors.text.primary }]}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
        </GlowCard>

        <TouchableOpacity onPress={handleLogout} activeOpacity={0.8} style={{ marginTop: spacing.xl }}>
          <LinearGradient
            colors={['#EF4444', '#DC2626'] as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.logoutButton, {
              borderRadius: borderRadius.button,
              padding: spacing.md,
            }]}
          >
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
  avatarPlaceholder: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarText: {
    fontWeight: '800',
    color: '#ffffff',
  },
  username: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  email: {
    fontWeight: '500',
  },
  section: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontWeight: '500',
  },
  infoValue: {
    fontWeight: '600',
  },
  logoutButton: {
    alignItems: 'center',
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
