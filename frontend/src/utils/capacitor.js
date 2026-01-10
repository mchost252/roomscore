/**
 * Capacitor Native Utilities
 * Handles native device features for iOS/Android
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Check if running on a native platform (iOS/Android)
 */
export const isNativePlatform = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Get the current platform
 * @returns {'ios' | 'android' | 'web'}
 */
export const getPlatform = () => {
  return Capacitor.getPlatform();
};

/**
 * Initialize Capacitor plugins on app start
 */
export const initializeCapacitor = async () => {
  if (!isNativePlatform()) {
    console.log('Running on web - Capacitor native features disabled');
    return;
  }

  try {
    // Hide splash screen after app is ready
    await SplashScreen.hide();

    // Set up status bar
    await setupStatusBar();

    // Set up keyboard listeners
    setupKeyboardListeners();

    // Set up app state listeners
    setupAppStateListeners();

    // Request push notification permissions
    await setupPushNotifications();

    console.log('Capacitor initialized successfully');
  } catch (error) {
    console.error('Error initializing Capacitor:', error);
  }
};

/**
 * Configure status bar appearance
 */
export const setupStatusBar = async () => {
  if (!isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    
    if (getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#5865F2' });
    }
  } catch (error) {
    console.error('Error setting up status bar:', error);
  }
};

/**
 * Set up keyboard listeners for mobile
 */
export const setupKeyboardListeners = () => {
  if (!isNativePlatform()) return;

  Keyboard.addListener('keyboardWillShow', (info) => {
    document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
    document.body.classList.add('keyboard-open');
  });

  Keyboard.addListener('keyboardWillHide', () => {
    document.body.style.setProperty('--keyboard-height', '0px');
    document.body.classList.remove('keyboard-open');
  });
};

/**
 * Set up app state listeners (foreground/background)
 */
export const setupAppStateListeners = () => {
  if (!isNativePlatform()) return;

  App.addListener('appStateChange', ({ isActive }) => {
    console.log('App state changed. Is active:', isActive);
    // You can trigger data refresh when app comes to foreground
    if (isActive) {
      window.dispatchEvent(new CustomEvent('app:foreground'));
    } else {
      window.dispatchEvent(new CustomEvent('app:background'));
    }
  });

  App.addListener('appUrlOpen', (data) => {
    console.log('App opened with URL:', data.url);
    // Handle deep links here
    window.dispatchEvent(new CustomEvent('app:deeplink', { detail: data }));
  });

  // Handle back button on Android
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });
};

/**
 * Set up push notifications
 */
export const setupPushNotifications = async () => {
  if (!isNativePlatform()) return null;

  try {
    // Request permission
    const permStatus = await PushNotifications.requestPermissions();
    
    if (permStatus.receive === 'granted') {
      // Register with APNS/FCM
      await PushNotifications.register();

      // Listen for registration token
      PushNotifications.addListener('registration', (token) => {
        console.log('Push registration token:', token.value);
        // Send this token to your backend
        window.dispatchEvent(new CustomEvent('push:registered', { detail: token }));
      });

      // Listen for registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
      });

      // Listen for incoming notifications when app is in foreground
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received:', notification);
        window.dispatchEvent(new CustomEvent('push:received', { detail: notification }));
      });

      // Listen for notification taps
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('Push notification action:', action);
        window.dispatchEvent(new CustomEvent('push:action', { detail: action }));
      });

      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error setting up push notifications:', error);
    return false;
  }
};

/**
 * Schedule a local notification
 */
export const scheduleLocalNotification = async (options) => {
  if (!isNativePlatform()) {
    // Fall back to web notifications
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(options.title, { body: options.body });
    }
    return;
  }

  try {
    await LocalNotifications.schedule({
      notifications: [{
        title: options.title,
        body: options.body,
        id: options.id || Date.now(),
        schedule: options.schedule || { at: new Date(Date.now() + 1000) },
        sound: options.sound || 'default',
        actionTypeId: options.actionTypeId,
        extra: options.extra
      }]
    });
  } catch (error) {
    console.error('Error scheduling local notification:', error);
  }
};

/**
 * Trigger haptic feedback
 */
export const hapticFeedback = async (style = 'medium') => {
  if (!isNativePlatform()) return;

  try {
    const impactStyle = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy
    }[style] || ImpactStyle.Medium;

    await Haptics.impact({ style: impactStyle });
  } catch (error) {
    console.error('Error triggering haptic:', error);
  }
};

/**
 * Trigger haptic notification
 */
export const hapticNotification = async (type = 'success') => {
  if (!isNativePlatform()) return;

  try {
    await Haptics.notification({ type });
  } catch (error) {
    console.error('Error triggering haptic notification:', error);
  }
};

/**
 * Get app info
 */
export const getAppInfo = async () => {
  if (!isNativePlatform()) {
    return { version: '1.0.0', build: 'web' };
  }

  try {
    const info = await App.getInfo();
    return info;
  } catch (error) {
    console.error('Error getting app info:', error);
    return null;
  }
};

/**
 * Check for app updates (used with Appflow Live Updates)
 */
export const checkForUpdates = async () => {
  // This will be implemented when Appflow is configured
  // The @capacitor/live-updates plugin handles this automatically
  console.log('Update check - Appflow Live Updates not yet configured');
};

export default {
  isNativePlatform,
  getPlatform,
  initializeCapacitor,
  setupStatusBar,
  setupPushNotifications,
  scheduleLocalNotification,
  hapticFeedback,
  hapticNotification,
  getAppInfo,
  checkForUpdates
};
