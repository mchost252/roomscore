import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
export function PremiumBadge() {
  return (
    <View style={[styles.wrap, { backgroundColor: 'rgba(250,204,21,0.2)', borderColor: '#facc15' }]}>
      <Ionicons name="diamond" size={12} color="#facc15" />
      <Text style={[styles.txt, { color: '#facc15' }]}>PREMIUM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
  },
  txt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});

export default PremiumBadge;
