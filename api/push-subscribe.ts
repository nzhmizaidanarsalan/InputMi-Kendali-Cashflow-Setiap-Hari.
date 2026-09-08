export const config = {
  maxDuration: 15,
};

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

  // Handle DELETE (unsubscribe device)
  if (req.method === 'DELETE') {
    const idToRemove = docId || endpoint;
    if (idToRemove) {
      removeServerSubscription(userId, idToRemove);
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

    // Persist to server firestore store file
    try {
      const fs = await import('fs');
      const path = await import('path');
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
      // Non-blocking persistence
    }

    return res.status(200).json({
      success: true,
      message: 'Push subscription registered successfully',
      docId: subId,
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
