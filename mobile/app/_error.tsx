import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function ErrorBoundary() {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  useEffect(() => {
    console.error('❌ Error page shown with params:', params);
  }, [params]);
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚠️ Something went wrong</Text>
      <Text style={styles.subtitle}>The app encountered an error</Text>
      
      <ScrollView style={styles.errorBox}>
        <Text style={styles.errorText}>
          {params?.error || 'An unexpected error occurred'}
        </Text>
      </ScrollView>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={() => router.replace('/')}
      >
        <Text style={styles.buttonText}>Go Home</Text>
      </TouchableOpacity>
      
      <Text style={styles.hint}>
        Check the console logs for more details.{'\n'}
        Try running: expo start --clear
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#ef4444',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 15,
    borderRadius: 8,
    maxHeight: 300,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#991b1b',
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
