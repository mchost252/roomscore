import api from './api';
import { Room, LeaderboardEntry, ChatMessage, PendingMember } from '../types';

export interface CreateRoomData {
  name: string;
  description?: string;
  isPublic: boolean;
  maxMembers?: number;
  duration?: '1_week' | '2_weeks' | '1_month';
  chatRetentionDays?: number;
  requireApproval?: boolean;
  tasks?: Array<{
    title: string;
    description?: string;
    taskType?: 'daily' | 'weekly' | 'custom';
    daysOfWeek?: number[];
    points?: number;
  }>;
}

export interface UpdateRoomData {
  name?: string;
  description?: string;
  isPublic?: boolean;
  maxMembers?: number;
}

export interface RoomSettingsData {
  isPublic?: boolean;
  chatRetentionDays?: number;
  requireApproval?: boolean;
}

class RoomService {
  // ── Get user's rooms ──
  async getMyRooms(): Promise<Room[]> {
    const res = await api.get('/rooms');
    return res.data.rooms || [];
  }

  // ── Get public/discoverable rooms ──
  async getPublicRooms(): Promise<Room[]> {
    const res = await api.get('/rooms', { params: { type: 'public' } });
    return res.data.rooms || [];
  }

  // ── Get room details ──
  async getRoom(roomId: string): Promise<Room> {
    const res = await api.get(`/rooms/${roomId}`);
    return res.data.room;
  }

  // ── Create room ──
  async createRoom(data: CreateRoomData): Promise<Room> {
    const res = await api.post('/rooms', data);
    return res.data.room;
  }

  // ── Update room ──
  async updateRoom(roomId: string, data: UpdateRoomData): Promise<Room> {
    const res = await api.put(`/rooms/${roomId}`, data);
    return res.data.room;
  }

  // ── Update room settings ──
  async updateSettings(roomId: string, data: RoomSettingsData): Promise<Room> {
    const res = await api.put(`/rooms/${roomId}/settings`, data);
    return res.data.room;
  }

  // ── Delete room ──
  async deleteRoom(roomId: string): Promise<void> {
    await api.delete(`/rooms/${roomId}`);
  }

  // ── Join room by code ──
  async joinRoom(joinCode: string): Promise<{ room?: Room; pending?: boolean; message?: string }> {
    const res = await api.post('/rooms/join', { joinCode });
    return res.data;
  }

  // ── Leave room ──
  async leaveRoom(roomId: string): Promise<void> {
    await api.delete(`/rooms/${roomId}/leave`);
  }

  // ── Remove member ──
  async removeMember(roomId: string, userId: string): Promise<void> {
    await api.delete(`/rooms/${roomId}/members/${userId}`);
  }

  // ── Get leaderboard ──
  async getLeaderboard(roomId: string): Promise<LeaderboardEntry[]> {
    const res = await api.get(`/rooms/${roomId}/leaderboard`);
    return res.data.leaderboard || [];
  }

  // ── Chat: Get messages ──
  async getMessages(roomId: string, opts?: { limit?: number; before?: string; lastId?: string }): Promise<{
    messages: ChatMessage[];
    retentionDays: number;
    deltaSync: boolean;
  }> {
    const params: any = {};
    if (opts?.limit) params.limit = opts.limit;
    if (opts?.before) params.before = opts.before;
    if (opts?.lastId) params.last_id = opts.lastId;
    const res = await api.get(`/rooms/${roomId}/chat`, { params });
    return res.data;
  }

  // ── Chat: Send message ──
  async sendMessage(roomId: string, message: string, replyToId?: string, replyToText?: string): Promise<ChatMessage> {
    const res = await api.post(`/rooms/${roomId}/chat`, { message, replyToId, replyToText });
    return res.data.message;
  }

  // ── Pending members ──
  async getPendingMembers(roomId: string): Promise<PendingMember[]> {
    const res = await api.get(`/rooms/${roomId}/pending`);
    return res.data.pendingMembers || [];
  }

  // ── Approve member ──
  async approveMember(roomId: string, userId: string): Promise<void> {
    await api.put(`/rooms/${roomId}/members/${userId}/approve`);
  }

  // ── Reject member ──
  async rejectMember(roomId: string, userId: string): Promise<void> {
    await api.delete(`/rooms/${roomId}/members/${userId}/reject`);
  }

  // ── Premium ──
  async activatePremium(roomId: string, code: string): Promise<Room> {
    const res = await api.put(`/rooms/${roomId}/premium`, { code });
    return res.data.room;
  }

  async deactivatePremium(roomId: string): Promise<Room> {
    const res = await api.put(`/rooms/${roomId}/premium`, { deactivate: true });
    return res.data.room;
  }
}

export default new RoomService();
