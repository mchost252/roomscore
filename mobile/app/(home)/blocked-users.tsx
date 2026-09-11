import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import messageService from '../../services/messageService';
import { useTheme } from '../../context/ThemeContext';
import ConfirmationModal from '../../components/ConfirmationModal';

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers(await messageService.getBlockedUsers()); }
    catch (error) { Alert.alert('Unable to load blocked users', 'Please try again.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const unblock = async (user: any) => {
      const userId = user.id || user._id || user.user_id;
      if (!userId) {
        Alert.alert('Unable to unblock user', 'This blocked-user record is missing its user ID.');
        return false;
      }
      const ok = await messageService.unblockUser(userId);
      if (!ok) {
        Alert.alert('Unable to unblock user', 'Please check your connection and try again.');
        return false;
      }
      setUsers(current => current.filter(item => (item.id || item._id || item.user_id) !== userId));
      return true;
  };
  return <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.text} /></TouchableOpacity><Text style={[styles.title, { color: colors.text }]}>Blocked Users</Text><View style={{ width: 24 }} /></View>
    {loading ? <Text style={[styles.empty, { color: colors.textSecondary }]}>Loading…</Text> : <FlatList data={users} keyExtractor={u => u.id || u._id || u.user_id} ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>You haven’t blocked anyone.</Text>} renderItem={({ item }) => <View style={[styles.row, { borderBottomColor: colors.border.primary }]}><View><Text style={[styles.name, { color: colors.text }]}>{item.username || 'User'}</Text></View><TouchableOpacity onPress={() => setSelectedUser(item)}><Text style={styles.action}>Unblock</Text></TouchableOpacity></View>} />}
    <ConfirmationModal
      visible={selectedUser !== null}
      title="Unblock user?"
      message={`Allow ${selectedUser?.username || 'this user'} to contact you again?`}
      confirmText="Unblock"
      onCancel={() => setSelectedUser(null)}
      onConfirm={async () => {
        const user = selectedUser;
        setSelectedUser(null);
        if (user) await unblock(user);
      }}
      isDark={isDark}
    />
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 20 }, header: { paddingTop: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }, title: { fontSize: 20, fontWeight: '700' }, row: { paddingVertical: 16, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, name: { fontSize: 16, fontWeight: '600' }, action: { color: '#ef4444', fontWeight: '700' }, empty: { textAlign: 'center', marginTop: 50 } });
