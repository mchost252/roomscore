import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';

type NotificationItem = { id: string; type?: string; title?: string; message?: string; body?: string; data?: Record<string, unknown>; createdAt?: string; read?: boolean };

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [items, setItems] = useState<NotificationItem[]>([]);

  const load = useCallback(async () => {
    const response = await api.get('/notifications?limit=50');
    setItems(response.data?.notifications || []);
  }, []);

  const openNotification = useCallback(async (item: NotificationItem) => {
    await api.put(`/notifications/${item.id}/read`).catch(error => console.warn('[NotificationsScreen] Read update failed:', error));
    const data = item.data || {};
    if ((item.type === 'task_reminder' || item.type === 'task_completed' || item.type === 'task_approved') && typeof data.taskId === 'string') {
      router.push({ pathname: '/(home)/task-thread', params: { taskId: data.taskId } });
    } else if (item.type === 'room_invite' && typeof data.roomId === 'string') {
      router.push({ pathname: '/(home)/room-detail', params: { roomId: data.roomId, openRequests: '1' } });
    } else if (item.type?.startsWith('room_') && typeof data.roomId === 'string') {
      router.push({ pathname: '/(home)/room-detail', params: { roomId: data.roomId } });
    } else if (item.type === 'direct_message' && typeof data.conversationId === 'string') {
      router.push({ pathname: '/(home)/chat', params: { conversationId: data.conversationId } });
    }
  }, [router]);

  useEffect(() => { load().catch(error => console.warn('[NotificationsScreen] Load failed:', error)); }, [load]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background.primary }]}>
      <View style={[styles.header, { borderBottomColor: colors.border.primary }]}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        <View style={{ width: 22 }} />
      </View>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={items.length === 0 ? styles.empty : styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openNotification(item)} style={[styles.row, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: colors.border.primary }]}>
            <View style={[styles.icon, { backgroundColor: 'rgba(99,102,241,0.12)' }]}><Ionicons name="notifications-outline" size={18} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title || 'Notification'}</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>{item.message || item.body || 'You have a new update.'}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSecondary }]}>You’re all caught up.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, paddingTop: 58, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 18, fontWeight: '800' },
  list: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 14, fontWeight: '800' },
  body: { fontSize: 12, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14 },
});
