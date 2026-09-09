import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import webpushDefault from 'web-push';
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const webpush = (webpushDefault as any).default || webpushDefault;

export const config = {
  maxDuration: 60,
};

// Default production VAPID credentials
const DEFAULT_VAPID_PUBLIC_KEY =
  'BEk5RLnA1i1q0LMu4blSJm_idocAdTq_DKHAMv3AFciSFe_VoyiDoQD4KtnO5GscLqZwFrpbyUODkaK6K_56uf4';
const DEFAULT_VAPID_PRIVATE_KEY =
  'v1HKui-zr7NKRThMjblkF2KbLVce4FsrSdk7Fg-dWYM';
const DEFAULT_VAPID_SUBJECT = 'mailto:nazhmizaidan05@gmail.com';

const CONFIGURED_CRON_SECRET =
  'i;$,T7RW!9D_7!Tg4SD%%yqug*u.659%cHGA3iVsaH+89RNl]{vGhf4soR^kb{]Z';

interface SanitizedVapidConfig {
  valid: boolean;
  publicKey: string;
  privateKey: string;
  subject: string;
  error?: string;
  code?: string;
}

function getSanitizedVapidConfig(): SanitizedVapidConfig {
  let rawPub = process.env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
  let rawPriv = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY;
  let subject = (process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT).trim();

  let cleanPub = rawPub.replace(/^["'\s{]+|["'\s,}]+$/g, '').trim();
  let cleanPriv = rawPriv.replace(/^["'\s{]+|["'\s,}]+$/g, '').trim();
  subject = subject.replace(/^["'\s{]+|["'\s,}]+$/g, '').trim();

  if (cleanPub.startsWith('BMptIjvg') || cleanPriv.includes('jfvJobsiKmPMn98w9aVg')) {
    cleanPub = DEFAULT_VAPID_PUBLIC_KEY;
    cleanPriv = DEFAULT_VAPID_PRIVATE_KEY;
    subject = DEFAULT_VAPID_SUBJECT;
  }

  if (!subject.startsWith('mailto:') && !subject.startsWith('https://')) {
    subject = DEFAULT_VAPID_SUBJECT;
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
        finalPrivKey = jwk.d;
      }
      if (jwk.x && jwk.y) {
        const xBuf = Buffer.from(jwk.x, 'base64url');
        const yBuf = Buffer.from(jwk.y, 'base64url');
        derivedPubKey = Buffer.concat([Buffer.from([0x04]), xBuf, yBuf]).toString('base64url');
      }
    } catch (e: any) {
      console.warn('[Scheduler] VAPID private key parsing note:', e?.message);
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
      publicKey: finalPubKey,
      privateKey: finalPrivKey,
      subject,
    };
  } catch (err: any) {
    return {
      valid: false,
      code: 'VAPID_INITIALIZATION_FAILED',
      publicKey: finalPubKey,
      privateKey: finalPrivKey,
      subject,
      error: err?.message || 'Failed to initialize webpush with resolved VAPID keys',
    };
  }
}

// Asia/Jakarta Date Utilities
function getJakartaTodayString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function parseLiabilityDueDate(dateStr?: string): { dateString: string } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
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

// Server-Side Firestore Access & Persistent Store
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
      console.warn('[Scheduler] Failed to parse FIREBASE_SERVICE_ACCOUNT:', e);
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
        console.log('[Scheduler] Initialized firebase-admin with Service Account credentials.');
      } else {
        try {
          initializeApp({
            credential: applicationDefault(),
            projectId,
          });
          console.log('[Scheduler] Initialized firebase-admin with Application Default Credentials.');
        } catch (adcErr) {
          initializeApp({ projectId });
          console.log('[Scheduler] Initialized firebase-admin with default projectId.');
        }
      }
    }

    const app = getApps()[0]!;
    cachedAdminDb = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
    return cachedAdminDb;
  } catch (err: any) {
    console.warn('[Scheduler] Unable to initialize Firebase Admin SDK:', err?.message);
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

// Local dev persistent server store path: data/server_firestore_store.json
function getLocalStorePath(): string {
  return path.join(process.cwd(), 'data', 'server_firestore_store.json');
}

function readLocalStore(): any {
  try {
    const storePath = getLocalStorePath();
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[Scheduler] Failed to read local store:', err);
  }
  return { users: {} };
}

function writeLocalStore(data: any): void {
  try {
    const storePath = getLocalStorePath();
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Scheduler] Failed to write local store:', err);
  }
}

interface UserData {
  userId: string;
  liabilities: any[];
  pushSubscriptions: any[];
}

function parseLocalStoreUsers(localStore: any): UserData[] {
  const users: UserData[] = [];
  if (localStore?.users) {
    for (const [userId, uData] of Object.entries<any>(localStore.users)) {
      users.push({
        userId,
        liabilities: Object.values(uData.liabilities || {}),
        pushSubscriptions: Object.values(uData.pushSubscriptions || {}),
      });
    }
  }
  return users;
}

async function loadAllUserData(isProd: boolean): Promise<{ users: UserData[]; source: string }> {
  const adminDb = getFirebaseAdminDb();
  if (!adminDb) {
    if (isProd) {
      throw new Error(
        'Firebase Admin Firestore failed to initialize in production. Check FIREBASE_SERVICE_ACCOUNT or Application Default Credentials.'
      );
    }
    console.warn('[Scheduler] Firebase Admin unavailable in local dev. Using local store fallback.');
    const localStore = readLocalStore();
    return { users: parseLocalStoreUsers(localStore), source: 'local_dev_store' };
  }

  try {
    const usersMap = new Map<string, UserData>();
    const usersSnap = await adminDb.collection('users').get();
    
    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const liabSnap = await adminDb
        .collection('users')
        .doc(userId)
        .collection('liabilities')
        .get();
      const subSnap = await adminDb
        .collection('users')
        .doc(userId)
        .collection('pushSubscriptions')
        .get();

      const liabilities = liabSnap.docs.map((d: any) => ({
        id: d.id,
        ...d.data(),
      }));

      const pushSubscriptions = subSnap.docs.map((d: any) => ({
        id: d.id,
        ...d.data(),
      }));

      usersMap.set(userId, {
        userId,
        liabilities,
        pushSubscriptions,
      });
    }

    return {
      users: Array.from(usersMap.values()),
      source: 'firebase_admin_firestore',
    };
  } catch (err: any) {
    if (isProd) {
      throw new Error(
        `Firebase Admin Firestore query failed in production: ${err?.message || err}`
      );
    }
    console.warn('[Scheduler] Firestore query failed in local dev, checking local store:', err?.message);
    const localStore = readLocalStore();
    return { users: parseLocalStoreUsers(localStore), source: 'local_dev_store' };
  }
}

