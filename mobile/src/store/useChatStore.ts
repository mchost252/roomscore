import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'delivered' | 'seen';
  replyTo?: { id: string; text: string; senderName: string } | null;
  reactions?: { emoji: string; count: number; userReacted: boolean }[];
  isVoiceNote?: boolean;
}

interface ChatState {
  // Active conversation messages (keyed by conversationId)
  messages: Record<string, ChatMessage[]>;
  // Typing indicators (keyed by conversationId -> userId)
  typingUsers: Record<string, Set<string>>;
  // Active conversation ID
  activeConversationId: string | null;

  // Actions
  setActiveConversation: (id: string | null) => void;
  appendMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: ChatMessage['status']) => void;
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  setTypingUser: (conversationId: string, userId: string, isTyping: boolean) => void;
  addReaction: (conversationId: string, messageId: string, emoji: string) => void;
  removeReaction: (conversationId: string, messageId: string, emoji: string) => void;
  clearConversation: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  typingUsers: {},
  activeConversationId: null,

  setActiveConversation: (id) => set({ activeConversationId: id }),

  appendMessage: (conversationId, message) => {
    const current = get().messages[conversationId] || [];
    // Prevent duplicates
    if (current.some((m) => m.id === message.id)) return;
    set({
      messages: {
        ...get().messages,
        [conversationId]: [...current, message],
      },
    });
  },

  updateMessageStatus: (conversationId, messageId, status) => {
    const current = get().messages[conversationId] || [];
    set({
      messages: {
        ...get().messages,
        [conversationId]: current.map((m) =>
          m.id === messageId ? { ...m, status } : m
        ),
      },
    });
  },

  setMessages: (conversationId, messages) => {
    set({
      messages: {
        ...get().messages,
        [conversationId]: messages,
      },
    });
  },

  setTypingUser: (conversationId, userId, isTyping) => {
    const current = new Set(get().typingUsers[conversationId] || []);
    if (isTyping) {
      current.add(userId);
    } else {
      current.delete(userId);
    }
    set({
      typingUsers: {
        ...get().typingUsers,
        [conversationId]: current,
      },
    });
  },

  addReaction: (conversationId, messageId, emoji) => {
    const current = get().messages[conversationId] || [];
    set({
      messages: {
        ...get().messages,
        [conversationId]: current.map((m) => {
          if (m.id !== messageId) return m;
          const reactions = m.reactions || [];
          const existing = reactions.find((r) => r.emoji === emoji);
          if (existing) {
            return {
              ...m,
              reactions: reactions.map((r) =>
                r.emoji === emoji
                  ? { ...r, count: r.count + 1, userReacted: true }
                  : r
              ),
            };
          }
          return {
            ...m,
            reactions: [...reactions, { emoji, count: 1, userReacted: true }],
          };
        }),
      },
    });
  },

  removeReaction: (conversationId, messageId, emoji) => {
    const current = get().messages[conversationId] || [];
    set({
      messages: {
        ...get().messages,
        [conversationId]: current.map((m) => {
          if (m.id !== messageId) return m;
          const reactions = m.reactions || [];
          return {
            ...m,
            reactions: reactions
              .map((r) =>
                r.emoji === emoji
                  ? { ...r, count: r.count - 1, userReacted: false }
                  : r
              )
              .filter((r) => r.count > 0),
          };
        }),
      },
    });
  },

  clearConversation: (conversationId) => {
    const { [conversationId]: _, ...rest } = get().messages;
    set({ messages: rest });
  },
}));
