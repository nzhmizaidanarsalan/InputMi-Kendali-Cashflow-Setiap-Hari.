import webpush from 'web-push';
import { evaluateLiabilityReminder } from '../src/utils/reminderEngine';
import { getServerSubscriptions, removeServerSubscription } from './push-subscribe';
import { getSanitizedVapidConfig, validateSubscription } from './vapidHelper';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Initialize and verify VAPID configuration
  const vapid = getSanitizedVapidConfig();
  if (!vapid.valid) {
    console.error('[WebPush] VAPID configuration invalid on server:', vapid.error);
    return res.status(500).json({
      success: false,
      code: 'VAPID_CONFIG_INVALID',
      error: 'Konfigurasi notifikasi belum valid.',
      details: vapid.error,
    });
  }

  const {
    userId,
    liabilities = [],
    testSend = false,
    testSubscription = null,
    todayOverride = null,
  } = req.body || {};

  // 2. Handle immediate Uji Coba (Test Send) request
  if (testSend) {
    let targetSub = testSubscription;

    // If subscription was not passed in body, try to find in server registry for this user
    if (!targetSub && userId) {
      const subs = getServerSubscriptions(userId);
      if (subs && subs.length > 0) {
        targetSub = subs[subs.length - 1];
      }
    }

    if (!targetSub) {
      return res.status(404).json({
        success: false,
        code: 'PUSH_SUBSCRIPTION_NOT_FOUND',
        error: 'Perangkat belum terdaftar untuk notifikasi.',
      });
    }

    // Validate subscription structure
    const validation = validateSubscription(targetSub);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        code: 'PUSH_SUBSCRIPTION_INVALID',
        error: 'Format langganan notifikasi perangkat tidak valid.',
        details: validation.error,
      });
    }

    // Privacy-safe test notification without financial data
    const testPayload = JSON.stringify({
      title: 'Pengingat InputMi',
      body: 'Notifikasi pengingat berhasil diaktifkan.',
      url: '/#balance',
      tag: 'inputmi-test-reminder',
    });

    try {
      // Send notification and await push provider response
      const sendResult = await webpush.sendNotification(
        {
          endpoint: targetSub.endpoint,
          keys: {
            p256dh: targetSub.keys.p256dh,
            auth: targetSub.keys.auth,
          },
        },
        testPayload,
        {
          TTL: 60,
        }
      );

      console.log('[WebPush] Test notification accepted by push provider. Status:', sendResult.statusCode);

      return res.status(200).json({
        success: true,
        code: 'PUSH_SEND_SUCCESS',
        message: 'Notifikasi pengingat berhasil diaktifkan.',
        providerStatus: sendResult.statusCode || 201,
      });
    } catch (err: any) {
      const statusCode = err?.statusCode || err?.status;
      console.error('[WebPush] Test notification provider error:', statusCode, err?.message, err?.body);

      // Handle expired or stale subscription (404 / 410)
      if (statusCode === 404 || statusCode === 410) {
        if (userId && (targetSub.id || targetSub.endpoint)) {
          removeServerSubscription(userId, targetSub.id || targetSub.endpoint);
        }
        return res.status(410).json({
          success: false,
          code: 'EXPIRED_SUBSCRIPTION',
          statusCode,
          error: 'Langganan notifikasi kedaluwarsa. Aktifkan kembali pengingat.',
        });
      }

      // Handle VAPID authentication error (401 / 403)
      if (statusCode === 401 || statusCode === 403) {
        return res.status(403).json({
          success: false,
          code: 'VAPID_AUTH_FAILED',
          statusCode,
          error: 'Autentikasi VAPID push service gagal. Periksa kunci server.',
          details: err?.body || err?.message,
        });
      }

      // Handle rate limiting (429)
      if (statusCode === 429) {
        return res.status(429).json({
          success: false,
          code: 'PUSH_RATE_LIMITED',
          statusCode,
          error: 'Terlalu banyak permintaan notifikasi. Silakan coba sesaat lagi.',
        });
      }

      // Handle other 4xx/5xx errors
      return res.status(statusCode && statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
        success: false,
        code: 'PUSH_SEND_FAILED',
        statusCode: statusCode || 500,
        error: 'Notifikasi gagal dikirim. Silakan coba lagi.',
        details: err?.message,
      });
    }
  }

  // 3. Regular scheduled check for liability reminders
  if (!userId) {
    return res.status(400).json({
      success: false,
      code: 'USER_ID_REQUIRED',
      error: 'User ID is required for checking reminders',
    });
  }

  let subscriptions: any[] = getServerSubscriptions(userId);
  if (testSubscription && !subscriptions.some((s) => s.endpoint === testSubscription.endpoint)) {
    subscriptions.push(testSubscription);
  }

  const results: any[] = [];
  const updatedLiabilities: any[] = [];

  for (const liability of liabilities) {
    const decision = evaluateLiabilityReminder(liability, todayOverride);

    if (decision.shouldSend && subscriptions.length > 0) {
      // Send privacy-safe liability reminder
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
            payload,
            { TTL: 86400 }
          );
          sentCount++;
        } catch (pushErr: any) {
          console.warn('[WebPush] Scheduled push error:', pushErr?.statusCode, pushErr?.message);
          if (pushErr?.statusCode === 404 || pushErr?.statusCode === 410) {
            if (userId && (sub.id || sub.endpoint)) {
              removeServerSubscription(userId, sub.id || sub.endpoint);
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
