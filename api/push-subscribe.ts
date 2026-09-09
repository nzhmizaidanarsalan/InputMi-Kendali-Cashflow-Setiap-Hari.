import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const config = {
  maxDuration: 15,
};

let cachedAdminDb: any = null;

function getFirebaseAdminDb(): any {
  if (cachedAdminDb) return cachedAdminDb;

  let cfg: any = {
    projectId: 'gen-lang-client-0875952108',
    firestoreDatabaseId: 'ai-studio-inputmi-19df9199-e84a-44e9-ab60-ac7a7581a473',
  };

  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    // Keep fallback
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || cfg.projectId;
  const databaseId = process.env.FIREBASE_DATABASE_ID || cfg.firestoreDatabaseId;

  let serviceAccount: any = null;
  const rawServiceAccount =
    process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_ADMIN_CREDENTIALS;

  if (rawServiceAccount) {
    try {
      const cleanStr = rawServiceAccount.trim().startsWith('{')
        ? rawServiceAccount
        : Buffer.from(rawServiceAccount, 'base64').toString('utf8');
      serviceAccount = JSON.parse(cleanStr);
    } catch (e) {
      console.warn('[PushSubscribe] Failed to parse FIREBASE_SERVICE_ACCOUNT:', e);
    }
  }

  if (!serviceAccount && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    serviceAccount = {
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  try {
    const existingApps = getApps();
    if (!existingApps.length) {
      if (serviceAccount) {
        initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || projectId,
        });
      } else {
        try {
          initializeApp({
            credential: applicationDefault(),
            projectId,
          });
        } catch (adcErr) {
          initializeApp({ projectId });
        }
      }
    }

    const app = getApps()[0]!;
    cachedAdminDb = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
    return cachedAdminDb;
  } catch (err: any) {
    console.warn('[PushSubscribe] Unable to initialize Firebase Admin SDK:', err?.message);
    return null;
  }
}

function isProduction(): boolean {
  return (
    process.env.VERCEL === '1' ||
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.VERCEL_ENV)
  );
}

function validateSubscription(sub: any): { valid: boolean; code?: string; error?: string } {
  if (!sub || typeof sub !== 'object') {
    return { valid: false, code: 'PUSH_SUBSCRIPTION_INVALID', error: 'Push subscription object is missing' };
  }
  if (!sub.endpoint || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://')) {
    return { valid: false, code: 'PUSH_SUBSCRIPTION_INVALID', error: 'Invalid or missing push endpoint' };
  }
  if (!sub.keys || typeof sub.keys !== 'object') {
    return { valid: false, code: 'PUSH_SUBSCRIPTION_INVALID', error: 'Subscription keys missing' };
  }
  if (!sub.keys.p256dh || typeof sub.keys.p256dh !== 'string' || sub.keys.p256dh.trim() === '') {
    return { valid: false, code: 'PUSH_SUBSCRIPTION_INVALID', error: 'Subscription keys.p256dh is missing' };
  }
  if (!sub.keys.auth || typeof sub.keys.auth !== 'string' || sub.keys.auth.trim() === '') {
    return { valid: false, code: 'PUSH_SUBSCRIPTION_INVALID', error: 'Subscription keys.auth is missing' };
  }
  return { valid: true };
}

// In-memory server-side registry fallback for runtime instances
const serverSubscriptionsRegistry = new Map<string, Map<string, any>>();

export function getServerSubscriptions(userId: string): any[] {
  const userMap = serverSubscriptionsRegistry.get(userId);
  if (!userMap) return [];
  return Array.from(userMap.values());
}

export function removeServerSubscription(userId: string, identifier: string): void {
  const userMap = serverSubscriptionsRegistry.get(userId);
  if (!userMap) return;

  if (userMap.has(identifier)) {
    userMap.delete(identifier);
    return;
  }

  // Also check by endpoint
  for (const [key, sub] of userMap.entries()) {
    if (sub.endpoint === identifier || key === identifier) {
      userMap.delete(key);
    }
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { userId, subscription, docId, endpoint } = req.body || {};

  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }

  const prodMode = isProduction();

  // Handle DELETE (unsubscribe device)
  if (req.method === 'DELETE') {
    const idToRemove = docId || endpoint;
    if (idToRemove) {
      removeServerSubscription(userId, idToRemove);
    }

    const adminDb = getFirebaseAdminDb();
    if (adminDb && docId) {
      try {
        await adminDb
          .collection('users')
          .doc(userId)
          .collection('pushSubscriptions')
          .doc(docId)
          .delete();
      } catch (e: any) {
        console.warn('[PushSubscribe] Firestore delete note:', e?.message);
      }
    }

    return res.status(200).json({ success: true, message: 'Subscription removed' });
  }

  // Handle POST (register subscription)
  if (req.method === 'POST') {
    const validation = validateSubscription(subscription);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        code: 'PUSH_SUBSCRIPTION_INVALID',
        error: 'Format langganan notifikasi perangkat tidak valid.',
        details: validation.error,
      });
    }

    const subId = docId || `sub_${Math.abs(subscription.endpoint.split('').reduce((a: number, b: string) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(36)}`;

    let userMap = serverSubscriptionsRegistry.get(userId);
    if (!userMap) {
      userMap = new Map();
      serverSubscriptionsRegistry.set(userId, userMap);
    }

    const subRecord = {
      id: subId,
      userId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      updatedAt: Date.now(),
      active: true,
    };

    userMap.set(subId, subRecord);

    // Save directly to Firestore using Firebase Admin
    const adminDb = getFirebaseAdminDb();
    if (adminDb) {
      try {
        await adminDb
          .collection('users')
          .doc(userId)
          .collection('pushSubscriptions')
          .doc(subId)
          .set(
            {
              id: subId,
              userId,
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
              },
              updatedAt: new Date().toISOString(),
              active: true,
            },
            { merge: true }
          );
      } catch (e: any) {
        console.error('[PushSubscribe] Firebase Admin Firestore write error:', e?.message);
        if (prodMode) {
          return res.status(500).json({
            success: false,
            error: 'FIRESTORE_WRITE_FAILED',
            details: e?.message,
          });
        }
      }
    } else if (prodMode) {
      return res.status(500).json({
        success: false,
        error: 'FIRESTORE_UNAVAILABLE',
        details: 'Firebase Admin Firestore is unavailable in production.',
      });
    }

    // Local development fallback ONLY (never executed in production)
    if (!prodMode && !adminDb) {
      try {
        const storePath = path.join(process.cwd(), 'data', 'server_firestore_store.json');
        let store: any = { users: {} };
        if (fs.existsSync(storePath)) {
          store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        }
        if (!store.users) store.users = {};
        if (!store.users[userId]) store.users[userId] = { liabilities: {}, pushSubscriptions: {} };
        if (!store.users[userId].pushSubscriptions) store.users[userId].pushSubscriptions = {};
        store.users[userId].pushSubscriptions[subId] = subRecord;
        const dir = path.dirname(storePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
      } catch (e) {
        // Non-blocking local fallback
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Push subscription registered successfully in Firestore',
      docId: subId,
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
