import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function DevToolsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!__DEV__) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} style={styles.header}>
        <Text style={styles.headerText}>Developer Tools</Text>
        <Text style={styles.arrow}>{isExpanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.content}>
          <Text style={styles.text}>DevTools ready for integration</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerText: {
    color: '#fff',
    fontWeight: '600',
  },
  arrow: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  content: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  text: {
    color: 'rgba(255,255,255,0.6)',
  },
});
