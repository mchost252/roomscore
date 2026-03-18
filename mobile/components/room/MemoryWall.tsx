/**
 * MemoryWall - Pinned Image Gallery Component
 * 
 * Features:
 * - Horizontal scroll of pinned images
 * - Angled/polygonal thumbnail styling
 * - Pre-fetch with caching
 * - Tap to open full-screen viewer
 * - Animated entrance
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useHaptics } from '../../hooks';
import { PinnedImage } from '../../types';
import { COLORS, GLASS, RADIUS, SPACING } from '../../styles/glassmorphism';

interface MemoryWallProps {
  images: PinnedImage[];
  onImagePress?: (image: PinnedImage) => void;
  maxVisible?: number;
}

interface ThumbnailProps {
  image: PinnedImage;
  index: number;
  onPress: () => void;
}

const Thumbnail = React.memo(function Thumbnail({ image, index, onPress }: ThumbnailProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  
  // Alternate between slight rotations for polygonal effect
  const rotation = index % 2 === 0 ? -3 : 3;

  const handlePress = () => {
    haptics.selection();
    onPress();
  };

  return (
    <Animated.View
      entering={FadeIn.delay(index * 80).springify()}
      style={[styles.thumbnailContainer, { transform: [{ rotate: `${rotation}deg` }] }]}
    >
      <TouchableOpacity 
        onPress={handlePress} 
        activeOpacity={0.9}
        style={styles.thumbnailTouchable}
      >
        <Image 
          source={{ uri: image.thumbnailUrl || image.imageUrl }} 
          style={styles.thumbnailImage}
          resizeMode="cover"
        />
        {/* Overlay gradient */}
        <View style={styles.thumbnailOverlay} pointerEvents="none" />
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function MemoryWall({ 
  images, 
  onImagePress,
  maxVisible = 5,
}: MemoryWallProps) {
  const { colors, isDark } = useTheme();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<PinnedImage | null>(null);

  const visibleImages = images.slice(0, maxVisible);
  const extraCount = images.length - maxVisible;

  const handleImagePress = useCallback((image: PinnedImage) => {
    setSelectedImage(image);
    setViewerVisible(true);
    onImagePress?.(image);
  }, [onImagePress]);

  const closeViewer = () => {
    setViewerVisible(false);
    setSelectedImage(null);
  };

  if (images.length === 0) return null;

  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="images" size={14} color={COLORS.primaryLight} />
            <Text style={[styles.title, { color: colors.text }]}>
              Memory Wall
            </Text>
          </View>
          <View style={[styles.countBadge, { backgroundColor: `${COLORS.primary}15` }]}>
            <Text style={[styles.countText, { color: COLORS.primary }]}>
              {images.length}
            </Text>
          </View>
        </View>

        {/* Thumbnails */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {visibleImages.map((image, index) => (
            <Thumbnail
              key={image.id}
              image={image}
              index={index}
              onPress={() => handleImagePress(image)}
            />
          ))}
          
          {/* Extra count badge */}
          {extraCount > 0 && (
            <Animated.View
              entering={FadeIn.delay(maxVisible * 80)}
              style={styles.extraContainer}
            >
              <TouchableOpacity 
                style={[styles.extraBadge, { backgroundColor: isDark ? GLASS.surface : 'rgba(0,0,0,0.08)' }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.extraText, { color: colors.textSecondary }]}>
                  +{extraCount}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      </View>

      {/* Full Screen Viewer */}
      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        onRequestClose={closeViewer}
        statusBarTranslucent
      >
        <TouchableOpacity 
          style={styles.viewerOverlay} 
          activeOpacity={1}
          onPress={closeViewer}
        >
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={styles.viewerContent}
          >
            {selectedImage && (
              <Image
                source={{ uri: selectedImage.imageUrl }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            )}
            
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: GLASS.surface }]}
              onPress={closeViewer}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const THUMBNAIL_SIZE = 90;

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    paddingRight: SPACING.lg,
    gap: SPACING.sm,
  },
  thumbnailContainer: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  thumbnailTouchable: {
    width: '100%',
    height: '100%',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: RADIUS.md,
  },
  extraContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  extraBadge: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraText: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Full Screen Viewer
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerContent: {
    width: screenWidth,
    height: screenHeight * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
