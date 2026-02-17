import React from 'react';
import { Text, TextProps } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../constants/theme';

interface GradientTextProps extends TextProps {
  children: React.ReactNode;
  gradient?: 'primary' | 'constellation' | 'cosmic' | 'primaryReverse';
  colors?: string[];
  style?: any;
}

/**
 * Gradient Text Component - Gemini-style smooth gradient text
 * Uses MaskedView to achieve true gradient text effect
 */
export const GradientText: React.FC<GradientTextProps> = ({
  children,
  gradient = 'primary',
  colors,
  style,
  ...textProps
}) => {
  const { gradients } = useTheme();
  
  // Get gradient colors from theme or use custom
  const gradientColors = colors || gradients[gradient]?.colors || gradients.primary.colors;
  const locations = gradients[gradient]?.locations || [0, 0.5, 1];

  return (
    <MaskedView
      maskElement={
        <Text {...textProps} style={[style, { backgroundColor: 'transparent' }]}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={gradientColors as any}
        locations={locations as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text {...textProps} style={[style, { opacity: 0 }]}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
};

export default GradientText;
