/**
 * ProofUploadModal — Flow triggered when a user completes a task.
 * Asks them if they want to upload proof (image) or skip.
 */
import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface ProofUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSkip: () => void;
  onUpload: (uri: string) => void;
}

export default function ProofUploadModal({ visible, onClose, onSkip, onUpload }: ProofUploadModalProps) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      alert('Camera permission is required.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0].uri) {
      setLoading(true);
      // Simulate slight delay for compress/blurhash gen (handled later)
      setTimeout(() => {
        setLoading(false);
        onUpload(res.assets[0].uri);
      }, 500);
    }
  };

  const handleGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alert('Gallery permission is required.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.7,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!res.canceled && res.assets[0].uri) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        onUpload(res.assets[0].uri);
      }, 500);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={[styles.sheet, { backgroundColor: isDark ? '#12121A' : '#ffffff' }]}>
          <Text style={[styles.title, { color: isDark ? '#ffffff' : '#0f172a' }]}>Mission Complete!</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Do you want to upload proof to the image wall? Ghost points await.
          </Text>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Processing proof...</Text>
            </View>
          ) : (
            <>
              <View style={styles.optionsRow}>
                <TouchableOpacity style={styles.optionBox} onPress={handleCamera}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
                    <Ionicons name="camera-outline" size={28} color="#a5b4fc" />
                  </View>
                  <Text style={[styles.optionLabel, { color: isDark ? '#fff' : '#000' }]}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionBox} onPress={handleGallery}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(34,211,238,0.15)' }]}>
                    <Ionicons name="images-outline" size={28} color="#22d3ee" />
                  </View>
                  <Text style={[styles.optionLabel, { color: isDark ? '#fff' : '#000' }]}>Gallery</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
                <Text style={styles.skipText}>Skip for now</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 20,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 24,
  },
  optionBox: {
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  skipBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a5b4fc',
  },
  loadingState: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
