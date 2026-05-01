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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import RoomService from '../services/roomService';
import type { RoomDetail } from '../types/room';

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
  const [retention, setRetention] = useState(3);
  const [maxMembers, setMaxMembers] = useState('20');

  // ── Loading states ──────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // ── Track dirty state ───────────────────────────────────────────────────
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (visible && room) {
      setName(room.name);
      setDescription(room.description || '');
      setIsPublic(!!room.isPublic);
      setRequireApproval(!!room.requireApproval);
      setRetention(room.chatRetentionDays ?? 3);
      setMaxMembers(String(room.maxMembers ?? 20));
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
  const handleSave = useCallback(async () => {
    if (!room || !hasChanges) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Call backend settings endpoint for supported fields
      await RoomService.updateSettings(roomId, {
        isPublic,
        chatRetentionDays: retention,
        requireApproval,
      });

      // Update local state with all fields (name/description are local-only for now)
      onSave({
        ...room,
        name: name.trim() || room.name,
        description: description.trim(),
        isPublic,
        isPrivate: !isPublic,
        requireApproval,
        chatRetentionDays: retention,
        maxMembers: parseInt(maxMembers, 10) || room.maxMembers,
      });
      onClose();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to save settings';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }, [room, roomId, name, description, isPublic, requireApproval, retention, maxMembers, hasChanges, onSave, onClose]);

  // ── Delete room handler (owner only) ────────────────────────────────────
  const handleDeleteRoom = useCallback(() => {
    Alert.alert(
      'Delete Room',
      'This will permanently delete the room and all its data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await RoomService.deleteRoom(roomId);
              onRoomDeleted?.();
            } catch (error: any) {
              const msg = error?.response?.data?.message || 'Failed to delete room';
              Alert.alert('Error', msg);
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [roomId, onRoomDeleted]);

  // ── Leave room handler (member only) ────────────────────────────────────
  const handleLeaveRoom = useCallback(() => {
    Alert.alert(
      'Leave Room',
      'Are you sure you want to leave this room? You will need to rejoin to access it again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              await RoomService.leaveRoom(roomId);
              onRoomLeft?.();
            } catch (error: any) {
              const msg = error?.response?.data?.message || 'Failed to leave room';
              Alert.alert('Error', msg);
            } finally {
              setLeaving(false);
            }
          },
        },
      ],
    );
  }, [roomId, onRoomLeft]);

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

                {/* Max Members — display */}
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
                      Maximum squad size
                    </Text>
                  </View>
                  <Text
                    style={[styles.maxMembersValue, { color: colors.textSecondary }]}
                  >
                    {maxMembers}
                  </Text>
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
});

export default RoomSettingsModal;
