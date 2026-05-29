/**
 * TaskSection — Clean Collapsible Section (v4)
 *
 * Matches reference mockup:
 *   - Clean section title (larger, bolder) + count badge
 *   - "Sort" button with icon on the right (next to chevron)
 *   - LayoutAnimation for smooth expand/collapse
 *
 * Each section gets a unique accent color:
 *   Active   → indigo (#6366f1)
 *   Pending  → green  (#22c55e)
 *   Spectating → slate (#64748b)
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface TaskSectionProps {
  title: string;
  count: number;
  defaultOpen?: boolean;
  /** Accent color for this section */
  accentColor?: string;
  /** Optional icon for the section header */
  icon?: string;
  children: React.ReactNode;
  onToggle?: (isOpen: boolean) => void;
  onSort?: () => void;
}

const TaskSection: React.FC<TaskSectionProps> = ({
  title,
  count,
  defaultOpen = false,
  accentColor,
  icon,
  children,
  onToggle,
  onSort,
}) => {
  const { colors, isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const accent = accentColor || colors.primary;

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !isOpen;
    setIsOpen(next);
    if (onToggle) onToggle(next);
  }, [isOpen, onToggle]);

  const textPrimary = isDark ? '#ffffff' : '#1a1a2e';
  const textMuted = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';

  return (
    <View style={styles.container}>
      {/* Section Header — clean, minimal */}
      <TouchableOpacity onPress={toggle} activeOpacity={0.7} style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: textPrimary }]}>{title}</Text>
          {count > 0 && (
            <View style={[styles.countBadge, { backgroundColor: accent + '15' }]}>
              <Text style={[styles.countText, { color: accent }]}>{count}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {/* Sort button — visible when section is open and has items */}
          {isOpen && count > 0 && (
            <TouchableOpacity
              onPress={onSort}
              activeOpacity={0.6}
              style={styles.sortBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.sortText, { color: textMuted }]}>Sort</Text>
              <Ionicons name="options-outline" size={15} color={textMuted} />
            </TouchableOpacity>
          )}
          <Ionicons
            name={isOpen ? 'chevron-down' : 'chevron-forward'}
            size={18}
            color={textMuted}
          />
        </View>
      </TouchableOpacity>

      {/* Section Body */}
      {isOpen && <View style={styles.body}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: {
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    marginTop: 8,
  },
});

export default React.memo(TaskSection);
