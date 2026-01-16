import api, { API_BASE_URL } from './api';

// Convert base64 public key to Uint8Array
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export async function ensureServiceWorkerRegistered() {
  if (!('serviceWorker' in navigator)) return null;
  // Vite will serve /sw.js from public
  const reg = await navigator.serviceWorker.register('/sw.js');
  return reg;
}

export async function getPushPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') {
    return await Notification.requestPermission();
  }
  return Notification.permission;
}

export async function subscribeToPush() {
  const reg = await ensureServiceWorkerRegistered();
  if (!reg || !('PushManager' in window)) {
    return { success: false, message: 'Push not supported on this device/browser' };
  }

  const perm = await getPushPermission();
  if (perm !== 'granted') {
    return { success: false, message: 'Push permission not granted' };
  }

  const keyRes = await api.get('/push/vapid-public-key');
  const publicKey = keyRes.data.publicKey;
  if (!publicKey) {
    return { success: false, message: 'Push not configured on server (missing VAPID key)' };
  }

  const existing = await reg.pushManager.getSubscription();
  const subscription = existing || await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });

  await api.post('/push/subscribe', { subscription });
  return { success: true };
}

export async function unsubscribeFromPush() {
  const reg = await ensureServiceWorkerRegistered();
  if (!reg) return { success: true };

  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
  }

  await api.post('/push/unsubscribe');
  return { success: true };
}
