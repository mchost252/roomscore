/**
 * ProofUploadModal — Flow triggered when a user completes a task.
 * Asks them if they want to upload proof (image) or skip.
 */
import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface ProofUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSkip: () => void;
  onUpload: (uri: string, caption: string) => void;
  mode?: 'proof' | 'chat';
}

export default function ProofUploadModal({ visible, onClose, onSkip, onUpload, mode = 'proof' }: ProofUploadModalProps) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');

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
      setSelectedImage(res.assets[0].uri);
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
      setSelectedImage(res.assets[0].uri);
    }
  };

  const submitUpload = () => {
    if (!selectedImage) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onUpload(selectedImage, caption.trim());
      setSelectedImage(null);
      setCaption('');
    }, 500);
  };

  const cancelSelection = () => {
    setSelectedImage(null);
    setCaption('');
  };

  const handleSkipOrClose = () => {
    if (mode === 'proof') onSkip();
    else onClose();
    cancelSelection();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkipOrClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.scrim}>
        <View style={[styles.sheet, { backgroundColor: isDark ? '#12121A' : '#ffffff' }]}>
          
          {!selectedImage ? (
            <>
              <Text style={[styles.title, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                {mode === 'proof' ? 'Mission Complete!' : 'Share Photo'}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {mode === 'proof' ? 'Do you want to upload proof to the image wall? Ghost points await.' : 'Select a photo to share with the squad.'}
              </Text>

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

              <TouchableOpacity style={styles.skipBtn} onPress={handleSkipOrClose}>
                <Text style={styles.skipText}>{mode === 'proof' ? 'Skip for now' : 'Cancel'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {loading ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Uploading...</Text>
                </View>
              ) : (
                <View style={styles.previewContainer}>
                  <View style={styles.previewHeader}>
                    <TouchableOpacity onPress={cancelSelection}>
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={[styles.previewTitle, { color: isDark ? '#fff' : '#000' }]}>Preview</Text>
                    <View style={{ width: 24 }} />
                  </View>

                  <Image source={{ uri: selectedImage }} style={styles.previewImage} />

                  <TextInput
                    style={[styles.captionInput, { 
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                      color: isDark ? '#fff' : '#000'
                    }]}
                    placeholder={mode === 'proof' ? "Add a caption for your proof..." : "Add a message..."}
                    placeholderTextColor={colors.textSecondary}
                    value={caption}
                    onChangeText={setCaption}
                    maxLength={200}
                    multiline
                  />

                  <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: colors.primary }]} onPress={submitUpload}>
                    <Text style={styles.uploadBtnText}>
                      {mode === 'proof' ? 'UPLOAD PROOF' : 'SEND PHOTO'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
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
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    width: '100%',
    alignItems: 'stretch',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  captionInput: {
    minHeight: 48,
    maxHeight: 100,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    marginBottom: 20,
  },
  uploadBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  uploadBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
