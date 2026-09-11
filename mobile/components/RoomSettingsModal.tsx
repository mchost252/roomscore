import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import RoomService from '../services/roomService';
import { uploadImage } from '../services/cloudinaryService';
import type { RoomDetail } from '../types/room';
import { roomStorage } from '../db/roomDb';
import ConfirmationModal from './ConfirmationModal';

interface RoomSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  room: RoomDetail | null;
  roomId: string;
  isOwner: boolean;
  onSave: (updated: RoomDetail) => void;
  onRoomDeleted?: () => void;
  onRoomLeft?: () => void;
}

export function RoomSettingsModal({
  visible,
  onClose,
  room,
  roomId,
  isOwner,
  onSave,
  onRoomDeleted,
  onRoomLeft,
}: RoomSettingsModalProps) {
  const { colors, isDark } = useTheme();

  // ── Form state ──────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [retention, setRetention] = useState(3);
  const [maxMembers, setMaxMembers] = useState('20');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [roomDp, setRoomDp] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingRoomDp, setUploadingRoomDp] = useState(false);

  // ── Loading states ──────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // ── Track dirty state ───────────────────────────────────────────────────
  const [hasChanges, setHasChanges] = useState(false);

  // ── Confirmation Modal States ───────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    if (visible && room) {
      setName(room.name);
      setDescription(room.description || '');
      setIsPublic(!!room.isPublic);
      setRequireApproval(!!room.requireApproval);
      setShowJoinCode(!!room.showJoinCode);
      setRetention(room.chatRetentionDays ?? 3);
      setMaxMembers(String(room.maxMembers ?? 20));
      setCoverImage(room.coverImage || null);
      setRoomDp(room.roomDp || null);
      setHasChanges(false);
    }
  }, [visible, room]);

  // Mark dirty on any field change
  const updateField = useCallback(
    <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
      setter(value);
      setHasChanges(true);
    },
    [],
  );

  // ── Save handler (owner only) ───────────────────────────────────────────
  const handlePickImage = useCallback(async (type: 'banner' | 'dp') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'banner' ? [16, 9] : [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        if (type === 'banner') {
          setUploadingBanner(true);
          const cloudinaryUrl = await uploadImage(imageUri, 'roomscore/rooms');
          setCoverImage(cloudinaryUrl);
        } else {
          setUploadingRoomDp(true);
          const cloudinaryUrl = await uploadImage(imageUri, 'roomscore/room-dp');
          setRoomDp(cloudinaryUrl);
        }
        setHasChanges(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploadingBanner(false);
      setUploadingRoomDp(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!room || !hasChanges) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const roomUpdate = RoomService.updateRoom(roomId, {
        name: name.trim() || room.name,
        description: description.trim(),
        isPublic,
        maxMembers: parseInt(maxMembers, 10) || room.maxMembers,
        coverImage: coverImage === null ? null : (coverImage || undefined),
        roomDp: roomDp === null ? null : (roomDp || undefined),
      });

      const dpUpdate = roomDp !== (room.roomDp || null)
        ? RoomService.updateRoomDp(roomId, roomDp ?? null)
        : Promise.resolve(null);

      await Promise.all([
        roomUpdate,
        dpUpdate,
        RoomService.updateSettings(roomId, {
          isPublic,
          chatRetentionDays: retention,
          requireApproval,
          showJoinCode,
        })
      ]);

      onSave({
        ...room,
        name: name.trim() || room.name,
        description: description.trim(),
        isPublic,
        isPrivate: !isPublic,
        requireApproval,
        showJoinCode,
        chatRetentionDays: retention,
        maxMembers: parseInt(maxMembers, 10) || room.maxMembers,
        coverImage: coverImage || null,
        roomDp: roomDp || null,
      });
      onClose();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to save settings';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }, [room, roomId, name, description, isPublic, requireApproval, showJoinCode, retention, maxMembers, coverImage, roomDp, hasChanges, onSave, onClose]);

  const removeRoomFromLocalCache = useCallback(() => {
    try {
      const raw = roomStorage.getString('rooms_list_cache');
      if (raw) {
        const rooms = JSON.parse(raw);
        roomStorage.set('rooms_list_cache', JSON.stringify(rooms.filter((r: any) => r.id !== roomId)));
      }
    } catch (e) {
      console.error('Error clearing room cache:', e);
    }
  }, [roomId]);

  // ── Delete room handler (owner only) ────────────────────────────────────
  const handleDeleteRoom = useCallback(() => {
    setShowDeleteConfirm(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const executeDeleteRoom = useCallback(async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await RoomService.deleteRoom(roomId);
      removeRoomFromLocalCache();
      onRoomDeleted?.();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to delete room';
      Alert.alert('Error', msg);
    } finally {
      setDeleting(false);
    }
  }, [roomId, onRoomDeleted, removeRoomFromLocalCache]);

  // ── Leave room handler (member only) ────────────────────────────────────
  const handleLeaveRoom = useCallback(() => {
    setShowLeaveConfirm(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  const executeLeaveRoom = useCallback(async () => {
    setShowLeaveConfirm(false);
    setLeaving(true);
    try {
      await RoomService.leaveRoom(roomId);
      removeRoomFromLocalCache();
      onRoomLeft?.();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to leave room';
      Alert.alert('Error', msg);
    } finally {
      setLeaving(false);
    }
  }, [roomId, onRoomLeft, removeRoomFromLocalCache]);

  // ── Styling ─────────────────────────────────────────────────────────────
  const sheetBg = isDark ? '#141424' : '#ffffff';
  const sectionBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)';
  const dangerBg = isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)';

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        {/* Proper overlay scrim */}
        <TouchableOpacity
          style={[styles.scrim, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: sheetBg, borderColor: colors.borderColor },
          ]}
        >
          {/* ── Header ───────────────────────────────────────────────────── */}
          <View style={styles.handleRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              {isOwner ? 'Room Settings' : 'Room Info'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ══════════════════════════════════════════════════════════════
                SECTION 1: Room Identity (owner only)
                ══════════════════════════════════════════════════════════════ */}
            {isOwner && (
              <View style={[styles.section, { backgroundColor: sectionBg }]}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="flag" size={14} color={colors.primary} />
                  <Text
                    style={[styles.sectionTitle, { color: colors.textSecondary }]}
                  >
                    IDENTIFICATION
                  </Text>
                </View>

                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Name
                </Text>
                <TextInput
                  value={name}
                  onChangeText={(v) => updateField(setName, v)}
                  placeholder="Room name"
                  placeholderTextColor={colors.placeholder}
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      borderColor: colors.borderColor,
                      backgroundColor: colors.inputBg,
                    },
                  ]}
                />

                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Description
                </Text>
                <TextInput
                  value={description}
                  onChangeText={(v) => updateField(setDescription, v)}
                  multiline
                  placeholder="Optional"
                  placeholderTextColor={colors.placeholder}
                  style={[
                    styles.input,
                    styles.area,
                    {
                      color: colors.text,
                      borderColor: colors.borderColor,
                      backgroundColor: colors.inputBg,
                    },
                  ]}
                />

                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Room banner
                </Text>
                <TouchableOpacity
                  onPress={() => handlePickImage('banner')}
                  disabled={uploadingBanner}
                  style={[
                    styles.imagePickerBtn,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.borderColor,
                    },
                  ]}
                >
                  {uploadingBanner ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="image" size={18} color={colors.primary} />
                      <Text style={[styles.imagePickerText, { color: colors.text }]}>
                        {coverImage ? 'Change banner image' : 'Pick banner image'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                {coverImage ? (
                  <>
                    <View style={[styles.imagePreviewWrap, { borderColor: colors.borderColor }]}>
                      <Image source={{ uri: coverImage }} style={styles.imagePreview} resizeMode="cover" />
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setCoverImage(null);
                        setHasChanges(true);
                      }}
                      style={[styles.clearImageBtn, { borderColor: colors.borderColor }]}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      <Text style={[styles.clearImageText, { color: '#ef4444' }]}>Remove banner</Text>
                    </TouchableOpacity>
                  </>
                ) : null}

                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 18 }]}>
                  Room display picture
                </Text>
                <TouchableOpacity
                  onPress={() => handlePickImage('dp')}
                  disabled={uploadingRoomDp}
                  style={[
                    styles.imagePickerBtn,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.borderColor,
                    },
                  ]}
                >
                  {uploadingRoomDp ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
                      <Text style={[styles.imagePickerText, { color: colors.text }]}>
                        {roomDp ? 'Change room DP' : 'Pick room DP'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                {roomDp ? (
                  <>
                    <View style={[styles.dpPreviewWrap, { borderColor: colors.borderColor }]}>
                      <Image source={{ uri: roomDp }} style={styles.dpPreviewImage} resizeMode="cover" />
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setRoomDp(null);
                        setHasChanges(true);
                      }}
                      style={[styles.clearImageBtn, { borderColor: colors.borderColor }]}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      <Text style={[styles.clearImageText, { color: '#ef4444' }]}>Remove room DP</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SECTION 2: Visibility & Access (owner only)
                ══════════════════════════════════════════════════════════════ */}
            {isOwner && (
              <View style={[styles.section, { backgroundColor: sectionBg }]}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="shield" size={14} color="#8b5cf6" />
                  <Text
                    style={[styles.sectionTitle, { color: colors.textSecondary }]}
                  >
                    VISIBILITY & ACCESS
                  </Text>
                </View>

                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>
                      Public Room
                    </Text>
                    <Text
                      style={[
                        styles.toggleDesc,
                        { color: colors.textTertiary },
                      ]}
                    >
                      Visible in search results
                    </Text>
                  </View>
                  <Switch
                    value={isPublic}
                    onValueChange={(v) => updateField(setIsPublic, v)}
                    trackColor={{
                      false: isDark ? '#333' : '#ccc',
                      true: colors.primary,
                    }}
                  />
                </View>

                <View
                  style={[
                    styles.divider,
                    { backgroundColor: colors.borderColor },
                  ]}
                />

                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>
                      Admin Approval
                    </Text>
                    <Text
                      style={[
                        styles.toggleDesc,
                        { color: colors.textTertiary },
                      ]}
                    >
                      Review join requests before accepting
                    </Text>
                  </View>
                  <Switch
                    value={requireApproval}
                    onValueChange={(v) => updateField(setRequireApproval, v)}
                    trackColor={{
                      false: isDark ? '#333' : '#ccc',
                      true: colors.primary,
                    }}
                  />
                </View>

                <View
                  style={[
                    styles.divider,
                    { backgroundColor: colors.borderColor },
                  ]}
                />

                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>
                      Show Join Code
                    </Text>
                    <Text
                      style={[
                        styles.toggleDesc,
                        { color: colors.textTertiary },
                      ]}
                    >
                      Members can see and copy the room code
                    </Text>
                  </View>
                  <Switch
                    value={showJoinCode}
                    onValueChange={(v) => updateField(setShowJoinCode, v)}
                    trackColor={{
                      false: isDark ? '#333' : '#ccc',
                      true: colors.primary,
                    }}
                  />
                </View>
              </View>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SECTION 3: Logistics (owner only)
                ══════════════════════════════════════════════════════════════ */}
            {isOwner && (
              <View style={[styles.section, { backgroundColor: sectionBg }]}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="settings" size={14} color="#f59e0b" />
                  <Text
                    style={[styles.sectionTitle, { color: colors.textSecondary }]}
                  >
                    LOGISTICS
                  </Text>
                </View>

                {/* Chat Retention Days — stepper */}
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>
                      Chat Retention
                    </Text>
                    <Text
                      style={[
                        styles.toggleDesc,
                        { color: colors.textTertiary },
                      ]}
                    >
                      Days messages are kept (1-5)
                    </Text>
                  </View>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      onPress={() => {
                        if (retention > 1) updateField(setRetention, retention - 1);
                      }}
                      style={[
                        styles.stepperBtn,
                        {
                          backgroundColor: colors.inputBg,
                          opacity: retention <= 1 ? 0.4 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="remove" size={16} color={colors.text} />
                    </TouchableOpacity>
                    <Text
                      style={[styles.stepperValue, { color: colors.text }]}
                    >
                      {retention}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        if (retention < 5) updateField(setRetention, retention + 1);
                      }}
                      style={[
                        styles.stepperBtn,
                        {
                          backgroundColor: colors.inputBg,
                          opacity: retention >= 5 ? 0.4 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="add" size={16} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View
                  style={[
                    styles.divider,
                    { backgroundColor: colors.borderColor },
                  ]}
                />

                {/* Max Members — stepper */}
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>
                      Max Members
                    </Text>
                    <Text
                      style={[
                        styles.toggleDesc,
                        { color: colors.textTertiary },
                      ]}
                    >
                      Maximum squad size (5-100)
                    </Text>
                  </View>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      onPress={() => {
                        const current = parseInt(maxMembers, 10) || 20;
                        if (current > 5) updateField(setMaxMembers, String(current - 1));
                      }}
                      style={[
                        styles.stepperBtn,
                        {
                          backgroundColor: colors.inputBg,
                          opacity: (parseInt(maxMembers, 10) || 20) <= 5 ? 0.4 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="remove" size={16} color={colors.text} />
                    </TouchableOpacity>
                    <Text
                      style={[styles.stepperValue, { color: colors.text }]}
                    >
                      {maxMembers}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        const current = parseInt(maxMembers, 10) || 20;
                        if (current < 100) updateField(setMaxMembers, String(current + 1));
                      }}
                      style={[
                        styles.stepperBtn,
                        {
                          backgroundColor: colors.inputBg,
                          opacity: (parseInt(maxMembers, 10) || 20) >= 100 ? 0.4 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="add" size={16} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SECTION 4: Room Info (non-owner view)
                ══════════════════════════════════════════════════════════════ */}
            {!isOwner && room && (
              <View style={[styles.section, { backgroundColor: sectionBg }]}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="information-circle" size={14} color={colors.primary} />
                  <Text
                    style={[styles.sectionTitle, { color: colors.textSecondary }]}
                  >
                    ROOM DETAILS
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>
                    Name
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {room.name}
                  </Text>
                </View>
                {room.description ? (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>
                      Description
                    </Text>
                    <Text
                      style={[styles.infoValue, { color: colors.text }]}
                      numberOfLines={3}
                    >
                      {room.description}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>
                    Join Code
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.primary }]}>
                    {room.joinCode}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>
                    Visibility
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {room.isPublic ? 'Public' : 'Private'}
                  </Text>
                </View>
              </View>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SAVE BUTTON (owner only, when there are changes)
                ══════════════════════════════════════════════════════════════ */}
            {isOwner && (
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: hasChanges ? colors.primary : colors.inputBg,
                    opacity: hasChanges && !saving ? 1 : 0.5,
                  },
                ]}
                onPress={handleSave}
                disabled={!hasChanges || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    style={[
                      styles.saveBtnText,
                      { color: hasChanges ? '#fff' : colors.textTertiary },
                    ]}
                  >
                    Save Changes
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* ══════════════════════════════════════════════════════════════
                DANGER ZONE
                ══════════════════════════════════════════════════════════════ */}
            <View style={[styles.section, { backgroundColor: dangerBg }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="warning" size={14} color="#ef4444" />
                <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>
                  DANGER ZONE
                </Text>
              </View>

              {/* Leave Room — for non-owners */}
              {!isOwner && (
                <TouchableOpacity
                  style={[
                    styles.dangerBtn,
                    {
                      borderColor: isDark
                        ? 'rgba(239,68,68,0.3)'
                        : 'rgba(239,68,68,0.2)',
                    },
                  ]}
                  onPress={handleLeaveRoom}
                  disabled={leaving}
                >
                  {leaving ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <>
                      <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                      <View style={styles.dangerBtnInfo}>
                        <Text style={styles.dangerBtnTitle}>Leave Room</Text>
                        <Text
                          style={[
                            styles.dangerBtnDesc,
                            { color: colors.textTertiary },
                          ]}
                        >
                          You will need to rejoin to access this room
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.textTertiary}
                      />
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Delete Room — for owners */}
              {isOwner && (
                <TouchableOpacity
                  style={[
                    styles.dangerBtn,
                    {
                      borderColor: isDark
                        ? 'rgba(239,68,68,0.3)'
                        : 'rgba(239,68,68,0.2)',
                    },
                  ]}
                  onPress={handleDeleteRoom}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      <View style={styles.dangerBtnInfo}>
                        <Text style={styles.dangerBtnTitle}>Delete Room</Text>
                        <Text
                          style={[
                            styles.dangerBtnDesc,
                            { color: colors.textTertiary },
                          ]}
                        >
                          Permanently delete this room and all its data
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.textTertiary}
                      />
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Bottom padding */}
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>

        {/* ── Custom Confirmation Modals (Fix for native Alert bug inside Modals) ── */}
        <ConfirmationModal
          visible={showDeleteConfirm}
          title="Delete Room"
          message="This will permanently delete the room and all its data. This action cannot be undone."
          confirmText="Delete Room"
          cancelText="Cancel"
          isDark={isDark}
          destructive={true}
          onConfirm={executeDeleteRoom}
          onCancel={() => setShowDeleteConfirm(false)}
        />

        <ConfirmationModal
          visible={showLeaveConfirm}
          title="Leave Room"
          message="Are you sure you want to leave this room? You will need to rejoin to access it again."
          confirmText="Leave Room"
          cancelText="Cancel"
          isDark={isDark}
          destructive={true}
          onConfirm={executeLeaveRoom}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: 24,
    paddingHorizontal: 20,
    maxHeight: '90%',
  },
  handleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  title: { fontSize: 20, fontWeight: '700' },

  // ── Sections ──────────────────────────────────────────────────────────
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // ── Form fields ───────────────────────────────────────────────────────
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  area: { minHeight: 80, textAlignVertical: 'top' },

  // ── Image picker ──────────────────────────────────────────────────────
  imagePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  imagePickerText: {
    fontSize: 15,
    fontWeight: '600',
  },
  clearImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  clearImageText: {
    fontSize: 13,
    fontWeight: '600',
  },
  imagePreviewWrap: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 8,
  },
  imagePreview: {
    width: '100%',
    height: 120,
  },
  dpPreviewWrap: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 8,
  },
  dpPreviewImage: {
    width: 88,
    height: 88,
    borderRadius: 16,
  },

  // ── Toggle rows ───────────────────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },

  // ── Stepper ───────────────────────────────────────────────────────────
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '900',
    minWidth: 20,
    textAlign: 'center',
  },

  // ── Max members display ───────────────────────────────────────────────
  maxMembersValue: {
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Info rows (non-owner view) ────────────────────────────────────────
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },

  // ── Save button ───────────────────────────────────────────────────────
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Danger zone ───────────────────────────────────────────────────────
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  dangerBtnInfo: {
    flex: 1,
  },
  dangerBtnTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
  dangerBtnDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  backdropGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  backdropOption: {
    width: '30%', alignItems: 'center', gap: 4,
    borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent',
    paddingVertical: 6,
  },
  backdropPreview: {
    width: '100%', height: 40, borderRadius: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  backdropPreviewInner: { flex: 1 },
  backdropLabel: { fontSize: 9, fontWeight: '700' },
});

export default RoomSettingsModal;
