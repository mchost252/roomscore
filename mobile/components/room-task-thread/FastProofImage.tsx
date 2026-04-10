/**
 * FastProofImage — Triple-Tier WhatsApp Style Image Loader
 *
 * 1. Tier 1: 0ms render of local BlurHash
 * 2. Tier 2: Network fetch of compressed thumbnail into fixed frame
 * 3. Tier 3: Tap interaction to view high-res original in a modal
 */
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Dimensions, Text } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface FastProofImageProps {
  mediaUrl: string;
  blurHash?: string;
  width?: number | string;
  height?: number;
  borderRadius?: number;
  isGhostApproved?: boolean;
}

export default function FastProofImage({
  mediaUrl,
  blurHash,
  width: imgWidth = '100%',
  height: imgHeight = 200,
  borderRadius = 12,
  isGhostApproved = false,
}: FastProofImageProps) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const insets = useSafeAreaInsets();

  // Only show "Processing" for truly invalid URLs (empty or malformed)
  if (!mediaUrl || mediaUrl === 'undefined' || mediaUrl === 'null') {
    return (
      <View style={[styles.container, { width: imgWidth as any, height: imgHeight, borderRadius, backgroundColor: 'rgba(99,102,241,0.1)' }]}>
        <Ionicons name="image-outline" size={32} color="rgba(99,102,241,0.5)" />
        <Text style={{ fontSize: 10, color: 'rgba(99,102,241,0.5)', marginTop: 4 }}>No image</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setIsViewerOpen(true)}
        style={[styles.container, { width: imgWidth as any, height: imgHeight, borderRadius }]}
      >
        {hasError ? (
          <View style={styles.errorContainer}>
            <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.3)" />
            <Text style={styles.errorText}>Image unavailable</Text>
          </View>
        ) : (
          <Image
            source={{ uri: mediaUrl }}
            placeholder={blurHash ? { blurhash: blurHash } : undefined}
            contentFit="cover"
            transition={300}
            style={StyleSheet.absoluteFillObject}
            cachePolicy="memory-disk"
            onError={() => setHasError(true)}
          />
        )}

        {/* Optional overlay for approved status */}
        {isGhostApproved && (
          <View style={styles.approvedOverlay}>
            <Ionicons name="shield-checkmark" size={16} color="#22d3ee" />
          </View>
        )}
      </TouchableOpacity>

      {/* High-Res Viewer Modal */}
      <Modal visible={isViewerOpen} transparent animationType="fade" onRequestClose={() => setIsViewerOpen(false)}>
        <Animated.View style={styles.viewerRoot} entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
          {/* Dismiss background */}
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setIsViewerOpen(false)} />
          
          <TouchableOpacity
            style={[styles.closeBtn, { top: insets.top + 16 }]}
            onPress={() => setIsViewerOpen(false)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          <Animated.View entering={ZoomIn.springify().damping(16)} exiting={ZoomOut.duration(200)}>
            <Image
              source={{ uri: mediaUrl }}
              placeholder={blurHash ? { blurhash: blurHash } : undefined}
              contentFit="contain"
              style={{ width, height: height * 0.8 }}
              cachePolicy="memory-disk"
            />
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(99,102,241,0.1)',
  },
  errorText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  approvedOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(10,10,10,0.8)',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.4)',
  },
  viewerRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
