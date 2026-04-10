import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  withTiming, 
  runOnJS,
  Easing
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from './ThemeContext';

interface NotificationConfig {
  id: string;
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  durationMs?: number;
}

interface NotificationContextType {
  showNotification: (config: Omit<NotificationConfig, 'id'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useAppNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useAppNotification must be used within NotificationProvider');
  return ctx;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [activeNotif, setActiveNotif] = useState<NotificationConfig | null>(null);
  const translateY = useSharedValue(-150); // Start hidden above screen
  const opacity = useSharedValue(0);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hideNotification = useCallback(() => {
    'worklet';
    translateY.value = withTiming(-150, { duration: 300, easing: Easing.in(Easing.ease) }, (finished) => {
      if (finished) {
        runOnJS(setActiveNotif)(null);
      }
    });
    opacity.value = withTiming(0, { duration: 300 });
  }, [translateY, opacity]);

  const showNotification = useCallback((config: Omit<NotificationConfig, 'id'>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    setActiveNotif({ ...config, id: Date.now().toString() });
    
    // Slide in
    translateY.value = withSpring(insets.top + 10, { damping: 15, stiffness: 150 });
    opacity.value = withTiming(1, { duration: 200 });

    // Auto dismiss
    const duration = config.durationMs || 4000;
    timeoutRef.current = setTimeout(() => {
      hideNotification();
    }, duration);
  }, [insets.top, translateY, opacity, hideNotification]);

  const handlePress = () => {
    if (activeNotif?.onPress) {
      activeNotif.onPress();
    }
    hideNotification();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleGestureEvent = (event: any) => {
    if (event.nativeEvent.translationY < -20) {
      hideNotification();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';
  const borderCol = isDark ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.2)';

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      
      {activeNotif && (
        <PanGestureHandler onGestureEvent={handleGestureEvent}>
          <Animated.View style={[styles.overlay, animatedStyle]}>
            <Pressable 
              onPress={handlePress}
              style={[
                styles.pill, 
                { backgroundColor: cardBg, borderColor: borderCol }
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)' }]}>
                <Ionicons name={activeNotif.icon || 'notifications'} size={18} color="#8B5CF6" />
              </View>
              
              <View style={styles.textContainer}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {activeNotif.title}
                </Text>
                {activeNotif.message && (
                  <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={1}>
                    {activeNotif.message}
                  </Text>
                )}
              </View>
              
              {activeNotif.onPress && (
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              )}
            </Pressable>
          </Animated.View>
        </PanGestureHandler>
      )}
    </NotificationContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    paddingHorizontal: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 13,
    marginTop: 2,
  },
});