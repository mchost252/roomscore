import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import api from '../../services/api';
import { RoomDetail } from '../../types/room';
import { useRoomsInstant } from './useRoomsInstant';

export type TabType = 'my-rooms' | 'discover' | 'join-code';

export function useRoomsManager() {
  const router = useRouter();
  const {
    myRooms,
    publicRooms,
    loading,
    refreshing,
    error: hookError,
    refresh: hookRefresh,
  } = useRoomsInstant();

  const [activeTab, setActiveTab] = useState<TabType>('my-rooms');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [createRoomModalVisible, setCreateRoomModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (hookError) {
      setError(hookError);
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [hookError]);

  const handleJoinRoom = useCallback(async () => {
    if (!joinCode.trim()) {
      setError('Please enter a join code');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setJoiningRoom(true);
      setError(null);

      const response = await api.post('/rooms/join', {
        joinCode: joinCode.trim().toUpperCase(),
      });

      setJoinCode('');

      if (response.data.pending) {
        setSuccess(response.data.message || 'Request sent! Waiting for owner approval.');
        setTimeout(() => setSuccess(null), 4000);
        return;
      }

      setSuccess('Successfully joined room!');
      setTimeout(() => setSuccess(null), 3000);

      setTimeout(() => {
        router.push({
          pathname: '/(home)/room-detail',
          params: { roomId: response.data.room._id || response.data.room.id },
        });
      }, 1000);
    } catch (err: any) {
      console.error('Error joining room:', err);
      setError(err.response?.data?.message || 'Failed to join room');
      setTimeout(() => setError(null), 5000);
    } finally {
      setJoiningRoom(false);
    }
  }, [joinCode, router]);

  const handleJoinPublicRoom = useCallback(async (room: RoomDetail) => {
    try {
      setError(null);
      const response = await api.post('/rooms/join', {
        joinCode: room.joinCode,
      });

      if (response.data.pending) {
        setSuccess(response.data.message || 'Request sent! Waiting for owner approval.');
        setTimeout(() => setSuccess(null), 4000);
        hookRefresh();
        return;
      }

      setSuccess('Successfully joined room!');
      setTimeout(() => setSuccess(null), 3000);

      setTimeout(() => {
        router.push({
          pathname: '/(home)/room-detail',
          params: { roomId: response.data.room._id || response.data.room.id },
        });
      }, 1000);
    } catch (err: any) {
      console.error('Error joining room:', err);
      setError(err.response?.data?.message || 'Failed to join room');
      setTimeout(() => setError(null), 5000);
    }
  }, [router, hookRefresh]);

  const filteredMyRooms = myRooms.filter(room => {
    const isExpired = room.endDate && new Date() > new Date(room.endDate);
    if (isExpired && !room.isPremium) return false;
    
    const query = searchQuery.toLowerCase();
    return room.name.toLowerCase().includes(query) ||
           room.description?.toLowerCase().includes(query);
  });

  const filteredPublicRooms = publicRooms.filter(room => {
    const query = searchQuery.toLowerCase();
    return room.name.toLowerCase().includes(query) ||
           room.description?.toLowerCase().includes(query);
  });

  return {
    // Data
    myRooms: filteredMyRooms,
    publicRooms: filteredPublicRooms,
    loading,
    refreshing,
    refresh: hookRefresh,
    
    // UI State
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    searchFocused,
    setSearchFocused,
    joinCode,
    setJoinCode,
    joiningRoom,
    createRoomModalVisible,
    setCreateRoomModalVisible,
    error,
    setError,
    success,
    setSuccess,
    
    // Actions
    handleJoinRoom,
    handleJoinPublicRoom,
  };
}
