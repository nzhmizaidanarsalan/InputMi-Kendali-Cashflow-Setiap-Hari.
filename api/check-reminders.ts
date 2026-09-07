import crypto from 'crypto';
import webpushDefault from 'web-push';

export const config = {
  maxDuration: 30,
};

const webpush: any = (webpushDefault as any).default || webpushDefault;

// In-memory fallback registry for serverless instances
const serverSubscriptionsRegistry = new Map<string, Map<string, any>>();

function getServerSubscriptions(userId: string): any[] {
  const userMap = serverSubscriptionsRegistry.get(userId);
  if (!userMap) return [];
  return Array.from(userMap.values());
}

function removeServerSubscription(userId: string, identifier: string): void {
  const userMap = serverSubscriptionsRegistry.get(userId);
  if (!userMap) return;

  if (userMap.has(identifier)) {
    userMap.delete(identifier);
    return;
  }

  for (const [key, sub] of userMap.entries()) {
    if (sub.endpoint === identifier || key === identifier) {
      userMap.delete(key);
    }
  }
}

/**
 * Validates the structure and presence of keys in a push subscription object
 */
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

/**
 * Sanitizes and extracts matching 32-byte scalar from PKCS#8 or raw URL-safe Base64 keys
 */
function getSanitizedVapidConfig(): {
  valid: boolean;
  publicKey: string;
  privateKey: string;
  subject: string;
  error?: string;
  code?: string;
} {
  let rawPub = process.env.VAPID_PUBLIC_KEY || '';
  let rawPriv = process.env.VAPID_PRIVATE_KEY || '';
  let subject = (process.env.VAPID_SUBJECT || 'mailto:support@inputmi.app').trim();

  // Strip surrounding quotes, trailing commas, braces, and whitespace
  let cleanPub = rawPub.replace(/^[\"\'\s{]+|[\"\'\s,}]+$/g, '').trim();
  let cleanPriv = rawPriv.replace(/^[\"\'\s{]+|[\"\'\s,}]+$/g, '').trim();
  subject = subject.replace(/^[\"\'\s{]+|[\"\'\s,}]+$/g, '').trim();

  if (!subject.startsWith('mailto:') && !subject.startsWith('https://')) {
    subject = 'mailto:support@inputmi.app';
  }

  if (!cleanPriv) {
    return {
      valid: false,
      code: 'VAPID_CONFIG_INVALID',
      publicKey: cleanPub,
      privateKey: '',
      subject,
      error: 'VAPID_PRIVATE_KEY is missing from environment',
    };
  }

  let finalPrivKey = cleanPriv;
  let derivedPubKey = '';

  // Check if cleanPriv is in PKCS#8 DER base64 or PEM format
  if (cleanPriv.length > 64 || cleanPriv.includes('BEGIN PRIVATE KEY')) {
    try {
      let keyObject: crypto.KeyObject;
      if (cleanPriv.includes('BEGIN PRIVATE KEY')) {
        keyObject = crypto.createPrivateKey(cleanPriv);
      } else {
        const derBuffer = Buffer.from(cleanPriv, 'base64');
        keyObject = crypto.createPrivateKey({
          key: derBuffer,
          format: 'der',
          type: 'pkcs8',
        });
      }

      const jwk = keyObject.export({ format: 'jwk' });
      if (jwk.d) {
        finalPrivKey = jwk.d; // 32-byte URL-safe base64 scalar
      }
      if (jwk.x && jwk.y) {
        const xBuf = Buffer.from(jwk.x, 'base64url');
        const yBuf = Buffer.from(jwk.y, 'base64url');
        derivedPubKey = Buffer.concat([Buffer.from([0x04]), xBuf, yBuf]).toString('base64url');
      }
    } catch (e: any) {
      console.warn('[WebPush] VAPID private key parsing note:', e?.message);
    }
  }

  const finalPubKey = cleanPub || derivedPubKey;

  if (!finalPubKey || !finalPrivKey) {
    return {
      valid: false,
      code: 'VAPID_CONFIG_INVALID',
      publicKey: finalPubKey,
      privateKey: '',
      subject,
      error: 'Unable to resolve matching VAPID public and private keys',
    };
  }

  try {
    webpush.setVapidDetails(subject, finalPubKey, finalPrivKey);
    return {
      valid: true,
      code: 'VAPID_CONFIG_VALID',
      publicKey: finalPubKey,
      privateKey: finalPrivKey,
      subject,
    };
  } catch (err: any) {
    console.error('[WebPush] webpush.setVapidDetails failed:', err?.message);
    return {
      valid: false,
      code: 'VAPID_CONFIG_INVALID',
      publicKey: finalPubKey,
      privateKey: '',
      subject,
      error: err?.message || 'Invalid VAPID credentials',
    };
  }
}

// Inlined liability reminder helper functions
function getJakartaToday(): { dateString: string; year: number; month: number; day: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateString = formatter.format(now);
  const [yearStr, monthStr, dayStr] = dateString.split('-');
  return {
    dateString,
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
    day: parseInt(dayStr, 10),
  };
}

function parseLiabilityDueDate(dueDateStr?: string): { dateString: string } | null {
  if (!dueDateStr || typeof dueDateStr !== 'string') return null;
  const trimmed = dueDateStr.trim();
  const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const year = match[1];
  const month = match[2].padStart(2, '0');
  const day = match[3].padStart(2, '0');
  return { dateString: `${year}-${month}-${day}` };
}

function getCalendarDayDifference(startDateStr: string, endDateStr: string): number {
  const [sYear, sMonth, sDay] = startDateStr.split('-').map((v) => parseInt(v, 10));
  const [eYear, eMonth, eDay] = endDateStr.split('-').map((v) => parseInt(v, 10));
  const sUtc = Date.UTC(sYear, sMonth - 1, sDay);
  const eUtc = Date.UTC(eYear, eMonth - 1, eDay);
  const diffMs = eUtc - sUtc;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

const REMINDER_MESSAGES = {
  h3: {
    title: 'Pengingat InputMi',
    body: 'Ada tagihan yang jatuh tempo 3 hari lagi. Buka InputMi untuk detail.',
  },
  h1: {
    title: 'Pengingat InputMi',
    body: 'Ada tagihan yang jatuh tempo besok. Buka InputMi untuk detail.',
  },
  dueDate: {
    title: 'Pengingat InputMi',
    body: 'Ada tagihan jatuh tempo hari ini. Buka InputMi untuk detail.',
  },
};

function evaluateLiabilityReminder(
  liability: {
    id: string;
    name?: string;
    totalRemaining: number;
    dueDate?: string;
    reminderState?: any;
  },
  customTodayDateStr?: string
): any {
  if (!liability || liability.totalRemaining <= 0) {
    return { shouldSend: false, reason: 'liability_settled_or_paid' };
  }

  const parsedDue = parseLiabilityDueDate(liability.dueDate);
  if (!parsedDue) {
    return { shouldSend: false, reason: 'invalid_due_date_format' };
  }

  const todayStr = customTodayDateStr || getJakartaToday().dateString;
  const diffDays = getCalendarDayDifference(todayStr, parsedDue.dateString);

  let state = liability.reminderState ? { ...liability.reminderState } : {};

  if (state.lastEvaluatedDueDate && state.lastEvaluatedDueDate !== parsedDue.dateString) {
    state = {
      h3Sent: false,
      h1Sent: false,
      dueDateSent: false,
      lastEvaluatedDueDate: parsedDue.dateString,
      updatedAt: Date.now(),
    };
  } else if (!state.lastEvaluatedDueDate) {
    state.lastEvaluatedDueDate = parsedDue.dateString;
  }

  if (diffDays === 3) {
    if (state.h3Sent) {
      return { shouldSend: false, diffDays, reason: 'h3_already_delivered' };
    }
    return {
      shouldSend: true,
      stage: 'h3',
      title: REMINDER_MESSAGES.h3.title,
      body: REMINDER_MESSAGES.h3.body,
      diffDays,
      newReminderState: {
        ...state,
        h3Sent: true,
        lastEvaluatedDueDate: parsedDue.dateString,
        updatedAt: Date.now(),
      },
    };
  }

  if (diffDays === 1) {
    if (state.h1Sent) {
      return { shouldSend: false, diffDays, reason: 'h1_already_delivered' };
    }
    return {
      shouldSend: true,
      stage: 'h1',
      title: REMINDER_MESSAGES.h1.title,
      body: REMINDER_MESSAGES.h1.body,
      diffDays,
      newReminderState: {
        ...state,
        h1Sent: true,
        lastEvaluatedDueDate: parsedDue.dateString,
        updatedAt: Date.now(),
      },
    };
  }

  if (diffDays === 0) {
    if (state.dueDateSent) {
      return { shouldSend: false, diffDays, reason: 'dueDate_already_delivered' };
    }
    return {
      shouldSend: true,
      stage: 'dueDate',
      title: REMINDER_MESSAGES.dueDate.title,
      body: REMINDER_MESSAGES.dueDate.body,
      diffDays,
      newReminderState: {
        ...state,
        dueDateSent: true,
        lastEvaluatedDueDate: parsedDue.dateString,
        updatedAt: Date.now(),
      },
    };
  }

  return {
    shouldSend: false,
    diffDays,
    reason: diffDays < 0 ? 'due_date_passed' : 'not_in_reminder_window',
  };
}

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

    // If subscription was not passed in body, check server registry
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
