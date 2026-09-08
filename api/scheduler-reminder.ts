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

// Persistent server store path: data/server_firestore_store.json
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

async function loadAllUserData(): Promise<{ users: UserData[]; source: string }> {
  const usersMap = new Map<string, UserData>();
  let source = 'server_persistent_store';

  // 1. Try Firebase Admin Firestore
  const adminDb = getFirebaseAdminDb();
  if (adminDb) {
    try {
      const usersSnap = await adminDb.collection('users').get();
      if (usersSnap && usersSnap.docs && usersSnap.docs.length > 0) {
        source = 'firebase_admin_firestore';
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
      }
    } catch (err: any) {
      console.warn('[Scheduler] Firebase Admin query note (using persistent server store):', err?.message);
    }
  }

  // 2. Also read and merge local persistent store (exact Firestore collection schema)
  const localStore = readLocalStore();
  if (localStore.users) {
    for (const [userId, uData] of Object.entries<any>(localStore.users)) {
      const existing = usersMap.get(userId);
      const localLiabs: any[] = Object.values(uData.liabilities || {});
      const localSubs: any[] = Object.values(uData.pushSubscriptions || {});

      if (!existing) {
        usersMap.set(userId, {
          userId,
          liabilities: localLiabs,
          pushSubscriptions: localSubs,
        });
      } else {
        // Merge missing liabilities
        for (const l of localLiabs) {
          if (!existing.liabilities.some((x) => x.id === l.id)) {
            existing.liabilities.push(l);
          }
        }
        // Merge missing subscriptions
        for (const s of localSubs) {
          if (!existing.pushSubscriptions.some((x) => x.endpoint === s.endpoint)) {
            existing.pushSubscriptions.push(s);
          }
        }
      }
    }
  }

  return { users: Array.from(usersMap.values()), source };
}

async function updateLiabilityReminderState(
  userId: string,
  liabilityId: string,
  newState: any
): Promise<void> {
  // Update in Firebase Admin if available
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
    } catch (e: any) {
      console.warn('[Scheduler] Firebase Admin update note:', e?.message);
    }
  }

  // Update in local persistent store
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

  // Load users, liabilities, and push subscriptions from server-side Firestore
  const { users, source } = await loadAllUserData();

  let usersScanned = users.length;
  let liabilitiesScanned = 0;
  let activeLiabilities = 0;
  let h3Due = 0;
  let h1Due = 0;
  let todayDue = 0;
  let subscriptionsFound = 0;
  let pushesAttempted = 0;
  let pushesSent = 0;
  let pushesFailed = 0;

  for (const user of users) {
    const activeSubs = (user.pushSubscriptions || []).filter(
      (s) => s.endpoint && s.keys && s.keys.p256dh && s.keys.auth && s.active !== false
    );
    subscriptionsFound += activeSubs.length;

    for (const liability of user.liabilities || []) {
      liabilitiesScanned++;

      const remaining = Number(liability.totalRemaining);
      if (isNaN(remaining) || remaining <= 0) {
        continue;
      }
      activeLiabilities++;

      const parsedDue = parseLiabilityDueDate(liability.dueDate);
      if (!parsedDue) {
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

      let shouldSend = false;
      let stage = '';
      let title = 'Pengingat InputMi';
      let body = '';

      if (diffDays === 0) {
        todayDue++;
        if (!state.dueDateSent) {
          shouldSend = true;
          stage = 'dueDate';
          title = 'Pengingat Jatuh Tempo Hari Ini';
          body = `Kewajiban "${liability.name || 'Tagihan'}" jatuh tempo hari ini. Segera lakukan pelunasan.`;
        }
      } else if (diffDays === 1) {
        h1Due++;
        if (!state.h1Sent) {
          shouldSend = true;
          stage = 'h1';
          title = 'Pengingat Jatuh Tempo Besok';
          body = `Kewajiban "${liability.name || 'Tagihan'}" jatuh tempo besok (H-1).`;
        }
      } else if (diffDays === 3) {
        h3Due++;
        if (!state.h3Sent) {
          shouldSend = true;
          stage = 'h3';
          title = 'Pengingat Jatuh Tempo 3 Hari Lagi';
          body = `Kewajiban "${liability.name || 'Tagihan'}" jatuh tempo dalam 3 hari (H-3).`;
        }
      }

      if (shouldSend && activeSubs.length > 0) {
        const payload = JSON.stringify({
          title,
          body,
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

        let anyPushSucceeded = false;

        for (const sub of activeSubs) {
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
            anyPushSucceeded = true;
          } catch (pushErr: any) {
            pushesFailed++;
            console.warn(`[Scheduler] Push delivery failed to endpoint ${sub.endpoint}:`, pushErr?.message);
          }
        }

        // Update reminderState in Firestore
        const updatedState = {
          ...state,
          h3Sent: stage === 'h3' ? true : !!state.h3Sent,
          h1Sent: stage === 'h1' ? true : !!state.h1Sent,
          dueDateSent: stage === 'dueDate' ? true : !!state.dueDateSent,
          lastEvaluatedDueDate: parsedDue.dateString,
          updatedAt: Date.now(),
        };

        if (anyPushSucceeded || pushesAttempted > 0) {
          await updateLiabilityReminderState(user.userId, liability.id, updatedState);
        }
      }
    }
  }

  const diagnosticResponse = {
    ok: true,
    todayJakarta,
    usersScanned,
    liabilitiesScanned,
    activeLiabilities,
    h3Due,
    h1Due,
    todayDue,
    subscriptionsFound,
    pushesAttempted,
    pushesSent,
    pushesFailed,
  };

  console.log('[Scheduler] Diagnostic run output:', diagnosticResponse);

  return res.status(200).json(diagnosticResponse);
}
