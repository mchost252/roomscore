import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LocalDirectMessage } from '../../services/sqliteService';

interface ChatBubbleProps {
  message: LocalDirectMessage;
  isMine: boolean;
  isDark: boolean;
  showTimestamp?: boolean;
  onRetry?: (msg: LocalDirectMessage) => void;
  onReply?: (msg: LocalDirectMessage) => void;
  onLongPress?: (msg: LocalDirectMessage) => void;
}

const ACCENT_COLOR = '#6366f1';
const VIOLET_ACCENT = '#8b5cf6';

const STATUS_ICONS: Record<string, { name: string; color: string }> = {
  sending: { name: 'time-outline', color: 'rgba(255,255,255,0.4)' },
  sent: { name: 'checkmark', color: 'rgba(255,255,255,0.5)' },
  delivered: { name: 'checkmark-done', color: 'rgba(255,255,255,0.5)' },
  read: { name: 'checkmark-done', color: '#60a5fa' },
  failed: { name: 'alert-circle', color: '#ef4444' },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

function ChatBubble({ 
  message, isMine, isDark, showTimestamp = true, 
  onRetry, onReply, onLongPress 
}: ChatBubbleProps) {
  const status = STATUS_ICONS[message.status] || STATUS_ICONS.sending;
  const hasReply = !!message.reply_to_text;
  const isFailed = message.status === 'failed';

  const bubbleBg = isMine 
    ? undefined 
    : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  
  const textColor = isMine ? '#ffffff' : isDark ? '#f1f5f9' : '#1e293b';
  const timeColor = isMine 
    ? 'rgba(255,255,255,0.5)' 
    : isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  const replyTextColor = isMine 
    ? 'rgba(255,255,255,0.7)' 
    : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const accentBarColor = isDark ? ACCENT_COLOR : '#818cf8';

  return (
    <View style={[styles.row, isMine ? styles.rowRight : styles.rowLeft]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={() => onReply?.(message)}
        onPress={isFailed ? () => onRetry?.(message) : undefined}
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          // Sharp bottom corner on sender's side (WhatsApp style)
          isMine 
            ? { borderBottomRightRadius: 4 } 
            : { borderBottomLeftRadius: 4 },
        ]}
      >
        {/* Gradient fill for sent bubbles */}
        {isMine && (
          <LinearGradient
            colors={[ACCENT_COLOR, '#7c3aed', VIOLET_ACCENT] as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              StyleSheet.absoluteFill, 
              { 
                borderRadius: 20, 
                borderBottomRightRadius: 4,
                opacity: 1,
              }
            ]}
          />
        )}

        {/* Glass fill for received bubbles */}
        {!isMine && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: 20,
                borderBottomLeftRadius: 4,
                backgroundColor: bubbleBg,
              },
            ]}
          />
        )}

        {/* Accent bar on received messages */}
        {!isMine && (
          <View
            style={[styles.accentBar, { backgroundColor: accentBarColor }]}
          />
        )}

        {/* Reply preview */}
        {hasReply && (
          <View
            style={[
              styles.replyPreview,
              {
                backgroundColor: isMine
                  ? 'rgba(255,255,255,0.12)'
                  : isDark
                  ? 'rgba(99,102,241,0.1)'
                  : 'rgba(99,102,241,0.06)',
                borderLeftColor: isMine ? 'rgba(255,255,255,0.3)' : ACCENT_COLOR,
              },
            ]}
          >
            <Text
              style={[styles.replyText, { color: replyTextColor }]}
              numberOfLines={1}
            >
              {message.reply_to_text}
            </Text>
          </View>
        )}

        {/* Message content */}
        <Text style={[styles.content, { color: textColor }]}>
          {message.content}
        </Text>

        {/* Timestamp + status row */}
        {showTimestamp && (
          <View style={styles.meta}>
            <Text style={[styles.time, { color: timeColor }]}>
              {formatTime(message.created_at)}
            </Text>
            {isMine && (
              <Ionicons
                name={status.name as any}
                size={13}
                color={status.color}
                style={styles.statusIcon}
              />
            )}
          </View>
        )}

        {/* Failed retry hint */}
        {isFailed && isMine && (
          <View style={styles.failedRow}>
            <Ionicons name="refresh" size={11} color="#ef4444" />
            <Text style={styles.failedText}>Tap to retry</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default memo(ChatBubble);

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 14,
    marginVertical: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowLeft: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    minWidth: 70,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    overflow: 'hidden',
  },
  bubbleMine: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 4,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
  },
  replyPreview: {
    borderLeftWidth: 2,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  replyText: {
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    fontSize: 15.5,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 3,
  },
  time: {
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  statusIcon: {
    marginLeft: 1,
  },
  failedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  failedText: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '600',
  },
});
