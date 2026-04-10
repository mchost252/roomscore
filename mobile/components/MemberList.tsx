import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { RoomMember } from '../types/room';

interface MemberListProps {
  members: RoomMember[];
  isOwner?: boolean;
  onMemberAction?: (member: RoomMember, action: 'message' | 'more') => void;
}

export function MemberList({ members, isOwner, onMemberAction }: MemberListProps) {
  const { colors } = useTheme();

  if (!members.length) {
    return (
      <Text style={[styles.empty, { color: colors.textSecondary }]}>No members yet.</Text>
    );
  }

  return (
    <View style={styles.list}>
      {members.map((m) => (
        <View
          key={m.id}
          style={[styles.row, { borderBottomColor: colors.borderColor }]}
        >
          <View style={styles.left}>
            {m.avatar ? (
              <Image source={{ uri: m.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.placeholder, { backgroundColor: colors.surface }]}>
                <Text style={[styles.initial, { color: colors.text }]}>
                  {m.username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={[styles.name, { color: colors.text }]}>{m.username}</Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {m.isOnline ? 'Online' : 'Offline'} · {m.aura}
              </Text>
            </View>
          </View>
          {isOwner && onMemberAction && (
            <TouchableOpacity onPress={() => onMemberAction(m, 'more')}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { overflow: 'hidden' },
  empty: { paddingVertical: 12, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  placeholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontSize: 18, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 2 },
});

export default MemberList;
