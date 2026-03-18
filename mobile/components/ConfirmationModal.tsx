import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDark: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export default function ConfirmationModal({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDark,
  onConfirm,
  onCancel,
  destructive = false,
}: Props) {
  const bg = isDark ? 'rgba(20,20,35,0.95)' : 'rgba(255,255,255,0.95)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const textC = isDark ? '#f1f5f9' : '#1e293b';
  const subC = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
  
  const confirmBg = destructive ? '#ef4444' : '#6366f1';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
        )}
        
        <Pressable 
          style={styles.cardWrapper}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Space-gradient halo behind card */}
          <LinearGradient
            colors={
              destructive
                ? ['rgba(248,113,113,0.22)','rgba(30,64,175,0.0)']
                : ['rgba(94,92,255,0.28)','rgba(14,165,233,0.0)']
            }
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.glow}
          />

          <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>
            <View style={styles.iconWrap}>
              <LinearGradient
                colors={
                  destructive
                    ? ['rgba(248,113,113,0.35)','rgba(239,68,68,0.05)']
                    : ['rgba(129,140,248,0.38)','rgba(56,189,248,0.05)']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconCircle}
              >
                <Ionicons 
                  name={destructive ? 'warning-outline' : 'information-circle-outline'} 
                  size={28} 
                  color={confirmBg} 
                />
              </LinearGradient>
            </View>
            
            <Text style={[styles.title, { color: textC }]}>{title}</Text>
            <Text style={[styles.message, { color: subC }]}>{message}</Text>
            
            <View style={styles.btnRow}>
              <TouchableOpacity 
                style={[styles.btn, styles.cancelBtn, { borderColor: border, backgroundColor: isDark ? 'rgba(15,23,42,0.7)' : 'rgba(248,250,252,0.9)' }]} 
                onPress={onCancel}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelText, { color: textC }]}>{cancelText}</Text>
              </TouchableOpacity>
              
              <LinearGradient
                colors={
                  destructive
                    ? ['#f97373','#ef4444']
                    : ['#6366f1','#8b5cf6']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btn}
              >
                <TouchableOpacity
                  style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
                  onPress={onConfirm}
                  activeOpacity={0.85}
                >
                  <Text style={styles.confirmText}>{confirmText}</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 360,
  },
  glow: {
    position: 'absolute',
    top: -40,
    left: -20,
    right: -20,
    height: 160,
    borderRadius: 60,
    opacity: 0.8,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 24,
  },
  iconWrap: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
