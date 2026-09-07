import { getSanitizedVapidConfig } from './vapidHelper';

export const config = {
  maxDuration: 10,
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const vapid = getSanitizedVapidConfig();
  if (!vapid.valid) {
    return res.status(500).json({
      success: false,
      code: 'VAPID_CONFIG_INVALID',
      error: vapid.error || 'VAPID configuration is invalid on server',
    });
  }

  return res.status(200).json({
    success: true,
    publicKey: vapid.publicKey,
  });
}
