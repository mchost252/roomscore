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
    showJoinCode: raw.showJoinCode ?? false,
    coverImage: raw.coverImage ?? null,
    roomDp: raw.roomDp ?? raw.room_image ?? raw.dp ?? null,
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
    role: m.role === 'owner' || m.role === 'admin' ? m.role : 'member',
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
  showJoinCode?: boolean;
}

// ── Room Chat ─────────────────────────────────────────────────────────────
export interface RoomChatMessage {
  id: string;
  roomId: string;
  userId: string | null;
  username: string;
  avatar: string | null;
  content: string;
  type: 'user' | 'system';
  replyToId?: string | null;
  replyToText?: string | null;
  createdAt: string;
}

function mapChatMessage(raw: any): RoomChatMessage {
  const userObj = typeof raw.userId === 'object' && raw.userId ? raw.userId : null;
  return {
    id: raw._id || raw.id,
    roomId: raw.roomId,
    userId: typeof raw.userId === 'object' ? raw.userId?._id || raw.userId?.id : raw.userId,
    username: userObj?.username ?? raw.username ?? 'Member',
    avatar: userObj?.avatar ?? raw.avatar ?? null,
    content: raw.content ?? '',
    type: raw.type || 'user',
    replyToId: raw.replyToId,
    replyToText: raw.replyToText,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
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

  // ── Core Update (owner only) ─────────────────────────────────────────────
  async updateRoom(
    roomId: string,
    data: { name?: string; description?: string; isPublic?: boolean; maxMembers?: number; coverImage?: string | null; roomDp?: string | null }
  ): Promise<RoomDetail> {
    const res = await api.put(`/rooms/${roomId}`, data);
    return mapRoom(res.data.room);
  },

  async updateRoomDp(roomId: string, roomDp: string | null): Promise<RoomDetail> {
    const res = await api.put(`/rooms/${roomId}/dp`, { roomDp });
    return mapRoom(res.data.room);
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

  // ── Remove an active member (owner only) ─────────────────────────────────
  async removeMember(roomId: string, userId: string): Promise<void> {
    await api.delete(`/rooms/${roomId}/members/${userId}`);
  },

  // ── Promote to admin / demote to member (owner only) ─────────────────────
  async updateMemberRole(roomId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
    await api.put(`/rooms/${roomId}/members/${userId}/role`, { role });
  },

  // ── Room Chat ──────────────────────────────────────────────────────────
  async getRoomChat(
    roomId: string,
    opts?: { limit?: number; before?: string; lastId?: string },
  ): Promise<RoomChatMessage[]> {
    const params: Record<string, string> = {};
    if (opts?.limit) params.limit = String(opts.limit);
    if (opts?.before) params.before = opts.before;
    if (opts?.lastId) params.last_id = opts.lastId;
    const res = await api.get(`/rooms/${roomId}/chat`, { params });
    return (res.data.messages || []).map(mapChatMessage);
  },

  async sendRoomChat(
    roomId: string,
    content: string,
    replyTo?: { id: string; text: string },
  ): Promise<RoomChatMessage> {
    const body: Record<string, any> = { message: content };
    if (replyTo) {
      body.replyToId = replyTo.id;
      body.replyToText = replyTo.text;
    }
    const res = await api.post(`/rooms/${roomId}/chat`, body);
    return mapChatMessage(res.data.message);
  },
};

export default RoomService;
