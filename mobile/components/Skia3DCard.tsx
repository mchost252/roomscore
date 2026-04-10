import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

// Conditionally import Skia only on native
let SkiaCanvas: any = null;
let SkiaRoundedRect: any = null;
let SkiaLinearGradient: any = null;
let SkiaVec: any = null;
let SkiaBlurMask: any = null;

if (Platform.OS !== 'web') {
  try {
    const Skia = require('@shopify/react-native-skia');
    SkiaCanvas = Skia.Canvas;
    SkiaRoundedRect = Skia.RoundedRect;
    SkiaLinearGradient = Skia.LinearGradient;
    SkiaVec = Skia.vec;
    SkiaBlurMask = Skia.BlurMask;
  } catch (e) {
    // Skia not available
  }
}

interface Skia3DCardProps {
  width: number;
  height: number;
  borderRadius?: number;
  elevation?: 'none' | 'low' | 'medium' | 'high';
  children?: React.ReactNode;
  style?: ViewStyle;
}

export default function Skia3DCard({
  width,
  height,
  borderRadius = 18,
  elevation = 'medium',
  children,
  style,
}: Skia3DCardProps) {
  const { isDark } = useTheme();

  const elevationConfig = {
    low:    { depth: 2, blur: 4,  opacity: 0.08 },
    medium: { depth: 4, blur: 8,  opacity: 0.12 },
    high:   { depth: 6, blur: 12, opacity: 0.18 },
  };
  if (elevation === 'none') {
    return (
      <View style={[{ width, height, borderRadius, overflow: 'hidden' }, style]}>
        {children}
      </View>
    );
  }
  const config = elevationConfig[elevation ?? 'medium'];

  const topHighlight = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)';
  const bottomShadow = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.12)';

  // Web fallback: simple gradient card
  if (Platform.OS === 'web' || !SkiaCanvas) {
    return (
      <View style={[{ width, overflow: 'hidden', borderRadius }, style]}>
        <LinearGradient
          colors={[topHighlight, 'transparent', bottomShadow]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    );
  }

  // Native: full Skia 3D card
  return (
    <View style={[{ width, height }, style]}>
      <SkiaCanvas style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
        <SkiaRoundedRect
          x={config.depth}
          y={config.depth}
          width={width}
          height={height}
          r={borderRadius}
          color={bottomShadow}
        >
          <SkiaBlurMask blur={config.blur} style="normal" />
        </SkiaRoundedRect>
        <SkiaRoundedRect x={0} y={0} width={width} height={height} r={borderRadius}>
          <SkiaLinearGradient
            start={SkiaVec(0, 0)}
            end={SkiaVec(0, height)}
            colors={[topHighlight, 'rgba(0,0,0,0.02)', bottomShadow]}
            positions={[0, 0.5, 1]}
          />
        </SkiaRoundedRect>
        <SkiaRoundedRect x={0} y={0} width={width} height={height * 0.3} r={borderRadius}>
          <SkiaLinearGradient
            start={SkiaVec(0, 0)}
            end={SkiaVec(0, height * 0.3)}
            colors={[topHighlight, 'transparent']}
          />
        </SkiaRoundedRect>
      </SkiaCanvas>
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>
        {children}
      </View>
    </View>
  );
}
