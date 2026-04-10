import React, { type ComponentProps } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface FabAction {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  color: string;
}

interface FloatingActionButtonsProps {
  actions: FabAction[];
}

export function FloatingActionButtons({ actions }: FloatingActionButtonsProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {actions.map((a, i) => (
        <TouchableOpacity
          key={`${a.label}-${i}`}
          style={[styles.btn, { backgroundColor: a.color }]}
          onPress={a.onPress}
          activeOpacity={0.85}
        >
          <Ionicons name={a.icon} size={22} color="#fff" />
          <Text style={styles.lbl}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: 'rgba(8,8,16,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  btn: {
    flex: 1,
    marginHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  lbl: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

export default FloatingActionButtons;
