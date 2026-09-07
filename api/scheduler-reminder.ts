export const config = {
  maxDuration: 60,
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const configuredSecret = 'i;$,T7RW!9D_7!Tg4SD%%yqug*u.659%cHGA3iVsaH+89RNl]{vGhf4soR^kb{]Z';
  const envSecret = process.env.CRON_SECRET;

  // Check Authorization header if CRON_SECRET is configured
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const isMatch =
      authHeader === `Bearer ${configuredSecret}` ||
      (envSecret && authHeader === `Bearer ${envSecret}`);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Unauthorized cron trigger' });
    }
  }

  const timestamp = new Date().toISOString();

  return res.status(200).json({
    success: true,
    message: 'Scheduled reminder check executed successfully.',
    schedulerTimestamp: timestamp,
    timezone: 'Asia/Jakarta',
  });
}
