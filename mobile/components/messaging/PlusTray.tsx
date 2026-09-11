import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

/**
 * PlusTray — attachment panel that opens from the composer's + button.
 *
 * Motion note: this deliberately does NOT animate its own position. The previous
 * version used `entering={FadeInDown}` on the container, which slid the whole
 * panel downward into place *after* layout had already reserved its space — so
 * you saw the panel drop in, then the chat shift up behind it, as two separate
 * movements. Now the panel takes its final space in a single layout pass and only
 * the tiles fade, so there is one shift rather than three.
 *
 * The tray and the keyboard are mutually exclusive — MessageInput enforces that.
 */

interface PlusTrayProps {
  visible: boolean;
  onSelect?: (type: string) => void;
  /** Violet room-chat palette instead of the default indigo. */
  tone?: 'default' | 'room';
}

interface TrayItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  type: string;
  color: string;
}

const TRAY_ITEMS: TrayItem[] = [
  { icon: 'image',         label: 'Gallery',  type: 'gallery',  color: '#8b5cf6' },
  { icon: 'camera',        label: 'Camera',   type: 'camera',   color: '#6366f1' },
  { icon: 'document-text', label: 'File',     type: 'file',     color: '#06b6d4' },
  { icon: 'location',      label: 'Location', type: 'location', color: '#f97316' },
  { icon: 'person',        label: 'Contact',  type: 'contact',  color: '#ec4899' },
];

/**
 * Fixed height so the composer's onLayout reports a stable value and the chat's
 * bottom padding resolves in one step.
 */
export const PLUS_TRAY_HEIGHT = 98;

function PlusTray({ visible, onSelect, tone = 'default' }: PlusTrayProps) {
  const { isDark } = useTheme();

  if (!visible) return null;

  const isRoom = tone === 'room';
  const divider = isRoom
    ? 'rgba(139,92,246,0.22)'
    : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const labelColor = isRoom
    ? 'rgba(199,180,255,0.75)'
    : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)';

  return (
    <View style={[styles.container, { borderTopColor: divider }]}>
      {TRAY_ITEMS.map((item, i) => (
        <Animated.View
          key={item.type}
          // Fade only — no translate, so nothing appears to "drop" into place.
          // A small stagger reads as deliberate without touching layout.
          entering={FadeIn.duration(150).delay(i * 22)}
          style={styles.itemWrap}
        >
          <TouchableOpacity
            onPress={() => onSelect?.(item.type)}
            activeOpacity={0.7}
            style={styles.item}
          >
            <View style={[styles.tile, { backgroundColor: `${item.color}1f` }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
}

export default memo(PlusTray);

const styles = StyleSheet.create({
  container: {
    height: PLUS_TRAY_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 10,
    marginTop: 8,
    // A flush panel with a hairline divider, so the tray reads as an extension of
    // the composer rather than a floating card stacked on top of it.
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemWrap: {
    flex: 1,
  },
  item: {
    alignItems: 'center',
    gap: 7,
  },
  tile: {
    width: 50,
    height: 50,
    // Rounded square rather than a circle — distinguishes attachment sources from
    // the circular action buttons in the composer row itself.
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
});
