export const config = {
  maxDuration: 10,
};

const DEFAULT_VAPID_PUBLIC_KEY =
  'BCO8ctQzOuEy5cjjPOLGmTlFYT6R9DsKVwl-3w-d3oSLxhNGbYgrwBebZbtMj87nCIf1RnlzTg6OZ0zPrrFCik0';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
  return res.status(200).json({ publicKey });
}
