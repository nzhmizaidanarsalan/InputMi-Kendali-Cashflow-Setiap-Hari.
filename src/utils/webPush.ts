import { db } from '../lib/firebase';
import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

// Default generated VAPID Public Key for InputMi
export const DEFAULT_VAPID_PUBLIC_KEY =
  'BCO8ctQzOuEy5cjjPOLGmTlFYT6R9DsKVwl-3w-d3oSLxhNGbYgrwBebZbtMj87nCIf1RnlzTg6OZ0zPrrFCik0';

/**
 * Convert base64 VAPID public key to Uint8Array for PushManager
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks whether Web Push and Service Workers are supported in the current environment
 */
export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current browser notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isWebPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Register Service Worker for InputMi
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isWebPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.error('Service Worker registration error:', error);
    return null;
  }
}

/**
 * Creates a unique deterministic doc ID for a subscription endpoint
 */
export function getSubscriptionDocId(endpoint: string): string {
  // Use a hash-safe string derived from the end of the endpoint
  try {
    let hash = 0;
    for (let i = 0; i < endpoint.length; i++) {
      hash = (hash << 5) - hash + endpoint.charCodeAt(i);
      hash |= 0;
    }
    const cleanId = Math.abs(hash).toString(36);
    return `sub_${cleanId}`;
  } catch (e) {
    return `sub_${Date.now()}`;
  }
}

/**
 * Subscribe current browser to Web Push notifications
 */
export async function subscribeToWebPush(
  userId: string
): Promise<{ success: boolean; subscription?: PushSubscription; error?: string }> {
  if (!isWebPushSupported()) {
    return { success: false, error: 'Browser ini tidak mendukung Web Push Notifications.' };
  }

  try {
    // 1. Explicitly request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        error:
          permission === 'denied'
            ? 'Izin notifikasi diblokir pada browser Anda. Aktifkan izin pada pengaturan browser untuk menerima pengingat.'
            : 'Izin notifikasi tidak diberikan.',
      };
    }

    // 2. Register / retrieve service worker
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await registerServiceWorker();
    }
    if (!registration) {
      return { success: false, error: 'Gagal mengaktifkan Service Worker.' };
    }

    await navigator.serviceWorker.ready;

    // 3. Fetch server public key or use default fallback
    let publicKey = DEFAULT_VAPID_PUBLIC_KEY;
    try {
      const res = await fetch('/api/push-vapid-key');
      if (res.ok) {
        const data = await res.json();
        if (data.publicKey) publicKey = data.publicKey;
      }
    } catch (e) {
      // Use fallback
    }

    // 4. Subscribe with PushManager
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const subJson = subscription.toJSON();
    const docId = getSubscriptionDocId(subscription.endpoint);

    // 5. Persist to Firestore under /users/{userId}/pushSubscriptions/{docId}
    const subData = {
      id: docId,
      userId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subJson.keys?.p256dh || '',
        auth: subJson.keys?.auth || '',
      },
      userAgent: navigator.userAgent || 'Unknown Browser',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      active: true,
    };

    try {
      const subDocRef = doc(db, 'users', userId, 'pushSubscriptions', docId);
      await setDoc(subDocRef, subData, { merge: true });
    } catch (dbErr) {
      console.warn('Could not write subscription directly to Firestore:', dbErr);
    }

    // 6. Also sync with backend /api/push-subscribe
    try {
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscription: subJson,
          docId,
        }),
      });
    } catch (apiErr) {
      // Backend sync error non-fatal
    }

    return { success: true, subscription };
  } catch (err: any) {
    console.error('subscribeToWebPush error:', err);
    return { success: false, error: err?.message || 'Terjadi kesalahan saat mengaktifkan notifikasi.' };
  }
}

/**
 * Unsubscribe current browser from Web Push notifications
 */
export async function unsubscribeFromWebPush(userId: string): Promise<boolean> {
  if (!isWebPushSupported()) return true;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const docId = getSubscriptionDocId(subscription.endpoint);

        // Delete from Firestore
        try {
          const subDocRef = doc(db, 'users', userId, 'pushSubscriptions', docId);
          await deleteDoc(subDocRef);
        } catch (e) {
          // Ignore
        }

        // Notify backend
        try {
          await fetch('/api/push-subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, endpoint: subscription.endpoint, docId }),
          });
        } catch (e) {
          // Ignore
        }

        await subscription.unsubscribe();
      }
    }
    return true;
  } catch (err) {
    console.error('unsubscribeFromWebPush error:', err);
    return false;
  }
}

/**
 * Check if the current browser already has an active push subscription
 */
export async function checkCurrentSubscription(): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch (err) {
    return false;
  }
}

/**
 * Triggers backend check for due liabilities
 */
export async function checkDueLiabilitiesReminders(
  userId: string,
  liabilities: any[]
): Promise<any> {
  try {
    const res = await fetch('/api/check-reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        timezone: 'Asia/Jakarta',
        liabilities,
      }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Non-blocking
  }
  return null;
}
