/**
 * RoomHeader — Static Identity Header (v7)
 *
 * Matches reference mockup exactly:
 *   - Cover image backdrop filling the full-width header area
 *   - Dark gradient overlay (darker towards bottom)
 *   - Room avatar on the LEFT (rounded square, purple gradient, infinity icon)
 *   - Room name to the RIGHT of avatar (large bold white)
 *   - "Room • X members" subtitle below name
 *   - Member row below subtitle (avatars + overflow pill)
 *   - "Room settings" pill on the RIGHT of the member row
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../context/ThemeContext';
import { RoomMember } from '../../types/room';
import AvatarStack from './AvatarStack';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BACKDROP_FALLBACK = require('../../assets/room_default_bg.jpg');

interface RoomHeaderProps {
  roomName: string;
  members: RoomMember[];
  coverImage?: string | null;
  roomDp?: string | null;
  topInset?: number;
  onSettingsPress?: () => void;
  joinCode?: string;
  isOwner?: boolean;
  showJoinCode?: boolean;
}

const RoomHeader: React.FC<RoomHeaderProps> = ({
  roomName,
  members,
  coverImage,
  roomDp,
  topInset = 0,
  onSettingsPress,
  joinCode,
  isOwner,
  showJoinCode,
}) => {
  const { isDark } = useTheme();
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const hasBackdrop = !backdropFailed && coverImage && (
    coverImage.startsWith('https://') || coverImage.startsWith('http://')
  );
  const hasRoomDp = !!roomDp && (roomDp.startsWith('https://') || roomDp.startsWith('http://'));

  const memberCount = members.length;

  const handleCopyCode = async () => {
    if (!joinCode) return;
    try {
      await Clipboard.setStringAsync(joinCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy join code:', err);
    }
  };

  const shouldShowJoinCode = showJoinCode && !isOwner ? true : showJoinCode;

  return (
    <View style={styles.container}>
      {/* Cover Image Backdrop */}
      <View style={styles.backdropWrap}>
        {hasBackdrop ? (
          <ExpoImage
            source={{ uri: coverImage! }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            onError={() => setBackdropFailed(true)}
            transition={300}
          />
        ) : (
          <ExpoImage
            source={BACKDROP_FALLBACK}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
          />
        )}
        {/* Dark gradient overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.4)', 'rgba(8,8,16,0.95)']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Content — left-aligned layout */}
      <View style={[styles.content, { paddingTop: topInset + 56 }]}>
        <View style={styles.mainRow}>
          {/* Room Avatar — left side */}
          <View style={styles.avatarContainer}>
            {hasRoomDp ? (
              <ExpoImage
                source={{ uri: roomDp! }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarGradient}
              >
                <Ionicons name="infinite" size={36} color="#fff" />
              </LinearGradient>
            )}
          </View>

          {/* Info Column — right of avatar */}
          <View style={styles.infoCol}>
            <Text style={styles.roomName} numberOfLines={1}>
              {roomName}
            </Text>
            <Text style={styles.subtitle}>
              Room · {memberCount} member{memberCount !== 1 ? 's' : ''}
            </Text>
            
            {/* Member avatars + Settings pill */}
            <View style={styles.bottomRow}>
              <View style={styles.memberRow}>
                <AvatarStack members={members} size={24} />
                {memberCount > 3 && (
                  <View style={styles.overflowPill}>
                    <Text style={styles.overflowText}>+{memberCount - 3}</Text>
                  </View>
                )}
              </View>

              <View style={styles.rightColumn}>
                {/* Room Settings Pill — right side */}
                <TouchableOpacity
                  onPress={onSettingsPress}
                  activeOpacity={0.7}
                  style={styles.settingsPill}
                >
                  <Ionicons name="settings-outline" size={12} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.settingsText}>Room settings</Text>
                </TouchableOpacity>

                {/* Join Code Copy Chip — below settings pill, only if visible */}
                {shouldShowJoinCode && joinCode && (
                  <TouchableOpacity
                    onPress={handleCopyCode}
                    activeOpacity={0.7}
                    style={[
                      styles.joinCodeChip,
                      codeCopied && styles.joinCodeChipCopied,
                    ]}
                  >
                    <Ionicons
                      name={codeCopied ? 'checkmark' : 'link'}
                      size={12}
                      color="rgba(255,255,255,0.7)"
                    />
                    <Text style={styles.joinCodeText}>
                      {codeCopied ? 'Copied!' : joinCode}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const AVATAR_SIZE = 76;

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    overflow: 'hidden',
    minHeight: 220,
  },
  backdropWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  avatarContainer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    marginTop: 2,
    shadowColor: '#6366f1',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  avatarGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  roomName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  overflowPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  overflowText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
  },
  settingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  settingsText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  joinCodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  joinCodeChipCopied: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderColor: 'rgba(34,197,94,0.3)',
  },
  joinCodeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
});

export default React.memo(RoomHeader);
