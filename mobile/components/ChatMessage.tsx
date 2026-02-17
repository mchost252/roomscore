import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { KRIOS_COLORS } from '../constants/colors';

interface ChatMessageProps {
  text: string;
  isUser?: boolean;
  color?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ text, isUser = false, color }) => {
  return (
    <View style={[styles.container, isUser && styles.userContainer]}>
      <View
        style={[
          styles.bubble,
          isUser && styles.userBubble,
          { backgroundColor: color || (isUser ? KRIOS_COLORS.accent.blue : KRIOS_COLORS.accent.purple) },
        ]}
      >
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
});
