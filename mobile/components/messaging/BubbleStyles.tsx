import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

const ACCENT_COLOR = '#6366f1';
const VIOLET_ACCENT = '#8b5cf6';
const NEON_CYAN = '#22d3ee';
const CYBER_GREEN = '#00ff88';

export interface StyleProps { isMine: boolean; children: React.ReactNode; }

const shared = StyleSheet.create({
  row: { paddingHorizontal: 14, marginVertical: 2 },
  rowRight: { alignItems: 'flex-end' as const },
  rowLeft: { alignItems: 'flex-start' as const },
  bubble: { maxWidth: '78%', minWidth: 70, borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, overflow: 'hidden' as const },
  bubbleMine: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 4 },
  bubbleTheirs: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 4 },
});

interface BaseBubbleProps extends StyleProps {
  visualStyle?: ViewStyle;
  gradientColors?: string[];
  gradientStart?: { x: number; y: number };
  gradientEnd?: { x: number; y: number };
  overrideRadius?: number;
}

function BaseBubble({ isMine, children, visualStyle, gradientColors, gradientStart = { x: 0, y: 0 }, gradientEnd = { x: 1, y: 1 }, overrideRadius }: BaseBubbleProps) {
  const tailStyle = isMine ? shared.bubbleMine : shared.bubbleTheirs;
  const radiusOverride: ViewStyle | undefined = overrideRadius !== undefined ? { borderRadius: overrideRadius } : undefined;
  return (
    <View style={[shared.row, isMine ? shared.rowRight : shared.rowLeft]}>
      <View style={[shared.bubble, tailStyle, radiusOverride, visualStyle]}>
        {gradientColors && (
          <LinearGradient colors={gradientColors as any} start={gradientStart} end={gradientEnd} style={[StyleSheet.absoluteFill, tailStyle, radiusOverride]} />
        )}
        {children}
      </View>
    </View>
  );
}

export function GlassBubble({ isMine, children }: StyleProps) {
  const { isDark } = useTheme();
  const backgroundColor = isMine ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.12)') : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)');
  const borderColor = isMine ? 'rgba(99,102,241,0.25)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)');
  return <BaseBubble isMine={isMine} visualStyle={{ backgroundColor, borderColor, borderWidth: 1 }}>{children}</BaseBubble>;
}

export function NeonBubble({ isMine, children }: StyleProps) {
  const { isDark } = useTheme();
  const backgroundColor = isMine ? ACCENT_COLOR : (isDark ? '#1a1a2e' : '#f8fafc');
  const glowColor = isMine ? ACCENT_COLOR : NEON_CYAN;
  return <BaseBubble isMine={isMine} visualStyle={{ backgroundColor, shadowColor: glowColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: isDark ? 0.5 : 0.3, shadowRadius: 12, elevation: 8 }}>{children}</BaseBubble>;
}

export function GradientBubble({ isMine, children }: StyleProps) {
  const { isDark } = useTheme();
  if (isMine) return <BaseBubble isMine={isMine} gradientColors={[ACCENT_COLOR, '#7c3aed', VIOLET_ACCENT]}>{children}</BaseBubble>;
  const backgroundColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  return <BaseBubble isMine={isMine} visualStyle={{ backgroundColor }}>{children}</BaseBubble>;
}

export function LiquidBubble({ isMine, children }: StyleProps) {
  const { isDark } = useTheme();
  if (isMine) return <BaseBubble isMine={isMine} gradientColors={['#6366f1', '#8b5cf6', '#a78bfa', '#818cf8']} gradientStart={{ x: 0, y: 0 }} gradientEnd={{ x: 1, y: 0.5 }}>{children}</BaseBubble>;
  const backgroundColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  return <BaseBubble isMine={isMine} visualStyle={{ backgroundColor }}>{children}</BaseBubble>;
}

export function CyberBubble({ isMine, children }: StyleProps) {
  const { isDark } = useTheme();
  const bg = isMine ? 'rgba(0,255,136,0.1)' : (isDark ? 'rgba(0,255,136,0.04)' : 'rgba(0,0,0,0.03)');
  const bc = isMine ? CYBER_GREEN : (isDark ? 'rgba(0,255,136,0.15)' : 'rgba(0,200,100,0.12)');
  return <BaseBubble isMine={isMine} overrideRadius={4} visualStyle={{ backgroundColor: bg, borderColor: bc, borderWidth: 1 }}>{children}</BaseBubble>;
}

export function OutlineBubble({ isMine, children }: StyleProps) {
  const { isDark } = useTheme();
  const bc = isMine ? ACCENT_COLOR : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)');
  return <BaseBubble isMine={isMine} visualStyle={{ backgroundColor: 'transparent', borderColor: bc, borderWidth: 1.5 }}>{children}</BaseBubble>;
}

export function ShadowBubble({ isMine, children }: StyleProps) {
  const { isDark } = useTheme();
  const bg = isMine ? ACCENT_COLOR : (isDark ? 'rgba(255,255,255,0.08)' : '#ffffff');
  return <BaseBubble isMine={isMine} visualStyle={{ backgroundColor: bg, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0.4 : 0.15, shadowRadius: 16, elevation: 12 }}>{children}</BaseBubble>;
}

// overrideRadius=2: blocky corners are intentional for the pixel aesthetic
export function PixelBubble({ isMine, children }: StyleProps) {
  const { isDark } = useTheme();
  const bg = isMine ? ACCENT_COLOR : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)');
  const bc = isMine ? '#4f46e5' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)');
  return <BaseBubble isMine={isMine} overrideRadius={2} visualStyle={{ backgroundColor: bg, borderColor: bc, borderWidth: 2 }}>{children}</BaseBubble>;
}

export function HologramBubble({ isMine, children }: StyleProps) {
  const { isDark } = useTheme();
  if (isMine) return <BaseBubble isMine={isMine} gradientColors={['#6366f1', '#8b5cf6', '#a78bfa', '#c084fc', '#818cf8']}>{children}</BaseBubble>;
  const bg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  return <BaseBubble isMine={isMine} visualStyle={{ backgroundColor: bg, borderColor: 'rgba(168,85,247,0.2)', borderWidth: 1 }}>{children}</BaseBubble>;
}

export function CosmicBubble({ isMine, children }: StyleProps) {
  const { isDark } = useTheme();
  if (isMine) return <BaseBubble isMine={isMine} gradientColors={['#1e1b4b', '#4c1d95', '#7c3aed']}>{children}</BaseBubble>;
  const bg = isDark ? 'rgba(100,80,200,0.1)' : 'rgba(0,0,0,0.04)';
  return <BaseBubble isMine={isMine} visualStyle={{ backgroundColor: bg }}>{children}</BaseBubble>;
}
