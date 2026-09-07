import crypto from 'crypto';
import webpush from 'web-push';

export interface VapidConfigResult {
  valid: boolean;
  publicKey: string;
  privateKey: string;
  subject: string;
  error?: string;
  code?: 'VAPID_CONFIG_INVALID' | 'VAPID_CONFIG_VALID';
}

/**
 * Normalizes, strips quotes/braces/commas, extracts 32-byte scalar from PKCS#8 DER if needed,
 * and initializes webpush with matching keys.
 */
export function getSanitizedVapidConfig(): VapidConfigResult {
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
      console.warn('VAPID private key conversion warning:', e?.message);
    }
  }

  // Ensure public key is present and matching
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
    console.error('webpush.setVapidDetails failed:', err?.message);
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

/**
 * Validates the structure and presence of keys in a push subscription object
 */
export function validateSubscription(sub: any): { valid: boolean; code?: string; error?: string } {
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
