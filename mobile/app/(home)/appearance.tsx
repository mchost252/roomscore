/**
 * Appearance — theme and chat bubble style.
 *
 * Consolidates two settings that were previously scattered or unreachable:
 *   • Theme lived inside settings.tsx as a bare dark-mode switch, with no way to
 *     pick "follow system" even though ThemeContext has supported it all along.
 *   • Chat bubble style had a fully working store (src/store/useBubbleStore.ts)
 *     wired into ChatBubble, but NO selection UI anywhere — users could not
 *     change it at all.
 *
 * Previews render the bubble components directly rather than going through
 * ChatBubble, because ChatBubble reads the selected style from the store and so
 * can only ever render the active one.
 */
import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useBubbleStore, BubbleStyle } from '../../src/store/useBubbleStore';
import MinimalBubble from '../../components/messaging/MinimalBubble';
import {
  GlassBubble, NeonBubble, GradientBubble, LiquidBubble, CyberBubble,
  OutlineBubble, ShadowBubble, PixelBubble, HologramBubble, CosmicBubble,
} from '../../components/messaging/BubbleStyles';

type ThemeOption = { key: 'light' | 'dark' | 'system'; label: string; icon: keyof typeof Ionicons.glyphMap };

const THEME_OPTIONS: ThemeOption[] = [
  { key: 'light',  label: 'Light',         icon: 'sunny-outline' },
  { key: 'dark',   label: 'Dark',          icon: 'moon-outline' },
  { key: 'system', label: 'Follow system', icon: 'phone-portrait-outline' },
];

/**
 * Selectable bubble styles. 'flame' is deliberately excluded — ChatBubble falls
 * back to MinimalBubble for it, so offering it would be a no-op choice.
 */
const BUBBLE_OPTIONS: { key: BubbleStyle; label: string }[] = [
  { key: 'minimal',  label: 'Minimal' },
  { key: 'glass',    label: 'Glass' },
  { key: 'neon',     label: 'Neon' },
  { key: 'gradient', label: 'Gradient' },
  { key: 'liquid',   label: 'Liquid' },
  { key: 'cyber',    label: 'Cyber' },
  { key: 'outline',  label: 'Outline' },
  { key: 'shadow',   label: 'Shadow' },
  { key: 'pixel',    label: 'Pixel' },
  { key: 'hologram', label: 'Hologram' },
  { key: 'cosmic',   label: 'Cosmic' },
];

function BubblePreview({ style }: { style: BubbleStyle }) {
  const inner = <Text style={styles.previewText}>Hey there</Text>;

  switch (style) {
    case 'glass':    return <GlassBubble isMine>{inner}</GlassBubble>;
    case 'neon':     return <NeonBubble isMine>{inner}</NeonBubble>;
    case 'gradient': return <GradientBubble isMine>{inner}</GradientBubble>;
    case 'liquid':   return <LiquidBubble isMine>{inner}</LiquidBubble>;
    case 'cyber':    return <CyberBubble isMine>{inner}</CyberBubble>;
    case 'outline':  return <OutlineBubble isMine>{inner}</OutlineBubble>;
    case 'shadow':   return <ShadowBubble isMine>{inner}</ShadowBubble>;
    case 'pixel':    return <PixelBubble isMine>{inner}</PixelBubble>;
    case 'hologram': return <HologramBubble isMine>{inner}</HologramBubble>;
    case 'cosmic':   return <CosmicBubble isMine>{inner}</CosmicBubble>;
    default:         return <MinimalBubble isMine>{inner}</MinimalBubble>;
  }
}

export default function AppearanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, gradients, isDark, theme: activeTheme, setTheme } = useTheme();

  const selectedBubble = useBubbleStore((s) => s.selectedStyle);
  const setBubbleStyle = useBubbleStore((s) => s.setStyle);

  const t = {
    background: colors.background.primary,
    surface: colors.surface,
    border: colors.border.primary,
    text: colors.text,
    textSecondary: colors.textSecondary,
  };
  const accent = '#6366f1';

  const goBack = useCallback(() => router.back(), [router]);

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <LinearGradient
        colors={gradients.background.colors as any}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 52) }]}>
        <TouchableOpacity
          onPress={goBack}
          style={[styles.backButton, { backgroundColor: t.surface, borderColor: t.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: t.text }]}>Appearance</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* ── Theme ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>Theme</Text>
          <View style={[styles.sectionCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            {THEME_OPTIONS.map((option, i) => {
              const selected = activeTheme === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.row,
                    i < THEME_OPTIONS.length - 1 && { borderBottomColor: t.border, borderBottomWidth: 1 },
                  ]}
                  onPress={() => setTheme(option.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.rowIcon, { backgroundColor: accent + '18' }]}>
                    <Ionicons name={option.icon} size={17} color={accent} />
                  </View>
                  <Text style={[styles.rowLabel, { color: t.text }]}>{option.label}</Text>
                  <View
                    style={[
                      styles.selectDot,
                      {
                        backgroundColor: selected ? accent : 'transparent',
                        borderColor: selected ? accent : t.border,
                      },
                    ]}
                  >
                    {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Chat bubble style ────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>Chat Bubble Style</Text>
          <Text style={[styles.sectionHint, { color: t.textSecondary }]}>
            Applies to all your conversations
          </Text>
          <View style={styles.bubbleGrid}>
            {BUBBLE_OPTIONS.map((option) => {
              const selected = selectedBubble === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.bubbleCard,
                    {
                      backgroundColor: t.surface,
                      borderColor: selected ? accent : t.border,
                      borderWidth: selected ? 2 : 1,
                    },
                  ]}
                  onPress={() => setBubbleStyle(option.key)}
                  activeOpacity={0.8}
                >
                  <View style={styles.bubblePreviewWrap} pointerEvents="none">
                    <BubblePreview style={option.key} />
                  </View>
                  <View style={styles.bubbleCardFooter}>
                    <Text
                      style={[styles.bubbleLabel, { color: selected ? accent : t.textSecondary }]}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                    {selected && <Ionicons name="checkmark-circle" size={15} color={accent} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
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

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 6, marginLeft: 4,
  },
  sectionHint: { fontSize: 11, marginBottom: 10, marginLeft: 4 },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },

  row: { flexDirection: 'row', alignItems: 'center', padding: 13 },
  rowIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontSize: 14, fontWeight: '500', flex: 1, marginLeft: 11 },
  selectDot: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },

  bubbleGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  bubbleCard: {
    width: '48%', borderRadius: 14, padding: 10, minHeight: 104,
    justifyContent: 'space-between',
  },
  bubblePreviewWrap: {
    minHeight: 52, justifyContent: 'center', alignItems: 'flex-start',
    transform: [{ scale: 0.9 }],
  },
  bubbleCardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8, gap: 4,
  },
  bubbleLabel: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  previewText: { color: '#fff', fontSize: 12, fontWeight: '500' },
});
