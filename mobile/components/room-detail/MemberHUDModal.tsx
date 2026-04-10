import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { RoomMember } from '../../types/room';

const { width: W, height: H } = Dimensions.get('window');

interface MemberHUDModalProps {
  visible: boolean;
  onClose: () => void;
  members: RoomMember[];
  isOwner: boolean;
  onKickMember?: (id: string) => void;
  onPromoteMember?: (id: string) => void;
}

export default function MemberHUDModal({
  visible,
  onClose,
  members,
  isOwner,
  onKickMember,
  onPromoteMember,
}: MemberHUDModalProps) {
  const { isDark, colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        
        <View style={[styles.container, { backgroundColor: isDark ? '#0a0a16' : '#fff', borderColor: colors.borderColor }]}>
          {/* Tactical Header */}
          <LinearGradient
            colors={isDark ? ['#1e1b4b', '#0a0a16'] : ['#f0f4ff', '#fff']}
            style={styles.header}
          >
            <View style={styles.headerTop}>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>SQUAD COMMAND</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {members.length} OPERATIVES ACTIVE
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {/* HUD Scanline Effect */}
            <View style={[styles.scanline, { backgroundColor: colors.primary, opacity: 0.1 }]} />
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.scroll}>
            {members.map((m, i) => (
              <View key={m.id || i} style={[styles.memberRow, { borderBottomColor: colors.borderColor }]}>
                <View style={styles.memberLeft}>
                  <View style={styles.avatarContainer}>
                    {m.avatar ? (
                      <Image source={{ uri: m.avatar }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
                        <Text style={[styles.avatarText, { color: colors.primary }]}>
                          {m.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.statusDot, { backgroundColor: m.isOnline ? '#22c55e' : '#64748b' }]} />
                  </View>
                  
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.text }]}>{m.username}</Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.roleBadge, { backgroundColor: i === 0 ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)' }]}>
                        <Text style={[styles.roleText, { color: i === 0 ? '#f59e0b' : '#6366f1' }]}>
                          {i === 0 ? 'COMMANDER' : 'OPERATIVE'}
                        </Text>
                      </View>
                      {m.aura && (
                        <Text style={[styles.auraText, { color: colors.textTertiary }]}>
                          AURA: {m.aura.toUpperCase()}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {isOwner && i !== 0 && (
                  <View style={styles.actions}>
                    <TouchableOpacity 
                      style={styles.actionIcon}
                      onPress={() => onPromoteMember?.(m.id)}
                    >
                      <Ionicons name="chevron-up-circle-outline" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionIcon}
                      onPress={() => onKickMember?.(m.id)}
                    >
                      <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          {/* Footer Branding */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textTertiary }]}>
              KRIOS TACTICAL INTERFACE v1.0.4
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  container: {
    width: '100%',
    maxWidth: 400,
    maxHeight: H * 0.7,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  scroll: {
    padding: 10,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#0a0a16',
  },
  memberInfo: {
    gap: 2,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 8,
    fontWeight: '800',
  },
  auraText: {
    fontSize: 8,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionIcon: {
    padding: 4,
  },
  footer: {
    padding: 15,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  footerText: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
