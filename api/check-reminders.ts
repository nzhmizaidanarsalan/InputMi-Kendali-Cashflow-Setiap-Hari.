import webpush from 'web-push';
import { evaluateLiabilityReminder } from '../src/utils/reminderEngine';
import { getServerSubscriptions, removeServerSubscription } from './push-subscribe';

export const config = {
  maxDuration: 30,
};

const DEFAULT_VAPID_PUBLIC_KEY =
  'BCO8ctQzOuEy5cjjPOLGmTlFYT6R9DsKVwl-3w-d3oSLxhNGbYgrwBebZbtMj87nCIf1RnlzTg6OZ0zPrrFCik0';
const DEFAULT_VAPID_PRIVATE_KEY =
  'LREUrzCT1g36gPEu7kf-w6cnQNRDfO-jkiuN-tLqYI0';

function initWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@inputmi.app';

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (err) {
    console.error('Error setting VAPID details:', err);
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  initWebPush();

  const {
    userId,
    liabilities = [],
    testSend = false,
    testSubscription = null,
    todayOverride = null,
  } = req.body || {};

  if (!userId && !testSubscription) {
    return res.status(400).json({ success: false, error: 'User ID or subscription is required' });
  }

  // Handle immediate test send request
  if (testSend && testSubscription) {
    try {
      const payload = JSON.stringify({
        title: 'Pengingat InputMi',
        body: 'Pengingat InputMi aktif! Anda akan menerima notifikasi saat tagihan jatuh tempo (H-3, H-1, Hari H).',
        url: '/#balance',
        tag: 'inputmi-test-reminder',
      });

      await webpush.sendNotification(testSubscription, payload);
      return res.status(200).json({
        success: true,
        message: 'Notifikasi uji coba berhasil dikirim ke perangkat Anda.',
      });
    } catch (err: any) {
      console.error('Test notification push error:', err);
      return res.status(500).json({
        success: false,
        error: `Gagal mengirim notifikasi: ${err?.message || 'Error'}`,
      });
    }
  }

  // Retrieve all registered subscriptions for this user
  let subscriptions: any[] = [];
  if (userId) {
    subscriptions = getServerSubscriptions(userId);
  }
  if (testSubscription && !subscriptions.some((s) => s.endpoint === testSubscription.endpoint)) {
    subscriptions.push(testSubscription);
  }

  const results: any[] = [];
  const updatedLiabilities: any[] = [];

  for (const liability of liabilities) {
    const decision = evaluateLiabilityReminder(liability, todayOverride);

    if (decision.shouldSend && subscriptions.length > 0) {
      // Send privacy-safe push notification to all user devices
      const payload = JSON.stringify({
        title: decision.title,
        body: decision.body,
        url: '/#balance',
        tag: `liability-${liability.id}-${decision.stage}`,
      });

      let sentCount = 0;
      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            payload
          );
          sentCount++;
        } catch (pushErr: any) {
          console.warn('Failed to send push to subscription:', pushErr?.statusCode, pushErr?.message);
          // If subscription is 404 Not Found or 410 Gone, safely clean it up
          if (pushErr?.statusCode === 404 || pushErr?.statusCode === 410) {
            if (userId && sub.id) {
              removeServerSubscription(userId, sub.id);
            }
          }
        }
      }

      results.push({
        liabilityId: liability.id,
        stage: decision.stage,
        diffDays: decision.diffDays,
        sentToDevices: sentCount,
        title: decision.title,
        body: decision.body,
      });

      updatedLiabilities.push({
        id: liability.id,
        reminderState: decision.newReminderState,
      });
    } else {
      results.push({
        liabilityId: liability.id,
        skipped: true,
        reason: decision.reason,
        diffDays: decision.diffDays,
      });
    }
  }

  return res.status(200).json({
    success: true,
    processedCount: liabilities.length,
    activeSubscriptions: subscriptions.length,
    results,
    updatedLiabilities,
  });
}
