import { validateSubscription } from './vapidHelper';

export const config = {
  maxDuration: 15,
};

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

    userMap.set(subId, {
      id: subId,
      userId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      updatedAt: Date.now(),
      active: true,
    });

    return res.status(200).json({
      success: true,
      message: 'Push subscription registered successfully',
      docId: subId,
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
