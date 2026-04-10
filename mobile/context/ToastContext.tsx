import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

export type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions | string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(null));
  }, [fadeAnim, slideAnim]);

  const showToast = useCallback((options: ToastOptions | string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const toastOpts = typeof options === 'string' ? { message: options } : options;
    setToast({
      message: toastOpts.message,
      type: toastOpts.type || 'info',
      duration: toastOpts.duration || 3000,
    });

    slideAnim.setValue(-50);
    fadeAnim.setValue(0);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: Platform.OS === 'ios' ? insets.top + 10 : 40,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    timeoutRef.current = setTimeout(() => {
      hideToast();
    }, toastOpts.duration || 3000);
  }, [fadeAnim, slideAnim, hideToast, insets.top]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              backgroundColor: isDark ? 'rgba(30, 30, 40, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              pointerEvents: 'none',
            },
          ]}
        >
          <View style={[
            styles.iconContainer, 
            { backgroundColor: toast.type === 'success' ? '#22c55e' : toast.type === 'error' ? '#ef4444' : colors.primary }
          ]}>
            <Ionicons 
              name={toast.type === 'success' ? 'checkmark' : toast.type === 'error' ? 'close' : 'information'} 
              size={16} 
              color="#fff" 
            />
          </View>
          <Text style={[styles.message, { color: isDark ? '#fff' : '#000' }]} numberOfLines={2}>
            {toast.message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 9999,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});
