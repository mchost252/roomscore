import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../constants/theme';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { colors, spacing, fontSizes, borderRadius, gradients, isDark } = useTheme();

  return (
    <LinearGradient
      colors={gradients.background.colors as any}
      locations={gradients.background.locations as any}
      style={styles.container}
    >
      <ScrollView>
        <View style={[styles.content, { padding: spacing.screen.paddingHorizontal }]}>
          <Text style={[styles.greeting, { 
            fontSize: fontSizes.h2, 
            color: colors.text.primary,
            marginBottom: spacing.sm 
          }]}>
            Hello, {user?.username}! 👋
          </Text>
          <Text style={[styles.subtitle, { 
            fontSize: fontSizes.body, 
            color: colors.text.secondary,
            marginBottom: spacing.xl 
          }]}>
            Welcome to Krios
          </Text>
          
          <View style={[styles.statsContainer, { gap: spacing.md, marginBottom: spacing.xl }]}>
            <View style={[styles.statCard, { 
              backgroundColor: isDark ? colors.background.tertiary : colors.background.secondary,
              padding: spacing.lg,
              borderRadius: borderRadius.lg,
              borderColor: colors.border.secondary,
            }]}>
              <Text style={[styles.statValue, { 
                fontSize: fontSizes.h2, 
                color: colors.constellation.DEFAULT,
                marginBottom: spacing.xs 
              }]}>
                {user?.streak || 0}
              </Text>
              <Text style={[styles.statLabel, { 
                fontSize: fontSizes.sm, 
                color: colors.text.secondary 
              }]}>
                Current Streak
              </Text>
            </View>
            
            <View style={[styles.statCard, { 
              backgroundColor: isDark ? colors.background.tertiary : colors.background.secondary,
              padding: spacing.lg,
              borderRadius: borderRadius.lg,
              borderColor: colors.border.secondary,
            }]}>
              <Text style={[styles.statValue, { 
                fontSize: fontSizes.h2, 
                color: colors.cosmic.DEFAULT,
                marginBottom: spacing.xs 
              }]}>
                {user?.totalTasksCompleted || 0}
              </Text>
              <Text style={[styles.statLabel, { 
                fontSize: fontSizes.sm, 
                color: colors.text.secondary 
              }]}>
                Tasks Completed
              </Text>
            </View>
          </View>

          <View style={[styles.infoBox, {
            backgroundColor: isDark ? colors.background.tertiary : colors.background.secondary,
            padding: spacing.lg,
            borderRadius: borderRadius.lg,
            borderColor: colors.border.secondary,
          }]}>
            <Text style={[styles.infoText, { 
              fontSize: fontSizes.sm, 
              color: colors.text.secondary 
            }]}>
              🌟 Your orbit dashboard - Track your habits and celebrate wins with your accountability circle!
            </Text>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 60,
  },
  greeting: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: {
    fontWeight: '800',
  },
  statLabel: {
    fontWeight: '500',
  },
  infoBox: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  infoText: {
    lineHeight: 20,
  },
});
