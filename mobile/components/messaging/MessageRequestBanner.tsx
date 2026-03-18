import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface MessageRequestBannerProps {
  isDark: boolean;
  username: string;
  message?: string;
  loading?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onBlock: () => void;
}

const ACCENT_COLOR = '#6366f1';
const VIOLET_ACCENT = '#8b5cf6';

function MessageRequestBanner({ 
  isDark, username, message, loading, onAccept, onDecline, onBlock 
}: MessageRequestBannerProps) {
  const bg = isDark ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.06)';
  const borderColor = isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.12)';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subtextColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';

  return (
    <View style={[styles.container, { backgroundColor: bg, borderColor, opacity: loading ? 0.7 : 1 }]}>
      <View style={styles.infoRow}>
        <View style={[styles.iconWrap, {
          backgroundColor: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)'
        }]}>
          <Ionicons name="mail-unread-outline" size={20} color={VIOLET_ACCENT} />
        </View>
        <View style={styles.infoText}>
          <Text style={[styles.title, { color: textColor }]}>
            Message request from {username}
          </Text>
          <Text style={[styles.subtitle, { color: subtextColor }]}>
            {message ? `"${message}"\n\nAccept to reply. They won't see this until you do.` : "Accept to start messaging. They won't see this."}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {/* Accept */}
        <TouchableOpacity 
          onPress={onAccept} 
          style={styles.acceptBtn} 
          activeOpacity={0.8}
          disabled={loading}
        >
          <LinearGradient colors={[ACCENT_COLOR, VIOLET_ACCENT] as any} style={styles.acceptGrad}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Ionicons name="checkmark" size={15} color="#fff" />
                <Text style={styles.acceptText}>Accept</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Decline */}
        <TouchableOpacity
          onPress={onDecline}
          style={[styles.secondaryBtn, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }]}
          activeOpacity={0.8}
          disabled={loading}
        >
          <Text style={[styles.secondaryText, { color: subtextColor }]}>Decline</Text>
        </TouchableOpacity>

        {/* Block */}
        <TouchableOpacity
          onPress={onBlock}
          style={[styles.secondaryBtn, {
            backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)',
            borderColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
          }]}
          activeOpacity={0.8}
          disabled={loading}
        >
          <Text style={styles.blockText}>Block</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default memo(MessageRequestBanner);

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    marginVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    flex: 1,
  },
  acceptGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 20,
  },
  acceptText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  blockText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
});
