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
};

export default RoomService;
