// COPIED FROM: frontend/src/pages/DashboardPage.jsx
// ADAPTED FOR: React Native

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { rooms as roomsAPI } from '../services/api';

interface Room {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  isPremium: boolean;
}

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const response = await roomsAPI.list();
      setRooms(response.data.rooms || []);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadRooms();
  };

  const renderRoom = ({ item }: { item: Room }) => (
    <TouchableOpacity
      style={[styles.roomCard, item.isPremium && styles.roomCardPremium]}
      onPress={() => navigation.navigate('RoomDetail', { roomId: item.id })}
    >
      <View style={styles.roomHeader}>
        <Text style={styles.roomName}>{item.name}</Text>
        {item.isPremium && <Text style={styles.premiumBadge}>⭐ Premium</Text>}
      </View>
      <Text style={styles.roomDescription}>{item.description}</Text>
      <Text style={styles.roomMembers}>👥 {item.memberCount} members</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4a90e2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.username}! 👋</Text>
        <Text style={styles.subtitle}>Your Orbit Rooms</Text>
      </View>

      <FlatList
        data={rooms}
        renderItem={renderRoom}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No rooms yet</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => navigation.navigate('CreateRoom')}
            >
              <Text style={styles.createButtonText}>Create Your First Room</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateRoom')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  roomCard: {
    backgroundColor: '#252547',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  roomCardPremium: {
    borderWidth: 2,
    borderColor: '#ffd700',
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  premiumBadge: {
    fontSize: 12,
    color: '#ffd700',
  },
  roomDescription: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 12,
  },
  roomMembers: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
  },
});
