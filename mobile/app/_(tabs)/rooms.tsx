import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../constants/theme';
import { GradientText } from '../../components';

export default function RoomsScreen() {
  const { colors, spacing, fontSizes, gradients } = useTheme();
  
  return (
    <LinearGradient
      colors={gradients.background.colors as any}
      locations={gradients.background.locations as any}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={{ 
        padding: spacing.screen.paddingHorizontal,
        paddingTop: spacing.xxxl,
      }}>
        <GradientText 
          gradient="primary" 
          style={[styles.title, { 
            fontSize: fontSizes.h1, 
            marginBottom: spacing.sm 
          }]}
        >
          Rooms
        </GradientText>
        <Text style={[styles.subtitle, { 
          fontSize: fontSizes.body, 
          color: colors.text.secondary 
        }]}>
          Your accountability circles will appear here
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontWeight: '500',
  },
});
