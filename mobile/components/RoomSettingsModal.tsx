import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import type { RoomDetail } from '../types/room';

interface RoomSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  room: RoomDetail | null;
  onSave: (updated: RoomDetail) => void;
}

export function RoomSettingsModal({ visible, onClose, room, onSave }: RoomSettingsModalProps) {
  const { colors, isDark } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (visible && room) {
      setName(room.name);
      setDescription(room.description || '');
      setIsPublic(!!room.isPublic);
    }
  }, [visible, room]);

  const save = () => {
    if (!room) return;
    onSave({
      ...room,
      name: name.trim() || room.name,
      description: description.trim(),
      isPublic,
      isPrivate: !isPublic,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <BlurView intensity={isDark ? 80 : 30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: isDark ? 'rgba(20,20,30,0.85)' : 'rgba(255,255,255,0.95)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
          <View style={styles.handleRow}>
            <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Room settings</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }]}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Room name"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
              style={[styles.input, { color: isDark ? '#fff' : '#000', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.05)' }]}
            />
            <Text style={[styles.label, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Optional"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
              style={[styles.input, styles.area, { color: isDark ? '#fff' : '#000', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.05)' }]}
            />
            <View style={styles.row}>
              <Text style={[styles.label, { color: isDark ? '#fff' : '#000', marginTop: 0 }]}>Public room</Text>
              <Switch value={isPublic} onValueChange={setIsPublic} />
            </View>
            <TouchableOpacity
              style={[styles.primary, { backgroundColor: colors.primary }]}
              onPress={save}
            >
              <Text style={styles.primaryTxt}>Save</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.1)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 24,
    maxHeight: '88%',
  },
  handleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 12, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  area: { minHeight: 88, textAlignVertical: 'top' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  primary: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default RoomSettingsModal;
