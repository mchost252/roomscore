import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SkeletonLoader() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#666',
    fontSize: 16,
  },
});
