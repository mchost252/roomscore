import api from './api';
import { RoomDetail, RoomMember, AuraTier } from '../types/room';

function mapAura(raw: string | undefined): AuraTier {
  const v = (raw || '').toLowerCase();
  if (v === 'silver' || v === 'gold' || v === 'platinum') return v as AuraTier;
  return 'bronze';
}

function mapRoom(raw: any): RoomDetail {
  const id = raw._id || raw.id;
  const ownerId =
    typeof raw.ownerId === 'object' && raw.ownerId
      ? raw.ownerId._id || raw.ownerId.id
      : raw.ownerId || raw.owner?._id || raw.owner?.id || '';

  return {
    id,
    name: raw.name,
    description: raw.description ?? '',
    joinCode: raw.joinCode ?? '',
    isPrivate: raw.isPrivate !== false && !raw.isPublic,
    isPublic: raw.isPublic ?? !raw.isPrivate,
    maxMembers: raw.maxMembers ?? 20,
    chatRetentionDays: raw.chatRetentionDays ?? 3,
    isPremium: !!raw.isPremium,
    streak: raw.streak ?? 0,
    ownerId,
    isActive: raw.isActive !== false,
    requireApproval: raw.requireApproval,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    doomClockExpiry: raw.doomClockExpiry,
    userRole: raw.userRole,
    groupAura: raw.groupAura,
    onlineCount: raw.onlineCount,
    weeklyPoints: raw.weeklyPoints,
  };
}

function mapMember(m: any): RoomMember {
  const userObj = m.userId?.username != null ? m.userId : m.user;
  const username = userObj?.username ?? 'Member';
  const avatar = userObj?.avatar;

  // Extract the actual user ID — may be a populated object or plain string
  const userId =
    typeof m.userId === 'object' && m.userId
      ? m.userId._id || m.userId.id
      : typeof m.userId === 'string'
        ? m.userId
        : m.user_id || userObj?._id || userObj?.id || undefined;

  return {
    id: m._id || m.id,
    userId,
    username,
    avatar,
    isOnline: !!m.isOnline,
    aura: mapAura(userObj?.aura),
    hasHeat: !!m.hasHeat,
  };
}

// ── Pending member type (returned by GET /rooms/:id/pending) ──────────────
export interface PendingMember {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  email?: string;
  requestedAt: string;
}

function mapPendingMember(raw: any): PendingMember {
  const userObj =
    typeof raw.userId === 'object' && raw.userId ? raw.userId : raw.user;
  return {
    id: raw._id || raw.id,
    userId: userObj?._id || userObj?.id || raw.userId || '',
    username: userObj?.username ?? 'Member',
    avatar: userObj?.avatar,
    email: userObj?.email,
    requestedAt: raw.requestedAt || raw.joinedAt || new Date().toISOString(),
  };
}

// ── Settings payload ──────────────────────────────────────────────────────
export interface RoomSettingsPayload {
  isPublic?: boolean;
  chatRetentionDays?: number;
  requireApproval?: boolean;
}

export const RoomService = {
  async getRoom(roomId: string): Promise<RoomDetail> {
    const res = await api.get(`/rooms/${roomId}`);
    return mapRoom(res.data.room);
  },

  async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    const res = await api.get(`/rooms/${roomId}`);
    const room = res.data.room;
    const members = room?.members || [];
    return members.map(mapMember);
  },

  // ── Settings (owner only) ────────────────────────────────────────────────
  async updateSettings(
    roomId: string,
    settings: RoomSettingsPayload,
  ): Promise<RoomDetail> {
    const res = await api.put(`/rooms/${roomId}/settings`, settings);
    return mapRoom(res.data.room);
  },

  // ── Delete room (owner only, cascade) ────────────────────────────────────
  async deleteRoom(roomId: string): Promise<void> {
    await api.delete(`/rooms/${roomId}`);
  },

  // ── Leave room (members only, owner cannot leave) ────────────────────────
  async leaveRoom(roomId: string): Promise<void> {
    await api.delete(`/rooms/${roomId}/leave`);
  },

  // ── Pending members (owner only) ─────────────────────────────────────────
  async getPendingMembers(roomId: string): Promise<PendingMember[]> {
    const res = await api.get(`/rooms/${roomId}/pending`);
    const pending = res.data.pendingMembers || [];
    return pending.map(mapPendingMember);
  },

  // ── Approve pending member (owner only) ──────────────────────────────────
  async approveMember(roomId: string, userId: string): Promise<void> {
    await api.put(`/rooms/${roomId}/members/${userId}/approve`);
  },

  // ── Reject pending member (owner only) ───────────────────────────────────
  async rejectMember(roomId: string, userId: string): Promise<void> {
    await api.delete(`/rooms/${roomId}/members/${userId}/reject`);
  },
};

export default RoomService;
