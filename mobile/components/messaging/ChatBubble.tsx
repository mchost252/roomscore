import React, { memo, useCallback } from 'react';
import { Text, StyleSheet, TouchableOpacity, View, Pressable, Image } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useBubbleStore } from '../../src/store/useBubbleStore';
import { LocalDirectMessage } from '../../services/sqliteService';
import MinimalBubble from './MinimalBubble';
import {
  GlassBubble,
  NeonBubble,
  GradientBubble,
  LiquidBubble,
  CyberBubble,
  OutlineBubble,
  ShadowBubble,
  PixelBubble,
  HologramBubble,
  CosmicBubble,
} from './BubbleStyles';
import MessageRow, { Reaction } from './MessageRow';
import ReactionPicker from './ReactionPicker';
import messageService from '../../services/messageService';

interface ChatBubbleProps {
  message: LocalDirectMessage;
  isMine: boolean;
  showTimestamp?: boolean;
  onRetry?: (msg: LocalDirectMessage) => void;
  onReply?: (msg: LocalDirectMessage) => void;
  onLongPress?: (msg: LocalDirectMessage) => void;
  reactions?: Reaction[];
  onReaction?: (emoji: string) => void;
  senderName?: string;
  senderAvatar?: string | null;
}

const ACCENT_COLOR = '#6366f1';

function BubbleContent({
  message,
  isMine,
  isDark,
}: {
  message: LocalDirectMessage;
  isMine: boolean;
  isDark: boolean;
}) {
  const hasReply = !!message.reply_to_text;
  const isFailed = message.status === 'failed';

  const textColor = isMine ? '#ffffff' : isDark ? '#f1f5f9' : '#1e293b';
  const replyTextColor = isMine
    ? 'rgba(255,255,255,0.7)'
    : isDark
    ? 'rgba(255,255,255,0.5)'
    : 'rgba(0,0,0,0.45)';

  return (
    <>
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

      {/* Failed retry hint */}
      {isFailed && isMine && (
        <View style={styles.failedRow}>
          <Text style={styles.failedText}>Tap to retry</Text>
        </View>
      )}
    </>
  );
}

function ChatBubble({
  message,
  isMine,
  showTimestamp = true,
  onRetry,
  onReply,
  onLongPress,
  reactions,
  onReaction,
  senderName,
  senderAvatar,
}: ChatBubbleProps) {
  const { isDark } = useTheme();
  const selectedStyle = useBubbleStore((s) => s.selectedStyle);
  const [pickerVisible, setPickerVisible] = React.useState(false);

  // Listen for global picker close events (e.g., scroll in chat)
  React.useEffect(() => {
    const unsub = messageService.on('picker:close_all', () => setPickerVisible(false));
    return () => unsub();
  }, []);

  const handleLongPress = useCallback(() => {
    // Show reaction picker only
    setPickerVisible(true);
    if (onLongPress) {
      onLongPress(message);
    }
  }, [message, onLongPress]);

  const handlePress = useCallback(() => {
    setPickerVisible(false);
    if (message.status === 'failed' && onRetry) {
      onRetry(message);
    }
  }, [message, onRetry]);

  // Render the correct bubble style
  const content = (
    <BubbleContent message={message} isMine={isMine} isDark={isDark} />
  );

  const renderBubble = () => {
    switch (selectedStyle) {
      case 'glass':
        return <GlassBubble isMine={isMine}>{content}</GlassBubble>;
      case 'neon':
        return <NeonBubble isMine={isMine}>{content}</NeonBubble>;
      case 'gradient':
        return <GradientBubble isMine={isMine}>{content}</GradientBubble>;
      case 'liquid':
        return <LiquidBubble isMine={isMine}>{content}</LiquidBubble>;
      case 'cyber':
        return <CyberBubble isMine={isMine}>{content}</CyberBubble>;
      case 'outline':
        return <OutlineBubble isMine={isMine}>{content}</OutlineBubble>;
      case 'shadow':
        return <ShadowBubble isMine={isMine}>{content}</ShadowBubble>;
      case 'pixel':
        return <PixelBubble isMine={isMine}>{content}</PixelBubble>;
      case 'hologram':
        return <HologramBubble isMine={isMine}>{content}</HologramBubble>;
      case 'cosmic':
        return <CosmicBubble isMine={isMine}>{content}</CosmicBubble>;
      case 'flame':
        // Flame is reserved for experimentation — renders minimal until implemented
        return <MinimalBubble isMine={isMine}>{content}</MinimalBubble>;
      case 'minimal':
      default:
        return <MinimalBubble isMine={isMine}>{content}</MinimalBubble>;
    }
  };

  return (
    <View style={{ position: 'relative' }}>
      {!isMine && (senderName || senderAvatar) && (
        <View style={styles.sender}>
          {!!senderAvatar && <Image source={{ uri: senderAvatar }} style={styles.senderAvatar} />}
          <Text style={styles.senderName} numberOfLines={1}>{senderName || 'Member'}</Text>
        </View>
      )}
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={handleLongPress}
        onPress={handlePress}
      >
        <MessageRow
          isMine={isMine}
          status={message.status}
          timestamp={message.created_at}
          showTimestamp={showTimestamp}
          reactions={reactions}
        >
          {renderBubble()}
        </MessageRow>
      </TouchableOpacity>
      {pickerVisible && (
        <Pressable
          style={{
            position: 'absolute',
            top: -100,
            left: -50,
            right: -50,
            bottom: -200,
            zIndex: 9998,
          }}
          onPress={() => setPickerVisible(false)}
          accessible={false}
        />
      )}
      <View style={[styles.pickerOverlay, pickerVisible ? { zIndex: 9999 } : {}]}>
        <ReactionPicker
          visible={pickerVisible}
          selected={(reactions || []).find(r => r.reacted)?.emoji || null}
          onSelect={async (emoji: string) => {
            setPickerVisible(false);
            if (onReaction) {
              onReaction(emoji);
              return;
            }
            const msgId = message.id || message.local_id;
            if (!msgId) return;
            try {
              const selected = (reactions || []).find(r => r.reacted)?.emoji || null;
              if (selected === emoji) {
                await messageService.removeMessageReaction(msgId, emoji);
              } else {
                await messageService.addMessageReaction(msgId, emoji);
              }
            } catch (e) {
              console.warn('Reaction toggle failed:', e);
            }
          }}
          onMore={() => setPickerVisible(false)}
        />
      </View>
    </View>
  );
}

export default memo(ChatBubble, (prevProps, nextProps) => {
  const reactionsEqual = (a?: Reaction[], b?: Reaction[]) => {
    if (a === b) return true;
    const sa = (a || []).map(r => `${r.emoji}:${r.count}:${r.reacted ? 1 : 0}`).join(',');
    const sb = (b || []).map(r => `${r.emoji}:${r.count}:${r.reacted ? 1 : 0}`).join(',');
    return sa === sb;
  };

  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.isMine === nextProps.isMine &&
    prevProps.showTimestamp === nextProps.showTimestamp &&
    reactionsEqual(prevProps.reactions, nextProps.reactions)
  );
});

const styles = StyleSheet.create({
  sender: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 18,
    marginBottom: 2,
  },
  senderAvatar: { width: 20, height: 20, borderRadius: 10 },
  senderAvatarFallback: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#64748b' },
  senderName: { fontSize: 11, fontWeight: '600', color: '#64748b' },
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
  failedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  pickerOverlay: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  failedText: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '600',
  },
});
