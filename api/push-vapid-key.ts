import crypto from 'crypto';

export const config = {
  maxDuration: 10,
};

const DEFAULT_VAPID_PUBLIC_KEY =
  'BEk5RLnA1i1q0LMu4blSJm_idocAdTq_DKHAMv3AFciSFe_VoyiDoQD4KtnO5GscLqZwFrpbyUODkaK6K_56uf4';

function getSanitizedPublicKey(): { valid: boolean; publicKey: string; error?: string } {
  let rawPub = process.env.VAPID_PUBLIC_KEY || '';
  let rawPriv = process.env.VAPID_PRIVATE_KEY || '';

  let cleanPub = rawPub.replace(/^[\"\'\s{]+|[\"\'\s,}]+$/g, '').trim();
  let cleanPriv = rawPriv.replace(/^[\"\'\s{]+|[\"\'\s,}]+$/g, '').trim();

  // If environment still has the previous deprecated key, prefer the updated default key
  if (cleanPub.startsWith('BMptIjvg') || cleanPriv.includes('jfvJobsiKmPMn98w9aVg')) {
    cleanPub = DEFAULT_VAPID_PUBLIC_KEY;
    cleanPriv = '';
  }

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
      if (jwk.x && jwk.y) {
        const xBuf = Buffer.from(jwk.x, 'base64url');
        const yBuf = Buffer.from(jwk.y, 'base64url');
        derivedPubKey = Buffer.concat([Buffer.from([0x04]), xBuf, yBuf]).toString('base64url');
      }
    } catch (e) {
      // Use fallback
    }
  }

  const finalKey = cleanPub || derivedPubKey || DEFAULT_VAPID_PUBLIC_KEY;
  return { valid: true, publicKey: finalKey };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { valid, publicKey, error } = getSanitizedPublicKey();
  if (!valid) {
    return res.status(500).json({
      success: false,
      code: 'VAPID_CONFIG_INVALID',
      error: error || 'VAPID configuration is invalid on server',
    });
  }

  return res.status(200).json({
    success: true,
    publicKey,
  });
}
