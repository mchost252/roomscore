import api from './api';

class PushNotificationManager {
  constructor() {
    this.registration = null;
    this.subscription = null;
  }

  // Check if push notifications are supported
  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  // Convert VAPID key from base64 to Uint8Array
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Request notification permission
  async requestPermission() {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported in this browser');
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  // Register service worker
  async registerServiceWorker() {
    if (!this.isSupported()) {
      throw new Error('Service Workers are not supported');
    }

    try {
      // Check if already registered
      const existingRegistration = await navigator.serviceWorker.getRegistration();
      if (existingRegistration) {
        this.registration = existingRegistration;
        console.log('Service Worker already registered');
        return this.registration;
      }

      // Register without awaiting - returns immediately with registration object
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('Service Worker registration initiated');
      
      // Let it become ready in background without blocking
      this.registration.installing?.addEventListener('statechange', (e) => {
        if (e.target.state === 'activated') {
          console.log('Service Worker is now active');
        }
      });
      
      return this.registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }

  // Subscribe to push notifications
  async subscribe() {
    try {
      // Get VAPID public key from server
      const { data } = await api.get('/push/vapid-public-key');
      const publicKey = data.publicKey;

      if (!publicKey) {
        throw new Error('Failed to get VAPID public key');
      }

      // Ensure service worker is registered
      if (!this.registration) {
        await this.registerServiceWorker();
      }

      // Subscribe to push notifications
      const applicationServerKey = this.urlBase64ToUint8Array(publicKey);
      
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      // Send subscription to server
      await api.post('/push/subscribe', {
        subscription: this.subscription.toJSON()
      });

      console.log('Push notification subscription successful');
      return this.subscription;
    } catch (error) {
      console.error('Push notification subscription failed:', error);
      throw error;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribe() {
    try {
      if (!this.subscription) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          this.subscription = await registration.pushManager.getSubscription();
        }
      }

      if (this.subscription) {
        await api.post('/push/unsubscribe', {
          endpoint: this.subscription.endpoint
        });

        await this.subscription.unsubscribe();
        this.subscription = null;
        console.log('Unsubscribed from push notifications');
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      throw error;
    }
  }

  // Check if already subscribed
  async getSubscription() {
    try {
      if (!this.isSupported()) {
        return null;
      }

      // Use getRegistration instead of ready to avoid blocking
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        return null;
      }
      
      this.subscription = await registration.pushManager.getSubscription();
      return this.subscription;
    } catch (error) {
      console.error('Error getting subscription:', error);
      return null;
    }
  }

  // Initialize push notifications
  async initialize() {
    try {
      if (!this.isSupported()) {
        console.warn('Push notifications not supported');
        return false;
      }

      // Check current permission
      const currentPermission = Notification.permission;
      
      if (currentPermission === 'denied') {
        console.warn('Push notifications are blocked');
        return false;
      }

      // Register service worker
      await this.registerServiceWorker();

      // Check if already subscribed
      const existingSubscription = await this.getSubscription();
      
      if (existingSubscription) {
        console.log('Already subscribed to push notifications');
        return true;
      }

      // If permission is default, don't auto-subscribe
      if (currentPermission === 'default') {
        return false;
      }

      // If permission is granted but not subscribed, subscribe
      if (currentPermission === 'granted') {
        await this.subscribe();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      return false;
    }
  }

  // Enable push notifications (request permission and subscribe)
  async enable() {
    try {
      const granted = await this.requestPermission();
      
      if (!granted) {
        throw new Error('Notification permission denied');
      }

      await this.subscribe();
      return true;
    } catch (error) {
      console.error('Error enabling push notifications:', error);
      throw error;
    }
  }

  // Check notification permission status
  getPermissionStatus() {
    if (!this.isSupported()) {
      return 'unsupported';
    }
    return Notification.permission;
  }
}

// Export singleton instance
const pushNotificationManager = new PushNotificationManager();
export default pushNotificationManager;
