import crypto from 'crypto';

export const config = {
  maxDuration: 10,
};

const DEFAULT_VAPID_PUBLIC_KEY =
  'BMptIjvgQvgCz_FIAJwTSsva0CBO8NuTv38W_ZZDDo_AyJ291ger8PUsNXhLCp1l0--CGT5mK8SASHEbd3qTGAw';

function getSanitizedPublicKey(): { valid: boolean; publicKey: string; error?: string } {
  let rawPub = process.env.VAPID_PUBLIC_KEY || '';
  let rawPriv = process.env.VAPID_PRIVATE_KEY || '';

  let cleanPub = rawPub.replace(/^[\"\'\s{]+|[\"\'\s,}]+$/g, '').trim();
  let cleanPriv = rawPriv.replace(/^[\"\'\s{]+|[\"\'\s,}]+$/g, '').trim();

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