async function updateLiabilityReminderState(
  userId: string,
  liabilityId: string,
  newState: any,
  isProd: boolean
): Promise<void> {
  const adminDb = getFirebaseAdminDb();
  if (adminDb) {
    try {
      await adminDb
        .collection('users')
        .doc(userId)
        .collection('liabilities')
        .doc(liabilityId)
        .update({
          reminderState: newState,
          updatedAt: new Date().toISOString(),
        });
      return;
    } catch (e: any) {
      if (isProd) {
        throw new Error(
          `Failed to update reminderState in Firestore in production: ${e?.message || e}`
        );
      }
      console.warn('[Scheduler] Firebase Admin update note in local dev:', e?.message);
    }
  }

  if (isProd) {
    throw new Error(
      'Cannot update reminderState: Firebase Admin Firestore is not available in production.'
    );
  }

  // Local development / test fallback ONLY (never executed in production)
  const localStore = readLocalStore();
  if (
    localStore.users &&
    localStore.users[userId] &&
    localStore.users[userId].liabilities &&
    localStore.users[userId].liabilities[liabilityId]
  ) {
    localStore.users[userId].liabilities[liabilityId].reminderState = newState;
    localStore.users[userId].liabilities[liabilityId].updatedAt = Date.now();
    writeLocalStore(localStore);
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Authorization check (optional for manual preview test, required for cron if header provided)
  const authHeader = req.headers.authorization;
  const envSecret = process.env.CRON_SECRET || CONFIGURED_CRON_SECRET;
  if (authHeader && envSecret) {
    const isMatch =
      authHeader === `Bearer ${CONFIGURED_CRON_SECRET}` ||
      authHeader === `Bearer ${envSecret}`;
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Unauthorized cron trigger' });
    }
  }

  // Initialize VAPID
  const vapid = getSanitizedVapidConfig();
  if (!vapid.valid) {
    console.error('[Scheduler] VAPID configuration error:', vapid.error);
    return res.status(500).json({
      ok: false,
      error: 'Konfigurasi Web Push VAPID belum valid.',
      details: vapid.error,
    });
  }

  const todayJakarta = getJakartaTodayString();
  const prodMode = isProduction();

  // Support resetting the dummy test liability for clean verification if requested
  const shouldResetTest =
    req.query?.resetTestLiability === 'true' || req.body?.resetTestLiability === true;
  if (shouldResetTest) {
    const adminDb = getFirebaseAdminDb();
    if (adminDb) {
      try {
        await adminDb
          .collection('users')
          .doc('user_real_test_01')
          .collection('liabilities')
          .doc('liab_real_due_today')
          .update({
            'reminderState.dueDateSent': false,
            'reminderState.h1Sent': false,
            'reminderState.h3Sent': false,
            'reminderState.lastEvaluatedDueDate': todayJakarta,
            'reminderState.updatedAt': Date.now(),
          });
        console.log('[Scheduler] Safely reset dummy test liability in Firestore.');
      } catch (e) {
        // Doc might not exist in production Firestore
      }
    }
    if (!prodMode) {
      const store = readLocalStore();
      if (store.users?.user_real_test_01?.liabilities?.liab_real_due_today) {
        store.users.user_real_test_01.liabilities.liab_real_due_today.reminderState = {
          h3Sent: false,
          h1Sent: false,
          dueDateSent: false,
          lastEvaluatedDueDate: todayJakarta,
          updatedAt: Date.now(),
        };
        writeLocalStore(store);
        console.log('[Scheduler] Safely reset dummy test liability in local store.');
      }
    }
  }

  // Load users, liabilities, and push subscriptions from server-side Firestore
  let users: UserData[] = [];
  let source = 'firebase_admin_firestore';
  try {
    const loaded = await loadAllUserData(prodMode);
    users = loaded.users;
    source = loaded.source;
  } catch (err: any) {
    console.error('[Scheduler] Critical Firestore load error:', err?.message || err);
    return res.status(500).json({
      ok: false,
      error: 'FIRESTORE_DATA_ACCESS_ERROR',
      message: err?.message || 'Failed to load data from Firebase Admin Firestore in production',
    });
  }

  let usersScanned = users.length;
  let liabilitiesScanned = 0;
  let activeLiabilities = 0;
  let h3Due = 0;
  let h1Due = 0;
  let todayDue = 0;

  let subscriptionsFoundGlobal = 0;
  let subscriptionsFoundForDueUsers = 0;

  let pushesAttempted = 0;
  let pushesSent = 0;
  let pushesFailed = 0;

  let alreadySentSkipped = 0;
  let noSubscriptionSkipped = 0;
  let invalidSubscriptionSkipped = 0;
  let paidSkipped = 0;
  let stateMismatchSkipped = 0;

  const dueLiabilitiesTrace: Array<{
    userId: string;
    liabilityId: string;
    reminderStage: string;
    dueDate: string;
    daysUntilDue: number;
    h3Sent: boolean;
    h1Sent: boolean;
    dueDateSent: boolean;
    subscriptionCountForThisUser: number;
    skipReason: string | null;
  }> = [];

  for (const user of users) {
    // Subscriptions strictly partitioned for this user UID
    const userSubs = user.pushSubscriptions || [];
    const validSubsForUser: any[] = [];

    for (const sub of userSubs) {
      const isValid =
        sub &&
        typeof sub.endpoint === 'string' &&
        sub.endpoint.startsWith('http') &&
        sub.keys &&
        typeof sub.keys.p256dh === 'string' &&
        typeof sub.keys.auth === 'string' &&
        sub.active !== false;

      if (isValid) {
        validSubsForUser.push(sub);
      } else {
        invalidSubscriptionSkipped++;
      }
    }

    subscriptionsFoundGlobal += validSubsForUser.length;

    for (const liability of user.liabilities || []) {
      liabilitiesScanned++;

      const remaining = Number(liability.totalRemaining);
      const isPaid = liability.status === 'paid' || liability.isPaid === true;
      if (isNaN(remaining) || remaining <= 0 || isPaid) {
        paidSkipped++;
        continue;
      }
      activeLiabilities++;

      const parsedDue = parseLiabilityDueDate(liability.dueDate);
      if (!parsedDue) {
        stateMismatchSkipped++;
        continue;
      }

      const diffDays = getCalendarDayDifference(todayJakarta, parsedDue.dateString);
      let state = liability.reminderState ? { ...liability.reminderState } : {};

      // Reset state if due date changed
      if (state.lastEvaluatedDueDate && state.lastEvaluatedDueDate !== parsedDue.dateString) {
        state = {
          h3Sent: false,
          h1Sent: false,
          dueDateSent: false,
          lastEvaluatedDueDate: parsedDue.dateString,
          updatedAt: Date.now(),
        };
      }

      // Check if liability matches reminder windows (H-3, H-1, or Hari H)
      let stage: 'h3' | 'h1' | 'dueDate' | null = null;
      let alreadySent = false;
      let stageTitle = '';
      let stageBody = '';

      if (diffDays === 0) {
        todayDue++;
        stage = 'dueDate';
        alreadySent = !!state.dueDateSent;
        stageTitle = 'Pengingat Jatuh Tempo Hari Ini';
        stageBody = `Kewajiban "${liability.name || 'Tagihan'}" jatuh tempo hari ini. Segera lakukan pelunasan.`;
      } else if (diffDays === 1) {
        h1Due++;
        stage = 'h1';
        alreadySent = !!state.h1Sent;
        stageTitle = 'Pengingat Jatuh Tempo Besok';
        stageBody = `Kewajiban "${liability.name || 'Tagihan'}" jatuh tempo besok (H-1).`;
      } else if (diffDays === 3) {
        h3Due++;
        stage = 'h3';
        alreadySent = !!state.h3Sent;
        stageTitle = 'Pengingat Jatuh Tempo 3 Hari Lagi';
        stageBody = `Kewajiban "${liability.name || 'Tagihan'}" jatuh tempo dalam 3 hari (H-3).`;
      }

      if (!stage) {
        // Not in reminder stage window
        continue;
      }

      // This liability is due: track subscriptions available specifically for this user
      subscriptionsFoundForDueUsers += validSubsForUser.length;

      let skipReason: string | null = null;
      if (alreadySent) {
        skipReason = 'ALREADY_SENT';
        alreadySentSkipped++;
      } else if (validSubsForUser.length === 0) {
        skipReason = 'NO_ACTIVE_SUBSCRIPTION';
        noSubscriptionSkipped++;
      }

      // Record safe diagnostic trace (no financial amounts or names)
      dueLiabilitiesTrace.push({
        userId: user.userId,
        liabilityId: liability.id,
        reminderStage: stage,
        dueDate: parsedDue.dateString,
        daysUntilDue: diffDays,
        h3Sent: !!state.h3Sent,
        h1Sent: !!state.h1Sent,
        dueDateSent: !!state.dueDateSent,
        subscriptionCountForThisUser: validSubsForUser.length,
        skipReason,
      });

      // If eligible, dispatch push notifications to this user's subscriptions only
      if (!skipReason && validSubsForUser.length > 0) {
        const payload = JSON.stringify({
          title: stageTitle,
          body: stageBody,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `liability-${liability.id}-${stage}`,
          data: {
            url: '/balance',
            liabilityId: liability.id,
            stage,
            dueDate: parsedDue.dateString,
          },
        });

        let successfulPushesForLiability = 0;

        for (const sub of validSubsForUser) {
          pushesAttempted++;
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.keys.p256dh,
                  auth: sub.keys.auth,
                },
              },
              payload,
              {
                TTL: 86400,
                urgency: 'high',
              }
            );
            pushesSent++;
            successfulPushesForLiability++;
          } catch (pushErr: any) {
            pushesFailed++;
            console.warn(`[Scheduler] Push delivery failed for user ${user.userId}:`, pushErr?.message);
          }
        }

        // CRITICAL: Only mark sent if at least one push notification succeeded!
        if (successfulPushesForLiability > 0) {
          const updatedState = {
            ...state,
            h3Sent: stage === 'h3' ? true : !!state.h3Sent,
            h1Sent: stage === 'h1' ? true : !!state.h1Sent,
            dueDateSent: stage === 'dueDate' ? true : !!state.dueDateSent,
            lastEvaluatedDueDate: parsedDue.dateString,
            updatedAt: Date.now(),
          };

          await updateLiabilityReminderState(user.userId, liability.id, updatedState, prodMode);
        }
      }
    }
  }

  const diagnosticResponse = {
    ok: true,
    source,
    todayJakarta,
    usersScanned,
    liabilitiesScanned,
    activeLiabilities,
    h3Due,
    h1Due,
    todayDue,
    subscriptionsFound: subscriptionsFoundGlobal,
    subscriptionsFoundGlobal,
    subscriptionsFoundForDueUsers,
    pushesAttempted,
    pushesSent,
    pushesFailed,
    alreadySentSkipped,
    noSubscriptionSkipped,
    invalidSubscriptionSkipped,
    paidSkipped,
    stateMismatchSkipped,
    dueLiabilitiesTrace,
  };

  console.log('[Scheduler] Diagnostic run output:', diagnosticResponse);

  return res.status(200).json(diagnosticResponse);
}
