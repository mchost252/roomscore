import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  suggestion: any;
  onAccept: () => void;
  onDismiss: () => void;
}

export default function SmartSuggestionCard({ suggestion, onAccept, onDismiss }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{suggestion.title}</Text>
      <Text style={styles.message}>{suggestion.message}</Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
        {suggestion.action && (
          <TouchableOpacity onPress={onAccept} style={styles.acceptButton}>
            <Text style={styles.acceptText}>{suggestion.action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  dismissButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dismissText: {
    color: 'rgba(255,255,255,0.6)',
  },
  acceptButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptText: {
    color: '#fff',
    fontWeight: '600',
  },
});
