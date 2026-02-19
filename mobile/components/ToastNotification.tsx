import React from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ToastNotificationProps {
  message: string;
  onUndo?: () => void;
  onDismiss: () => void;
  animatedValue: Animated.Value;
  theme: {
    success: string;
    text: string;
    surface: string;
    border: string;
    textTertiary: string;
  };
}

export default function ToastNotification({
  message,
  onUndo,
  onDismiss,
  animatedValue,
  theme,
}: ToastNotificationProps) {
  if (!message) return null;

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });

  return (
    <Animated.View 
      style={[
        styles.toast,
        { 
          backgroundColor: theme.surface,
          borderColor: theme.border,
          transform: [{ translateY }],
          opacity: animatedValue,
        }
      ]}
    >
      <View style={styles.toastContent}>
        <Ionicons name="checkmark-circle" size={20} color={theme.success} style={{ marginRight: 8 }} />
        <Text style={[styles.toastText, { color: theme.text }]}>{message}</Text>
      </View>
      
      {onUndo && (
        <TouchableOpacity style={styles.toastUndoButton} onPress={onUndo} activeOpacity={0.7}>
          <Text style={[styles.toastUndoText, { color: theme.success }]}>Undo</Text>
        </TouchableOpacity>
      )}
      
      <TouchableOpacity style={styles.toastDismiss} onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={16} color={theme.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  toastUndoButton: {
    marginLeft: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  toastUndoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toastDismiss: {
    marginLeft: 8,
    padding: 4,
  },
});